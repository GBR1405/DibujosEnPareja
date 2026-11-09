// El personaje de la casa: un monito gordito (cabeza grande, panza redonda, bracitos y
// piernitas) que cada quien dibuja encima como quiera. El "esqueleto" son estos huesos:
// después, en la casa, el dibujo se corta en 6 piezas (cada píxel va al hueso más cercano)
// y cada pieza se mueve sobre su articulación: así camina, se sienta, baila…
//
// Todo está en coordenadas del lienzo del personaje: 600 x 800, con los pies abajo.

import { carita } from '../iconos.js';

export const ANCHO = 600;
export const ALTO = 800;
export const PIES = 778; // dónde tocan el piso los pies

// Cada hueso es un segmento (a → b) con un grosor (r); la cabeza es un círculo.
// "I" y "D" son la izquierda y la derecha de quien mira la pantalla.
export const HUESOS = {
  cabeza: { a: [300, 190], b: [300, 190], r: 145 },
  torso: { a: [300, 335], b: [300, 545], r: 118 },
  brazoI: { a: [206, 372], b: [112, 560], r: 42 },
  brazoD: { a: [394, 372], b: [488, 560], r: 42 },
  piernaI: { a: [248, 592], b: [236, 770], r: 52 },
  piernaD: { a: [352, 592], b: [364, 770], r: 52 },
};
// Dónde gira cada pieza.
export const PIVOTES = {
  cabeza: [300, 322],
  torso: [300, 565],
  brazoI: [214, 368],
  brazoD: [386, 368],
  piernaI: [250, 582],
  piernaD: [350, 582],
};
export const PIEZAS = Object.keys(HUESOS);

// Distancia de (x, y) al segmento a-b.
function distancia(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const largo = dx * dx + dy * dy;
  const t = largo ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / largo)) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
}

// A qué pieza pertenece el punto (en coordenadas de 600 x 800).
export function piezaDe(x, y) {
  let mejor = 'torso';
  let menor = Infinity;
  for (const [nombre, hueso] of Object.entries(HUESOS)) {
    // Cuánto "afuera" de la pieza está (negativo = adentro).
    const d = distancia(x, y, hueso.a, hueso.b) - hueso.r;
    if (d < menor) { menor = d; mejor = nombre; }
  }
  return mejor;
}

const capsula = (ctx, [ax, ay], [bx, by], r) => {
  const ang = Math.atan2(by - ay, bx - ax);
  ctx.beginPath();
  ctx.arc(ax, ay, r, ang + Math.PI / 2, ang - Math.PI / 2);
  ctx.arc(bx, by, r, ang - Math.PI / 2, ang + Math.PI / 2);
  ctx.closePath();
};

// La guía para dibujar encima (no sale en el dibujo): el monito clarito y punteado.
export function dibujarGuia() {
  const c = document.createElement('canvas');
  c.width = ANCHO;
  c.height = ALTO;
  const ctx = c.getContext('2d');
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const forma = (dibujar) => {
    dibujar();
    ctx.fillStyle = 'rgba(211, 205, 248, .45)';
    ctx.fill();
    ctx.setLineDash([14, 12]);
    ctx.strokeStyle = 'rgba(58, 39, 69, .35)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.setLineDash([]);
  };
  const H = HUESOS;
  forma(() => capsula(ctx, H.piernaI.a, H.piernaI.b, H.piernaI.r - 6));
  forma(() => capsula(ctx, H.piernaD.a, H.piernaD.b, H.piernaD.r - 6));
  forma(() => capsula(ctx, H.brazoI.a, H.brazoI.b, H.brazoI.r - 6));
  forma(() => capsula(ctx, H.brazoD.a, H.brazoD.b, H.brazoD.r - 6));
  forma(() => { ctx.beginPath(); ctx.ellipse(300, 452, 128, 138, 0, 0, Math.PI * 2); });
  forma(() => { ctx.beginPath(); ctx.arc(H.cabeza.a[0], H.cabeza.a[1], H.cabeza.r - 8, 0, Math.PI * 2); });
  // las articulaciones
  ctx.fillStyle = 'rgba(255, 111, 145, .55)';
  for (const [x, y] of Object.values(PIVOTES)) { ctx.beginPath(); ctx.arc(x, y, 9, 0, Math.PI * 2); ctx.fill(); }
  // el piso
  ctx.strokeStyle = 'rgba(58, 39, 69, .25)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(150, PIES + 6);
  ctx.lineTo(450, PIES + 6);
  ctx.stroke();
  return c;
}

// Los colores del cuerpo de cada animalito.
const CUERPOS = {
  mapache: { piel: '#b9b2c6', panza: '#ebe7f1', patas: '#4a4258' },
  siames: { piel: '#f6ead6', panza: '#fff8ec', patas: '#6e4b3c', borde: '#b48b72' },
  gato: null,
  conejo: null,
};

function cargar(src) {
  return new Promise((ok, fallo) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fallo;
    img.src = src;
  });
}

// El personaje que viene de fábrica: el monito gordito vestido del animalito de cada quien
// (con su carita). Sirve hasta que se dibujen el suyo, y como base para dibujarlo.
export async function dibujarCuerpoBase(cuenta, { conCara = true } = {}) {
  const c = document.createElement('canvas');
  c.width = ANCHO;
  c.height = ALTO;
  const ctx = c.getContext('2d');
  const colores = CUERPOS[cuenta.carita] || { piel: cuenta.color, panza: '#fffdf7', patas: cuenta.color };
  const H = HUESOS;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#3a2745';
  ctx.lineWidth = 9;
  const pintar = (dibujar, relleno) => { dibujar(); ctx.fillStyle = relleno; ctx.fill(); ctx.stroke(); };
  // El siamés se oscurece hacia las orillas: las patitas y los bracitos, de claro (arriba)
  // a café (en la punta), y la panza con el borde más oscurito.
  const hacia = ([ax, ay], [bx, by]) => {
    if (!colores.borde) return colores.piel;
    const g = ctx.createLinearGradient(ax, ay, bx, by);
    g.addColorStop(0, colores.piel);
    g.addColorStop(0.45, colores.piel);
    g.addColorStop(1, colores.borde);
    return g;
  };
  const panza = () => {
    if (!colores.borde) return colores.piel;
    const g = ctx.createRadialGradient(300, 440, 30, 300, 452, 140);
    g.addColorStop(0, colores.piel);
    g.addColorStop(0.62, colores.piel);
    g.addColorStop(1, colores.borde);
    return g;
  };

  // piernitas y patitas
  for (const p of [H.piernaI, H.piernaD]) {
    pintar(() => capsula(ctx, p.a, [p.b[0], p.b[1] - 18], p.r - 10), hacia(p.a, p.b));
    pintar(() => { ctx.beginPath(); ctx.ellipse(p.b[0], p.b[1] - 8, p.r - 4, 26, 0, 0, Math.PI * 2); }, colores.patas);
  }
  // bracitos
  for (const b of [H.brazoI, H.brazoD]) {
    pintar(() => capsula(ctx, b.a, b.b, b.r - 8), hacia(b.a, b.b));
    pintar(() => { ctx.beginPath(); ctx.arc(b.b[0], b.b[1], b.r - 6, 0, Math.PI * 2); }, colores.patas);
  }
  // la panza
  pintar(() => { ctx.beginPath(); ctx.ellipse(300, 452, 128, 138, 0, 0, Math.PI * 2); }, panza());
  ctx.beginPath();
  ctx.ellipse(300, 478, 82, 92, 0, 0, Math.PI * 2);
  ctx.fillStyle = colores.panza;
  ctx.fill();
  // una pañoleta del color de la cuenta
  ctx.beginPath();
  ctx.moveTo(196, 332);
  ctx.quadraticCurveTo(300, 380, 404, 332);
  ctx.lineTo(372, 372);
  ctx.quadraticCurveTo(300, 420, 228, 372);
  ctx.closePath();
  ctx.fillStyle = cuenta.color;
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(300, 392);
  ctx.lineTo(276, 446);
  ctx.lineTo(324, 446);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  if (conCara) {
    const svg = carita(cuenta.carita, cuenta.color).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" ');
    try {
      const img = await cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
      // La cara de la carita (su centro está en 50, 62 de 100) va sobre el hueso de la cabeza.
      const lado = 360;
      ctx.drawImage(img, 300 - lado / 2, 205 - lado * 0.62, lado, lado);
    } catch { /* sin cara */ }
  }
  return c;
}

// Corta el dibujo del personaje en sus 6 piezas. `imagen`: el dibujo (cualquier tamaño 3:4).
// Devuelve { pieza: { canvas, x, y, w, h } } en coordenadas de `escala` × (600 x 800).
export function partir(imagen, escala = 0.6) {
  const W = Math.round(ANCHO * escala);
  const Hh = Math.round(ALTO * escala);
  const fuente = document.createElement('canvas');
  fuente.width = W;
  fuente.height = Hh;
  const fx = fuente.getContext('2d', { willReadFrequently: true });
  fx.drawImage(imagen, 0, 0, W, Hh);
  const datos = fx.getImageData(0, 0, W, Hh).data;

  // Para no calcular distancias píxel por píxel, se hace un mapa chiquito de a qué pieza
  // va cada zona (de a 3 px) y se consulta.
  const paso = 3;
  const mapa = [];
  const cols = Math.ceil(W / paso);
  for (let y = 0; y < Hh; y += paso) {
    for (let x = 0; x < W; x += paso) mapa.push(piezaDe((x + paso / 2) / escala, (y + paso / 2) / escala));
  }
  const partes = {};
  for (const nombre of PIEZAS) partes[nombre] = { x0: W, y0: Hh, x1: -1, y1: -1, datos: new Uint8ClampedArray(W * Hh * 4) };
  for (let y = 0; y < Hh; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const p = (y * W + x) * 4;
      if (datos[p + 3] < 6) continue;
      const parte = partes[mapa[Math.floor(y / paso) * cols + Math.floor(x / paso)]];
      parte.datos[p] = datos[p]; parte.datos[p + 1] = datos[p + 1]; parte.datos[p + 2] = datos[p + 2]; parte.datos[p + 3] = datos[p + 3];
      if (x < parte.x0) parte.x0 = x;
      if (x > parte.x1) parte.x1 = x;
      if (y < parte.y0) parte.y0 = y;
      if (y > parte.y1) parte.y1 = y;
    }
  }
  const resultado = {};
  for (const [nombre, p] of Object.entries(partes)) {
    if (p.x1 < 0) continue;
    const x = Math.max(0, p.x0 - 2);
    const y = Math.max(0, p.y0 - 2);
    const w = Math.min(W, p.x1 + 3) - x;
    const h = Math.min(Hh, p.y1 + 3) - y;
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const im = new ImageData(p.datos, W, Hh);
    c.getContext('2d').putImageData(im, -x, -y, x, y, w, h);
    resultado[nombre] = { canvas: c, x, y, w, h };
  }
  return { partes: resultado, escala };
}
