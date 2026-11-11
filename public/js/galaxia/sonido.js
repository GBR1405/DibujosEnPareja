// El sonido de la galaxia, con Web Audio:
//
//   - La música: public/galaxia/musica.mp3 (la pones tú). Suena en bucle, entra y sale
//     suavecito. Se reproduce con un <audio> conectado a Web Audio, así el volumen se
//     puede controlar también en iPhone (y no hay que cargar el archivo entero).
//   - La ruptura: public/galaxia/ruptura.mp3 (también tuya). Si no está, se arma una con
//     ruido y campanitas.
//   - Campanitas: notas de "cajita de música" hechas aquí mismo, en escala pentatónica
//     (así cualquier combinación suena bonita), con un poquito de eco.
//
// Los navegadores no dejan sonar nada hasta que la persona toque la pantalla (en iPhone,
// hasta que levante el dedo). Lo que se pide antes queda en espera y suena al primer
// toque. El audio solo se "despierta" en la galaxia: en iPhone, despertarlo puede pausar
// la música de otras apps, y eso no debe pasar mientras dibujan.

const ARCHIVOS = { musica: '/galaxia/musica.mp3', ruptura: '/galaxia/ruptura.mp3' };
const CLAVE_SILENCIO = 'garabatos-galaxia-silencio';
// Pentatónica de Do, en octavas altas (de cajita de música).
const ESCALA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32];
export const NOTAS = ESCALA.length;

let ctx = null;
let salida = null;    // todo pasa por aquí (silencio)
let efectos = null;   // campanitas y efectos
let musicaGain = null;
let eco = null;
let silenciado = false;
try { silenciado = localStorage.getItem(CLAVE_SILENCIO) === '1'; } catch { /* nada */ }

function impulsoDeEco(c, segundos = 2.6) {
  const largo = Math.floor(c.sampleRate * segundos);
  const buf = c.createBuffer(2, largo, c.sampleRate);
  for (let canal = 0; canal < 2; canal += 1) {
    const d = buf.getChannelData(canal);
    for (let i = 0; i < largo; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 3;
  }
  return buf;
}

export function contexto() {
  if (ctx) return ctx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try { ctx = new Ctx(); } catch { return null; }
  salida = ctx.createGain();
  salida.gain.value = silenciado ? 0 : 1;
  salida.connect(ctx.destination);
  efectos = ctx.createGain();
  efectos.gain.value = 0.55;
  efectos.connect(salida);
  musicaGain = ctx.createGain();
  musicaGain.gain.value = 0;
  musicaGain.connect(salida);
  eco = ctx.createConvolver();
  eco.buffer = impulsoDeEco(ctx);
  const ecoGain = ctx.createGain();
  ecoGain.gain.value = 0.35;
  eco.connect(ecoGain);
  ecoGain.connect(salida);
  return ctx;
}

// En iPhone (iOS 17+): que la música suene aunque el teléfono esté en silencio, como en
// cualquier app de música. Solo cuando empieza la música de la galaxia (si no, pausaría la
// música de otras apps con solo jalar la pantalla de Hoy). Al salir vuelve a lo normal.
function sesionDeAudio(tipo) {
  try { if (navigator.audioSession) navigator.audioSession.type = tipo; } catch { /* nada */ }
}

// Lo que quedó esperando a que el audio despierte. Los efectos caducan (una ruptura que
// suena 5 segundos tarde ya no tiene gracia); la música no.
let pendientes = [];
function correrPendientes() {
  const ahora = performance.now();
  const lista = pendientes;
  pendientes = [];
  for (const p of lista) if (!p.caduca || ahora - p.t < p.caduca) p.f();
}
function cuandoSuene(f, caduca = 0) {
  if (listo()) f();
  else pendientes.push({ f, t: performance.now(), caduca });
}

export function desbloquear() {
  const c = contexto();
  if (!c) return;
  if (c.state !== 'running') c.resume().then(correrPendientes, () => {});
  else if (pendientes.length) correrPendientes();
  // En iPhone, sonar algo (mudo) dentro del toque termina de despertarlo.
  try {
    const b = c.createBufferSource();
    b.buffer = c.createBuffer(1, 1, 22050);
    b.connect(c.destination);
    b.start(0);
  } catch { /* nada */ }
}
const listo = () => Boolean(ctx) && ctx.state === 'running';
export const sonando = listo;

// Despierta el audio con cada toque mientras dure la galaxia. Devuelve cómo quitarlo.
export function instalarDesbloqueo() {
  const eventos = ['pointerup', 'touchend', 'click', 'keydown'];
  for (const ev of eventos) window.addEventListener(ev, desbloquear, { capture: true, passive: true });
  return () => { for (const ev of eventos) window.removeEventListener(ev, desbloquear, { capture: true }); };
}

// Al salir de la galaxia: se apaga todo y el teléfono vuelve a lo suyo.
export function dormir({ fundido = 1 } = {}) {
  pararMusica({ fundido });
  pendientes = [];
  setTimeout(() => {
    if (ctx && ctx.state === 'running' && (!audio || audio.paused)) ctx.suspend().catch(() => {});
    sesionDeAudio('auto');
  }, fundido * 1000 + 300);
}

// ------------------------------------------------------------------ silencio
export const estaSilenciado = () => silenciado;
export function silenciar(si) {
  silenciado = si;
  try { localStorage.setItem(CLAVE_SILENCIO, si ? '1' : '0'); } catch { /* nada */ }
  if (salida && ctx) salida.gain.setTargetAtTime(si ? 0 : 1, ctx.currentTime, 0.15);
}

// ------------------------------------------------------------------ archivos cortos
// Se bajan apenas se pide (no hace falta el audio despierto) y se decodifican una vez.
const bajados = new Map();
const decodificados = new Map();
export function precargar(nombre) {
  if (!bajados.has(nombre)) {
    bajados.set(nombre, fetch(ARCHIVOS[nombre]).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null));
  }
  return bajados.get(nombre);
}
function buffer(nombre) {
  if (decodificados.has(nombre)) return decodificados.get(nombre);
  const c = contexto();
  const p = precargar(nombre).then((ab) => (ab && c
    ? new Promise((ok) => { try { c.decodeAudioData(ab, ok, () => ok(null)); } catch { ok(null); } })
    : null));
  decodificados.set(nombre, p);
  return p;
}

// Suena un archivo (si está) o su versión hecha a mano.
export function sonar(nombre, { volumen = 1 } = {}) {
  const c = contexto();
  if (!c) return;
  buffer(nombre); // se va decodificando mientras tanto
  cuandoSuene(async () => {
    const buf = await buffer(nombre);
    if (buf) {
      const s = c.createBufferSource();
      s.buffer = buf;
      const g = c.createGain();
      g.gain.value = volumen;
      s.connect(g);
      g.connect(salida);
      s.start();
    } else if (nombre === 'ruptura') {
      romperSintetico();
    }
  }, 4000);
}

// ------------------------------------------------------------------ campanitas
const frecuencia = (nota) => (nota > 40 ? nota : ESCALA[((Math.round(nota) % NOTAS) + NOTAS) % NOTAS]);

// Una nota de cajita de música. `nota`: índice en la escala (o una frecuencia en Hz).
export function campanita(nota = 0, { volumen = 0.22, cuando = 0, duracion = 1.8, conEco = true } = {}) {
  const c = ctx;
  if (!listo()) return;
  const f = frecuencia(nota);
  const t = c.currentTime + cuando;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  const filtro = c.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.value = 5200;
  g.connect(filtro);
  filtro.connect(efectos);
  if (conEco) filtro.connect(eco);
  // la nota y dos armónicos suaves (suena a metalito)
  [[1, 1, 'sine'], [2.0, 0.28, 'sine'], [3.01, 0.12, 'triangle']].forEach(([mult, amp, tipo]) => {
    const o = c.createOscillator();
    o.type = tipo;
    o.frequency.value = f * mult;
    const ga = c.createGain();
    ga.gain.value = amp;
    o.connect(ga);
    ga.connect(g);
    o.start(t);
    o.stop(t + duracion + 0.05);
  });
}

// Varias campanitas seguidas.
export function arpegio(notas = [0, 2, 4, 5, 7], { separacion = 0.09, volumen = 0.2, duracion = 1.8 } = {}) {
  notas.forEach((n, i) => campanita(n, { cuando: i * separacion, volumen, duracion }));
}

// Un "tin" de vidrio (cuando la pantalla se agrieta).
export function tin(intensidad = 1) {
  const c = ctx;
  if (!listo()) return;
  const t = c.currentTime;
  const f = 2600 + Math.random() * 2200;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(f * 0.92, t + 0.25);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12 * intensidad, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  o.connect(g);
  g.connect(efectos);
  g.connect(eco);
  o.start(t);
  o.stop(t + 0.32);
  ruido({ duracion: 0.05, volumen: 0.08 * intensidad, frecuencia: 6000 });
}

// Un crujido corto (la grieta que avanza).
export function crujido(intensidad = 1) {
  if (!listo()) return;
  ruido({ duracion: 0.07 + Math.random() * 0.06, volumen: 0.16 * intensidad, frecuencia: 1800 + Math.random() * 2400, q: 1.4 });
}

// Un "pop" suavecito (burbujas, botones, stickers).
export function pop({ alto = 1, volumen = 0.18 } = {}) {
  const c = ctx;
  if (!listo()) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(380 * alto, t);
  o.frequency.exponentialRampToValueAtTime(900 * alto, t + 0.08);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  o.connect(g);
  g.connect(efectos);
  o.start(t);
  o.stop(t + 0.18);
}

// Un "fiuuu" que sube o baja (saltos, estrellas que se van).
export function fiu({ desde = 500, hasta = 1400, duracion = 0.35, volumen = 0.1 } = {}) {
  const c = ctx;
  if (!listo()) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(desde, t);
  o.frequency.exponentialRampToValueAtTime(hasta, t + duracion);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duracion);
  o.connect(g);
  g.connect(efectos);
  g.connect(eco);
  o.start(t);
  o.stop(t + duracion + 0.05);
}

function ruido({ duracion = 0.2, volumen = 0.2, frecuencia: fr = 3000, cuando = 0, q = 0.8 } = {}) {
  const c = ctx;
  const t = c.currentTime + cuando;
  const largo = Math.ceil(c.sampleRate * duracion);
  const buf = c.createBuffer(1, largo, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < largo; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / largo) ** 2;
  const s = c.createBufferSource();
  s.buffer = buf;
  const filtro = c.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = fr;
  filtro.Q.value = q;
  const g = c.createGain();
  g.gain.value = volumen;
  s.connect(filtro);
  filtro.connect(g);
  g.connect(efectos);
  s.start(t);
}

// La ruptura hecha a mano (si no está ruptura.mp3): un crujido, vidrio y campanitas.
export function romperSintetico() {
  if (!listo()) return;
  ruido({ duracion: 0.5, volumen: 0.5, frecuencia: 2400, q: 0.6 });
  ruido({ duracion: 0.9, volumen: 0.25, frecuencia: 7000, q: 1.2, cuando: 0.04 });
  for (let i = 0; i < 14; i += 1) setTimeout(() => tin(0.5 + Math.random() * 0.6), 40 + i * (30 + Math.random() * 60));
  arpegio([11, 9, 7, 5, 4, 2, 0], { separacion: 0.12, volumen: 0.12 });
}

// ------------------------------------------------------------------ la música
let audio = null;
let sinArchivo = false;
let ambienteActivo = false;
let ambienteReloj = null;
let volumenMusica = 0.55;

export function iniciarMusica({ volumen = 0.55, fundido = 2.5 } = {}) {
  const c = contexto();
  if (!c) return;
  volumenMusica = volumen;
  cuandoSuene(() => {
    if (sinArchivo) { ambiente(true); return; }
    if (!audio) {
      audio = new Audio(ARCHIVOS.musica);
      audio.loop = true;
      audio.preload = 'auto';
      audio.addEventListener('error', () => { sinArchivo = true; ambiente(true); }, { once: true });
      try { c.createMediaElementSource(audio).connect(musicaGain); } catch { /* suena directo */ }
    }
    sesionDeAudio('playback');
    musicaGain.gain.cancelScheduledValues(c.currentTime);
    musicaGain.gain.setValueAtTime(musicaGain.gain.value, c.currentTime);
    musicaGain.gain.linearRampToValueAtTime(volumen, c.currentTime + fundido);
    audio.play().catch(() => {});
  });
}

// Baja la música un ratito (para que se escuche algo encima) y la vuelve a subir.
export function bajarMusica(si, { fundido = 0.6 } = {}) {
  if (!ctx || !musicaGain) return;
  const t = ctx.currentTime;
  musicaGain.gain.cancelScheduledValues(t);
  musicaGain.gain.setValueAtTime(musicaGain.gain.value, t);
  musicaGain.gain.linearRampToValueAtTime(si ? volumenMusica * 0.35 : volumenMusica, t + fundido);
}

export function pararMusica({ fundido = 1.2 } = {}) {
  ambiente(false);
  if (!ctx || !audio) return;
  musicaGain.gain.cancelScheduledValues(ctx.currentTime);
  musicaGain.gain.setValueAtTime(musicaGain.gain.value, ctx.currentTime);
  musicaGain.gain.linearRampToValueAtTime(0, ctx.currentTime + fundido);
  const a = audio;
  setTimeout(() => { if (musicaGain.gain.value < 0.01) a.pause(); }, fundido * 1000 + 100);
}

// Si no hay música (todavía no pusieron el archivo): campanitas de viento, despacito.
function ambiente(si) {
  if (si === ambienteActivo) return;
  ambienteActivo = si;
  clearTimeout(ambienteReloj);
  if (!si) return;
  const tocar = () => {
    if (!ambienteActivo) return;
    const base = Math.floor(Math.random() * 6);
    campanita(base, { volumen: 0.07 + Math.random() * 0.05, duracion: 3 });
    if (Math.random() < 0.4) campanita(base + 2, { volumen: 0.05, cuando: 0.35, duracion: 3 });
    ambienteReloj = setTimeout(tocar, 1800 + Math.random() * 3200);
  };
  tocar();
}
