// Base de datos: una sola tabla, `dibujos`, en Turso (libSQL, que es SQLite en la nube).
//
//   fecha   'AAAA-MM-DD'
//   quien   'uno' | 'dos'            (la clave primaria es fecha + quien:
//                                      una persona solo puede tener un dibujo por día)
//   imagen  BLOB  WebP comprimido, ~20-40 KB
//   mini    BLOB  WebP miniatura para el calendario, ~2-4 KB
//   creado  texto ISO con la hora en que se terminó
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

const aBuffer = (valor) => (valor == null ? null : Buffer.from(valor));

function abrir({ url, authToken }) {
  if (url.startsWith('file:')) {
    const ruta = url.slice('file:'.length);
    if (ruta && ruta !== ':memory:') fs.mkdirSync(path.dirname(path.resolve(ruta)), { recursive: true });
  }
  const db = createClient({ url, authToken });
  let listo = null;

  // La tabla se crea sola la primera vez que se usa.
  const iniciar = () => {
    if (!listo) {
      listo = db.execute(TABLA).catch((err) => { listo = null; throw err; });
    }
    return listo;
  };

  return {
    iniciar,

    // Lo que necesita la pantalla "Hoy": quién terminó hoy y qué días completaron los dos.
    async resumenDeHoy(fecha) {
      await iniciar();
      const [hoy, completos] = await db.batch([
        { sql: 'SELECT quien, creado FROM dibujos WHERE fecha = ?', args: [fecha] },
        { sql: 'SELECT fecha FROM dibujos GROUP BY fecha HAVING COUNT(*) = 2 ORDER BY fecha DESC LIMIT 400', args: [] },
      ], 'read');
      return {
        deHoy: hoy.rows.map((r) => ({ quien: r.quien, creado: r.creado })),
        fechasCompletas: completos.rows.map((r) => r.fecha),
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

    // Año nuevo: borra todo lo anterior a `fecha` (por ejemplo '2027-01-01').
    async borrarAntesDe(fecha) {
      await iniciar();
      const r = await db.execute({ sql: 'DELETE FROM dibujos WHERE fecha < ?', args: [fecha] });
      return r.rowsAffected;
    },

    // Solo para las pruebas.
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
