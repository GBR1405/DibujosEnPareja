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
// Los comodines que cada quien usó para recuperar un día que se le pasó:
//   comodines      fecha + quien del dibujo recuperado, y el mes en que se usó
//
// Y dos tablas pequeñas para los avisos al teléfono:
//   avisos         un aparato que quiere recibir avisos (uno por endpoint; una persona
//                  puede tener varios: teléfono, iPad…)
//   recordatorios  los días en que ya se mandó el recordatorio del mediodía
//
// Y lo nuevo (todo se crea solo):
//   pospuestos      los días que alguien pospuso su dibujo (motivo, de 1 a 10 y por qué)
//   animos          quién le mandó ánimos a quién (uno por día)
//   temas_elegidos  temas que eligió alguien en el reto "Tú eliges el tema"
//   retos           el reto de cada semana: lo que cada quien ha hecho (JSON)
//   retos_imagenes  los dibujos de los retos
//   monedas         la alcancía de los dos: cada ganancia o gasto, con una clave única
//   muebles         los muebles comprados (los que no tienen lugar están guardados)
//   casa_ajustes    la pintura y el piso elegidos
//   avatares        el personaje que dibujó cada quien
//   respuestas      la pregunta del día
//   cartas          las cartitas "Ábrela cuando…"
//   recuerdos       la galaxia: los recuerdos (con su foto en WebP)
//   frases          la galaxia: las frases del frasco de estrellas
//   estrellas       la galaxia: la estrella del día que atrapó cada quien (y su sticker)
//   galaxia_datos   la galaxia: lo que se recuerda de los juegos
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

// Los comodines usados: qué día se recuperó y en qué mes (para calcular el saldo).
const TABLA_COMODINES = `
  CREATE TABLE IF NOT EXISTS comodines (
    fecha TEXT NOT NULL,
    quien TEXT NOT NULL,
    mes   TEXT NOT NULL,
    usado TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`;

const TABLA_RECORDATORIOS = 'CREATE TABLE IF NOT EXISTS recordatorios (fecha TEXT PRIMARY KEY)';

const TABLAS_NUEVAS = [
  `CREATE TABLE IF NOT EXISTS pospuestos (
    fecha  TEXT NOT NULL,
    quien  TEXT NOT NULL,
    motivo TEXT NOT NULL,
    nivel  INTEGER NOT NULL,
    texto  TEXT NOT NULL,
    creado TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`,
  'CREATE TABLE IF NOT EXISTS animos (fecha TEXT NOT NULL, de TEXT NOT NULL, PRIMARY KEY (fecha, de))',
  'CREATE TABLE IF NOT EXISTS temas_elegidos (fecha TEXT PRIMARY KEY, tema TEXT NOT NULL, quien TEXT NOT NULL, creado TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS retos (
    semana      TEXT PRIMARY KEY,
    tipo        TEXT NOT NULL,
    datos       TEXT NOT NULL,
    completado  TEXT,
    actualizado TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS retos_imagenes (
    semana TEXT NOT NULL,
    clave  TEXT NOT NULL,
    imagen BLOB NOT NULL,
    mini   BLOB NOT NULL,
    creado TEXT NOT NULL,
    PRIMARY KEY (semana, clave)
  )`,
  `CREATE TABLE IF NOT EXISTS monedas (
    clave    TEXT PRIMARY KEY,
    quien    TEXT,
    cantidad INTEGER NOT NULL,
    motivo   TEXT NOT NULL,
    creado   TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS muebles (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo   TEXT NOT NULL,
    x      INTEGER,
    z      INTEGER,
    rot    INTEGER NOT NULL DEFAULT 0,
    pared  TEXT,
    piso   INTEGER NOT NULL DEFAULT 0,
    dibujo TEXT,
    quien  TEXT NOT NULL,
    creado TEXT NOT NULL
  )`,
  'CREATE TABLE IF NOT EXISTS casa_ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL)',
  'CREATE TABLE IF NOT EXISTS avatares (quien TEXT PRIMARY KEY, imagen BLOB NOT NULL, actualizado TEXT NOT NULL)',
  `CREATE TABLE IF NOT EXISTS respuestas (
    fecha  TEXT NOT NULL,
    quien  TEXT NOT NULL,
    texto  TEXT NOT NULL,
    creado TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`,
  // ---- la galaxia
  `CREATE TABLE IF NOT EXISTS recuerdos (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    quien  TEXT NOT NULL,
    titulo TEXT NOT NULL,
    texto  TEXT,
    fecha  TEXT,
    foto   BLOB,
    mini   BLOB,
    creado TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS frases (
    id     INTEGER PRIMARY KEY AUTOINCREMENT,
    de     TEXT NOT NULL,
    para   TEXT NOT NULL,
    texto  TEXT NOT NULL,
    creado TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS estrellas (
    fecha   TEXT NOT NULL,
    quien   TEXT NOT NULL,
    sticker INTEGER NOT NULL,
    creado  TEXT NOT NULL,
    PRIMARY KEY (fecha, quien)
  )`,
  'CREATE TABLE IF NOT EXISTS galaxia_datos (quien TEXT NOT NULL, clave TEXT NOT NULL, valor TEXT NOT NULL, PRIMARY KEY (quien, clave))',
  `CREATE TABLE IF NOT EXISTS cartas (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    de      TEXT NOT NULL,
    para    TEXT NOT NULL,
    cuando  TEXT NOT NULL,
    fecha   TEXT,
    texto   TEXT NOT NULL,
    color   TEXT NOT NULL,
    creado  TEXT NOT NULL,
    abierta TEXT
  )`,
];

const filaPospuesto = (f) => ({ fecha: f.fecha, quien: f.quien, motivo: f.motivo, nivel: Number(f.nivel), texto: f.texto });
const filaMueble = (f) => ({
  id: Number(f.id), tipo: f.tipo, x: f.x == null ? null : Number(f.x), z: f.z == null ? null : Number(f.z),
  rot: Number(f.rot) || 0, pared: f.pared || null, piso: Number(f.piso) || 0, dibujo: f.dibujo || null, quien: f.quien,
});
const filaCarta = (f) => ({
  id: Number(f.id), de: f.de, para: f.para, cuando: f.cuando, fecha: f.fecha || null, texto: f.texto,
  color: f.color, creado: f.creado, abierta: f.abierta || null,
});
const ahoraISO = () => new Date().toISOString();

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
      listo = db.batch([TABLA, TABLA_REACCIONES, TABLA_COMODINES, TABLA_AVISOS, TABLA_RECORDATORIOS, ...TABLAS_NUEVAS], 'write')
        // Las casas de antes del segundo piso no tenían la columna `piso` (si ya está, falla y no pasa nada).
        .then(() => db.execute('ALTER TABLE muebles ADD COLUMN piso INTEGER NOT NULL DEFAULT 0').catch(() => {}))
        .catch((err) => { listo = null; throw err; });
    }
    return listo;
  };

  return {
    iniciar,

    // Lo que necesita la pantalla "Hoy": quién terminó hoy, qué días completaron los dos,
    // las reacciones de hoy, quién dibujó y quién pospuso desde `desde` (para la racha
    // congelada) y cuántas monedas hay en la alcancía.
    async resumenDeHoy(fecha, desde = fecha) {
      await iniciar();
      const [hoy, completos, reacciones, recientes, pospuestos, saldo] = await db.batch([
        { sql: 'SELECT quien, creado FROM dibujos WHERE fecha = ?', args: [fecha] },
        { sql: 'SELECT fecha FROM dibujos GROUP BY fecha HAVING COUNT(*) = 2 ORDER BY fecha DESC LIMIT 400', args: [] },
        { sql: 'SELECT fecha, quien, reaccion, comentario FROM reacciones WHERE fecha = ?', args: [fecha] },
        { sql: 'SELECT fecha, quien FROM dibujos WHERE fecha >= ? AND fecha <= ?', args: [desde, fecha] },
        { sql: 'SELECT fecha, quien, motivo, nivel, texto FROM pospuestos WHERE fecha >= ? AND fecha <= ?', args: [desde, fecha] },
        { sql: 'SELECT COALESCE(SUM(cantidad), 0) AS n FROM monedas', args: [] },
      ], 'read');
      return {
        deHoy: hoy.rows.map((r) => ({ quien: r.quien, creado: r.creado })),
        fechasCompletas: completos.rows.map((r) => r.fecha),
        reacciones: reacciones.rows.map(filaReaccion),
        recientes: recientes.rows.map((r) => ({ fecha: r.fecha, quien: r.quien })),
        pospuestos: pospuestos.rows.map(filaPospuesto),
        saldo: Number(saldo.rows[0].n),
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

    // Recupera un día con un comodín: guarda el dibujo y anota el comodín, juntos. El
    // comodín solo se anota si el dibujo de verdad se guardó (si ya existía, no se gasta).
    async guardarConComodin({ fecha, quien, imagen, mini, mes }) {
      await iniciar();
      const creado = new Date().toISOString();
      const [r] = await db.batch([
        {
          sql: `INSERT INTO dibujos (fecha, quien, imagen, mini, creado) VALUES (?, ?, ?, ?, ?)
                ON CONFLICT (fecha, quien) DO NOTHING`,
          args: [fecha, quien, imagen, mini, creado],
        },
        {
          sql: `INSERT INTO comodines (fecha, quien, mes, usado)
                SELECT ?, ?, ?, ? WHERE (SELECT creado FROM dibujos WHERE fecha = ? AND quien = ?) = ?
                ON CONFLICT (fecha, quien) DO NOTHING`,
          args: [fecha, quien, mes, creado, fecha, quien, creado],
        },
      ], 'write');
      return r.rowsAffected === 1;
    },

    // Lo necesario para los comodines de `quien`: qué días dibujó entre `desde` y `hasta`,
    // desde cuándo existen dibujos, y en qué meses usó comodines.
    async estadoComodines(quien, desde, hasta) {
      await iniciar();
      const [dibujados, primera, usos, pospuestos] = await db.batch([
        { sql: 'SELECT fecha FROM dibujos WHERE quien = ? AND fecha >= ? AND fecha <= ?', args: [quien, desde, hasta] },
        { sql: 'SELECT MIN(fecha) AS primera FROM dibujos', args: [] },
        { sql: 'SELECT mes FROM comodines WHERE quien = ?', args: [quien] },
        { sql: 'SELECT fecha, quien, motivo, nivel, texto FROM pospuestos WHERE quien = ? AND fecha >= ? AND fecha <= ?', args: [quien, desde, hasta] },
      ], 'read');
      return {
        dibujados: dibujados.rows.map((f) => f.fecha),
        primera: primera.rows[0] ? primera.rows[0].primera || null : null,
        usos: usos.rows.map((f) => f.mes),
        pospuestos: pospuestos.rows.map(filaPospuesto),
      };
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

    // Todo un mes (miniaturas incluidas) en una sola consulta, y si cada dibujo se
    // recuperó con un comodín.
    async mes(anio, mes) {
      await iniciar();
      const pref = `${anio}-${String(mes).padStart(2, '0')}`;
      const r = await db.execute({
        sql: `SELECT d.fecha, d.quien, d.creado, d.mini,
                EXISTS (SELECT 1 FROM comodines c WHERE c.fecha = d.fecha AND c.quien = d.quien) AS recuperado
              FROM dibujos d WHERE d.fecha >= ? AND d.fecha <= ? ORDER BY d.fecha`,
        args: [`${pref}-01`, `${pref}-31`],
      });
      return r.rows.map((f) => ({
        fecha: f.fecha, quien: f.quien, creado: f.creado, mini: aBuffer(f.mini), recuperado: Number(f.recuperado) > 0,
      }));
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
      // Los retos se borran cuando ya terminó su semana (la que cruza el año, sigue).
      const [a, m, d] = fecha.split('-').map(Number);
      const semanaVieja = new Date(Date.UTC(a, m - 1, d - 6)).toISOString().slice(0, 10);
      const [r] = await db.batch([
        { sql: 'DELETE FROM dibujos WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM reacciones WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM pospuestos WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM animos WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM temas_elegidos WHERE fecha < ?', args: [fecha] },
        { sql: 'DELETE FROM retos WHERE semana < ?', args: [semanaVieja] },
        { sql: 'DELETE FROM retos_imagenes WHERE semana < ?', args: [semanaVieja] },
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

    // ------------------------------------------------------------ posponer
    async pospuestosEntre(desde, hasta) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT fecha, quien, motivo, nivel, texto FROM pospuestos WHERE fecha >= ? AND fecha <= ?', args: [desde, hasta] });
      return r.rows.map(filaPospuesto);
    },

    // Devuelve false si ya lo había pospuesto ese día.
    async guardarPospuesto({ fecha, quien, motivo, nivel, texto }) {
      await iniciar();
      const r = await db.execute({
        sql: `INSERT INTO pospuestos (fecha, quien, motivo, nivel, texto, creado) VALUES (?, ?, ?, ?, ?, ?)
              ON CONFLICT (fecha, quien) DO NOTHING`,
        args: [fecha, quien, motivo, nivel, texto, ahoraISO()],
      });
      return r.rowsAffected === 1;
    },

    // "Mandar ánimos" una vez al día. Devuelve false si ya los había mandado.
    async marcarAnimos(fecha, de) {
      await iniciar();
      const r = await db.execute({ sql: 'INSERT INTO animos (fecha, de) VALUES (?, ?) ON CONFLICT DO NOTHING', args: [fecha, de] });
      return r.rowsAffected === 1;
    },

    // ------------------------------------------------------------ temas elegidos
    async temasElegidosEntre(desde, hasta) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT fecha, tema, quien FROM temas_elegidos WHERE fecha >= ? AND fecha <= ?', args: [desde, hasta] });
      return r.rows.map((f) => ({ fecha: f.fecha, tema: f.tema, quien: f.quien }));
    },

    // ------------------------------------------------------------ retos
    async leerReto(semana) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT semana, tipo, datos, completado, actualizado FROM retos WHERE semana = ?', args: [semana] });
      if (!r.rows.length) return null;
      const f = r.rows[0];
      return { semana: f.semana, tipo: f.tipo, datos: JSON.parse(f.datos), completado: f.completado || null, actualizado: f.actualizado };
    },

    // Cambia lo guardado del reto de la semana con `cambiar(datos)`, que devuelve los datos
    // nuevos (o lanza un error con `.codigo` si no se puede). Si las dos personas guardan al
    // mismo tiempo, se vuelve a intentar con lo más nuevo: nada se pisa.
    // `extra` (opcional) son sentencias que se guardan juntas, solo si el cambio se guardó.
    async actualizarReto(semana, tipo, cambiar, { completo = () => false, extra = () => [] } = {}) {
      await iniciar();
      for (let intento = 0; intento < 5; intento += 1) {
        // eslint-disable-next-line no-await-in-loop
        const actual = (await this.leerReto(semana)) || { datos: {}, completado: null, actualizado: null };
        const datos = cambiar(JSON.parse(JSON.stringify(actual.datos)));
        const ahora = `${ahoraISO()}#${intento}${Math.random().toString(36).slice(2, 6)}`;
        const terminado = actual.completado || (completo(datos) ? ahoraISO() : null);
        const sentencia = actual.actualizado
          ? { sql: 'UPDATE retos SET datos = ?, completado = ?, actualizado = ? WHERE semana = ? AND actualizado = ?', args: [JSON.stringify(datos), terminado, ahora, semana, actual.actualizado] }
          : { sql: 'INSERT INTO retos (semana, tipo, datos, completado, actualizado) VALUES (?, ?, ?, ?, ?) ON CONFLICT (semana) DO NOTHING', args: [semana, tipo, JSON.stringify(datos), terminado, ahora] };
        // eslint-disable-next-line no-await-in-loop
        const [r] = await db.batch([sentencia], 'write');
        if (r.rowsAffected === 1) {
          const otras = extra(datos, { recienCompletado: !actual.completado && Boolean(terminado) });
          // eslint-disable-next-line no-await-in-loop
          if (otras.length) await db.batch(otras, 'write');
          return { datos, completado: terminado, recienCompletado: !actual.completado && Boolean(terminado) };
        }
      }
      const error = new Error('reto_ocupado');
      error.codigo = 'reto_ocupado';
      throw error;
    },

    // Guarda un dibujo del reto. Devuelve false si ese lugar ya tenía uno.
    async guardarImagenReto({ semana, clave, imagen, mini }) {
      await iniciar();
      const r = await db.execute({
        sql: 'INSERT INTO retos_imagenes (semana, clave, imagen, mini, creado) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING',
        args: [semana, clave, imagen, mini, ahoraISO()],
      });
      return r.rowsAffected === 1;
    },

    async leerImagenReto(semana, clave, mini = false) {
      await iniciar();
      const r = await db.execute({ sql: `SELECT ${mini ? 'mini' : 'imagen'} AS datos FROM retos_imagenes WHERE semana = ? AND clave = ?`, args: [semana, clave] });
      return r.rows.length ? aBuffer(r.rows[0].datos) : null;
    },

    // Las imágenes que tiene el reto de esa semana: { base: 'creado', final: 'creado' … }
    async imagenesDeReto(semana) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT clave, creado FROM retos_imagenes WHERE semana = ?', args: [semana] });
      return Object.fromEntries(r.rows.map((f) => [f.clave, f.creado]));
    },

    async retosAnteriores(antesDe, limite = 12) {
      await iniciar();
      const [retos, imagenes] = await db.batch([
        { sql: 'SELECT semana, tipo, datos, completado FROM retos WHERE semana < ? ORDER BY semana DESC LIMIT ?', args: [antesDe, limite] },
        { sql: 'SELECT semana, clave, creado FROM retos_imagenes WHERE semana < ?', args: [antesDe] },
      ], 'read');
      return retos.rows.map((f) => ({
        semana: f.semana,
        tipo: f.tipo,
        datos: JSON.parse(f.datos),
        completado: f.completado || null,
        imagenes: Object.fromEntries(imagenes.rows.filter((i) => i.semana === f.semana).map((i) => [i.clave, i.creado])),
      }));
    },

    // ------------------------------------------------------------ monedas
    // Anota ganancias (o gastos). Cada una tiene una clave única: si ya estaba, no se
    // vuelve a contar. Devuelve cuánto se sumó de verdad.
    async sumarMonedas(filas) {
      await iniciar();
      if (!filas.length) return 0;
      const creado = ahoraISO();
      const rs = await db.batch(filas.map((f) => ({
        sql: 'INSERT INTO monedas (clave, quien, cantidad, motivo, creado) VALUES (?, ?, ?, ?, ?) ON CONFLICT (clave) DO NOTHING',
        args: [f.clave, f.quien || null, f.cantidad, f.motivo, creado],
      })), 'write');
      return rs.reduce((suma, r, i) => suma + (r.rowsAffected === 1 ? filas[i].cantidad : 0), 0);
    },

    // Se asegura de que cada dibujo (y cada día en que dibujaron los dos) tenga su
    // ganancia anotada. Sirve para los dibujos de antes de que existiera la alcancía.
    async sincronizarMonedas({ dibujo, pareja }) {
      await iniciar();
      const creado = ahoraISO();
      await db.batch([
        {
          sql: `INSERT INTO monedas (clave, quien, cantidad, motivo, creado)
                SELECT 'dibujo:' || fecha || ':' || quien, quien, ?, 'dibujo', ? FROM dibujos WHERE true
                ON CONFLICT (clave) DO NOTHING`,
          args: [dibujo, creado],
        },
        {
          sql: `INSERT INTO monedas (clave, quien, cantidad, motivo, creado)
                SELECT 'pareja:' || fecha, NULL, ?, 'pareja', ? FROM dibujos WHERE true GROUP BY fecha HAVING COUNT(*) = 2
                ON CONFLICT (clave) DO NOTHING`,
          args: [pareja, creado],
        },
      ], 'write');
    },

    async saldo() {
      await iniciar();
      const r = await db.execute('SELECT COALESCE(SUM(cantidad), 0) AS n FROM monedas');
      return Number(r.rows[0].n);
    },

    async movimientos(limite = 12) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT clave, quien, cantidad, motivo, creado FROM monedas ORDER BY creado DESC, clave DESC LIMIT ?', args: [limite] });
      return r.rows.map((f) => ({ clave: f.clave, quien: f.quien || null, cantidad: Number(f.cantidad), motivo: f.motivo, creado: f.creado }));
    },

    // ------------------------------------------------------------ casa
    async muebles() {
      await iniciar();
      const r = await db.execute('SELECT id, tipo, x, z, rot, pared, piso, dibujo, quien FROM muebles ORDER BY id');
      return r.rows.map(filaMueble);
    },

    async mueble(id) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT id, tipo, x, z, rot, pared, piso, dibujo, quien FROM muebles WHERE id = ?', args: [id] });
      return r.rows.length ? filaMueble(r.rows[0]) : null;
    },

    // Compra: se anota el gasto y el mueble queda guardado (sin lugar), todo junto y solo
    // si alcanza la plata. Devuelve el id del mueble, o null si no alcanzó.
    async comprar({ tipo, precio, quien }) {
      await iniciar();
      const tx = await db.transaction('write');
      try {
        const s = await tx.execute('SELECT COALESCE(SUM(cantidad), 0) AS n FROM monedas');
        if (Number(s.rows[0].n) < precio) { await tx.rollback(); return null; }
        const creado = ahoraISO();
        const r = await tx.execute({ sql: 'INSERT INTO muebles (tipo, rot, quien, creado) VALUES (?, 0, ?, ?)', args: [tipo, quien, creado] });
        const id = Number(r.lastInsertRowid);
        if (precio > 0) {
          await tx.execute({ sql: 'INSERT INTO monedas (clave, quien, cantidad, motivo, creado) VALUES (?, ?, ?, ?, ?)', args: [`compra:${id}`, quien, -precio, `compra:${tipo}`, creado] });
        }
        await tx.commit();
        return id;
      } finally {
        tx.close();
      }
    },

    // Vende un mueble: se borra y se devuelve `reembolso`. Devuelve false si no existía.
    async vender({ id, reembolso, quien }) {
      await iniciar();
      const tx = await db.transaction('write');
      try {
        const r = await tx.execute({ sql: 'DELETE FROM muebles WHERE id = ?', args: [id] });
        if (r.rowsAffected !== 1) { await tx.rollback(); return false; }
        if (reembolso > 0) {
          await tx.execute({ sql: 'INSERT INTO monedas (clave, quien, cantidad, motivo, creado) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING', args: [`venta:${id}`, quien, reembolso, 'venta', ahoraISO()] });
        }
        await tx.commit();
        return true;
      } finally {
        tx.close();
      }
    },

    // Pone un mueble en un lugar (o lo guarda, con x = null).
    async moverMueble({ id, x, z, rot, pared, piso }) {
      await iniciar();
      const r = await db.execute({ sql: 'UPDATE muebles SET x = ?, z = ?, rot = ?, pared = ?, piso = ? WHERE id = ?', args: [x, z, rot || 0, pared || null, piso || 0, id] });
      return r.rowsAffected === 1;
    },

    async ponerDibujo(id, dibujo) {
      await iniciar();
      const r = await db.execute({ sql: 'UPDATE muebles SET dibujo = ? WHERE id = ?', args: [dibujo, id] });
      return r.rowsAffected === 1;
    },

    async ajustesCasa() {
      await iniciar();
      const r = await db.execute('SELECT clave, valor FROM casa_ajustes');
      return Object.fromEntries(r.rows.map((f) => [f.clave, f.valor]));
    },

    async guardarAjuste(clave, valor) {
      await iniciar();
      await db.execute({ sql: 'INSERT INTO casa_ajustes (clave, valor) VALUES (?, ?) ON CONFLICT (clave) DO UPDATE SET valor = excluded.valor', args: [clave, valor] });
    },

    // ------------------------------------------------------------ personajes
    async guardarAvatar(quien, imagen) {
      await iniciar();
      const actualizado = ahoraISO();
      await db.execute({
        sql: 'INSERT INTO avatares (quien, imagen, actualizado) VALUES (?, ?, ?) ON CONFLICT (quien) DO UPDATE SET imagen = excluded.imagen, actualizado = excluded.actualizado',
        args: [quien, imagen, actualizado],
      });
      return actualizado;
    },

    async leerAvatar(quien) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT imagen, actualizado FROM avatares WHERE quien = ?', args: [quien] });
      return r.rows.length ? { imagen: aBuffer(r.rows[0].imagen), actualizado: r.rows[0].actualizado } : null;
    },

    async versionesDeAvatares() {
      await iniciar();
      const r = await db.execute('SELECT quien, actualizado FROM avatares');
      return Object.fromEntries(r.rows.map((f) => [f.quien, f.actualizado]));
    },

    // ------------------------------------------------------------ pregunta del día
    async respuestasEntre(desde, hasta) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT fecha, quien, texto, creado FROM respuestas WHERE fecha >= ? AND fecha <= ? ORDER BY fecha DESC', args: [desde, hasta] });
      return r.rows.map((f) => ({ fecha: f.fecha, quien: f.quien, texto: f.texto, creado: f.creado }));
    },

    // Devuelve false si ya había respondido ese día.
    async guardarRespuesta({ fecha, quien, texto }) {
      await iniciar();
      const r = await db.execute({
        sql: 'INSERT INTO respuestas (fecha, quien, texto, creado) VALUES (?, ?, ?, ?) ON CONFLICT (fecha, quien) DO NOTHING',
        args: [fecha, quien, texto, ahoraISO()],
      });
      return r.rowsAffected === 1;
    },

    // ------------------------------------------------------------ cartitas
    async cartasDe(quien) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT * FROM cartas WHERE de = ? OR para = ? ORDER BY id DESC LIMIT 200', args: [quien, quien] });
      return r.rows.map(filaCarta);
    },

    async crearCarta({ de, para, cuando, fecha, texto, color }) {
      await iniciar();
      const r = await db.execute({
        sql: 'INSERT INTO cartas (de, para, cuando, fecha, texto, color, creado) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [de, para, cuando, fecha || null, texto, color, ahoraISO()],
      });
      return Number(r.lastInsertRowid);
    },

    async carta(id) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT * FROM cartas WHERE id = ?', args: [id] });
      return r.rows.length ? filaCarta(r.rows[0]) : null;
    },

    // La marca como abierta (solo la primera vez). Devuelve true si se abrió ahora.
    async abrirCarta(id) {
      await iniciar();
      const r = await db.execute({ sql: 'UPDATE cartas SET abierta = ? WHERE id = ? AND abierta IS NULL', args: [ahoraISO(), id] });
      return r.rowsAffected === 1;
    },

    // ------------------------------------------------------------ la galaxia
    // Los recuerdos (sin las fotos: esas se piden aparte), del más viejo al más nuevo.
    async recuerdos() {
      await iniciar();
      const r = await db.execute(`SELECT id, quien, titulo, texto, fecha, creado, foto IS NOT NULL AS tieneFoto
        FROM recuerdos ORDER BY COALESCE(fecha, substr(creado, 1, 10)), id`);
      return r.rows.map((f) => ({
        id: Number(f.id), quien: f.quien, titulo: f.titulo, texto: f.texto || '', fecha: f.fecha || null, creado: f.creado, foto: Number(f.tieneFoto) > 0,
      }));
    },

    async crearRecuerdo({ quien, titulo, texto, fecha, foto, mini }) {
      await iniciar();
      const r = await db.execute({
        sql: 'INSERT INTO recuerdos (quien, titulo, texto, fecha, foto, mini, creado) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [quien, titulo, texto || null, fecha || null, foto || null, mini || null, ahoraISO()],
      });
      return Number(r.lastInsertRowid);
    },

    // Solo quien lo escribió lo puede borrar. Devuelve true si se borró.
    async borrarRecuerdo(id, quien) {
      await iniciar();
      const r = await db.execute({ sql: 'DELETE FROM recuerdos WHERE id = ? AND quien = ?', args: [id, quien] });
      return r.rowsAffected === 1;
    },

    async fotoRecuerdo(id, mini = false) {
      await iniciar();
      const r = await db.execute({ sql: `SELECT ${mini ? 'mini' : 'foto'} AS datos, creado FROM recuerdos WHERE id = ?`, args: [id] });
      return r.rows.length && r.rows[0].datos != null ? aBuffer(r.rows[0].datos) : null;
    },

    async frases() {
      await iniciar();
      const r = await db.execute('SELECT id, de, para, texto, creado FROM frases ORDER BY id');
      return r.rows.map((f) => ({ id: Number(f.id), de: f.de, para: f.para, texto: f.texto, creado: f.creado }));
    },

    async crearFrase({ de, para, texto }) {
      await iniciar();
      const r = await db.execute({ sql: 'INSERT INTO frases (de, para, texto, creado) VALUES (?, ?, ?, ?)', args: [de, para, texto, ahoraISO()] });
      return Number(r.lastInsertRowid);
    },

    async borrarFrase(id, de) {
      await iniciar();
      const r = await db.execute({ sql: 'DELETE FROM frases WHERE id = ? AND de = ?', args: [id, de] });
      return r.rowsAffected === 1;
    },

    // Las estrellas del día que atrapó `quien` (con el sticker que le tocó a cada una).
    async estrellas(quien) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT fecha, sticker, creado FROM estrellas WHERE quien = ? ORDER BY fecha', args: [quien] });
      return r.rows.map((f) => ({ fecha: f.fecha, sticker: Number(f.sticker), creado: f.creado }));
    },

    // Anota la estrella de hoy. Devuelve false si ya la había atrapado.
    async atraparEstrella({ fecha, quien, sticker }) {
      await iniciar();
      const r = await db.execute({
        sql: 'INSERT INTO estrellas (fecha, quien, sticker, creado) VALUES (?, ?, ?, ?) ON CONFLICT (fecha, quien) DO NOTHING',
        args: [fecha, quien, sticker, ahoraISO()],
      });
      return r.rowsAffected === 1;
    },

    async datosGalaxia(quien) {
      await iniciar();
      const r = await db.execute({ sql: 'SELECT clave, valor FROM galaxia_datos WHERE quien = ?', args: [quien] });
      const datos = {};
      for (const f of r.rows) { try { datos[f.clave] = JSON.parse(f.valor); } catch { /* se ignora */ } }
      return datos;
    },

    async guardarDatoGalaxia(quien, clave, valor) {
      await iniciar();
      await db.execute({
        sql: 'INSERT INTO galaxia_datos (quien, clave, valor) VALUES (?, ?, ?) ON CONFLICT (quien, clave) DO UPDATE SET valor = excluded.valor',
        args: [quien, clave, JSON.stringify(valor)],
      });
    },

    // Solo para las pruebas.
    async insertarPospuesto({ fecha, quien, motivo = 'ocupado', nivel = 5, texto = 'prueba' }) {
      await iniciar();
      await db.execute({ sql: 'INSERT INTO pospuestos (fecha, quien, motivo, nivel, texto, creado) VALUES (?, ?, ?, ?, ?, ?)', args: [fecha, quien, motivo, nivel, texto, ahoraISO()] });
    },
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
