// El lienzo de dibujo.
//
// Todo lo que se dibuja se guarda como una lista de operaciones (trazos,
// formas, "limpiar"). Deshacer y rehacer solo quitan y ponen operaciones y
// vuelven a pintar, así que no gastan memoria por cada paso.
//
// El lienzo tiene un tamaño interno fijo (3:4) para que los dibujos de las dos
// personas sean comparables sin importar si dibujan en teléfono o iPad.

import { rellenar, hexARgb } from './balde.js';

export const ANCHO = 1200;
export const ALTO = 1600;
const FINAL = { ancho: 720, alto: 960 };       // lo que se envía; el servidor lo comprime a pocos KB
const BORRADOR = { ancho: 900, alto: 1200 };   // lo que se guarda en este aparato mientras dibujas
const PAPEL = '#fffdf7';
const MAX_ENVIO = 2_400_000; // caracteres del data URL; el servidor acepta hasta 2.8 M

// Grosor del pincel, en píxeles del lienzo interno (1200 de ancho). El borrador es más
// ancho: FACTOR_BORRADOR veces el grosor elegido.
export const GROSOR = { min: 2, max: 72, inicial: 12 };
export const FACTOR_BORRADOR = 2.4;
const GRACIA_LAPIZ_MS = 1500;

const medio = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

// ------------------------------------------------------------------ pintar
function grosorDe(op, w) {
  return op.size * (op.borrar ? FACTOR_BORRADOR : 1) * w;
}

// Dibuja el tramo k de un trazo (de 1 a n-1). Los tramos van de punto medio a
// punto medio con curvas, lo que suaviza el temblor de la mano.
function tramo(c, op, k) {
  const p = op.pts;
  const n = p.length;
  const inicio = k === 1 ? p[0] : medio(p[k - 1], p[k]);
  c.lineWidth = grosorDe(op, (p[k][2] + p[Math.min(k + 1, n - 1)][2]) / 2);
  c.beginPath();
  c.moveTo(inicio[0], inicio[1]);
  if (k <= n - 2) {
    const fin = medio(p[k], p[k + 1]);
    c.quadraticCurveTo(p[k][0], p[k][1], fin[0], fin[1]);
  } else {
    c.lineTo(p[n - 1][0], p[n - 1][1]);
  }
  c.stroke();
}

function estiloTrazo(c, op) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = op.color;
  c.fillStyle = op.color;
}

function punto(c, op) {
  const [x, y, w] = op.pts[0];
  c.beginPath();
  c.arc(x, y, grosorDe(op, w) / 2, 0, Math.PI * 2);
  c.fill();
}

function pintarTrazo(c, op) {
  estiloTrazo(c, op);
  if (op.pts.length === 1) { punto(c, op); return; }
  for (let k = 1; k < op.pts.length; k += 1) tramo(c, op, k);
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
    case 'circulo':
      c.ellipse(cx, cy, Math.max(w / 2, 0.5), Math.max(hh / 2, 0.5), 0, 0, Math.PI * 2);
      break;
    case 'cuadrado':
      c.rect(x0, y0, w, hh);
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

function pintarForma(c, op) {
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.strokeStyle = op.color;
  c.fillStyle = op.color;
  c.lineWidth = op.size;
  caminoDeForma(c, op.forma, op.a, op.b);
  if (op.relleno && op.forma !== 'linea') c.fill();
  c.stroke();
}

// El balde lee los píxeles de cómo va el dibujo y rellena desde el punto tocado.
// Devuelve false si no cambió nada (la zona ya era de ese color).
function pintarBalde(c, op) {
  const imagen = c.getImageData(0, 0, ANCHO, ALTO);
  const cambio = rellenar(imagen, op.x, op.y, hexARgb(op.color));
  if (cambio) c.putImageData(imagen, 0, 0, cambio.x, cambio.y, cambio.w, cambio.h);
  return Boolean(cambio);
}

function pintarOp(c, op) {
  if (op.t === 'trazo') pintarTrazo(c, op);
  else if (op.t === 'forma') pintarForma(c, op);
  else if (op.t === 'balde') pintarBalde(c, op);
  else if (op.t === 'limpiar') { c.fillStyle = PAPEL; c.fillRect(0, 0, ANCHO, ALTO); }
}

// ------------------------------------------------------------------ exportar
// Para enviar: casi sin pérdida (WebP, o PNG en Safari, que no sabe crear WebP).
// El servidor hace la compresión fuerte una sola vez, al terminar.
function codificarFinal(canvas) {
  let url = canvas.toDataURL('image/webp', 0.95);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/png');
  if (url.length > MAX_ENVIO) url = canvas.toDataURL('image/jpeg', 0.92);
  return url;
}

// Para el borrador local: liviano, porque localStorage tiene poco espacio (~5 MB).
function codificarBorrador(canvas) {
  let url = canvas.toDataURL('image/webp', 0.85);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', 0.85);
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

// ------------------------------------------------------------------ lienzo
export function crearLienzo(caja, { alCambiar } = {}) {
  const fondo = document.createElement('canvas');
  const vista = document.createElement('canvas'); // para ver la forma mientras se arrastra
  for (const c of [fondo, vista]) { c.width = ANCHO; c.height = ALTO; }
  fondo.className = 'lienzo';
  vista.className = 'lienzo lienzo-vista';
  caja.append(fondo, vista);
  const ctx = fondo.getContext('2d');
  const cv = vista.getContext('2d');
  const limpiarVista = () => cv.clearRect(0, 0, ANCHO, ALTO);

  const estado = { herramienta: 'pluma', color: '#2b2220', grosor: GROSOR.inicial, forma: 'corazon', relleno: false };
  const grosor = () => Math.min(GROSOR.max, Math.max(GROSOR.min, Number(estado.grosor) || GROSOR.inicial));
  let ops = [];
  let rehacerPila = [];
  let imagenBase = null;
  let activo = null;
  let rect = null;
  let ultimoLapiz = 0;

  // ---- pintar todo de nuevo
  function redibujar() {
    ctx.fillStyle = PAPEL;
    ctx.fillRect(0, 0, ANCHO, ALTO);
    if (imagenBase) ctx.drawImage(imagenBase, 0, 0, ANCHO, ALTO);
    for (const op of ops) pintarOp(ctx, op);
  }
  redibujar();

  const avisar = () => alCambiar && alCambiar({
    puedeDeshacer: ops.length > 0,
    puedeRehacer: rehacerPila.length > 0,
  });

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

  // ---- punteros
  function puntoDe(e) {
    const w = e.pointerType === 'pen' ? Math.round((0.35 + 1.1 * (e.pressure || 0.5)) * 100) / 100 : 1;
    return [
      (e.clientX - rect.left) * (ANCHO / rect.width),
      (e.clientY - rect.top) * (ALTO / rect.height),
      w,
    ];
  }

  vista.addEventListener('pointerdown', (e) => {
    if (activo) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Si se está usando el Apple Pencil, la palma de la mano no debe pintar.
    if (e.pointerType === 'pen') ultimoLapiz = Date.now();
    else if (e.pointerType === 'touch' && Date.now() - ultimoLapiz < GRACIA_LAPIZ_MS) return;

    e.preventDefault();
    limpiarVista();
    try { vista.setPointerCapture(e.pointerId); } catch { /* el puntero ya no está activo */ }
    rect = vista.getBoundingClientRect();
    const p = puntoDe(e);

    if (estado.herramienta === 'balde') {
      // Un toque y listo: no hay trazo que seguir.
      const op = { t: 'balde', x: Math.round(p[0]), y: Math.round(p[1]), color: estado.color };
      if (pintarBalde(ctx, op)) {
        confirmarOp(op);
        onda(e.clientX - rect.left, e.clientY - rect.top, op.color);
      }
      try { vista.releasePointerCapture(e.pointerId); } catch { /* nada */ }
    } else if (estado.herramienta === 'formas') {
      activo = { id: e.pointerId, tipo: 'forma', a: p, b: p };
    } else {
      const borrar = estado.herramienta === 'borrador';
      const op = { t: 'trazo', color: borrar ? PAPEL : estado.color, size: grosor(), borrar, pts: [p] };
      activo = { id: e.pointerId, tipo: 'trazo', op };
      estiloTrazo(ctx, op);
      punto(ctx, op);
    }
  });

  vista.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'pen') ultimoLapiz = Date.now();
    if (!activo || e.pointerId !== activo.id) return;
    e.preventDefault();
    const eventos = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
    const lista = eventos.length ? eventos : [e];

    if (activo.tipo === 'forma') {
      activo.b = puntoDe(lista[lista.length - 1]);
      limpiarVista();
      pintarForma(cv, { forma: estado.forma, color: estado.color, size: grosor(), relleno: estado.relleno, a: activo.a, b: activo.b });
      return;
    }

    const { op } = activo;
    estiloTrazo(ctx, op);
    for (const ev of lista) {
      const p = puntoDe(ev);
      const ultimo = op.pts[op.pts.length - 1];
      if (Math.hypot(p[0] - ultimo[0], p[1] - ultimo[1]) < 1.5) continue;
      op.pts.push(p);
      if (op.pts.length >= 3) tramo(ctx, op, op.pts.length - 2);
    }
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
      const op = { t: 'forma', forma: estado.forma, color: estado.color, size: grosor(), relleno: estado.relleno, a: a.a, b: a.b };
      pintarOp(ctx, op);
      confirmarOp(op);
      return;
    }

    const { op } = a;
    estiloTrazo(ctx, op);
    if (op.pts.length >= 2) tramo(ctx, op, op.pts.length - 1);
    confirmarOp(op);
  }
  vista.addEventListener('pointerup', (e) => terminar(e, false));
  vista.addEventListener('pointercancel', (e) => terminar(e, true));
  vista.addEventListener('lostpointercapture', (e) => terminar(e, false));
  vista.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- tamaño en pantalla: el mayor 3:4 que quepa en el área disponible
  function ajustar() {
    const area = caja.parentElement;
    const estilo = getComputedStyle(area);
    const dispW = area.clientWidth - parseFloat(estilo.paddingLeft) - parseFloat(estilo.paddingRight);
    const dispH = area.clientHeight - parseFloat(estilo.paddingTop) - parseFloat(estilo.paddingBottom);
    if (dispW <= 0 || dispH <= 0) return;
    const ancho = Math.floor(Math.min(dispW, dispH * (ANCHO / ALTO)));
    caja.style.width = `${ancho}px`;
    caja.style.height = `${Math.floor(ancho * (ALTO / ANCHO))}px`;
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(caja.parentElement);
  ajustar();

  // ---- acciones
  function deshacer() {
    if (!ops.length) return;
    rehacerPila.push(ops.pop());
    redibujar();
    avisar();
  }
  function rehacer() {
    if (!rehacerPila.length) return;
    ops.push(rehacerPila.pop());
    redibujar();
    avisar();
  }
  function limpiar() {
    ops.push({ t: 'limpiar' });
    rehacerPila = [];
    redibujar();
    avisar();
  }

  // Hay algo dibujado si queda tinta después del último "limpiar".
  function estaVacio() {
    let hayTinta = Boolean(imagenBase);
    for (const op of ops) {
      if (op.t === 'limpiar') hayTinta = false;
      else if (op.t === 'forma' || op.t === 'balde' || (op.t === 'trazo' && !op.borrar)) hayTinta = true;
    }
    return !hayTinta;
  }

  const exportarFinal = () => codificarFinal(reducir(fondo, FINAL.ancho, FINAL.alto));
  const exportarBorrador = () => codificarBorrador(reducir(fondo, BORRADOR.ancho, BORRADOR.alto));

  function cargarBase(imagen) {
    imagenBase = imagen;
    ops = [];
    rehacerPila = [];
    redibujar();
    avisar();
  }

  return {
    estado,
    deshacer,
    rehacer,
    limpiar,
    estaVacio,
    exportarFinal,
    exportarBorrador,
    cargarBase,
    ajustar,
    // Cuántos píxeles de pantalla mide un píxel del lienzo (para mostrar el tamaño real del pincel).
    escala: () => caja.getBoundingClientRect().width / ANCHO,
    destruir: () => observador.disconnect(),
  };
}
