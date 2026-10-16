// La postal: los dos dibujos de un día juntos en una sola imagen, con el estilo de la app
// (papel de punticos, el tema en su cartelito amarillo, polaroids con nombre y carita,
// las reacciones y notitas, la fecha y el nombre de la app abajo).
//
// Se arma en el teléfono con un <canvas>; no se manda nada al servidor.

import { h, aviso, descargar } from './ui.js';
import { icono, carita } from './iconos.js';

const TINTA = '#3a2745';
const TINTA_2 = '#6f5f7e';
const PAPEL = '#fffdf7';
const CIELO = '#e7e4ff';
const CIELO_2 = '#d3cdf8';
const SOL = '#ffcf4a';
const FRESA = '#ff6f91';
const SOMBRA = 'rgba(58, 39, 69, .3)';

const DISPLAY = "Bagel, 'Arial Rounded MT Bold', 'Trebuchet MS', sans-serif";
const TEXTO = "Mali, 'Comic Sans MS', 'Trebuchet MS', sans-serif";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const ANCHO = 1200;
const MARGEN = 70;
const FOTO = { ancho: 490, img: 430, borde: 30, pie: 104 }; // polaroid
FOTO.imgAlto = Math.round(FOTO.img * 4 / 3);
FOTO.alto = FOTO.borde + FOTO.imgAlto + FOTO.pie;

// ------------------------------------------------------------------ ayudantes
function cargar(src) {
  return new Promise((ok, fallo) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fallo(new Error(`no cargó ${src.slice(0, 40)}`));
    img.src = src;
  });
}

function caritaComoImagen(cuenta, triste) {
  const svg = carita(cuenta.carita, cuenta.color, triste)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" ');
  return cargar(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
}

// Rectángulo con esquinas redondas (a mano: roundRect no existe en Safari 15).
function redondo(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function girado(ctx, cx, cy, grados, dibujar) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((grados * Math.PI) / 180);
  ctx.translate(-cx, -cy);
  dibujar();
  ctx.restore();
}

// Parte `texto` en renglones que quepan en `ancho` (como mucho `max`; el último con "…").
function renglones(ctx, texto, ancho, max) {
  const palabras = texto.split(/\s+/).filter(Boolean);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? `${actual} ${p}` : p;
    if (ctx.measureText(prueba).width <= ancho || !actual) actual = prueba;
    else { lineas.push(actual); actual = p; }
  }
  if (actual) lineas.push(actual);
  if (lineas.length > max) {
    lineas.length = max;
    let ultima = lineas[max - 1];
    while (ultima.length > 1 && ctx.measureText(`${ultima}…`).width > ancho) ultima = ultima.slice(0, -1);
    lineas[max - 1] = `${ultima.trimEnd()}…`;
  }
  return lineas;
}

// ------------------------------------------------------------------ piezas
function fondo(ctx, alto) {
  ctx.fillStyle = CIELO;
  ctx.fillRect(0, 0, ANCHO, alto);
  ctx.fillStyle = CIELO_2;
  for (let y = 18; y < alto; y += 36) {
    for (let x = 18; x < ANCHO; x += 36) {
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function cinta(ctx, cx, y) {
  girado(ctx, cx, y, 3, () => {
    const w = 170;
    const h = 46;
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - w / 2, y - h / 2, w, h);
    ctx.clip();
    for (let i = -h; i < w + h; i += 28) {
      ctx.fillStyle = 'rgba(255, 111, 145, .9)';
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + i, y + h / 2);
      ctx.lineTo(cx - w / 2 + i + 14, y + h / 2);
      ctx.lineTo(cx - w / 2 + i + 14 + h, y - h / 2);
      ctx.lineTo(cx - w / 2 + i + h, y - h / 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 194, 209, .9)';
      ctx.beginPath();
      ctx.moveTo(cx - w / 2 + i + 14, y + h / 2);
      ctx.lineTo(cx - w / 2 + i + 28, y + h / 2);
      ctx.lineTo(cx - w / 2 + i + 28 + h, y - h / 2);
      ctx.lineTo(cx - w / 2 + i + 14 + h, y - h / 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(58, 39, 69, .35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - w / 2, y - h / 2, w, h);
  });
}

function cartelTema(ctx, y, tema) {
  const x = 120;
  const w = ANCHO - 240;
  ctx.font = `76px ${DISPLAY}`;
  const lineas = renglones(ctx, tema, w - 110, 3);
  const alto = 128 + lineas.length * 84;
  girado(ctx, ANCHO / 2, y + alto / 2, -1.3, () => {
    ctx.fillStyle = TINTA;
    redondo(ctx, x + 9, y + 11, w, alto, 36);
    ctx.fill();
    ctx.fillStyle = SOL;
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 6;
    redondo(ctx, x, y, w, alto, 36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `600 34px ${TEXTO}`;
    ctx.fillText('El tema del día', ANCHO / 2, y + 66);
    ctx.font = `76px ${DISPLAY}`;
    lineas.forEach((l, i) => ctx.fillText(l, ANCHO / 2, y + 128 + i * 84));
  });
  cinta(ctx, ANCHO / 2, y - 4);
  return alto;
}

function pegatina(ctx, cx, cy, emoji) {
  girado(ctx, cx, cy, 12, () => {
    ctx.fillStyle = SOMBRA;
    ctx.beginPath();
    ctx.arc(cx + 5, cy + 7, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(cx, cy, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.font = `66px ${EMOJI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TINTA;
    ctx.fillText(emoji, cx, cy + 4);
  });
}

function polaroid(ctx, cx, y, giro, { cuenta, imagen, caraFeliz, caraTriste, emoji }) {
  const x = cx - FOTO.ancho / 2;
  girado(ctx, cx, y + FOTO.alto / 2, giro, () => {
    ctx.fillStyle = SOMBRA;
    redondo(ctx, x + 9, y + 12, FOTO.ancho, FOTO.alto, 14);
    ctx.fill();
    ctx.fillStyle = PAPEL;
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 6;
    redondo(ctx, x, y, FOTO.ancho, FOTO.alto, 14);
    ctx.fill();
    ctx.stroke();

    const ix = x + FOTO.borde;
    const iy = y + FOTO.borde;
    if (imagen) {
      ctx.drawImage(imagen, ix, iy, FOTO.img, FOTO.imgAlto);
      ctx.strokeStyle = SOMBRA;
      ctx.lineWidth = 3;
      ctx.strokeRect(ix, iy, FOTO.img, FOTO.imgAlto);
    } else {
      // No dibujó ese día: su carita triste, como en la app.
      ctx.setLineDash([16, 12]);
      ctx.strokeStyle = 'rgba(58, 39, 69, .4)';
      ctx.lineWidth = 4;
      ctx.strokeRect(ix, iy, FOTO.img, FOTO.imgAlto);
      ctx.setLineDash([]);
      if (caraTriste) ctx.drawImage(caraTriste, cx - 150, iy + FOTO.imgAlto / 2 - 180, 300, 300);
      ctx.fillStyle = TINTA_2;
      ctx.font = `600 32px ${TEXTO}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('No dibujó este día', cx, iy + FOTO.imgAlto / 2 + 160);
    }

    // El nombre con su carita, centrados en el pie de la polaroid.
    ctx.font = `48px ${DISPLAY}`;
    const anchoNombre = ctx.measureText(cuenta.nombre).width;
    const total = 70 + 14 + anchoNombre;
    const pieY = iy + FOTO.imgAlto + FOTO.pie / 2 - 2;
    if (caraFeliz) ctx.drawImage(caraFeliz, cx - total / 2, pieY - 37, 70, 70);
    ctx.fillStyle = TINTA;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(cuenta.nombre, cx - total / 2 + 84, pieY + 4);

    if (emoji) pegatina(ctx, x + FOTO.ancho - 26, y + 22, emoji);
  });
}

// El globito con la notita, debajo de la polaroid (con su piquito apuntando hacia arriba).
function medirNotita(ctx, nota) {
  if (!nota || !nota.comentario) return null;
  ctx.font = `32px ${TEXTO}`;
  const lineas = renglones(ctx, `«${nota.comentario}»`, 400, 4);
  return { lineas, alto: 92 + lineas.length * 42 };
}

function notita(ctx, cx, y, giro, medida, autor) {
  const w = 460;
  const x = cx - w / 2;
  girado(ctx, cx, y + medida.alto / 2, giro, () => {
    ctx.fillStyle = PAPEL;
    ctx.strokeStyle = TINTA;
    ctx.lineWidth = 5;
    redondo(ctx, x, y, w, medida.alto, 26);
    ctx.fill();
    ctx.stroke();
    // piquito
    ctx.beginPath();
    ctx.moveTo(cx - 22, y + 2.5);
    ctx.lineTo(cx, y - 24);
    ctx.lineTo(cx + 22, y + 2.5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - 22, y);
    ctx.lineTo(cx, y - 24);
    ctx.lineTo(cx + 22, y);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = TINTA_2;
    ctx.font = `600 27px ${TEXTO}`;
    ctx.fillText(`${autor.nombre} dice:`, cx, y + 40);
    ctx.fillStyle = TINTA;
    ctx.font = `32px ${TEXTO}`;
    medida.lineas.forEach((l, i) => ctx.fillText(l, cx, y + 84 + i * 42));
  });
}

function logo(ctx, y) {
  girado(ctx, ANCHO / 2, y, -3, () => {
    ctx.font = `128px ${DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    // sombra rosada
    ctx.fillStyle = FRESA;
    ctx.strokeStyle = FRESA;
    ctx.strokeText('garabatos', ANCHO / 2 + 8, y + 10);
    ctx.fillText('garabatos', ANCHO / 2 + 8, y + 10);
    // contorno de tinta y relleno de papel
    ctx.strokeStyle = TINTA;
    ctx.strokeText('garabatos', ANCHO / 2, y);
    ctx.fillStyle = PAPEL;
    ctx.fillText('garabatos', ANCHO / 2, y);
    // el garabato amarillo de abajo
    ctx.strokeStyle = SOL;
    ctx.lineWidth = 11;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i <= 40; i += 1) {
      const px = ANCHO / 2 - 270 + i * 13.5;
      const py = y + 92 + Math.sin(i * 0.8) * 9;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  });
}

// ------------------------------------------------------------------ la postal
// `dibujos`: los dos lados, [{ cuenta, src (o null si no dibujó), nota, autor }],
// donde `nota` es la reacción que `autor` (la otra persona) le dejó a ese dibujo.
export async function crearPostal({ fechaTexto, tema, dibujos, emojiDe }) {
  try {
    await Promise.all([`400 76px Bagel`, `400 32px Mali`, `600 32px Mali`].map((f) => document.fonts.load(f)));
  } catch { /* con la letra de reserva también sale bonita */ }

  const lados = await Promise.all(dibujos.map(async (d) => ({
    ...d,
    imagen: d.src ? await cargar(d.src) : null,
    caraFeliz: await caritaComoImagen(d.cuenta, false).catch(() => null),
    caraTriste: d.src ? null : await caritaComoImagen(d.cuenta, true).catch(() => null),
    emoji: d.src && d.nota ? emojiDe(d.nota.reaccion) : null,
  })));

  const lienzo = document.createElement('canvas');
  const ctx = lienzo.getContext('2d');

  // Primero se mide todo para saber qué tan alta queda.
  ctx.font = `76px ${DISPLAY}`;
  const altoTema = 128 + renglones(ctx, tema, ANCHO - 350, 3).length * 84;
  const notitas = lados.map((l) => (l.src ? medirNotita(ctx, l.nota) : null));
  const altoNotitas = Math.max(0, ...notitas.map((n) => (n ? n.alto + 60 : 0)));
  const yTema = 170;
  const yFotos = yTema + altoTema + 78;
  const yNotitas = yFotos + FOTO.alto + 62;
  const yLogo = yNotitas + altoNotitas + 96;
  const alto = yLogo + 210;

  lienzo.width = ANCHO;
  lienzo.height = alto;
  fondo(ctx, alto);

  ctx.fillStyle = TINTA_2;
  ctx.font = `600 36px ${TEXTO}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(fechaTexto, ANCHO / 2, MARGEN + 26);

  cartelTema(ctx, yTema, tema);

  const centros = [ANCHO / 2 - 290, ANCHO / 2 + 290];
  const giros = [-2.2, 2.4];
  lados.forEach((l, i) => polaroid(ctx, centros[i], yFotos, giros[i], l));
  lados.forEach((l, i) => { if (notitas[i]) notita(ctx, centros[i], yNotitas, giros[i] * 0.6, notitas[i], l.autor); });

  logo(ctx, yLogo);
  ctx.fillStyle = TINTA_2;
  ctx.font = `600 30px ${TEXTO}`;
  ctx.textAlign = 'center';
  ctx.fillText('Un ratito para dibujar juntos, cada día.', ANCHO / 2, yLogo + 150);

  return new Promise((ok, fallo) => {
    lienzo.toBlob((b) => (b ? ok(b) : fallo(new Error('sin imagen'))), 'image/png');
  });
}

// ------------------------------------------------------------------ ver y guardar
// Abre la postal en grande: primero un papelito de "armando…" y luego la imagen, con
// botones para compartirla (en iPhone, desde ahí se guarda en Fotos) o bajarla.
export function abrirPostal({ nombreArchivo, armar }) {
  const visor = h('div', { class: 'visor visor-postal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Postal del día' });
  let url = null;
  const cerrar = () => {
    visor.classList.add('se-va');
    setTimeout(() => { visor.remove(); if (url) URL.revokeObjectURL(url); }, 200);
    document.removeEventListener('keydown', alTeclado);
  };
  function alTeclado(e) { if (e.key === 'Escape') cerrar(); }
  document.addEventListener('keydown', alTeclado);
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrar(); });

  // La ✕ está desde el principio: también sirve para cancelar mientras se arma.
  const botonCerrar = h('button', { type: 'button', class: 'visor-cerrar', 'aria-label': 'Cerrar la postal', onclick: cerrar }, icono('cerrar'));
  visor.append(botonCerrar, h('div', { class: 'papel-carga', role: 'status' },
    h('span', { class: 'papel-cinta', 'aria-hidden': 'true' }),
    h('p', { class: 'papel-titulo' }, 'Armando…'),
    h('span', { class: 'papel-garabato', 'aria-hidden': 'true' }),
    h('p', { class: 'papel-contador' }, 'pegando los dibujos en la postal')));
  document.body.append(visor);

  armar().then((blob) => {
    if (!visor.isConnected) return;
    const archivo = new File([blob], `${nombreArchivo}.png`, { type: 'image/png' });
    url = URL.createObjectURL(blob);
    let puedeCompartir = false;
    try { puedeCompartir = Boolean(navigator.canShare && navigator.canShare({ files: [archivo] })); } catch { /* no */ }

    const compartir = async () => {
      try {
        await navigator.share({ files: [archivo], title: 'Garabatos' });
      } catch (e) {
        if (e.name !== 'AbortError') descargar(blob, archivo.name);
      }
    };
    visor.replaceChildren(
      botonCerrar,
      h('div', { class: 'visor-marco postal' }, h('img', { src: url, alt: 'La postal con los dos dibujos del día' })),
      h('div', { class: 'visor-acciones' },
        puedeCompartir && h('button', { type: 'button', class: 'boton fresa', onclick: compartir }, icono('compartir'), 'Compartir'),
        h('button', { type: 'button', class: `boton ${puedeCompartir ? 'blanco' : 'fresa'}`, onclick: () => descargar(blob, archivo.name) }, icono('descargar'), 'Guardar')));
  }).catch(() => {
    if (!visor.isConnected) return;
    cerrar();
    aviso('No se pudo armar la postal. Inténtalo otra vez.', 3600);
  });
}
