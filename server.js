const path = require('path');
const crypto = require('crypto');
const express = require('express');

const config = require('./config');
const { abrir } = require('./lib/base');
const { comprimir } = require('./lib/imagen');
const { temaDelDia } = require('./lib/tema-del-dia');
const { crearAvisos } = require('./lib/avisos');
const { REACCIONES, reaccionPorId, LARGO_COMENTARIO } = require('./lib/reacciones');
const { crearRadio } = require('./lib/radio');
const F = require('./lib/fecha');

// ---------------------------------------------------------------- arranque
const cuentas = config.cuentas;
const porId = new Map(cuentas.map((c) => [c.id, c]));
const parejaDe = (id) => cuentas.find((c) => c.id !== id).id;
const hoy = () => F.claveDeHoy(config.zonaHoraria);

const base = abrir(config.turso);
const avisos = crearAvisos({ base, claves: config.avisos });
const radio = crearRadio();

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
// Compara dos textos tardando siempre lo mismo (no da pistas de cuánto se acertó).
const iguales = (dado, real) => {
  const h = (t) => crypto.createHash('sha256').update(String(t)).digest();
  return crypto.timingSafeEqual(h(dado), h(real));
};
const pinCorrecto = iguales;

// ---------------------------------------------------------------- avisos
const HORAS = 3600;

// Valida lo que manda el navegador al activar avisos (PushSubscription.toJSON()).
function leerAparato(cuerpo) {
  const { endpoint, keys } = cuerpo || {};
  if (typeof endpoint !== 'string' || endpoint.length > 2000) return null;
  let url;
  try { url = new URL(endpoint); } catch { return null; }
  if (url.protocol !== 'https:') return null;
  const clave = (t, max) => typeof t === 'string' && t.length <= max && /^[A-Za-z0-9_+/-]+={0,2}$/.test(t);
  if (!keys || !clave(keys.p256dh, 200) || !clave(keys.auth, 100)) return null;
  return { endpoint, p256dh: keys.p256dh, auth: keys.auth };
}

// Cuando alguien termina el dibujo de hoy, se le avisa a la otra persona.
function avisarALaPareja(yo, fecha) {
  const otra = parejaDe(yo);
  const nombre = porId.get(yo).nombre;
  return avisos.avisar(async () => {
    const yaDibujo = (await base.terminaronEl(fecha)).includes(otra);
    return [{
      quien: otra,
      mensaje: yaDibujo
        ? { titulo: `Ya puedes ver el dibujo de ${nombre} 💛`, texto: 'Ábrelo en Garabatos.', tag: 'pareja', ttl: 6 * HORAS }
        : { titulo: `${nombre} ya dibujó, ¡te toca! 🎨`, texto: `Hoy toca dibujar: ${temaDelDia(fecha)}.`, tag: 'pareja', ttl: 6 * HORAS },
    }];
  });
}

// ---------------------------------------------------------------- reacciones
// Lo que ve la app de una reacción: { reaccion, comentario }, o null si no hay nada.
// (Si alguien quitó un emoji de lib/reacciones.js, las reacciones viejas con él se ignoran.)
function verNota(fila) {
  const reaccion = fila && reaccionPorId(fila.reaccion) ? fila.reaccion : null;
  const comentario = (fila && fila.comentario) || null;
  return reaccion || comentario ? { reaccion, comentario } : null;
}

// La notita: una sola línea, sin espacios de más, y cortita.
function leerComentario(texto) {
  if (typeof texto !== 'string') return undefined;
  const limpio = texto.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
  return [...limpio].length <= LARGO_COMENTARIO ? limpio : undefined;
}

// Cuando alguien reacciona o deja una notita, se le avisa al dueño del dibujo. Quitar una
// reacción, o volver a poner la misma, no avisa. Si cambia varias veces seguidas, el aviso
// nuevo reemplaza al anterior sin volver a sonar.
function avisarReaccion(yo, fecha, antes, ahora, hoy) {
  const reaccionNueva = Boolean(ahora && ahora.reaccion) && ahora.reaccion !== (antes && antes.reaccion);
  const notitaNueva = Boolean(ahora && ahora.comentario) && ahora.comentario !== (antes && antes.comentario);
  if (!reaccionNueva && !notitaNueva) return null;
  const nombre = porId.get(yo).nombre;
  const emoji = ahora.reaccion ? reaccionPorId(ahora.reaccion).emoji : '';
  const cual = fecha === hoy ? 'tu dibujo de hoy' : `tu dibujo del ${F.fechaCorta(fecha)}`;
  const mensaje = notitaNueva
    ? { titulo: `${nombre} te dejó una notita ${emoji || '💌'}`, texto: `«${ahora.comentario}» (en ${cual})` }
    : { titulo: `${nombre} reaccionó ${emoji} a ${cual}`, texto: 'Ábrelo en Garabatos para verlo 💛' };
  return avisos.avisar([{ quien: parejaDe(yo), mensaje: { ...mensaje, tag: 'reaccion', ttl: 12 * HORAS, renotify: false } }]);
}

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
      + "script-src 'self'; connect-src 'self'; font-src 'self'; manifest-src 'self'; frame-ancestors 'none'; "
      // La radio: el audio viene directo de cada emisora (cualquier https). Solo afecta a
      // <audio>, que no puede ejecutar código.
      + 'media-src https:',
  });
  next();
});

// Recordatorio del mediodía. Lo llama cron-job.org todos los días a las 12:00 (hora de
// Costa Rica) con la cabecera Authorization: Bearer <CRON_SECRET>. Va antes que todo lo
// demás para que, sin la contraseña correcta, no se ejecute nada.
async function recordatorio(req, res) {
  const secreto = config.cronSecreto;
  if (!secreto) return res.status(503).json({ error: 'falta_CRON_SECRET' });
  if (!iguales(req.get('authorization') || '', `Bearer ${secreto}`)) return res.status(401).json({ error: 'no_autorizado' });

  const fecha = await mantenimiento();
  if (!avisos.disponible) return res.json({ ok: true, fecha, enviados: 0, nota: 'avisos_desactivados' });

  // Si el cron se ejecuta dos veces el mismo día, la segunda no manda nada.
  if (!(await base.marcarRecordatorio(fecha, F.sumarDias(fecha, -7)))) {
    return res.json({ ok: true, fecha, enviados: 0, nota: 'ya_se_mando_hoy' });
  }
  const terminaron = await base.terminaronEl(fecha);
  const faltan = cuentas.filter((c) => !terminaron.includes(c.id));
  const tema = temaDelDia(fecha);
  const { enviados } = await avisos.avisar(faltan.map((c) => ({
    quien: c.id,
    mensaje: { titulo: `Hoy toca dibujar: ${tema}. ¿Te animas? ✏️`, texto: `Un ratito para dibujar con ${porId.get(parejaDe(c.id)).nombre}.`, tag: 'recordatorio', ttl: 12 * HORAS },
  })), { tope: 5000 });
  return res.json({ ok: true, fecha, enviados, avisados: faltan.map((c) => c.nombre) });
}
app.get('/api/cron/recordatorio', recordatorio);
app.post('/api/cron/recordatorio', recordatorio);

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

// Al salir, la app manda el endpoint de este aparato (si tenía avisos) para que deje de
// recibir los avisos de esta cuenta. El endpoint es una dirección larga e imposible de
// adivinar que solo conoce el propio aparato, así que basta con él para borrarlo.
app.post('/api/salir', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint === 'string' && endpoint.length <= 2000) {
    await base.borrarAparato(endpoint).catch((err) => console.warn('No se pudo borrar el aparato al salir:', err.message));
  }
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

// Todo lo de abajo exige haber entrado.
app.use('/api', requiereSesion);

app.get('/api/yo', (req, res) => {
  const ver = ({ id, nombre, color, carita }) => ({ id, nombre, color, carita });
  res.json({
    yo: ver(porId.get(req.yo)),
    pareja: ver(porId.get(parejaDe(req.yo))),
    reacciones: REACCIONES,
    largoComentario: LARGO_COMENTARIO,
  });
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
  const { deHoy, fechasCompletas, reacciones } = await base.resumenDeHoy(fecha);
  const mio = deHoy.find((f) => f.quien === req.yo);
  const suyo = deHoy.find((f) => f.quien === otra);
  const notaDe = (quien) => verNota(reacciones.find((r) => r.quien === quien));

  res.json({
    fecha,
    tema: temaDelDia(fecha),
    yoListo: Boolean(mio),
    parejaListo: Boolean(suyo),
    miV: mio ? mio.creado : null,
    // La pareja solo "se ve" cuando yo ya terminé el mío.
    parejaV: mio && suyo ? suyo.creado : null,
    // La reacción que mi pareja le dejó a mi dibujo, y la que yo le dejé al suyo.
    notas: { mio: mio ? notaDe(req.yo) : null, suyo: mio && suyo ? notaDe(otra) : null },
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
  // Solo el dibujo de hoy avisa (terminar el de ayer a medianoche no). Tarda como mucho
  // ~3 s y nunca falla: si el aviso no sale, el dibujo igual quedó guardado.
  if (fecha === req.hoy) await avisarALaPareja(req.yo, fecha);
  return res.json({ ok: true, bytes: listo.imagen.length });
});

// ---- reacciones
// Reaccionar al dibujo de la pareja: un emoji y/o una notita. Se puede cambiar cuando se
// quiera; `reaccion: null` o `comentario: ''` lo quitan, y lo que no se manda se queda igual.
app.post('/api/reaccion', async (req, res) => {
  const { fecha, reaccion, comentario } = req.body || {};
  if (!F.esFecha(fecha) || fecha > req.hoy) return res.status(400).json({ error: 'fecha_invalida' });
  if (reaccion === undefined && comentario === undefined) return res.status(400).json({ error: 'nada_que_guardar' });
  if (reaccion != null && !reaccionPorId(reaccion)) return res.status(400).json({ error: 'reaccion_invalida' });
  const texto = comentario == null ? comentario : leerComentario(comentario);
  if (comentario != null && texto === undefined) return res.status(400).json({ error: 'comentario_invalido' });

  // Solo se reacciona a lo que uno puede ver (las mismas reglas que /api/dibujo):
  // el dibujo de la pareja existe y, si es de hoy, yo ya terminé el mío.
  const otra = parejaDe(req.yo);
  const terminaron = await base.terminaronEl(fecha);
  if (!terminaron.includes(otra)) return res.status(404).json({ error: 'sin_dibujo' });
  if (!terminaron.includes(req.yo) && fecha >= req.hoy) return res.status(403).json({ error: 'todavia_no' });

  const antes = verNota(await base.reaccionDe(fecha, otra));
  const ahora = {
    reaccion: reaccion === undefined ? (antes && antes.reaccion) || null : reaccion,
    comentario: comentario === undefined ? (antes && antes.comentario) || null : texto || null,
  };
  await base.guardarReaccion({ fecha, quien: otra, ...ahora });
  await avisarReaccion(req.yo, fecha, antes, verNota(ahora), req.hoy);
  return res.json({ ok: true, nota: verNota(ahora) });
});

// ---- avisos al teléfono
app.get('/api/avisos/clave', (req, res) => {
  res.json({ clave: avisos.clavePublica });
});

app.post('/api/avisos/activar', async (req, res) => {
  if (!avisos.disponible) return res.status(503).json({ error: 'avisos_no_disponibles' });
  const aparato = leerAparato(req.body);
  if (!aparato) return res.status(400).json({ error: 'aparato_invalido' });
  await base.guardarAparato({ ...aparato, quien: req.yo });
  return res.json({ ok: true });
});

app.post('/api/avisos/desactivar', async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string' || endpoint.length > 2000) return res.status(400).json({ error: 'aparato_invalido' });
  await base.borrarAparato(endpoint, req.yo);
  return res.json({ ok: true });
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
// La radio de la pantalla de dibujar: todos los estilos con sus emisoras, de una vez,
// para que al tocar un estilo la música arranque en el mismo toque (el iPhone lo exige).
app.get('/api/radio', async (req, res) => {
  res.set('Cache-Control', 'private, max-age=1800');
  res.json({ estilos: await radio.catalogo() });
});

app.get('/api/mes/:mes', async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(req.params.mes);
  const anio = F.anioDe(req.hoy);
  if (!m || +m[1] !== anio || +m[2] < 1 || +m[2] > 12) return res.status(400).json({ error: 'mes_invalido' });

  const numero = +m[2];
  const [filas, reacciones] = await Promise.all([
    base.mes(anio, numero),
    base.reaccionesEntre(`${req.params.mes}-01`, `${req.params.mes}-31`),
  ]);
  const notas = new Map(reacciones.map((r) => [`${r.fecha}/${r.quien}`, verNota(r)]));
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
      yo: mio ? { v: mio.creado, mini: url(mio.mini), nota: notas.get(`${fecha}/${req.yo}`) || null } : null,
      pareja: suyo ? {
        v: suyo.creado, visible, mini: visible ? url(suyo.mini) : null, nota: (visible && notas.get(`${fecha}/${otra}`)) || null,
      } : null,
    });
  }
  res.json({ hoy: req.hoy, anio, dias });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'no_existe' }));

// ---------------------------------------------------------------- archivos
// En tu computadora los sirve Express; en Vercel los sirve su CDN desde public/.
app.use(express.static(path.join(__dirname, 'public'), {
  // sw.js (el que muestra los avisos) va siempre con no-cache, para que el navegador
  // revise si cambió cada vez que se abre la app.
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
module.exports.avisos = avisos;
module.exports.radio = radio;
module.exports.mantenimiento = mantenimiento;
module.exports.reiniciarRevisionDeAnio = () => { anioRevisado = null; };
