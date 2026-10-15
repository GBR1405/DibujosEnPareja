const path = require('path');
const crypto = require('crypto');
const express = require('express');

const config = require('./config');
const { abrir } = require('./lib/base');
const { comprimir } = require('./lib/imagen');
const { temaDelDia } = require('./lib/tema-del-dia');
const F = require('./lib/fecha');

// ---------------------------------------------------------------- arranque
const cuentas = config.cuentas;
const porId = new Map(cuentas.map((c) => [c.id, c]));
const parejaDe = (id) => cuentas.find((c) => c.id !== id).id;
const hoy = () => F.claveDeHoy(config.zonaHoraria);

const base = abrir(config.turso);

for (const c of cuentas) {
  if (!/^\d{4,8}$/.test(c.pin)) throw new Error(`El PIN de ${c.nombre} debe tener de 4 a 8 números.`);
}
if (cuentas.some((c) => config.pinesDeEjemplo.includes(c.pin))) {
  console.warn('⚠ Estás usando los PIN de ejemplo. Cámbialos con PIN_UNO y PIN_DOS (o en config.js).');
}

let SECRETO = config.secreto;
if (!SECRETO) {
  if (process.env.VERCEL) throw new Error('Falta la variable SECRETO. Mira el README, paso 3.');
  SECRETO = crypto.randomBytes(32).toString('hex');
  console.warn('⚠ Sin SECRETO: las sesiones se cierran cada vez que reinicias el servidor.');
}

// Revisa (una vez por instancia) si empezó un año nuevo y, si es así, borra el anterior.
let anioRevisado = null;
async function mantenimiento() {
  const fecha = hoy();
  const anio = F.anioDe(fecha);
  if (anioRevisado !== anio) {
    if (config.borrarAlEmpezarAnio) {
      const borrados = await base.borrarAntesDe(`${anio}-01-01`);
      if (borrados > 0) console.log(`🌱 Año nuevo (${anio}): se borraron ${borrados} dibujos del año anterior.`);
    }
    anioRevisado = anio;
  }
  return fecha;
}

// ---------------------------------------------------------------- sesiones
const COOKIE = 'garabatos';
const UN_ANIO_MS = 365 * 24 * 60 * 60 * 1000;

const firmar = (texto) => crypto.createHmac('sha256', SECRETO).update(texto).digest('base64url');

function crearToken(id) {
  const cuerpo = `${id}.${Date.now() + UN_ANIO_MS}`;
  return `${cuerpo}.${firmar(cuerpo)}`;
}

function leerToken(token) {
  const partes = String(token || '').split('.');
  if (partes.length !== 3) return null;
  const [id, caduca, firma] = partes;
  const esperada = Buffer.from(firmar(`${id}.${caduca}`));
  const recibida = Buffer.from(firma);
  if (esperada.length !== recibida.length || !crypto.timingSafeEqual(esperada, recibida)) return null;
  if (Number(caduca) < Date.now() || !porId.has(id)) return null;
  return id;
}

function leerCookie(req, nombre) {
  for (const trozo of (req.headers.cookie || '').split(';')) {
    const i = trozo.indexOf('=');
    if (i > -1 && trozo.slice(0, i).trim() === nombre) return decodeURIComponent(trozo.slice(i + 1).trim());
  }
  return null;
}

function requiereSesion(req, res, next) {
  const id = leerToken(leerCookie(req, COOKIE));
  if (!id) return res.status(401).json({ error: 'sin_sesion' });
  req.yo = id;
  return next();
}

// Frena a quien pruebe PIN a lo loco. Ojo: vive en la memoria de cada instancia del
// servidor (en Vercel puede haber varias), así que ayuda pero no es perfecto; por eso
// conviene usar PIN de 6 números o más y hay una pausa fija tras cada error.
const intentos = new Map();
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });
function segundosDeBloqueo(ip) {
  const e = intentos.get(ip);
  return e && e.hasta > Date.now() ? Math.ceil((e.hasta - Date.now()) / 1000) : 0;
}
function falloDePin(ip) {
  const e = intentos.get(ip) || { fallos: 0, hasta: 0, rondas: 0 };
  e.fallos += 1;
  if (e.fallos >= 5) {
    e.rondas += 1;
    e.hasta = Date.now() + Math.min(60_000 * 2 ** (e.rondas - 1), 15 * 60_000);
    e.fallos = 0;
  }
  intentos.set(ip, e);
  if (intentos.size > 500) intentos.delete(intentos.keys().next().value);
}
const pinCorrecto = (dado, real) => {
  const h = (t) => crypto.createHash('sha256').update(String(t)).digest();
  return crypto.timingSafeEqual(h(dado), h(real));
};

// ---------------------------------------------------------------- servidor
const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '3mb' }));

app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'same-origin',
    'Content-Security-Policy':
      "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; "
      + "script-src 'self'; connect-src 'self'; font-src 'self'; manifest-src 'self'; frame-ancestors 'none'",
  });
  next();
});

app.use('/api', async (req, res, next) => {
  req.hoy = await mantenimiento();
  next();
});

// Se puede terminar el dibujo de hoy o, si la medianoche te agarró dibujando, el de ayer
// (siempre que sea del mismo año).
const fechaPermitida = (fecha, h) => F.esFecha(fecha)
  && (fecha === h || (fecha === F.sumarDias(h, -1) && F.anioDe(fecha) === F.anioDe(h)));

app.get('/api/cuentas', (req, res) => {
  res.json({
    nombreApp: config.nombreApp,
    cuentas: cuentas.map(({ id, nombre, color, carita, pin }) => ({ id, nombre, color, carita, largoPin: pin.length })),
  });
});

app.post('/api/entrar', async (req, res) => {
  const bloqueo = segundosDeBloqueo(req.ip);
  if (bloqueo) return res.status(429).json({ error: 'demasiados_intentos', espera: bloqueo });

  const { id, pin } = req.body || {};
  const cuenta = porId.get(id);
  if (!cuenta || typeof pin !== 'string' || !pinCorrecto(pin, cuenta.pin)) {
    falloDePin(req.ip);
    await espera(700);
    return res.status(401).json({ error: 'pin_incorrecto', espera: segundosDeBloqueo(req.ip) });
  }
  intentos.delete(req.ip);
  res.cookie(COOKIE, crearToken(cuenta.id), {
    httpOnly: true, sameSite: 'lax', secure: req.secure, maxAge: UN_ANIO_MS, path: '/',
  });
  return res.json({ ok: true });
});

app.post('/api/salir', (req, res) => {
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Todo lo de abajo exige haber entrado.
app.use('/api', requiereSesion);

app.get('/api/yo', (req, res) => {
  const ver = ({ id, nombre, color, carita }) => ({ id, nombre, color, carita });
  res.json({ yo: ver(porId.get(req.yo)), pareja: ver(porId.get(parejaDe(req.yo))) });
});

// Días seguidos (hasta hoy, o hasta ayer si hoy aún no han terminado los dos).
function calcularRacha(fechas, fecha) {
  const completos = new Set(fechas);
  let dia = completos.has(fecha) ? fecha : F.sumarDias(fecha, -1);
  let n = 0;
  while (completos.has(dia) && n < 400) { n += 1; dia = F.sumarDias(dia, -1); }
  return n;
}

app.get('/api/hoy', async (req, res) => {
  const fecha = req.hoy;
  const otra = parejaDe(req.yo);
  const { deHoy, fechasCompletas } = await base.resumenDeHoy(fecha);
  const mio = deHoy.find((f) => f.quien === req.yo);
  const suyo = deHoy.find((f) => f.quien === otra);

  res.json({
    fecha,
    tema: temaDelDia(fecha),
    yoListo: Boolean(mio),
    parejaListo: Boolean(suyo),
    miV: mio ? mio.creado : null,
    // La pareja solo "se ve" cuando yo ya terminé el mío.
    parejaV: mio && suyo ? suyo.creado : null,
    racha: calcularRacha(fechasCompletas, fecha),
    anio: F.anioDe(fecha),
    diasParaReinicio: F.diasHastaFinDeAnio(fecha),
  });
});

app.post('/api/terminar', async (req, res) => {
  const { fecha, imagen } = req.body || {};
  if (!fechaPermitida(fecha, req.hoy)) return res.status(400).json({ error: 'fecha_invalida' });

  const m = /^data:image\/(?:png|webp|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(typeof imagen === 'string' && imagen.length < 2_800_000 ? imagen : '');
  if (!m) return res.status(400).json({ error: 'imagen_invalida' });

  const listo = await comprimir(Buffer.from(m[1], 'base64'), config.imagen);
  if (!listo) return res.status(400).json({ error: 'imagen_invalida' });

  const guardado = await base.guardar({ fecha, quien: req.yo, imagen: listo.imagen, mini: listo.mini });
  if (!guardado) return res.status(409).json({ error: 'ya_terminado' });
  return res.json({ ok: true, bytes: listo.imagen.length });
});

// Imagen de un día. ?mini=1 devuelve la miniatura. Se guarda en la caché del navegador
// "para siempre": un dibujo terminado nunca cambia.
app.get('/api/dibujo/:fecha/:quien', async (req, res) => {
  const { fecha, quien } = req.params;
  if (!F.esFecha(fecha) || !porId.has(quien)) return res.status(404).end();

  const fila = await base.leerImagen({ fecha, quien, yo: req.yo, mini: Boolean(req.query.mini) });
  if (!fila) return res.status(404).end();
  if (quien !== req.yo && !fila.tengoMio && fecha >= req.hoy) return res.status(403).end();

  res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=31536000, immutable' });
  return res.send(fila.datos);
});

// Un mes completo: los días con sus temas y las miniaturas, en una sola respuesta.
app.get('/api/mes/:mes', async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(req.params.mes);
  const anio = F.anioDe(req.hoy);
  if (!m || +m[1] !== anio || +m[2] < 1 || +m[2] > 12) return res.status(400).json({ error: 'mes_invalido' });

  const numero = +m[2];
  const filas = await base.mes(anio, numero);
  const porDia = new Map();
  for (const f of filas) {
    if (!porDia.has(f.fecha)) porDia.set(f.fecha, {});
    porDia.get(f.fecha)[f.quien] = f;
  }
  const otra = parejaDe(req.yo);
  const url = (buf) => `data:image/webp;base64,${buf.toString('base64')}`;

  const dias = [];
  for (let d = 1; d <= F.diasDelMes(anio, numero); d += 1) {
    const fecha = `${anio}-${String(numero).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const futuro = fecha > req.hoy;
    const reg = porDia.get(fecha) || {};
    const mio = reg[req.yo];
    const suyo = reg[otra];
    const visible = Boolean(suyo) && (Boolean(mio) || fecha < req.hoy);
    dias.push({
      fecha,
      futuro,
      tema: futuro ? null : temaDelDia(fecha),
      yo: mio ? { v: mio.creado, mini: url(mio.mini) } : null,
      pareja: suyo ? { v: suyo.creado, visible, mini: visible ? url(suyo.mini) : null } : null,
    });
  }
  res.json({ hoy: req.hoy, anio, dias });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'no_existe' }));

// ---------------------------------------------------------------- archivos
// En tu computadora los sirve Express; en Vercel los sirve su CDN desde public/.
app.use(express.static(path.join(__dirname, 'public'), {
  setHeaders(res, archivo) {
    res.set('Cache-Control', archivo.endsWith('.woff2') ? 'public, max-age=31536000, immutable' : 'no-cache');
  },
}));

app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  console.error(err);
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'imagen_muy_grande' });
  return res.status(500).json({ error: 'error_del_servidor' });
});

// ---------------------------------------------------------------- listo
// Vercel importa `app`; en tu computadora, `npm start` lo pone a escuchar.
if (require.main === module) {
  base.iniciar()
    .then(mantenimiento)
    .then(() => {
      app.listen(config.puerto, () => {
        console.log(`🖍  ${config.nombreApp} lista en http://localhost:${config.puerto}`);
        console.log(`    Base de datos: ${config.turso.url.startsWith('file:') ? `archivo local (${config.turso.url.slice(5)})` : 'Turso'}`);
      });
    })
    .catch((err) => { console.error('No se pudo iniciar:', err.message); process.exit(1); });
}

module.exports = app;
module.exports.app = app;
module.exports.base = base;
module.exports.mantenimiento = mantenimiento;
module.exports.reiniciarRevisionDeAnio = () => { anioRevisado = null; };
