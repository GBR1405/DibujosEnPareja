// Base de datos: los dibujos van en una sola tabla, `dibujos`, en Turso (libSQL, que es SQLite en la nube).
//
//   fecha   'AAAA-MM-DD'
//   quien   'uno' | 'dos'            (la clave primaria es fecha + quien:
//                                      una persona solo puede tener un dibujo por día)
//   imagen  BLOB  WebP comprimido, ~20-40 KB
//   mini    BLOB  WebP miniatura para el calendario, ~2-4 KB
//   creado  texto ISO con la hora en que se terminó
//
// Las reacciones y notitas que cada quien deja en el dibujo de su pareja:
//   reacciones     una fila por dibujo (fecha + quien es el DUEÑO del dibujo; la escribe
//                  la otra persona): un emoji y/o un comentario cortito
//
// Y dos tablas pequeñas para los avisos al teléfono:
//   avisos         un aparato que quiere recibir avisos (uno por endpoint; una persona
//                  puede tener varios: teléfono, iPad…)
//   recordatorios  los días en que ya se mandó el recordatorio del mediodía
//
// En tu computadora, si no defines TURSO_DATABASE_URL, usa un archivo SQLite local.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');

const TABLA = `
  CREATE TABLE IF NOT EXISTS dibujos (
    fecha  TEXT NOT NULL,
    quien  TEXT NOT NULL,
    imagen BLOB NOT NULL,
    mini   BLOB NOT NULL,
    creado TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`;

const TABLA_AVISOS = `
  CREATE TABLE IF NOT EXISTS avisos (
    endpoint TEXT PRIMARY KEY,
    quien    TEXT NOT NULL,
    p256dh   TEXT NOT NULL,
    auth     TEXT NOT NULL,
    creado   TEXT NOT NULL
  )`;

const TABLA_REACCIONES = `
  CREATE TABLE IF NOT EXISTS reacciones (
    fecha       TEXT NOT NULL,
    quien       TEXT NOT NULL,
    reaccion    TEXT,
    comentario  TEXT,
    actualizado TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`;

const TABLA_RECORDATORIOS = 'CREATE TABLE IF NOT EXISTS recordatorios (fecha TEXT PRIMARY KEY)';

// Más que esto por persona es basura vieja (aparatos que ya no se usan).
const MAX_APARATOS = 10;

const filaReaccion = (f) => ({ fecha: f.fecha, quien: f.quien, reaccion: f.reaccion || null, comentario: f.comentario || null });

const aBuffer = (valor) => (valor == null ? null : Buffer.from(valor));

function abrir({ url, authToken }) {
  if (url.startsWith('file:')) {
    const ruta = url.slice('file:'.length);
    if (ruta && ruta !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  }
  const db = createClient({ url, authToken });
  let listo = null;

  // Las tablas se crean solas la primera vez que se usan.
  const iniciar = () => {
    if (!listo) {
      listo = db.batch([TABLA, TABLA_REACCIONES, TABLA_AVISOS, TABLA_RECORDATORIOS], 'write').catch((err) => { listo = null; throw err; });
    }
    return listo;
  };

  return {
    iniciar,

    // Lo que necesita la pantalla "Hoy": quién terminó hoy, qué días completaron los dos
    // y las reacciones de hoy.
    async resumenDeHoy(fecha) {
      await iniciar();
      const [hoy, completos, reacciones] = await db.batch([
        { sql: 'SELECT quien, creado FROM dibujos WHERE fecha = ?', args: [fecha] },
        { sql: 'SELECT fecha FROM dibujos GROUP BY fecha HAVING COUNT(*) = 2 ORDER BY fecha DESC LIMIT 400', args: [] },
        { sql: 'SELECT fecha, quien, reaccion, comentario FROM reacciones WHERE fecha = ?', args: [fecha] },
      ], 'read');
      return {
        deHoy: hoy.rows.map((r) => ({ quien: r.quien, creado: r.creado })),
        fechasCompletas: completos.rows.map((r) => r.fecha),
        reacciones: reacciones.rows.map(filaReaccion),
      };
    },

    // Guarda un dibujo. Devuelve false si esa persona ya había terminado ese día.
    async guardar({ fecha, quien, imagen, mini }) {
      await iniciar();
      const r = await db.execute({
        sql: `INSERT INTO dibujos (fecha, quien, imagen, mini, creado) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (fecha, quien) DO NOTHING`,
        args: [fecha, quien, imagen, mini, new Date().toISOString()],
      });
      return r.rowsAffected === 1;
    },

    // Una imagen, junto con si `yo` ya terminó su dibujo de ese día
    // (el servidor lo necesita para decidir si puede ver la de la pareja).
    async leerImagen({ fecha, quien, yo, mini }) {
      await iniciar();
      const columna = mini ? 'mini' : 'imagen';
      const r = await db.execute({
        sql: `SELECT ${columna} AS datos, creado,
                (SELECT COUNT(*) FROM dibujos m WHERE m.fecha = d.fecha AND m.quien = ?) AS tengoMio
              FROM dibujos d WHERE d.fecha = ? AND d.quien = ?`,
        args: [yo, fecha, quien],
      });
      if (r.rows.length === 0) return null;
      const fila = r.rows[0];
      return { datos: aBuffer(fila.datos), creado: fila.creado, tengoMio: Number(fila.tengoMio) > 0 };
    },

    // Todo un mes (miniaturas incluidas) en una sola consulta.
    async mes(anio, mes) {
      await iniciar();
      const pref = `${anio}-${String(mes).padStart(2, '0')}`;
      const r = await db.execute({
        sql: 'SELECT fecha, quien, creado, mini FROM dibujos WHERE fecha >= ? AND fecha <= ? ORDER BY fecha',
        args: [`${pref}-01`, `${pref}-31`],
      });
      return r.rows.map((f) => ({ fecha: f.fecha, quien: f.quien, creado: f.creado, mini: aBuffer(f.mini) }));
    },

    // Las reacciones de un rango de fechas (para el calendario).
    async reaccionesEntre(desde, hasta) {
      await iniciar();
      const r = await db.execute({
        sql: 'SELECT fecha, quien, reaccion, comentario FROM reacciones WHERE fecha >= ? AND fecha <= ?',
        args: [desde, hasta],
      });
      return r.rows.map(filaReaccion);
    },

    // La reacción que tiene el dibujo de `quien` ese día (null si no tiene).
    async reaccionDe(fecha, quien) {
      await iniciar();
      const r = await db.execute({
        sql: 'SELECT fecha, quien, reaccion, comentario FROM reacciones WHERE fecha = ? AND quien = ?',
        args: [fecha, quien],
      });
      return r.rows.length ? filaReaccion(r.rows[0]) : null;
    },

    // Guarda la reacción del dibujo de `quien`. Sin emoji ni comentario, se borra.
    async guardarReaccion({ fecha, quien, reaccion, comentario }) {
      await iniciar();
      if (!reaccion && !comentario) {
        await db.execute({ sql: 'DELETE FROM reacciones WHERE fecha = ? AND quien = ?', args: [fecha, quien] });
        return;
      }
      await db.execute({
        sql: `INSERT INTO reacciones (fecha, quien, reaccion, comentario, actualizado) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT (fecha, quien) DO UPDATE SET
                reaccion = excluded.reaccion, comentario = excluded.comentario, actualizado = excluded.actualizado`,
        args: [fecha, quien, reaccion || null, comentario || null, new Date().toISOString()],
      });
    },

    // Año nuevo: borra todo lo anterior a `fecha` (por ejemplo '2027-01-01'), con sus
    // reacciones. Devuelve cuántos dibujos borró.
    async borrarAntesDe(fecha) {
      await iniciar();
      const [r] = await db.batch([
        { sql: 'DELETE FROM dibujos WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM reacciones WHERE fecha < ?', args: [fecha] },
      ], 'write');
      return r.rowsAffected;
    },

    // Quiénes ya terminaron su dibujo ese día: ['uno'], ['uno', 'dos']…
    async terminaronEl(fecha) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT quien FROM dibujos WHERE fecha = ?', args: [fecha] });
      return r.rows.map((f) => f.quien);
    },

    // ------------------------------------------------------------ avisos
    // Guarda el aparato para `quien`. Si ese endpoint ya estaba (aunque fuera de la
    // otra cuenta), se actualiza: un aparato recibe los avisos de quien entró en él.
    async guardarAparato({ endpoint, quien, p256dh, auth }) {
      await iniciar();
      await db.batch([
        {
          sql: `INSERT INTO avisos (endpoint, quien, p256dh, auth, creado) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (endpoint) DO UPDATE SET
                  quien = excluded.quien, p256dh = excluded.p256dh, auth = excluded.auth, creado = excluded.creado`,
          args: [endpoint, quien, p256dh, auth, new Date().toISOString()],
        },
        {
          sql: `DELETE FROM avisos WHERE quien = ? AND endpoint NOT IN
                  (SELECT endpoint FROM avisos WHERE quien = ? ORDER BY creado DESC LIMIT ${MAX_APARATOS})`,
          args: [quien, quien],
        },
      ], 'write');
    },

    // Borra un aparato. Con `quien`, solo si es de esa persona. Devuelve cuántos borró.
    async borrarAparato(endpoint, quien = null) {
      await iniciar();
      const r = quien
        ? await db.execute({ sql: 'DELETE FROM avisos WHERE endpoint = ? AND quien = ?', args: [endpoint, quien] })
        : await db.execute({ sql: 'DELETE FROM avisos WHERE endpoint = ?', args: [endpoint] });
      return r.rowsAffected;
    },

    // Los aparatos de una persona, con el formato que pide web-push.
    async aparatosDe(quien) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT endpoint, p256dh, auth FROM avisos WHERE quien = ? ORDER BY creado', args: [quien] });
      return r.rows.map((f) => ({ endpoint: f.endpoint, keys: { p256dh: f.p256dh, auth: f.auth } }));
    },

    // Apunta que el recordatorio de `fecha` ya salió. Devuelve false si ya estaba
    // apuntado (el cron se ejecutó dos veces): así nunca se manda dos veces el mismo día.
    // De paso borra los de hace más de una semana, que ya no sirven.
    async marcarRecordatorio(fecha, semanaPasada) {
      await iniciar();
      const [r] = await db.batch([
        { sql: 'INSERT INTO recordatorios (fecha) VALUES (?) ON CONFLICT (fecha) DO NOTHING', args: [fecha] },
        { sql: 'DELETE FROM recordatorios WHERE fecha < ?', args: [semanaPasada] },
      ], 'write');
      return r.rowsAffected === 1;
    },

    // Solo para las pruebas.
    async borrarDibujo({ fecha, quien }) {
      await iniciar();
      await db.execute({ sql: 'DELETE FROM dibujos WHERE fecha = ? AND quien = ?', args: [fecha, quien] });
    },
    async contar() {
      await iniciar();
      const r = await db.execute('SELECT COUNT(*) AS n FROM dibujos');
      return Number(r.rows[0].n);
    },
    async insertarCrudo({ fecha, quien, imagen, mini, creado }) {
      await iniciar();
      await db.execute({
        sql: 'INSERT INTO dibujos (fecha, quien, imagen, mini, creado) VALUES (?, ?, ?, ?, ?)',
        args: [fecha, quien, imagen, mini, creado || new Date().toISOString()],
      });
    },
    cerrar: () => db.close(),
  };
}

module.exports = { abrir };
