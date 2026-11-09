const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const config = require('./config');
const { abrir } = require('./lib/base');
const { comprimir, comprimirAvatar } = require('./lib/imagen');
const { temaDelDia } = require('./lib/tema-del-dia');
const { crearAvisos } = require('./lib/avisos');
const { REACCIONES, reaccionPorId, LARGO_COMENTARIO } = require('./lib/reacciones');
const { crearRadio } = require('./lib/radio');
const { saldo, siguienteMes } = require('./lib/comodines');
const { calcularRacha, nivelDeRacha, pospuestoATiempo, limitePospuesto, MOTIVOS } = require('./lib/racha');
const RETOS = require('./lib/retos');
const JUEGO = require('./lib/reto-juego');
const CASA = require('./lib/casa');
const { preguntaDelDia, LARGO_RESPUESTA } = require('./lib/preguntas');
const CARTAS = require('./lib/cartas');
const F = require('./lib/fecha');

// ---------------------------------------------------------------- arranque
const cuentas = config.cuentas;
const porId = new Map(cuentas.map((c) => [c.id, c]));
const IDS = cuentas.map((c) => c.id);
const NOMBRES = Object.fromEntries(cuentas.map((c) => [c.id, c.nombre]));
const parejaDe = (id) => cuentas.find((c) => c.id !== id).id;
const hoy = () => F.claveDeHoy(config.zonaHoraria);
const G = CASA.GANANCIAS;

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

// El tema de cada día: el de la lista (lib/temas.js), salvo que alguien lo haya elegido
// en el reto "Tú eliges el tema". Devuelve una función fecha -> tema para ese rango.
async function temasEntre(desde, hasta) {
  const elegidos = new Map((await base.temasElegidosEntre(desde, hasta)).map((e) => [e.fecha, e]));
  const tema = (fecha) => (elegidos.has(fecha) ? elegidos.get(fecha).tema : temaDelDia(fecha));
  tema.quienEligio = (fecha) => (elegidos.has(fecha) ? elegidos.get(fecha).quien : null);
  return tema;
}
const temaDe = async (fecha) => (await temasEntre(fecha, fecha))(fecha);

// Un texto de una sola línea, sin espacios de más, de 1 a `max` letras (o undefined).
function leerTexto(texto, max, { lineas = false } = {}) {
  if (typeof texto !== 'string') return undefined;
  const limpio = lineas
    ? texto.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
    : texto.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim();
  const largo = [...limpio].length;
  return largo >= 1 && largo <= max ? limpio : undefined;
}

// Una imagen que manda la app como data URL (PNG, WebP o JPEG). Devuelve el Buffer o null.
function leerDataUrl(imagen, formatos = 'png|webp|jpeg') {
  const re = new RegExp(`^data:image\\/(?:${formatos});base64,([A-Za-z0-9+/]+={0,2})$`);
  const m = re.exec(typeof imagen === 'string' && imagen.length < 2_800_000 ? imagen : '');
  return m ? Buffer.from(m[1], 'base64') : null;
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
        : { titulo: `${nombre} ya dibujó, ¡te toca! 🎨`, texto: `Hoy toca dibujar: ${await temaDe(fecha)}.`, tag: 'pareja', ttl: 6 * HORAS },
    }];
  });
}

// Un aviso cualquiera para la pareja de `yo`.
const avisarA = (quien, titulo, texto, { tag = 'pareja', ttl = 12 * HORAS } = {}) => avisos.avisar([{ quien, mensaje: { titulo, texto, tag, ttl } }]);

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
  const ayer = F.sumarDias(fecha, -1);
  const [terminaron, terminaronAyer, pospuestos, tema] = await Promise.all([
    base.terminaronEl(fecha), base.terminaronEl(ayer), base.pospuestosEntre(ayer, fecha), temaDe(fecha),
  ]);
  const pospuso = (quien, dia) => pospuestos.some((p) => p.quien === quien && p.fecha === dia);
  // A quien pospuso hoy no se le insiste; a quien pospuso ayer se le recuerda que hoy son dos.
  const faltan = cuentas.filter((c) => !terminaron.includes(c.id) && !pospuso(c.id, fecha));
  const { enviados } = await avisos.avisar(faltan.map((c) => ({
    quien: c.id,
    mensaje: pospuso(c.id, ayer) && !terminaronAyer.includes(c.id)
      ? { titulo: 'Hoy te tocan dos dibujos ✏️✏️', texto: `El que pospusiste ayer y el de hoy (${tema}). ¡Que no se pierda la racha!`, tag: 'recordatorio', ttl: 12 * HORAS }
      : { titulo: `Hoy toca dibujar: ${tema}. ¿Te animas? ✏️`, texto: `Un ratito para dibujar con ${porId.get(parejaDe(c.id)).nombre}.`, tag: 'recordatorio', ttl: 12 * HORAS },
  })), { tope: 5000 });
  return res.json({ ok: true, fecha, enviados, avisados: faltan.map((c) => c.nombre) });
}
app.get('/api/cron/recordatorio', recordatorio);
app.post('/api/cron/recordatorio', recordatorio);

app.use('/api', async (req, res, next) => {
  req.hoy = await mantenimiento();
  next();
});

// ---------------------------------------------------------------- qué días se pueden dibujar
// - Hoy, siempre.
// - Ayer, gratis hasta las `horasDeGracia` de hoy (por si la medianoche te agarró dibujando).
// - Un día de los últimos `comodines.diasAtras` que se te pasó: con un comodín.
// Siempre del mismo año (el 1 de enero se empieza en blanco).
const enGracia = () => F.horaEn(config.zonaHoraria) < config.horasDeGracia;

// Los comodines de `quien`: cuántos le quedan, cuándo llega el próximo, y qué días puede
// recuperar (los de la ventana que no dibujó, desde el primer dibujo de la pareja).
// Los días que pospuso no se recuperan con comodín: van aparte, en `pendientes`, mientras
// todavía esté a tiempo de dibujarlos (gratis).
async function infoComodines(quien, hoy) {
  const { maximo, porMes, diasAtras } = config.comodines;
  const desde = F.sumarDias(hoy, -diasAtras);
  const [{ dibujados, primera, usos, pospuestos }, tema] = await Promise.all([
    base.estadoComodines(quien, desde, hoy),
    temasEntre(desde, hoy),
  ]);
  const mes = hoy.slice(0, 7);
  const quedan = saldo(usos, mes, { maximo, porMes });
  const hechos = new Set(dibujados);
  const pospuse = new Set(pospuestos.map((p) => p.fecha));
  const ventana = [];
  for (let d = 1; d <= diasAtras; d += 1) {
    const fecha = F.sumarDias(hoy, -d);
    if (F.anioDe(fecha) !== F.anioDe(hoy) || !primera || fecha < primera) break;
    ventana.push(fecha);
  }
  const ayer = F.sumarDias(hoy, -1);
  const gracia = enGracia();
  return {
    quedan,
    maximo,
    proximo: quedan < maximo ? `${siguienteMes(mes)}-01` : null,
    ventana,
    pospuse,
    perdidos: ventana.filter((f) => !hechos.has(f) && !pospuse.has(f)).map((fecha) => ({ fecha, tema: tema(fecha), gratis: fecha === ayer && gracia })),
    pendientes: pospuestos
      .filter((p) => p.fecha !== hoy && !hechos.has(p.fecha) && pospuestoATiempo(p.fecha, hoy, gracia))
      .map((p) => ({ fecha: p.fecha, tema: tema(p.fecha), motivo: p.motivo, nivel: p.nivel, texto: p.texto, hasta: limitePospuesto(p.fecha) })),
  };
}

// ¿`quien` tiene pendiente (pospuesto y todavía a tiempo) el dibujo de `fecha`? Mientras
// sea así, no puede ver el dibujo de su pareja de ese día (como si fuera hoy).
async function tienePendiente(quien, fecha, hoy) {
  if (fecha >= hoy || !pospuestoATiempo(fecha, hoy, enGracia())) return false;
  const [pospuestos, terminaron] = await Promise.all([base.pospuestosEntre(fecha, fecha), base.terminaronEl(fecha)]);
  return pospuestos.some((p) => p.quien === quien) && !terminaron.includes(quien);
}

// Las monedas que da un dibujo terminado: el suyo y, si ya dibujaron los dos ese día, el
// extra de pareja. Devuelve cuántas se ganaron.
async function ganarPorDibujo(quien, fecha) {
  const terminaron = await base.terminaronEl(fecha);
  const filas = [{ clave: `dibujo:${fecha}:${quien}`, quien, cantidad: G.dibujo, motivo: 'dibujo' }];
  if (IDS.every((q) => terminaron.includes(q))) filas.push({ clave: `pareja:${fecha}`, quien: null, cantidad: G.pareja, motivo: 'pareja' });
  return base.sumarMonedas(filas);
}

function avisarRecuperado(yo, fecha) {
  const nombre = porId.get(yo).nombre;
  return avisos.avisar([{
    quien: parejaDe(yo),
    mensaje: { titulo: `${nombre} recuperó su dibujo del ${F.fechaCorta(fecha)} 🎟️`, texto: 'Usó un comodín para no perder la racha.', tag: 'pareja', ttl: 12 * HORAS },
  }]);
}

// La versión de lo que se ve en el teléfono: una huella de los archivos de public/
// (cambia con cada cambio publicado). La app la compara al volver a abrirse y, si hay
// una nueva, se recarga sola: en iPhone la app instalada puede quedarse "dormida" en
// memoria con el código viejo por días.
const VERSION = (() => {
  try {
    const huella = crypto.createHash('sha1');
    const recorrer = (carpeta) => {
      for (const f of fs.readdirSync(carpeta, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        const ruta = path.join(carpeta, f.name);
        if (f.isDirectory()) recorrer(ruta);
        else if (/\.(js|css|html|webmanifest)$/.test(f.name)) huella.update(f.name).update(fs.readFileSync(ruta));
      }
    };
    recorrer(path.join(__dirname, 'public'));
    return huella.digest('hex').slice(0, 12);
  } catch {
    return (process.env.VERCEL_GIT_COMMIT_SHA || 'local').slice(0, 12);
  }
})();

app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ version: VERSION });
});

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

// La cartita de novedades (config.novedades): ¿le toca verla a esta cuenta?
const claveNovedades = (quien) => `novedades:${config.novedades.id}:${quien}`;
async function tocaNovedades(quien) {
  const n = config.novedades;
  if (!n || !n.para.includes(quien)) return null;
  const ajustes = await base.ajustesCasa();
  return ajustes[claveNovedades(quien)] ? null : { id: n.id, de: n.de };
}

app.get('/api/yo', async (req, res) => {
  const ver = ({ id, nombre, color, carita }) => ({ id, nombre, color, carita });
  res.json({
    yo: ver(porId.get(req.yo)),
    pareja: ver(porId.get(parejaDe(req.yo))),
    reacciones: REACCIONES,
    largoComentario: LARGO_COMENTARIO,
    novedades: await tocaNovedades(req.yo),
  });
});

app.post('/api/novedades/visto', async (req, res) => {
  if (config.novedades) await base.guardarAjuste(claveNovedades(req.yo), new Date().toISOString());
  res.json({ ok: true });
});

// Fecha -> Set de quiénes, a partir de filas { fecha, quien }.
function porFecha(filas) {
  const m = new Map();
  for (const f of filas) {
    if (!m.has(f.fecha)) m.set(f.fecha, new Set());
    m.get(f.fecha).add(f.quien);
  }
  return m;
}
const sinQuien = (p) => (p ? { motivo: p.motivo, nivel: p.nivel, texto: p.texto } : null);

// La alcancía se pone al día (con los dibujos de antes de que existiera) una vez al día.
let alcanciaRevisada = null;

app.get('/api/hoy', async (req, res) => {
  const fecha = req.hoy;
  const ayer = F.sumarDias(fecha, -1);
  const otra = parejaDe(req.yo);
  if (alcanciaRevisada !== fecha) {
    await base.sincronizarMonedas({ dibujo: G.dibujo, pareja: G.pareja });
    alcanciaRevisada = fecha;
  }
  const [resumen, comodines, tema] = await Promise.all([
    base.resumenDeHoy(fecha, F.sumarDias(fecha, -2)),
    infoComodines(req.yo, fecha),
    temasEntre(fecha, fecha),
  ]);
  const { deHoy, fechasCompletas, reacciones, recientes, pospuestos } = resumen;
  const mio = deHoy.find((f) => f.quien === req.yo);
  const suyo = deHoy.find((f) => f.quien === otra);
  const notaDe = (quien) => verNota(reacciones.find((r) => r.quien === quien));
  const gracia = enGracia();

  const racha = calcularRacha({
    completos: fechasCompletas, recientes: porFecha(recientes), pospuestos: porFecha(pospuestos), quienes: IDS, hoy: fecha, enGracia: gracia,
  });
  // Cada 7 días de racha, un premio para la alcancía (una sola vez por día).
  let saldoMonedas = resumen.saldo;
  if (mio && suyo && racha > 0 && racha % 7 === 0) {
    saldoMonedas += await base.sumarMonedas([{ clave: `semana:${fecha}`, quien: null, cantidad: G.semana, motivo: 'racha' }]);
  }

  // Posponer: hoy, si no he dibujado, no lo pospuse ya y no lo pospuse ayer.
  const pospusoEl = (quien, dia) => pospuestos.find((p) => p.quien === quien && p.fecha === dia) || null;
  const porque = mio ? 'ya_dibujaste' : pospusoEl(req.yo, fecha) ? 'ya_pospusiste' : pospusoEl(req.yo, ayer) ? 'ayer_pospusiste' : null;
  const dibujoEl = (quien, dia) => recientes.some((r) => r.quien === quien && r.fecha === dia);
  const suyosPendientes = pospuestos
    .filter((p) => p.quien === otra && p.fecha !== fecha && !dibujoEl(otra, p.fecha) && pospuestoATiempo(p.fecha, fecha, gracia))
    .map((p) => ({ fecha: p.fecha, motivo: p.motivo }));

  res.json({
    fecha,
    tema: tema(fecha),
    // Si el tema de hoy lo eligió alguien (reto "Tú eliges el tema").
    temaElegidoPor: tema.quienEligio(fecha),
    yoListo: Boolean(mio),
    parejaListo: Boolean(suyo),
    miV: mio ? mio.creado : null,
    // La pareja solo "se ve" cuando yo ya terminé el mío.
    parejaV: mio && suyo ? suyo.creado : null,
    // La reacción que mi pareja le dejó a mi dibujo, y la que yo le dejé al suyo.
    notas: { mio: mio ? notaDe(req.yo) : null, suyo: mio && suyo ? notaDe(otra) : null },
    racha,
    nivelRacha: nivelDeRacha(racha),
    monedas: saldoMonedas,
    // Mis comodines y los días que se me pasaron y todavía puedo recuperar.
    comodines: { quedan: comodines.quedan, maximo: comodines.maximo, proximo: comodines.proximo },
    perdidos: comodines.perdidos,
    posponer: {
      puedo: !porque,
      porque,
      mio: sinQuien(pospusoEl(req.yo, fecha)),
      suyo: sinQuien(pospusoEl(otra, fecha)),
      // Los días que pospuse y todavía tengo que dibujar (gratis, sin comodín).
      pendientes: comodines.pendientes,
      suyosPendientes,
      motivos: Object.values(MOTIVOS),
      largoTexto: config.posponer.largoTexto,
    },
    horasDeGracia: config.horasDeGracia,
    anio: F.anioDe(fecha),
    diasParaReinicio: F.diasHastaFinDeAnio(fecha),
  });
});

app.post('/api/terminar', async (req, res) => {
  const { fecha, imagen, comodin } = req.body || {};
  if (!F.esFecha(fecha) || fecha > req.hoy || F.anioDe(fecha) !== F.anioDe(req.hoy)) return res.status(400).json({ error: 'fecha_invalida' });
  // Un día anterior (fuera de la gracia de ayer) solo con comodín, pedido a propósito,
  // salvo que sea un día que pospuse y todavía estoy a tiempo (ese es gratis). Un día
  // pospuesto que ya se pasó no se recupera ni con comodín.
  let comodines = null;
  let pospuesto = false;
  if (fecha !== req.hoy && !(fecha === F.sumarDias(req.hoy, -1) && enGracia())) {
    const info = await infoComodines(req.yo, req.hoy);
    if (info.pendientes.some((p) => p.fecha === fecha)) {
      pospuesto = true;
    } else {
      if (info.pospuse.has(fecha)) return res.status(400).json({ error: 'pospuesto_vencido' });
      if (comodin !== true) return res.status(400).json({ error: 'fecha_invalida' });
      if (!info.ventana.includes(fecha)) return res.status(400).json({ error: 'fecha_invalida' });
      if (info.quedan < 1) return res.status(403).json({ error: 'sin_comodines', proximo: info.proximo });
      comodines = info;
    }
  }

  const buffer = leerDataUrl(imagen);
  if (!buffer) return res.status(400).json({ error: 'imagen_invalida' });
  const listo = await comprimir(buffer, config.imagen);
  if (!listo) return res.status(400).json({ error: 'imagen_invalida' });

  const dibujo = { fecha, quien: req.yo, imagen: listo.imagen, mini: listo.mini };
  const guardado = comodines
    ? await base.guardarConComodin({ ...dibujo, mes: req.hoy.slice(0, 7) })
    : await base.guardar(dibujo);
  if (!guardado) return res.status(409).json({ error: 'ya_terminado' });
  const ganadas = await ganarPorDibujo(req.yo, fecha);
  // El dibujo de hoy avisa a la pareja, y también recuperar un día con comodín o hacer el
  // pospuesto (terminar el de ayer a medianoche no). Tarda como mucho ~3 s y nunca falla.
  if (fecha === req.hoy) await avisarALaPareja(req.yo, fecha);
  else if (comodines) await avisarRecuperado(req.yo, fecha);
  else if (pospuesto) await avisarA(parejaDe(req.yo), `${NOMBRES[req.yo]} hizo el dibujo que había pospuesto 💪`, `El del ${F.fechaCorta(fecha)}. ¡La racha sigue!`);
  return res.json({ ok: true, bytes: listo.imagen.length, monedas: ganadas, ...(comodines ? { comodines: comodines.quedan - 1 } : {}) });
});

// ---- posponer
// Hoy no puedo dibujar: lo pospongo, digo por qué (ocupado o me siento mal, de 1 a 10 y
// un textito). Solo hoy, si no he dibujado, y si no lo pospuse ayer.
app.post('/api/posponer', async (req, res) => {
  const { motivo, nivel, texto } = req.body || {};
  if (!MOTIVOS[motivo]) return res.status(400).json({ error: 'motivo_invalido' });
  if (!Number.isInteger(nivel) || nivel < 1 || nivel > 10) return res.status(400).json({ error: 'nivel_invalido' });
  const porque = leerTexto(texto, config.posponer.largoTexto);
  if (!porque) return res.status(400).json({ error: 'texto_invalido' });

  const fecha = req.hoy;
  const ayer = F.sumarDias(fecha, -1);
  const [terminaron, pospuestos] = await Promise.all([base.terminaronEl(fecha), base.pospuestosEntre(ayer, fecha)]);
  if (terminaron.includes(req.yo)) return res.status(409).json({ error: 'ya_dibujaste' });
  if (pospuestos.some((p) => p.quien === req.yo && p.fecha === ayer)) return res.status(403).json({ error: 'ayer_pospusiste' });
  if (!(await base.guardarPospuesto({ fecha, quien: req.yo, motivo, nivel, texto: porque }))) return res.status(409).json({ error: 'ya_pospusiste' });

  await avisarA(parejaDe(req.yo), `${NOMBRES[req.yo]} pospuso el dibujo de hoy ${MOTIVOS[motivo].emoji}`, `${MOTIVOS[motivo].nombre} (${nivel}/10): «${porque}»`);
  return res.json({ ok: true });
});

// Mandarle ánimos a mi pareja cuando pospuso (una vez al día).
app.post('/api/animos', async (req, res) => {
  const otra = parejaDe(req.yo);
  const pospuestos = await base.pospuestosEntre(F.sumarDias(req.hoy, -1), req.hoy);
  if (!pospuestos.some((p) => p.quien === otra)) return res.status(400).json({ error: 'no_pospuso' });
  if (!(await base.marcarAnimos(req.hoy, req.yo))) return res.status(409).json({ error: 'ya_mandaste' });
  await avisarA(otra, `${NOMBRES[req.yo]} te manda ánimos 💛`, '¡Tú puedes! Aquí te esperan para dibujar juntos.', { tag: 'animos' });
  return res.json({ ok: true });
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
  if (!terminaron.includes(req.yo) && (fecha >= req.hoy || await tienePendiente(req.yo, fecha, req.hoy))) return res.status(403).json({ error: 'todavia_no' });

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
  if (quien !== req.yo && !fila.tengoMio && (fecha >= req.hoy || await tienePendiente(req.yo, fecha, req.hoy))) return res.status(403).end();

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
  const desde = `${req.params.mes}-01`;
  const hasta = `${req.params.mes}-31`;
  const [filas, reacciones, pospuestos, tema] = await Promise.all([
    base.mes(anio, numero),
    base.reaccionesEntre(desde, hasta),
    base.pospuestosEntre(desde, hasta),
    temasEntre(desde, hasta),
  ]);
  const notas = new Map(reacciones.map((r) => [`${r.fecha}/${r.quien}`, verNota(r)]));
  const pospuso = new Map(pospuestos.map((p) => [`${p.fecha}/${p.quien}`, sinQuien(p)]));
  const gracia = enGracia();
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
    // Un día que pospuse y todavía puedo dibujar se comporta como "hoy": no veo el de mi pareja.
    const miPospuesto = pospuso.get(`${fecha}/${req.yo}`) || null;
    const pendiente = !mio && miPospuesto && fecha < req.hoy && pospuestoATiempo(fecha, req.hoy, gracia);
    const visible = Boolean(suyo) && (Boolean(mio) || (fecha < req.hoy && !pendiente));
    dias.push({
      fecha,
      futuro,
      tema: futuro ? null : tema(fecha),
      temaElegidoPor: futuro ? null : tema.quienEligio(fecha),
      pospuesto: { yo: miPospuesto, pareja: pospuso.get(`${fecha}/${otra}`) || null, pendiente: Boolean(pendiente) },
      yo: mio ? { v: mio.creado, mini: url(mio.mini), nota: notas.get(`${fecha}/${req.yo}`) || null, recuperado: mio.recuperado } : null,
      pareja: suyo ? {
        v: suyo.creado, visible, mini: visible ? url(suyo.mini) : null, nota: (visible && notas.get(`${fecha}/${otra}`)) || null, recuperado: suyo.recuperado,
      } : null,
    });
  }
  res.json({ hoy: req.hoy, anio, dias });
});

// ---------------------------------------------------------------- reto de la semana
const retoDe = (fecha) => RETOS.retoDeLaSemana(fecha, IDS);
const verReto = (reto, guardado, yo, hoyFecha) => JUEGO.vista(reto, guardado, yo, NOMBRES, { hoy: hoyFecha });

// Después de cada paso del reto: si se completó, el premio (una vez) y un aviso; si no,
// y ahora le toca a la otra persona, un aviso para que sepa.
async function despuesDelReto(reto, resultado, yo, hoyFecha) {
  const otra = parejaDe(yo);
  if (resultado.recienCompletado) {
    const acerto = reto.tipo === 'adivina' && resultado.datos.acertado === true;
    await base.sumarMonedas([{ clave: `reto:${reto.semana}`, quien: null, cantidad: JUEGO.PREMIO + (acerto ? JUEGO.PREMIO_ACERTAR : 0), motivo: 'reto' }]);
    await avisarA(otra, `¡Completaron el reto de la semana! ${reto.emoji}`, `${reto.nombre}: entra a verlo. +${JUEGO.PREMIO + (acerto ? JUEGO.PREMIO_ACERTAR : 0)} 🪙 para la casa.`, { tag: 'reto' });
    return;
  }
  const suya = verReto(reto, { datos: resultado.datos, completado: resultado.completado }, otra, hoyFecha);
  if (suya.fase === 'mi_turno') await avisarA(otra, `¡Te toca en el reto! ${reto.emoji}`, `${reto.nombre}: ${suya.texto}`, { tag: 'reto' });
}

app.get('/api/reto', async (req, res) => {
  const reto = retoDe(req.hoy);
  const guardado = await base.leerReto(reto.semana);
  res.set('Cache-Control', 'no-store');
  res.json({ reto: verReto(reto, guardado, req.yo, req.hoy) });
});

// Los retos de las semanas anteriores (los más nuevos primero).
app.get('/api/retos', async (req, res) => {
  const lista = await base.retosAnteriores(retoDe(req.hoy).semana, 12);
  res.json({ retos: lista.map((g) => verReto(retoDe(g.semana), g, req.yo, req.hoy)) });
});

// El dibujo que me toca en el reto (el servidor sabe en qué lugar va).
app.post('/api/reto/dibujo', async (req, res) => {
  const reto = retoDe(req.hoy);
  const guardado = await base.leerReto(reto.semana);
  const plan = JUEGO.planDeDibujo(reto, (guardado && guardado.datos) || {}, req.yo);
  if (!plan) return res.status(409).json({ error: 'no_te_toca' });
  const buffer = leerDataUrl(req.body?.imagen);
  const listo = buffer && await comprimir(buffer, config.imagen);
  if (!listo) return res.status(400).json({ error: 'imagen_invalida' });
  const titulo = plan.pideTitulo ? leerTexto(req.body.titulo, 40) || null : null;

  if (!(await base.guardarImagenReto({ semana: reto.semana, clave: plan.clave, imagen: listo.imagen, mini: listo.mini }))) {
    return res.status(409).json({ error: 'ya_terminado' });
  }
  const creado = new Date().toISOString();
  const resultado = await base.actualizarReto(reto.semana, reto.tipo, (d) => ({
    ...d, imgs: { ...(d.imgs || {}), [plan.clave]: creado }, ...(titulo ? { titulo } : {}),
  }), { completo: (d) => JUEGO.completo(reto.tipo, d) });
  await despuesDelReto(reto, resultado, req.yo, req.hoy);
  return res.json({ ok: true, reto: verReto(reto, resultado, req.yo, req.hoy) });
});

// Las demás acciones: tema, palabra, adivinar, colores, mirar.
app.post('/api/reto/:accion', async (req, res) => {
  const reto = retoDe(req.hoy);
  const { accion } = req.params;
  if (!['tema', 'palabra', 'adivinar', 'colores', 'mirar'].includes(accion)) return res.status(404).json({ error: 'no_existe' });
  const manana = F.sumarDias(req.hoy, 1);
  let resultado;
  try {
    resultado = await base.actualizarReto(
      reto.semana,
      reto.tipo,
      (datos) => JUEGO.aplicar(reto, datos, req.yo, accion, req.body || {}, { hoy: req.hoy, manana }),
      {
        completo: (d) => JUEGO.completo(reto.tipo, d),
        // El tema elegido se vuelve el tema de mañana para los dos.
        extra: (d) => (accion === 'tema' ? [{
          sql: 'INSERT INTO temas_elegidos (fecha, tema, quien, creado) VALUES (?, ?, ?, ?) ON CONFLICT (fecha) DO NOTHING',
          args: [d.fecha, d.tema, req.yo, new Date().toISOString()],
        }] : []),
      },
    );
  } catch (e) {
    if (!e.codigo) throw e;
    return res.status(e.codigo === 'reto_ocupado' || e.codigo === 'ya_hecho' ? 409 : 400).json({ error: e.codigo });
  }
  await despuesDelReto(reto, resultado, req.yo, req.hoy);
  return res.json({ ok: true, reto: verReto(reto, resultado, req.yo, req.hoy) });
});

app.get('/api/reto/imagen/:semana/:clave', async (req, res) => {
  const { semana, clave } = req.params;
  if (!F.esFecha(semana) || !/^[a-z]{2,10}$/.test(clave)) return res.status(404).end();
  const guardado = await base.leerReto(semana);
  if (!guardado) return res.status(404).end();
  const reto = retoDe(semana);
  if (!JUEGO.puedeVer(reto, guardado.datos, req.yo, clave)) return res.status(403).end();
  const datos = await base.leerImagenReto(semana, clave, Boolean(req.query.mini));
  if (!datos) return res.status(404).end();
  // El dibujo que se mira 10 segundos (reto "De memoria") no se guarda en la caché.
  const fugaz = reto.tipo === 'memoria' && clave === 'dibujo' && req.yo !== reto.primero && !JUEGO.completo(reto.tipo, guardado.datos);
  res.set({ 'Content-Type': 'image/webp', 'Cache-Control': fugaz ? 'no-store' : 'private, max-age=31536000, immutable' });
  return res.send(datos);
});

// ---------------------------------------------------------------- la casa
const tieneEl = (muebles, id) => CASA.muebleDe(id)?.precio === 0 || muebles.some((m) => m.tipo === id);
// Cuántos pisos tiene la casa: 2 si compraron el segundo piso.
const pisosDe = (muebles) => (muebles.some((m) => m.tipo === 'segundo_piso') ? 2 : 1);

app.get('/api/casa', async (req, res) => {
  await base.sincronizarMonedas({ dibujo: G.dibujo, pareja: G.pareja });
  const [monedas, movimientos, muebles, ajustes, avatares, terminaron, pospuestos] = await Promise.all([
    base.saldo(), base.movimientos(15), base.muebles(), base.ajustesCasa(), base.versionesDeAvatares(),
    base.terminaronEl(req.hoy), base.pospuestosEntre(req.hoy, req.hoy),
  ]);
  res.set('Cache-Control', 'no-store');
  res.json({
    monedas,
    movimientos,
    catalogo: CASA.CATALOGO,
    lado: CASA.LADO,
    ganancias: G,
    muebles: muebles.filter((m) => !CASA.esDelCuarto(CASA.muebleDe(m.tipo))),
    tiene: CASA.CATALOGO.filter((m) => CASA.esDelCuarto(m) && tieneEl(muebles, m.id)).map((m) => m.id),
    ajustes: { pintura: ajustes.pintura || CASA.POR_DEFECTO.pintura, piso: ajustes.piso || CASA.POR_DEFECTO.piso },
    pisos: pisosDe(muebles),
    escalera: CASA.ESCALERA,
    avatares: Object.fromEntries(IDS.map((q) => [q, avatares[q] || null])),
    // Cómo anda cada quien hoy (los personajes lo muestran).
    animo: Object.fromEntries(IDS.map((q) => [q, {
      dibujo: terminaron.includes(q),
      pospuso: (pospuestos.find((p) => p.quien === q) || {}).motivo || null,
    }])),
  });
});

app.post('/api/casa/comprar', async (req, res) => {
  const m = CASA.muebleDe(req.body?.tipo);
  if (!m) return res.status(400).json({ error: 'mueble_invalido' });
  const deCuarto = CASA.esDelCuarto(m);
  const antes = await base.muebles();
  if (deCuarto && tieneEl(antes, m.id)) return res.status(409).json({ error: 'ya_lo_tienen' });
  const id = await base.comprar({ tipo: m.id, precio: m.precio, quien: req.yo });
  if (id == null) return res.status(402).json({ error: 'sin_monedas', monedas: await base.saldo() });
  if (m.cat === 'pintura' || m.cat === 'piso') await base.guardarAjuste(m.cat, m.id); // la pintura o el piso se estrenan de una
  // El segundo piso trae su escalera: lo que estaba donde va la escalera se guarda.
  const guardados = m.id === 'segundo_piso' ? CASA.tapanLaEscalera(antes).map((x) => x.id) : [];
  for (const g of guardados) await base.moverMueble({ id: g, x: null, z: null, rot: 0, pared: null, piso: 0 });
  if (guardados.length) {
    await avisarA(parejaDe(req.yo), `${NOMBRES[req.yo]} compró el segundo piso 🏠`, 'Algunos muebles se guardaron para hacerle lugar a la escalera.', { tag: 'casa' });
  }
  return res.json({ ok: true, id, monedas: await base.saldo(), guardados });
});

// Poner (o mover) un mueble: { id, x, z, rot, piso } en el piso, o { id, x, pared, piso } en la pared.
app.post('/api/casa/poner', async (req, res) => {
  const { id, x, z, rot, pared, piso } = req.body || {};
  const muebles = await base.muebles();
  const mueble = muebles.find((m) => m.id === id);
  if (!mueble) return res.status(404).json({ error: 'no_existe' });
  const tipo = CASA.muebleDe(mueble.tipo);
  const nuevo = tipo && tipo.cat === 'pared'
    ? { id, tipo: mueble.tipo, x, z: 0, rot: 0, pared, piso: piso || 0 }
    : { id, tipo: mueble.tipo, x, z, rot: rot || 0, pared: null, piso: piso || 0 };
  const error = CASA.revisarLugar(nuevo, muebles, { pisos: pisosDe(muebles) });
  if (error) return res.status(error === 'lugar_ocupado' ? 409 : 400).json({ error });
  await base.moverMueble(nuevo);
  return res.json({ ok: true });
});

app.post('/api/casa/guardar', async (req, res) => {
  const mueble = await base.mueble(req.body?.id);
  if (!mueble) return res.status(404).json({ error: 'no_existe' });
  await base.moverMueble({ id: mueble.id, x: null, z: null, rot: 0, pared: null });
  return res.json({ ok: true });
});

app.post('/api/casa/vender', async (req, res) => {
  const mueble = await base.mueble(req.body?.id);
  const tipo = mueble && CASA.muebleDe(mueble.tipo);
  if (!mueble || !tipo || CASA.esDelCuarto(tipo)) return res.status(404).json({ error: 'no_existe' });
  await base.vender({ id: mueble.id, reembolso: Math.floor(tipo.precio / 2), quien: req.yo });
  return res.json({ ok: true, monedas: await base.saldo() });
});

// Elegir la pintura o el piso (de los que ya tienen).
app.post('/api/casa/cuarto', async (req, res) => {
  const m = CASA.muebleDe(req.body?.tipo);
  if (!m || (m.cat !== 'pintura' && m.cat !== 'piso')) return res.status(400).json({ error: 'invalido' });
  if (!tieneEl(await base.muebles(), m.id)) return res.status(402).json({ error: 'no_lo_tienen' });
  await base.guardarAjuste(m.cat, m.id);
  return res.json({ ok: true });
});

// Qué dibujo se ve en un cuadro: { id, fecha, quien } (uno que yo pueda ver).
app.post('/api/casa/cuadro', async (req, res) => {
  const { id, fecha, quien } = req.body || {};
  const mueble = await base.mueble(id);
  if (!mueble || mueble.tipo !== 'cuadro') return res.status(404).json({ error: 'no_existe' });
  if (!F.esFecha(fecha) || !porId.has(quien)) return res.status(400).json({ error: 'dibujo_invalido' });
  const fila = await base.leerImagen({ fecha, quien, yo: req.yo, mini: true });
  if (!fila || (quien !== req.yo && !fila.tengoMio && fecha >= req.hoy)) return res.status(400).json({ error: 'dibujo_invalido' });
  await base.ponerDibujo(mueble.id, `${fecha}/${quien}`);
  return res.json({ ok: true });
});

// ---- el personaje de cada quien (lo dibujan sobre un monito gordito)
app.post('/api/avatar', async (req, res) => {
  const buffer = leerDataUrl(req.body?.imagen, 'png|webp');
  const imagen = buffer && await comprimirAvatar(buffer);
  if (!imagen) return res.status(400).json({ error: 'imagen_invalida' });
  const v = await base.guardarAvatar(req.yo, imagen);
  await avisarA(parejaDe(req.yo), `${NOMBRES[req.yo]} se dibujó un personaje nuevo 🏠`, 'Entra a la casa para verlo caminar.', { tag: 'casa' });
  return res.json({ ok: true, v });
});

app.get('/api/avatar/:quien', async (req, res) => {
  if (!porId.has(req.params.quien)) return res.status(404).end();
  const fila = await base.leerAvatar(req.params.quien);
  if (!fila) return res.status(404).end();
  res.set({ 'Content-Type': 'image/webp', 'Cache-Control': 'private, max-age=31536000, immutable' });
  return res.send(fila.imagen);
});

// ---------------------------------------------------------------- pregunta del día
app.get('/api/pregunta', async (req, res) => {
  const otra = parejaDe(req.yo);
  const desde = F.sumarDias(req.hoy, -30);
  const respuestas = await base.respuestasEntre(F.anioDe(desde) === F.anioDe(req.hoy) ? desde : `${F.anioDe(req.hoy)}-01-01`, req.hoy);
  const de = (fecha, quien) => (respuestas.find((r) => r.fecha === fecha && r.quien === quien) || {}).texto || null;
  const dia = (fecha) => {
    const mia = de(fecha, req.yo);
    const suya = de(fecha, otra);
    // La de mi pareja se ve cuando ya respondí la mía (o cuando ya pasó el día).
    return { fecha, pregunta: preguntaDelDia(fecha), mia, suya: mia || fecha < req.hoy ? suya : null, parejaRespondio: Boolean(suya) };
  };
  const fechas = [...new Set(respuestas.map((r) => r.fecha))].filter((f) => f !== req.hoy).sort().reverse();
  res.set('Cache-Control', 'no-store');
  res.json({ hoy: dia(req.hoy), anteriores: fechas.map(dia), largo: LARGO_RESPUESTA });
});

app.post('/api/pregunta', async (req, res) => {
  const texto = leerTexto(req.body?.texto, LARGO_RESPUESTA, { lineas: true });
  if (!texto) return res.status(400).json({ error: 'texto_invalido' });
  if (!(await base.guardarRespuesta({ fecha: req.hoy, quien: req.yo, texto }))) return res.status(409).json({ error: 'ya_respondiste' });
  const ganadas = await base.sumarMonedas([{ clave: `pregunta:${req.hoy}:${req.yo}`, quien: req.yo, cantidad: G.pregunta, motivo: 'pregunta' }]);
  const otra = parejaDe(req.yo);
  const yaRespondio = (await base.respuestasEntre(req.hoy, req.hoy)).some((r) => r.quien === otra);
  await avisarA(otra, `${NOMBRES[req.yo]} respondió la pregunta del día 💭`, yaRespondio ? 'Ya pueden ver lo que respondió cada quien.' : `«${preguntaDelDia(req.hoy)}» Responde para ver su respuesta.`, { tag: 'pregunta' });
  return res.json({ ok: true, monedas: ganadas });
});

// ---------------------------------------------------------------- cartitas
// Lo que se ve de una carta: el texto solo si ya se abrió, o si la escribí yo.
function verCarta(c, yo) {
  const cuando = CARTAS.cuandoDe(c.cuando);
  return {
    id: c.id, de: c.de, para: c.para, cuando: c.cuando, cuandoTexto: cuando ? cuando.texto : c.cuando, emoji: cuando ? cuando.emoji : '💌',
    fecha: c.fecha, color: c.color, creado: c.creado, abierta: c.abierta,
    texto: c.de === yo || c.abierta ? c.texto : null,
  };
}

app.get('/api/cartas', async (req, res) => {
  const todas = await base.cartasDe(req.yo);
  res.set('Cache-Control', 'no-store');
  res.json({
    recibidas: todas.filter((c) => c.para === req.yo).map((c) => verCarta(c, req.yo)),
    enviadas: todas.filter((c) => c.de === req.yo).map((c) => verCarta(c, req.yo)),
    cuando: CARTAS.CUANDO,
    colores: CARTAS.COLORES_SOBRE,
    largo: CARTAS.LARGO_CARTA,
    hoy: req.hoy,
  });
});

app.post('/api/cartas', async (req, res) => {
  const { cuando, fecha, color } = req.body || {};
  const tipo = CARTAS.cuandoDe(cuando);
  if (!tipo) return res.status(400).json({ error: 'cuando_invalido' });
  if (tipo.id === 'fecha' && (!F.esFecha(fecha) || fecha <= req.hoy || fecha > F.sumarDias(req.hoy, 3 * 366))) return res.status(400).json({ error: 'fecha_invalida' });
  if (!CARTAS.COLORES_SOBRE.includes(color)) return res.status(400).json({ error: 'color_invalido' });
  const texto = leerTexto(req.body.texto, CARTAS.LARGO_CARTA, { lineas: true });
  if (!texto) return res.status(400).json({ error: 'texto_invalido' });
  const id = await base.crearCarta({ de: req.yo, para: parejaDe(req.yo), cuando: tipo.id, fecha: tipo.id === 'fecha' ? fecha : null, texto, color });
  const ganadas = await base.sumarMonedas([{ clave: `carta:${req.hoy}:${req.yo}`, quien: req.yo, cantidad: G.carta, motivo: 'carta' }]);
  const cuandoTexto = tipo.id === 'fecha' ? `llegue el ${F.fechaCorta(fecha)}` : tipo.texto;
  await avisarA(parejaDe(req.yo), `${NOMBRES[req.yo]} te escribió una cartita 💌`, `«Ábrela cuando ${cuandoTexto}»`, { tag: 'carta', ttl: 24 * HORAS });
  return res.json({ ok: true, id, monedas: ganadas });
});

app.post('/api/cartas/:id/abrir', async (req, res) => {
  const carta = await base.carta(Number(req.params.id));
  if (!carta || carta.para !== req.yo) return res.status(404).json({ error: 'no_existe' });
  if (carta.cuando === 'fecha' && carta.fecha > req.hoy) return res.status(403).json({ error: 'todavia_no', fecha: carta.fecha });
  if (await base.abrirCarta(carta.id)) {
    const cuando = CARTAS.cuandoDe(carta.cuando);
    await avisarA(carta.de, `${NOMBRES[req.yo]} abrió tu cartita 🥹`, `«Ábrela cuando ${carta.cuando === 'fecha' ? `llegue el ${F.fechaCorta(carta.fecha)}` : cuando.texto}»`, { tag: 'carta' });
  }
  return res.json({ ok: true, carta: verCarta(await base.carta(carta.id), req.yo) });
});

app.use('/api', (req, res) => res.status(404).json({ error: 'no_existe' }));

// ---------------------------------------------------------------- archivos
// En tu computadora los sirve Express; en Vercel los sirve su CDN desde public/.
app.use(express.static(path.join(__dirname, 'public'), {
  // Sin ETag ni Last-Modified: en Vercel los archivos de la función tienen todos la misma
  // fecha (2018), así que un index.html nuevo del mismo tamaño se vería "igual" (304) y el
  // navegador se quedaría con el viejo. Son archivos chiquitos: mejor bajarlos siempre.
  etag: false,
  lastModified: false,
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
