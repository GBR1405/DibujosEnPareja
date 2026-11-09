// El lienzo de dibujo.
//
// Todo lo que se dibuja se guarda como una lista de operaciones (trazos, formas, balde,
// "limpiar"…). Deshacer y rehacer solo quitan y ponen operaciones y vuelven a pintar,
// así que no gastan memoria por cada paso.
//
// Tiene 2 capas (cada una es un <canvas> transparente encima del papel). Cada operación
// sabe en qué capa va. Para que deshacer dé siempre lo mismo, el balde mira el dibujo
// completo (todas las capas juntas) y pinta solo en la suya.
//
// Pinceles: pincel redondo (cambia con la presión), tinta (perfect-freehand), lápiz (con
// grano), marcador (transparente, se multiplica) y aerógrafo (puntitos). Además: borrador,
// balde, formas, gotero, espejo (lo que dibujas sale reflejado) y estabilizador (suaviza el
// pulso; mientras más fuerte, más "se arrastra" la línea detrás del dedo).
//
// El tamaño interno es fijo (3:4) para que los dibujos de las dos personas sean
// comparables sin importar si dibujan en teléfono o iPad.
//
// Modos especiales (para los retos y el personaje):
//   zona      solo se puede pintar dentro de ese rectángulo (Mitad y mitad)
//   fijo      una imagen de fondo que no se puede borrar (la mitad de la pareja, el garabato)
//   guia      una imagen de ayuda debajo de todo que no sale en el dibujo (el monito)
//   papel     null = fondo transparente (el personaje)
//   maxTrazos cuántos trazos se pueden hacer (Termina mi garabato)

import { rellenar, hexARgb } from './balde.js';
import { getStroke } from '../vendor/freehand.js';

export const ANCHO = 1200;
export const ALTO = 1600;
const FINAL = { ancho: 720, alto: 960 }; // lo que se envía; el servidor lo comprime a pocos KB
const PAPEL = '#fffdf7';
const MAX_ENVIO = 2_400_000; // caracteres del data URL; el servidor acepta hasta 2.8 M

// Grosor del pincel, en píxeles del lienzo interno (1200 de ancho). El borrador es más
// ancho: FACTOR_BORRADOR veces el grosor elegido.
export const GROSOR = { min: 2, max: 72, inicial: 12 };
export const FACTOR_BORRADOR = 2.4;
export const CAPAS = 2;
const GRACIA_LAPIZ_MS = 1500;

export const PINCELES = [
  { id: 'redondo', nombre: 'Pincel', ayuda: 'Cambia con la presión' },
  { id: 'tinta', nombre: 'Tinta', ayuda: 'Puntas finitas, suave' },
  { id: 'lapiz', nombre: 'Lápiz', ayuda: 'Con grano de grafito' },
  { id: 'marcador', nombre: 'Marcador', ayuda: 'Transparente, se encima' },
  { id: 'aerografo', nombre: 'Aerógrafo', ayuda: 'Puntitos como spray' },
];
// Cuánto se transparenta cada pincel (además de la opacidad elegida) y cómo se mezcla.
const MEZCLA = {
  redondo: { alfa: 1, modo: 'source-over' },
  tinta: { alfa: 1, modo: 'source-over' },
  lapiz: { alfa: 0.92, modo: 'source-over' },
  marcador: { alfa: 0.5, modo: 'multiply' },
  aerografo: { alfa: 1, modo: 'source-over' },
};

const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// Azar con semilla (mulberry32): el aerógrafo y el grano del lápiz salen iguales al repintar.
function azar(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ pinceles
function grosorDe(size, w, borrar) {
  return size * (borrar ? FACTOR_BORRADOR : 1) * w;
}

// Tramo k de un trazo (de 1 a n-1): de punto medio a punto medio con curvas, lo que
// suaviza el temblor de la mano.
function tramo(c, pts, k, ancho) {
  const n = pts.length;
  const inicio = k === 1 ? pts[0] : medio(pts[k - 1], pts[k]);
  c.lineWidth = ancho((pts[k][2] + pts[Math.min(k + 1, n - 1)][2]) / 2);
  c.beginPath();
  c.moveTo(inicio[0], inicio[1]);
  if (k <= n - 2) {
    const fin = medio(pts[k], pts[k + 1]);
    c.quadraticCurveTo(pts[k][0], pts[k][1], fin[0], fin[1]);
  } else {
    c.lineTo(pts[n - 1][0], pts[n - 1][1]);
  }
  c.stroke();
}

function punto(c, p, diametro) {
  c.beginPath();
  c.arc(p[0], p[1], diametro / 2, 0, Math.PI * 2);
  c.fill();
}

// El grano del lápiz: un ruido fijo que se usa como "textura" del trazo.
let ruido = null;
function canvasRuido() {
  if (ruido) return ruido;
  const lado = 96;
  ruido = document.createElement('canvas');
  ruido.width = lado;
  ruido.height = lado;
  const x = ruido.getContext('2d');
  const im = x.createImageData(lado, lado);
  const r = azar(1234);
  for (let i = 0; i < lado * lado; i += 1) {
    const v = r();
    im.data[i * 4 + 3] = v < 0.22 ? 0 : Math.round(120 + v * 135);
  }
  x.putImageData(im, 0, 0);
  return ruido;
}
const patrones = new WeakMap();
function patronLapiz(c, color) {
  let m = patrones.get(c);
  if (!m) { m = new Map(); patrones.set(c, m); }
  if (!m.has(color)) {
    const p = document.createElement('canvas');
    p.width = 96;
    p.height = 96;
    const x = p.getContext('2d');
    x.fillStyle = color;
    x.fillRect(0, 0, 96, 96);
    x.globalCompositeOperation = 'destination-in';
    x.drawImage(canvasRuido(), 0, 0);
    m.set(color, c.createPattern(p, 'repeat'));
  }
  return m.get(color);
}

// Aerógrafo: puntitos al azar (con semilla) alrededor del tramo que termina en el punto k.
function rociar(c, pts, k, size, semilla) {
  const r = azar(semilla * 7919 + k * 104729);
  const [x1, y1, w1] = pts[k];
  const prev = k > 0 ? pts[k - 1] : pts[k];
  const dist = Math.hypot(x1 - prev[0], y1 - prev[1]);
  const radio = size * 2.6 * (0.6 + 0.4 * Math.min(1.4, w1));
  const n = Math.max(8, Math.min(320, Math.round((dist + 3) * radio * 0.09)));
  for (let i = 0; i < n; i += 1) {
    const t = r();
    const px = prev[0] + (x1 - prev[0]) * t;
    const py = prev[1] + (y1 - prev[1]) * t;
    const ang = r() * Math.PI * 2;
    const rad = r() * r() * radio * 1.15; // más denso en el centro
    const tam = 1.5 + r() * 2.8;
    c.fillRect(px + Math.cos(ang) * rad - tam / 2, py + Math.sin(ang) * rad - tam / 2, tam, tam);
  }
}

// Tinta: el contorno del trazo lo calcula perfect-freehand (con puntas finitas).
function tinta(c, pts, size, pen, ultimo) {
  const entrada = pts.map(([x, y, w]) => [x, y, pen ? Math.min(1, Math.max(0.05, (w - 0.35) / 1.1)) : 0.5]);
  const contorno = getStroke(entrada, {
    size: size * 1.3, thinning: 0.62, smoothing: 0.55, streamline: 0.3, simulatePressure: !pen, last: ultimo,
    start: { taper: size * 2.5, cap: true }, end: { taper: size * 2.5, cap: true },
  });
  if (contorno.length < 3) { punto(c, pts[0], size); return; }
  c.beginPath();
  c.moveTo(contorno[0][0], contorno[0][1]);
  for (let i = 1; i < contorno.length; i += 1) {
    const a = contorno[i];
    const b = contorno[(i + 1) % contorno.length];
    c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
  }
  c.closePath();
  c.fill();
}

// Marcador: el trazo entero de un solo golpe, del mismo ancho (así no se oscurece donde
// se cruza consigo mismo; con otros trazos sí, como un marcador de verdad).
function marcador(c, pts, size) {
  c.lineWidth = size * 1.6;
  c.beginPath();
  c.moveTo(pts[0][0], pts[0][1]);
  if (pts.length === 1) c.lineTo(pts[0][0] + 0.1, pts[0][1]);
  for (let k = 1; k < pts.length - 1; k += 1) {
    const m = medio(pts[k], pts[k + 1]);
    c.quadraticCurveTo(pts[k][0], pts[k][1], m[0], m[1]);
  }
  if (pts.length > 1) c.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]);
  c.stroke();
}

function estilo(c, color) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = color;
  c.fillStyle = color;
}

// Pinta un trazo completo (para repintar). `listas`: los puntos y, con espejo, los reflejados.
function pintarTrazo(c, op, listas) {
  estilo(c, op.borrar ? '#000' : op.color);
  for (const [i, pts] of listas.entries()) {
    const pincel = op.borrar ? 'redondo' : op.pincel || 'redondo';
    if (pincel === 'tinta') tinta(c, pts, op.size, op.pen, true);
    else if (pincel === 'marcador') marcador(c, pts, op.size);
    else if (pincel === 'aerografo') for (let k = 0; k < pts.length; k += 1) rociar(c, pts, k, op.size, op.semilla + i);
    else {
      const factor = pincel === 'lapiz' ? 0.55 : 1;
      if (pincel === 'lapiz') { c.strokeStyle = patronLapiz(c, op.color); c.fillStyle = c.strokeStyle; }
      const ancho = (w) => grosorDe(op.size * factor, w, op.borrar);
      if (pts.length === 1) punto(c, pts[0], ancho(pts[0][2]));
      for (let k = 1; k < pts.length; k += 1) tramo(c, pts, k, ancho);
    }
  }
}

function caminoDeForma(c, forma, a, b) {
  const x0 = Math.min(a[0], b[0]);
  const y0 = Math.min(a[1], b[1]);
  const x1 = Math.max(a[0], b[0]);
  const y1 = Math.max(a[1], b[1]);
  const w = x1 - x0;
  const hh = y1 - y0;
  const cx = x0 + w / 2;
  const cy = y0 + hh / 2;
  c.beginPath();
  switch (forma) {
    case 'linea':
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      break;
    case 'flecha': {
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const punta = Math.min(90, Math.hypot(b[0] - a[0], b[1] - a[1]) * 0.35);
      c.moveTo(a[0], a[1]);
      c.lineTo(b[0], b[1]);
      c.moveTo(b[0] - punta * Math.cos(ang - 0.5), b[1] - punta * Math.sin(ang - 0.5));
      c.lineTo(b[0], b[1]);
      c.lineTo(b[0] - punta * Math.cos(ang + 0.5), b[1] - punta * Math.sin(ang + 0.5));
      break;
    }
    case 'circulo':
      c.ellipse(cx, cy, Math.max(w / 2, 0.5), Math.max(hh / 2, 0.5), 0, 0, Math.PI * 2);
      break;
    case 'cuadrado':
      c.rect(x0, y0, w, hh);
      break;
    case 'rombo':
      c.moveTo(cx, y0);
      c.lineTo(x1, cy);
      c.lineTo(cx, y1);
      c.lineTo(x0, cy);
      c.closePath();
      break;
    case 'triangulo':
      c.moveTo(cx, y0);
      c.lineTo(x1, y1);
      c.lineTo(x0, y1);
      c.closePath();
      break;
    case 'corazon': {
      const alto = hh * 0.3;
      const bajo = (hh + alto) / 2;
      c.moveTo(cx, y0 + alto);
      c.bezierCurveTo(cx, y0, x0, y0, x0, y0 + alto);
      c.bezierCurveTo(x0, y0 + bajo, cx, y0 + bajo, cx, y1);
      c.bezierCurveTo(cx, y0 + bajo, x1, y0 + bajo, x1, y0 + alto);
      c.bezierCurveTo(x1, y0, cx, y0, cx, y0 + alto);
      c.closePath();
      break;
    }
    case 'estrella': {
      for (let i = 0; i < 10; i += 1) {
        const radio = i % 2 === 0 ? 1 : 0.46;
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const px = cx + Math.cos(ang) * (w / 2) * radio;
        const py = cy + Math.sin(ang) * (hh / 2) * radio;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath();
      break;
    }
    default:
  }
}

function pintarForma(c, op, W) {
  estilo(c, op.color);
  c.lineWidth = op.size;
  const pares = op.espejo ? [[op.a, op.b], [[W - op.a[0], op.a[1]], [W - op.b[0], op.b[1]]]] : [[op.a, op.b]];
  for (const [a, b] of pares) {
    caminoDeForma(c, op.forma, a, b);
    if (op.relleno && op.forma !== 'linea' && op.forma !== 'flecha') c.fill();
    c.stroke();
  }
}

// ------------------------------------------------------------------ exportar
let webpConAlfa = null;
function sabeWebp() {
  if (webpConAlfa === null) {
    const c = document.createElement('canvas');
    c.width = 2;
    c.height = 2;
    webpConAlfa = c.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpConAlfa;
}

// Para enviar: casi sin pérdida (WebP, o PNG en Safari, que no sabe crear WebP).
// El servidor hace la compresión fuerte una sola vez, al terminar.
function codificarFinal(canvas, transparente) {
  let url = canvas.toDataURL('image/webp', 0.95);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/png');
  if (url.length > MAX_ENVIO && !transparente) url = canvas.toDataURL('image/jpeg', 0.92);
  return url;
}

function reducir(origen, ancho, alto) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(origen, 0, 0, ancho, alto);
  return c;
}

const lienzoNuevo = (W, H, clase) => {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  if (clase) c.className = clase;
  return c;
};

// ------------------------------------------------------------------ lienzo
export function crearLienzo(caja, opciones = {}) {
  const {
    alCambiar, alGotero, alLimite, alAviso,
    ancho: W = ANCHO, alto: H = ALTO,
    papel = PAPEL, zona = null, fijo = null, guia = null, maxTrazos = null,
  } = opciones;

  caja.classList.toggle('transparente', !papel);
  caja.style.setProperty('--papel', papel || 'transparent');
  caja.style.aspectRatio = `${W} / ${H}`;

  // Debajo de todo: la imagen fija y la guía; luego las 2 capas; arriba, la vista.
  const fijoCanvas = fijo ? lienzoNuevo(W, H, 'lienzo lienzo-fijo') : null;
  if (fijoCanvas) fijoCanvas.getContext('2d').drawImage(fijo, 0, 0, W, H);
  const guiaCanvas = guia ? lienzoNuevo(W, H, 'lienzo lienzo-guia') : null;
  if (guiaCanvas) guiaCanvas.getContext('2d').drawImage(guia, 0, 0, W, H);
  const capas = Array.from({ length: CAPAS }, (_, i) => ({ canvas: lienzoNuevo(W, H, `lienzo lienzo-capa capa-${i}`), visible: true, opacidad: 1 }));
  const viva = lienzoNuevo(W, H, 'lienzo lienzo-viva');    // el trazo mientras se dibuja
  const vista = lienzoNuevo(W, H, 'lienzo lienzo-vista');  // la forma mientras se arrastra (y los dedos)
  const borrador = lienzoNuevo(W, H);                      // de trabajo (no se ve)
  caja.append(...[fijoCanvas, guiaCanvas, ...capas.map((c) => c.canvas), viva, vista].filter(Boolean));
  if (zona) {
    // Lo que no se puede tocar se ve rayadito.
    const velo = document.createElement('div');
    velo.className = 'lienzo-velo';
    const izq = zona.x <= 0;
    velo.style.left = izq ? `${((zona.x + zona.w) / W) * 100}%` : '0';
    velo.style.width = `${(1 - zona.w / W) * 100}%`;
    caja.append(velo);
  }
  const ctxs = capas.map((c) => c.canvas.getContext('2d', { willReadFrequently: false }));
  const cviva = viva.getContext('2d');
  const cv = vista.getContext('2d');
  const cb = borrador.getContext('2d', { willReadFrequently: true });
  const limpiarVista = () => cv.clearRect(0, 0, W, H);

  const estado = {
    herramienta: 'pluma', pincel: 'redondo', color: '#2b2220', grosor: GROSOR.inicial, opacidad: 1,
    estabilizador: 0, espejo: false, forma: 'corazon', relleno: false, capa: 0,
  };
  const grosor = () => Math.min(GROSOR.max, Math.max(GROSOR.min, Number(estado.grosor) || GROSOR.inicial));
  let ops = [];
  let rehacerPila = [];
  const bases = Array(CAPAS).fill(null);
  let activo = null;
  let rect = null;
  let ultimoLapiz = 0;
  let semillas = Math.floor(Math.random() * 1e6);

  const recortar = (c) => {
    if (!zona) return;
    c.beginPath();
    c.rect(zona.x, zona.y, zona.w, zona.h);
    c.clip();
  };
  const espejar = (pts) => pts.map(([x, y, w]) => [W - x, y, w]);

  // ---- capas en pantalla
  function mostrarCapas() {
    capas.forEach((c) => {
      c.canvas.style.opacity = String(c.opacidad);
      c.canvas.style.display = c.visible ? '' : 'none';
    });
    // El trazo vivo va justo encima de la capa activa (así se ve en su lugar).
    capas[estado.capa].canvas.after(viva);
  }

  // ---- repintar
  // Un trazo o una forma se pinta primero en el lienzo de trabajo y de ahí pasa a su
  // capa con su transparencia (igual que mientras se dibuja, en el lienzo "vivo").
  function cajaDe(op) {
    const margen = op.size * (op.pincel === 'aerografo' ? 4.4 : 2) + 4;
    const pts = op.t === 'forma' ? [op.a, op.b] : op.pts;
    let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (op.espejo) { const a = W - x1; const b = W - x0; x0 = Math.min(x0, a); x1 = Math.max(x1, b); }
    x0 = Math.max(0, Math.floor(x0 - margen)); y0 = Math.max(0, Math.floor(y0 - margen));
    x1 = Math.min(W, Math.ceil(x1 + margen)); y1 = Math.min(H, Math.ceil(y1 + margen));
    return { x: x0, y: y0, w: Math.max(1, x1 - x0), h: Math.max(1, y1 - y0) };
  }

  function pasarACapa(origen, op, r) {
    const c = ctxs[op.capa];
    const mezcla = MEZCLA[op.pincel] || MEZCLA.redondo;
    c.save();
    recortar(c);
    c.globalAlpha = (op.alpha == null ? 1 : op.alpha) * (op.t === 'forma' ? 1 : mezcla.alfa);
    c.globalCompositeOperation = op.t === 'forma' ? 'source-over' : mezcla.modo;
    c.drawImage(origen, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
    c.restore();
  }

  // Todo el dibujo junto (papel, fondo fijo y las dos capas enteras), en el lienzo de trabajo.
  function componerTodo({ soloVisibles = false } = {}) {
    cb.save();
    cb.globalAlpha = 1;
    cb.globalCompositeOperation = 'source-over';
    cb.clearRect(0, 0, W, H);
    if (papel) { cb.fillStyle = papel; cb.fillRect(0, 0, W, H); }
    if (fijoCanvas) cb.drawImage(fijoCanvas, 0, 0);
    for (const c of capas) {
      if (soloVisibles && !c.visible) continue;
      cb.globalAlpha = soloVisibles ? c.opacidad : 1;
      cb.drawImage(c.canvas, 0, 0);
    }
    cb.restore();
  }

  function pintarBalde(op) {
    componerTodo();
    const imagen = cb.getImageData(0, 0, W, H);
    const antes = new Uint8ClampedArray(imagen.data);
    // Sin papel (personaje), el fondo transparente cuenta como blanco para el balde.
    if (!papel) {
      for (let p = 0; p < antes.length; p += 4) {
        if (antes[p + 3] < 255) {
          const a = antes[p + 3] / 255;
          for (let k = 0; k < 3; k += 1) imagen.data[p + k] = Math.round(imagen.data[p + k] * a + 255 * (1 - a));
          imagen.data[p + 3] = 255;
        }
      }
      antes.set(imagen.data);
    }
    const cambio = rellenar(imagen, op.x, op.y, hexARgb(op.color));
    if (!cambio) return false;
    const c = ctxs[op.capa];
    const x0 = zona ? Math.max(cambio.x, zona.x) : cambio.x;
    const y0 = zona ? Math.max(cambio.y, zona.y) : cambio.y;
    const x1 = zona ? Math.min(cambio.x + cambio.w, zona.x + zona.w) : cambio.x + cambio.w;
    const y1 = zona ? Math.min(cambio.y + cambio.h, zona.y + zona.h) : cambio.y + cambio.h;
    if (x1 <= x0 || y1 <= y0) return false;
    const destino = c.getImageData(x0, y0, x1 - x0, y1 - y0);
    const d = destino.data;
    const n = imagen.data;
    let algo = false;
    for (let y = y0; y < y1; y += 1) {
      for (let x = x0; x < x1; x += 1) {
        const p = (y * W + x) * 4;
        if (n[p] === antes[p] && n[p + 1] === antes[p + 1] && n[p + 2] === antes[p + 2]) continue;
        const q = ((y - y0) * (x1 - x0) + (x - x0)) * 4;
        d[q] = n[p]; d[q + 1] = n[p + 1]; d[q + 2] = n[p + 2]; d[q + 3] = 255;
        algo = true;
      }
    }
    if (algo) c.putImageData(destino, x0, y0);
    return algo;
  }

  function pintarOp(op) {
    const capa = op.capa == null ? 0 : op.capa;
    const c = ctxs[capa];
    if (op.t === 'trazo') {
      const listas = op.espejo ? [op.pts, espejar(op.pts)] : [op.pts];
      if (op.borrar) {
        c.save();
        recortar(c);
        c.globalCompositeOperation = 'destination-out';
        pintarTrazo(c, op, listas);
        c.restore();
        return;
      }
      const r = cajaDe(op);
      cb.clearRect(r.x, r.y, r.w, r.h);
      pintarTrazo(cb, op, listas);
      pasarACapa(borrador, { ...op, capa }, r);
      cb.clearRect(r.x, r.y, r.w, r.h);
    } else if (op.t === 'forma') {
      const r = cajaDe(op);
      cb.clearRect(r.x, r.y, r.w, r.h);
      pintarForma(cb, op, W);
      pasarACapa(borrador, { ...op, capa }, r);
      cb.clearRect(r.x, r.y, r.w, r.h);
    } else if (op.t === 'balde') {
      pintarBalde({ ...op, capa });
    } else if (op.t === 'imagen') {
      c.save();
      recortar(c);
      c.drawImage(op.img, 0, 0, W, H);
      c.restore();
    } else if (op.t === 'juntar') {
      ctxs[0].save();
      ctxs[0].globalAlpha = op.alpha;
      ctxs[0].drawImage(capas[1].canvas, 0, 0);
      ctxs[0].restore();
      ctxs[1].clearRect(0, 0, W, H);
    } else if (op.t === 'limpiar') {
      const cuales = op.capa == null ? ctxs : [c];
      for (const x of cuales) x.clearRect(0, 0, W, H);
    }
  }

  function redibujar() {
    ctxs.forEach((c, i) => {
      c.clearRect(0, 0, W, H);
      if (bases[i]) c.drawImage(bases[i], 0, 0, W, H);
    });
    for (const op of ops) pintarOp(op);
  }

  const contarTrazos = () => ops.filter((o) => (o.t === 'trazo' && !o.borrar) || o.t === 'forma').length;
  const avisar = () => alCambiar && alCambiar({ puedeDeshacer: ops.length > 0, puedeRehacer: rehacerPila.length > 0, trazos: contarTrazos() });

  function confirmarOp(op) {
    ops.push(op);
    rehacerPila = [];
    avisar();
  }

  // Un circulito del color que se expande donde cayó el balde.
  function onda(x, y, color) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const el = document.createElement('span');
    el.className = 'balde-onda';
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.style.setProperty('--color', color);
    caja.append(el);
    setTimeout(() => el.remove(), 600);
  }

  // El color que se ve en ese punto (para el gotero).
  function muestrear(x, y) {
    const px = Math.min(W - 1, Math.max(0, Math.round(x)));
    const py = Math.min(H - 1, Math.max(0, Math.round(y)));
    let [r, g, b] = papel ? hexARgb(papel) : [255, 255, 255];
    const encima = (canvas, alfa = 1) => {
      const d = canvas.getContext('2d').getImageData(px, py, 1, 1).data;
      const a = (d[3] / 255) * alfa;
      r = d[0] * a + r * (1 - a); g = d[1] * a + g * (1 - a); b = d[2] * a + b * (1 - a);
    };
    if (fijoCanvas) encima(fijoCanvas);
    for (const c of capas) if (c.visible) encima(c.canvas, c.opacidad);
    return `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
  }

  // ---- punteros
  function puntoDe(e) {
    const w = e.pointerType === 'pen' ? Math.round((0.35 + 1.1 * (e.pressure || 0.5)) * 100) / 100 : 1;
    return [(e.clientX - rect.left) * (W / rect.width), (e.clientY - rect.top) * (H / rect.height), w];
  }

  // Estabilizador: el punto que se dibuja persigue al dedo (más lento mientras más fuerte).
  function suavizar(p) {
    const nivel = Number(estado.estabilizador) || 0;
    if (!nivel || !activo.suave) { activo.suave = p.slice(); return p.slice(); }
    const k = 1 - Math.min(0.9, nivel * 0.085);
    const s = activo.suave;
    s[0] += (p[0] - s[0]) * k;
    s[1] += (p[1] - s[1]) * k;
    s[2] += (p[2] - s[2]) * k;
    return [s[0], s[1], s[2]];
  }

  const enZona = (p) => !zona || (p[0] >= zona.x && p[0] <= zona.x + zona.w && p[1] >= zona.y && p[1] <= zona.y + zona.h);
  const pinta = (h) => h === 'pluma' || h === 'formas';

  vista.addEventListener('pointerdown', (e) => {
    if (activo) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Si se está usando el Apple Pencil, la palma de la mano no debe pintar.
    if (e.pointerType === 'pen') ultimoLapiz = Date.now();
    else if (e.pointerType === 'touch' && Date.now() - ultimoLapiz < GRACIA_LAPIZ_MS) return;

    e.preventDefault();
    limpiarVista();
    rect = vista.getBoundingClientRect();
    const p = puntoDe(e);
    const herramienta = estado.herramienta;

    if (herramienta === 'gotero') {
      if (alGotero) alGotero(muestrear(p[0], p[1]));
      return;
    }
    if (!capas[estado.capa].visible) {
      if (alAviso) alAviso('Esa capa está escondida 🙈 Tócale el ojito para verla.');
      return;
    }
    if (zona && !enZona(p)) {
      if (alAviso) alAviso('Esa mitad no es tuya 😉');
      return;
    }
    if (maxTrazos != null && pinta(herramienta) && contarTrazos() >= maxTrazos) {
      if (alLimite) alLimite();
      return;
    }
    try { vista.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo */ }

    if (herramienta === 'balde') {
      // Un toque y listo: no hay trazo que seguir.
      const op = { t: 'balde', capa: estado.capa, x: Math.round(p[0]), y: Math.round(p[1]), color: estado.color };
      if (pintarBalde(op)) {
        confirmarOp(op);
        onda(e.clientX - rect.left, e.clientY - rect.top, op.color);
      }
      try { vista.releasePointerCapture(e.pointerId); } catch { /* nada */ }
      return;
    }
    if (herramienta === 'formas') {
      activo = { id: e.pointerId, tipo: 'forma', a: p, b: p };
      return;
    }

    const borrar = herramienta === 'borrador';
    semillas += 1;
    const op = {
      t: 'trazo', capa: estado.capa, pincel: borrar ? 'redondo' : estado.pincel, color: estado.color, size: grosor(),
      alpha: borrar ? 1 : estado.opacidad, borrar, espejo: Boolean(estado.espejo) && !zona, pen: e.pointerType === 'pen', semilla: semillas, pts: [p],
    };
    activo = { id: e.pointerId, tipo: 'trazo', op, crudo: p, suave: null };
    suavizar(p);
    empezarVivo(op);
  });

  // ---- el trazo "vivo" (mientras el dedo se mueve)
  // El borrador borra directo en su capa; lo demás se pinta en `viva`, que se ve con la
  // misma transparencia que tendrá, y al soltar pasa a la capa.
  function contextoVivo(op) {
    if (op.borrar) {
      const c = ctxs[op.capa];
      c.save();
      recortar(c);
      c.globalCompositeOperation = 'destination-out';
      estilo(c, '#000');
      return c;
    }
    const mezcla = MEZCLA[op.pincel] || MEZCLA.redondo;
    viva.style.opacity = String(op.alpha * mezcla.alfa);
    viva.style.mixBlendMode = mezcla.modo === 'multiply' ? 'multiply' : 'normal';
    cviva.save();
    recortar(cviva);
    estilo(cviva, op.color);
    if (op.pincel === 'lapiz') { cviva.strokeStyle = patronLapiz(cviva, op.color); cviva.fillStyle = cviva.strokeStyle; }
    return cviva;
  }

  function empezarVivo(op) {
    activo.ctx = contextoVivo(op);
    pintarVivo(op, 0);
  }

  // Pinta lo nuevo del trazo: `desde` es el índice del primer punto nuevo.
  function pintarVivo(op, desde, final = false) {
    const c = activo.ctx;
    const listas = op.espejo ? [op.pts, espejar(op.pts)] : [op.pts];
    const pincel = op.borrar ? 'redondo' : op.pincel;
    if (pincel === 'tinta' || pincel === 'marcador') {
      // Estos se vuelven a pintar enteros cada vez (son un solo contorno).
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, W, H);
      c.restore();
      for (const pts of listas) {
        if (pincel === 'tinta') tinta(c, pts, op.size, op.pen, final);
        else marcador(c, pts, op.size);
      }
      return;
    }
    for (const [i, pts] of listas.entries()) {
      if (pincel === 'aerografo') {
        for (let k = desde; k < pts.length; k += 1) rociar(c, pts, k, op.size, op.semilla + i);
        continue;
      }
      const factor = pincel === 'lapiz' ? 0.55 : 1;
      const ancho = (w) => grosorDe(op.size * factor, w, op.borrar);
      if (desde === 0 && pts.length === 1) { punto(c, pts[0], ancho(pts[0][2])); continue; }
      // Cada punto nuevo permite dibujar el tramo anterior (que ya tiene con qué curvarse).
      for (let k = Math.max(1, desde - 1); k <= pts.length - 2; k += 1) tramo(c, pts, k, ancho);
      if (final && pts.length >= 2) tramo(c, pts, pts.length - 1, ancho);
    }
  }

  vista.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'pen') ultimoLapiz = Date.now();
    if (!activo || e.pointerId !== activo.id) return;
    e.preventDefault();
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const lista = eventos.length ? eventos : [e];

    if (activo.tipo === 'forma') {
      activo.b = puntoDe(lista[lista.length - 1]);
      limpiarVista();
      cv.save();
      recortar(cv);
      cv.globalAlpha = estado.opacidad;
      pintarForma(cv, { forma: estado.forma, color: estado.color, size: grosor(), relleno: estado.relleno, espejo: estado.espejo && !zona, a: activo.a, b: activo.b }, W);
      cv.restore();
      return;
    }

    const { op } = activo;
    const antes = op.pts.length;
    for (const ev of lista) {
      const crudo = puntoDe(ev);
      activo.crudo = crudo;
      const p = suavizar(crudo);
      const ultimo = op.pts[op.pts.length - 1];
      if (Math.hypot(p[0] - ultimo[0], p[1] - ultimo[1]) < 1.5) continue;
      op.pts.push(p);
    }
    if (op.pts.length > antes) pintarVivo(op, antes);
  });

  function terminar(e, cancelado) {
    if (!activo || e.pointerId !== activo.id) return;
    const a = activo;
    activo = null;

    if (a.tipo === 'forma') {
      limpiarVista();
      // por si algún evento rezagado alcanzó a dibujar la vista previa
      requestAnimationFrame(() => { if (!activo) limpiarVista(); });
      const largo = Math.hypot(a.b[0] - a.a[0], a.b[1] - a.a[1]);
      if (cancelado || largo < 12) return;
      const op = {
        t: 'forma', capa: estado.capa, forma: estado.forma, color: estado.color, size: grosor(), relleno: estado.relleno,
        alpha: estado.opacidad, espejo: Boolean(estado.espejo) && !zona, a: a.a, b: a.b,
      };
      pintarOp(op);
      confirmarOp(op);
      return;
    }

    const { op } = a;
    // Con estabilizador, la línea alcanza al dedo al soltar.
    if (estado.estabilizador && a.crudo) {
      const ultimo = op.pts[op.pts.length - 1];
      const dist = Math.hypot(a.crudo[0] - ultimo[0], a.crudo[1] - ultimo[1]);
      const pasos = Math.min(24, Math.floor(dist / 4));
      const antes = op.pts.length;
      for (let i = 1; i <= pasos; i += 1) {
        const t = i / pasos;
        op.pts.push([ultimo[0] + (a.crudo[0] - ultimo[0]) * t, ultimo[1] + (a.crudo[1] - ultimo[1]) * t, ultimo[2]]);
      }
      if (op.pts.length > antes) {
        activo = a; // pintarVivo usa activo.ctx
        pintarVivo(op, antes);
        activo = null;
      }
    }
    activo = a;
    pintarVivo(op, op.pts.length, true);
    activo = null;
    if (op.borrar) {
      a.ctx.restore();
    } else {
      cviva.restore();
      // Lo vivo pasa a la capa con su transparencia, y se limpia.
      pasarACapa(viva, op, cajaDe(op));
      cviva.clearRect(0, 0, W, H);
      viva.style.opacity = '1';
    }
    confirmarOp(op);
  }
  vista.addEventListener('pointerup', (e) => terminar(e, false));
  vista.addEventListener('pointercancel', (e) => terminar(e, true));
  vista.addEventListener('lostpointercapture', (e) => terminar(e, false));
  vista.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- tamaño en pantalla: el mayor W:H que quepa en el área disponible
  function ajustar() {
    const area = caja.parentElement;
    const est = getComputedStyle(area);
    const dispW = area.clientWidth - parseFloat(est.paddingLeft) - parseFloat(est.paddingRight);
    const dispH = area.clientHeight - parseFloat(est.paddingTop) - parseFloat(est.paddingBottom);
    if (dispW <= 0 || dispH <= 0) return;
    const ancho = Math.floor(Math.min(dispW, dispH * (W / H)));
    caja.style.width = `${ancho}px`;
    caja.style.height = `${Math.floor(ancho * (H / W))}px`;
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(caja.parentElement);
  ajustar();
  mostrarCapas();

  // ---- acciones
  function deshacer() {
    if (!ops.length || activo) return;
    rehacerPila.push(ops.pop());
    redibujar();
    avisar();
  }
  function rehacer() {
    if (!rehacerPila.length || activo) return;
    ops.push(rehacerPila.pop());
    redibujar();
    avisar();
  }
  // Borra una capa (o todo, sin `capa`). Se puede deshacer.
  function limpiar(capa = null) {
    const op = { t: 'limpiar', capa };
    pintarOp(op);
    confirmarOp(op);
  }
  function juntarCapas() {
    const op = { t: 'juntar', alpha: capas[1].opacidad };
    pintarOp(op);
    confirmarOp(op);
  }
  // Pone una imagen entera en una capa (por ejemplo, el cuerpo base del personaje).
  function ponerImagen(img, capa = estado.capa) {
    const op = { t: 'imagen', capa, img };
    pintarOp(op);
    confirmarOp(op);
  }

  // ¿Hay tinta en cada capa (después de su último "limpiar")?
  function tintaPorCapa() {
    const hay = bases.map(Boolean);
    for (const op of ops) {
      if (op.t === 'limpiar') { if (op.capa == null) hay.fill(false); else hay[op.capa] = false; }
      else if (op.t === 'juntar') { hay[0] = hay[0] || hay[1]; hay[1] = false; }
      else if (op.t === 'forma' || op.t === 'balde' || op.t === 'imagen' || (op.t === 'trazo' && !op.borrar)) hay[op.capa || 0] = true;
    }
    return hay;
  }
  const estaVacio = () => !tintaPorCapa().some(Boolean);

  // Lo que se envía: el papel, el fondo fijo y las capas visibles, con su transparencia.
  function exportarFinal({ ancho = FINAL.ancho, alto = Math.round((FINAL.ancho * H) / W) } = {}) {
    componerTodo({ soloVisibles: true });
    const url = codificarFinal(reducir(borrador, ancho, alto), !papel);
    cb.clearRect(0, 0, W, H);
    return url;
  }

  // Para el borrador de este aparato: cada capa como imagen (con su transparencia).
  function exportarCapas() {
    const tipo = sabeWebp() ? 'image/webp' : 'image/png';
    const hay = tintaPorCapa();
    return Promise.all(capas.map((c, i) => (hay[i]
      ? new Promise((ok) => { c.canvas.toBlob((b) => ok(b), tipo, 0.92); })
      : Promise.resolve(null))));
  }

  // Empieza con estas imágenes en las capas (lo que se recuperó del borrador).
  function cargarCapas(imagenes) {
    imagenes.forEach((img, i) => { if (i < CAPAS) bases[i] = img || null; });
    ops = [];
    rehacerPila = [];
    redibujar();
    avisar();
  }

  return {
    estado,
    ancho: W,
    alto: H,
    capas: capas.map((c) => ({ get visible() { return c.visible; }, get opacidad() { return c.opacidad; } })),
    deshacer,
    rehacer,
    limpiar,
    juntarCapas,
    ponerImagen,
    estaVacio,
    contarTrazos,
    tintaPorCapa,
    exportarFinal,
    exportarCapas,
    cargarCapas,
    // Lo de antes: una sola imagen (el borrador viejo) en la capa de abajo.
    cargarBase: (img) => cargarCapas([img, null]),
    elegirCapa(i) { estado.capa = i; mostrarCapas(); },
    ponerVisible(i, si) { capas[i].visible = si; mostrarCapas(); },
    ponerOpacidad(i, v) { capas[i].opacidad = Math.min(1, Math.max(0.05, v)); mostrarCapas(); },
    // Dibuja la capa `i` chiquita en `destino` (un canvas), para el panel de capas.
    miniatura(i, destino) {
      const x = destino.getContext('2d');
      x.clearRect(0, 0, destino.width, destino.height);
      x.drawImage(capas[i].canvas, 0, 0, destino.width, destino.height);
    },
    ajustar,
    // Cuántos píxeles de pantalla mide un píxel del lienzo (para mostrar el tamaño real del pincel).
    escala: () => caja.getBoundingClientRect().width / W,
    destruir: () => observador.disconnect(),
  };
}
