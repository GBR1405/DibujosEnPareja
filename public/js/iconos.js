// Iconos dibujados a mano (trazo redondeado) y las caritas de cada cuenta.

const TRAZOS = {
  pluma: '<path d="M7 25l1.7-5.8L21.9 6a2.7 2.7 0 0 1 3.8 3.8L12.5 23z"/><path d="M8.7 19.2l4.1 4.1"/><path d="M19.6 8.4l4 4"/><path d="M5.5 27.5l1.4-2.8"/>',
  formas: '<circle cx="12" cy="11.5" r="6.5"/><path d="M13.5 27l7-12.5L27.5 27z"/>',
  borrador: '<path d="M11.5 24.5L5.8 18.8a2 2 0 0 1 0-2.8L16 5.8a2 2 0 0 1 2.8 0l7.4 7.4a2 2 0 0 1 0 2.8L17.2 25"/><path d="M10 12.2l9.8 9.8"/><path d="M12.5 24.8H27"/>',
  deshacer: '<path d="M10.5 11.5H20a6 6 0 0 1 0 12h-7"/><path d="M14.5 7L10 11.5l4.5 4.5"/>',
  rehacer: '<path d="M21.5 11.5H12a6 6 0 0 0 0 12h7"/><path d="M17.5 7l4.5 4.5-4.5 4.5"/>',
  basura: '<path d="M6.5 9h19"/><path d="M12 9V6h8v3"/><path d="M8.8 9l1.3 17.2h11.8L23.2 9"/><path d="M13.3 13.5v8.5M18.7 13.5v8.5"/>',
  linea: '<path d="M6.5 25.5l19-19"/>',
  circulo: '<circle cx="16" cy="16" r="10"/>',
  cuadrado: '<rect x="6.5" y="6.5" width="19" height="19" rx="3"/>',
  triangulo: '<path d="M16 6l11 19.5H5z"/>',
  corazon: '<path d="M16 27C7.4 20.4 5 15 5 11.6A6 6 0 0 1 16 8.8a6 6 0 0 1 11 2.8C27 15 24.6 20.4 16 27z"/>',
  estrella: '<path d="M16 4.5l3.5 7.3 7.9.9-5.9 5.4 1.6 7.9L16 22.1 9 26l1.6-7.9-5.9-5.4 7.9-.9z"/>',
  flecha: '<path d="M5.5 16h19M18 9l7 7-7 7"/>',
  rombo: '<path d="M16 4.5L27.5 16 16 27.5 4.5 16z"/>',
  volver: '<path d="M19.5 6.5L10 16l9.5 9.5"/>',
  calendario: '<rect x="5" y="8" width="22" height="19" rx="4"/><path d="M5 14.5h22M11 5v6M21 5v6"/>',
  hoy: '<circle cx="16" cy="16" r="5.5"/><path d="M16 4.5v3M16 24.5v3M4.5 16h3M24.5 16h3M8 8l2 2M22 22l2 2M24 8l-2 2M10 22l-2 2"/>',
  cerrar: '<path d="M8.5 8.5l15 15M23.5 8.5l-15 15"/>',
  descargar: '<path d="M16 5.5v15M9.8 14.5l6.2 6.2 6.2-6.2M6.5 26.5h19"/>',
  check: '<path d="M7 17l6 6 12-13"/>',
  salir: '<path d="M13 6.5H8.5a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2H13"/><path d="M19 11l5 5-5 5M24 16H12"/>',
  sobre: '<rect x="4.5" y="8" width="23" height="17" rx="3"/><path d="M5.5 10.5L16 18l10.5-7.5"/>',
  retroceso: '<path d="M12 7h12a2.5 2.5 0 0 1 2.5 2.5v13A2.5 2.5 0 0 1 24 25H12L5.5 16z"/><path d="M15.5 12l7 8M22.5 12l-7 8"/>',
  contorno: '<path d="M16 6l11 19.5H5z"/>',
  relleno: '<path d="M16 6l11 19.5H5z" fill="currentColor"/>',
  enviar: '<path d="M5.5 15.5L26.5 6l-6.5 20.5-4.6-8.3z"/><path d="M15.4 18.2L26.5 6"/>',
  compartir: '<path d="M16 19V5.5M10.5 11L16 5.5l5.5 5.5"/><path d="M9.5 14.5H8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1.5"/>',
  postal: '<rect x="4.5" y="7.5" width="23" height="17" rx="3"/><path d="M17.5 12h6M17.5 16h6M17.5 20h4"/><rect x="8" y="11" width="6" height="7" rx="1"/>',
  balde: '<path d="M5.2 14.2L14 5.4l10.4 10.4-8.8 8.8a2.4 2.4 0 0 1-3.4 0l-7-7a2.4 2.4 0 0 1 0-3.4z"/><path d="M5.4 16.4h18.4"/><path d="M14 5.4L10.6 2"/><path d="M27 19.5c1.7 2.6 2.6 4.1 2.6 5.2a2.6 2.6 0 0 1-5.2 0c0-1.1.9-2.6 2.6-5.2z" fill="currentColor"/>',
  musica: '<path d="M12 23.5V8.5l13-3v15"/><circle cx="8.5" cy="23.5" r="3.5"/><circle cx="21.5" cy="20.5" r="3.5"/>',
  play: '<path d="M10.5 6.5v19l15-9.5z" fill="currentColor"/>',
  pausa: '<rect x="8.5" y="7" width="5" height="18" rx="1.5" fill="currentColor"/><rect x="18.5" y="7" width="5" height="18" rx="1.5" fill="currentColor"/>',
  siguiente: '<path d="M6.5 7.5v17l12.5-8.5z" fill="currentColor"/><path d="M24.5 7.5v17"/>',
  volumen: '<path d="M5.5 12.5h5l6-5v17l-6-5h-5z"/><path d="M21 12a5.5 5.5 0 0 1 0 8M24.5 9a10 10 0 0 1 0 14"/>',
  campana: '<path d="M8.5 22.5V15a7.5 7.5 0 0 1 15 0v7.5l2.2 2.7H6.3z"/><path d="M13.3 27.5a2.9 2.9 0 0 0 5.4 0"/><path d="M16 5V7.5"/>',
  // ---- lo nuevo
  casa: '<path d="M5 15.5L16 6l11 9.5"/><path d="M8.5 13v13h15V13"/><path d="M13.5 26v-6.5h5V26"/>',
  nosotros: '<path d="M12.5 25C6 20.2 4 16.6 4 13.8a4.4 4.4 0 0 1 8.5-1.7 4.4 4.4 0 0 1 8.5 1.7c0 2.8-2 6.4-8.5 11.2z"/><path d="M21.4 9.3A3.8 3.8 0 0 1 28 11.6c0 2.2-1.4 4.8-5.6 8.3"/>',
  reto: '<path d="M10 6.5h12v6a6 6 0 0 1-12 0z"/><path d="M10 9H6.5a3.5 3.5 0 0 0 3.8 4.5M22 9h3.5a3.5 3.5 0 0 1-3.8 4.5"/><path d="M16 18.5V23M11 26.5h10M12.5 26.5l1-3.5h5l1 3.5"/>',
  moneda: '<circle cx="16" cy="16" r="10.5"/><path d="M16 9.5v13M19.6 12.4c-.8-1-2-1.5-3.6-1.5-2 0-3.5 1-3.5 2.6 0 3.6 7 1.8 7 5.3 0 1.6-1.5 2.6-3.5 2.6-1.6 0-2.9-.6-3.7-1.6"/>',
  capas: '<path d="M16 5.5L27 11l-11 5.5L5 11z"/><path d="M5 16l11 5.5L27 16"/><path d="M5 21l11 5.5L27 21"/>',
  gotero: '<path d="M19.5 5.5l7 7"/><path d="M22.5 8.5L10.2 20.8a2 2 0 0 0-.5.9l-.9 3.8 3.8-.9a2 2 0 0 0 .9-.5L25.8 11.8"/><path d="M17.8 9.8l4.4 4.4"/><path d="M5.5 27l3-3"/>',
  ajustes: '<path d="M6 9.5h10M23.5 9.5H26M6 16h3.5M16.5 16H26M6 22.5h12.5M25.5 22.5h.5"/><circle cx="20" cy="9.5" r="3.2"/><circle cx="13" cy="16" r="3.2"/><circle cx="22" cy="22.5" r="3.2"/>',
  espejo: '<path d="M16 4.5v23" stroke-dasharray="2.2 3.2"/><path d="M12 9.5L5.5 16l6.5 6.5z"/><path d="M20 9.5l6.5 6.5-6.5 6.5z" fill="currentColor"/>',
  redondo: '<path d="M7 25l1.7-5.8L21.9 6a2.7 2.7 0 0 1 3.8 3.8L12.5 23z"/><path d="M8.7 19.2l4.1 4.1"/><path d="M5.5 27.5l1.4-2.8"/>',
  tinta: '<path d="M16 4.5l7.5 10.5L16 27.5 8.5 15z"/><path d="M16 27.5V18.5"/><circle cx="16" cy="15.5" r="1.8" fill="currentColor"/>',
  lapiz: '<path d="M6.5 25.5l2-6.5L21.5 6a2.5 2.5 0 0 1 3.5 0l1 1a2.5 2.5 0 0 1 0 3.5L13 23.5z"/><path d="M8.5 19l4.5 4.5"/><path d="M6.5 25.5l2.6-.8-1.8-1.8z" fill="currentColor"/><path d="M18.5 9l4.5 4.5"/>',
  marcador: '<path d="M10.5 21.5L6 26h7l1.5-1.5"/><path d="M10.5 21.5l3.5 3.5L25.5 13.5 22 10z"/><path d="M22 10l3-3 3.5 3.5-3 3"/>',
  aerografo: '<rect x="8.5" y="12.5" width="10" height="14.5" rx="2.5"/><path d="M11 12.5V9.5h5v3"/><path d="M13.5 9.5V7h3.5"/><path d="M22 7.5h.1M25 5.5h.1M25 9.5h.1M28 7.5h.1M22.5 11.5h.1M27.5 11.5h.1" stroke-width="3.2"/>',
  ojo: '<path d="M3.5 16S8 8 16 8s12.5 8 12.5 8S24 24 16 24 3.5 16 3.5 16z"/><circle cx="16" cy="16" r="3.6"/>',
  'ojo-no': '<path d="M3.5 16S8 8 16 8s12.5 8 12.5 8S24 24 16 24 3.5 16 3.5 16z"/><circle cx="16" cy="16" r="3.6"/><path d="M6 6l20 20"/>',
  girar: '<path d="M24.5 12A9.5 9.5 0 1 0 25.5 18"/><path d="M25.5 6v6.5H19"/>',
  caja: '<path d="M5 11l11-5 11 5v11l-11 5-11-5z"/><path d="M5 11l11 5 11-5M16 16v11"/>',
  tienda: '<path d="M7 11h18l-1.5 15.5h-15z"/><path d="M12 13V9.5a4 4 0 0 1 8 0V13"/>',
  luna: '<path d="M25.5 19.5A10.5 10.5 0 1 1 12.5 6.5a8.5 8.5 0 0 0 13 13z"/>',
  mas: '<path d="M16 7v18M7 16h18"/>',
  personaje: '<circle cx="16" cy="8.5" r="4.5"/><ellipse cx="16" cy="19" rx="5.5" ry="5.8"/><path d="M10.8 16.5l-4.3 4M21.2 16.5l4.3 4M13.5 24.5l-1.5 3.5M18.5 24.5l1.5 3.5"/>',
  pregunta: '<path d="M6 7.5h20a2 2 0 0 1 2 2V20a2 2 0 0 1-2 2H14l-6 5v-5H6a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2z"/><path d="M13.5 12.6a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .8-1 1.5"/><path d="M16 19.2h.1" stroke-width="3.4"/>',
  candado: '<rect x="7.5" y="14" width="17" height="12.5" rx="3"/><path d="M11 14v-3a5 5 0 0 1 10 0v3"/>',
  juntar: '<path d="M8 6v5.5l8 7 8-7V6"/><path d="M16 18.5V27M12 23l4 4 4-4"/>',
  mover: '<path d="M16 4.5v23M4.5 16h23M12.5 8l3.5-3.5L19.5 8M12.5 24l3.5 3.5 3.5-3.5M8 12.5L4.5 16 8 19.5M24 12.5l3.5 3.5-3.5 3.5"/>',
  cuerpo: '<circle cx="16" cy="8.5" r="5"/><path d="M9.5 27.5c-2-6 0-12 6.5-12s8.5 6 6.5 12z"/>',
};

export function icono(nombre, { relleno = false, titulo = '' } = {}) {
  const span = document.createElement('span');
  span.className = `icono icono-${nombre}`;
  span.setAttribute('aria-hidden', titulo ? 'false' : 'true');
  if (titulo) span.setAttribute('role', 'img');
  span.innerHTML = `<svg viewBox="0 0 32 32" fill="${relleno ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">${TRAZOS[nombre] || ''}</svg>`;
  return span;
}

const TINTA = '#3a2745';

// ------------------------------------------------------------------ caritas
// Cada animalito: sus orejas, su cara y cómo se le ven los ojos. Todas comparten la
// misma posición de ojos (36, 58) y (64, 58), así las expresiones sirven para todas.
//   expresión: 'normal' · 'triste' (no dibujó: cejitas y lagrimita) · 'desanimado'
//   (pospuso el dibujo: ojitos caídos, boca plana y una gotita de sudor).

// Un moñito del color de la cuenta, para que se sepa de quién es.
const monito = (color, x, y, giro) => `<g transform="translate(${x} ${y}) rotate(${giro})">
  <path d="M0 0l-9-6v12z M0 0l9-6v12z" fill="${color}" stroke-width="2.6"/><circle r="3" fill="${color}" stroke-width="2.4"/></g>`;

const ANIMALES = {
  gato: (color) => ({
    orejas: `<path d="M17 44L19 12l26 15z" fill="${color}"/><path d="M83 44L81 12 55 27z" fill="${color}"/>
      <path d="M23 34l1.4-12 11 6.5z" fill="#ffc2d1" stroke="none"/><path d="M77 34l-1.4-12-11 6.5z" fill="#ffc2d1" stroke="none"/>`,
    cara: `<ellipse cx="50" cy="62" rx="37" ry="31" fill="${color}"/>`,
    bigotes: true,
  }),
  conejo: (color) => ({
    orejas: `<ellipse cx="33" cy="25" rx="9.5" ry="22" fill="${color}" transform="rotate(-9 33 25)"/>
      <ellipse cx="67" cy="25" rx="9.5" ry="22" fill="${color}" transform="rotate(9 67 25)"/>
      <ellipse cx="33" cy="26" rx="4" ry="15" fill="#ffc2d1" stroke="none" transform="rotate(-9 33 26)"/>
      <ellipse cx="67" cy="26" rx="4" ry="15" fill="#ffc2d1" stroke="none" transform="rotate(9 67 26)"/>`,
    cara: `<ellipse cx="50" cy="62" rx="37" ry="31" fill="${color}"/>`,
  }),
  // Mapache: gris, con su antifaz oscuro, cejitas blancas y hocico blanco.
  mapache: (color) => ({
    orejas: `<path d="M16 46C10 26 18 14 36 26z" fill="#9b94a9"/><path d="M84 46C90 26 82 14 64 26z" fill="#9b94a9"/>
      <path d="M20 38c-2-9 2-14 10-10z" fill="#5c5469" stroke="none"/><path d="M80 38c2-9-2-14-10-10z" fill="#5c5469" stroke="none"/>
      ${monito(color, 76, 26, 18)}`,
    cara: `<ellipse cx="50" cy="62" rx="38" ry="31" fill="#c9c2d4"/>
      <path d="M22 46q8-9 19-4M78 46q-8-9-19-4" fill="none" stroke="#fffdf7" stroke-width="5"/>
      <path d="M13 60q6-15 25-10 12 3 24 0 19-5 25 10-6 12-23 7-14-4-28 0-17 5-23-7z" fill="#4a4258" stroke-width="3"/>
      <ellipse cx="50" cy="76" rx="15" ry="11" fill="#fffdf7" stroke-width="3"/>
      <ellipse cx="50" cy="69.5" rx="5" ry="3.6" fill="${TINTA}" stroke="none"/>`,
    ojoClaro: true,
    boca: 'mapache',
  }),
  // Gato siamés: crema, con las orejas y el antifaz café oscuro, y ojitos azules.
  siames: (color) => ({
    orejas: `<path d="M16 46L20 11l25 17z" fill="#5c3d30"/><path d="M84 46L80 11 55 28z" fill="#5c3d30"/>
      <path d="M23 35l1.6-12 10 6.5z" fill="#c98d86" stroke="none"/><path d="M77 35l-1.6-12-10 6.5z" fill="#c98d86" stroke="none"/>
      ${monito(color, 77, 22, 14)}`,
    // Las orillas de la cara se oscurecen (como un siamés de verdad): dos anillos
    // cafés por dentro del borde, y el contorno de tinta otra vez encima.
    cara: `<ellipse cx="50" cy="62" rx="37" ry="31" fill="#f6ead6"/>
      <ellipse cx="50" cy="62" rx="32" ry="26" fill="none" stroke="#c9a68c" stroke-width="10" opacity=".55"/>
      <ellipse cx="50" cy="62" rx="34.6" ry="28.6" fill="none" stroke="#8a6450" stroke-width="5" opacity=".6"/>
      <ellipse cx="50" cy="62" rx="37" ry="31" fill="none"/>
      <ellipse cx="50" cy="70" rx="23" ry="19" fill="#b7927c" stroke="none" opacity=".55"/>
      <ellipse cx="50" cy="72" rx="15" ry="13" fill="#7f5a47" stroke="none" opacity=".75"/>
      <path d="M46 68.5h8l-4 4.2z" fill="#e88f9e" stroke-width="2.2"/>`,
    ojosAzules: true,
    bigotes: true,
    boca: 'siames',
  }),
};

function ojos(a, expresion) {
  const blanco = a.ojoClaro ? '#fffdf7' : TINTA;
  if (expresion === 'desanimado') {
    // párpados caídos: media lunita hacia abajo y una rayita encima
    const lid = (x) => `<path d="M${x - 6} 58.5q6 4.5 12 0" fill="none" stroke="${blanco}" stroke-width="3.4"/>`;
    return lid(36) + lid(64);
  }
  if (a.ojosAzules) {
    const ojo = (x) => `<ellipse cx="${x}" cy="58" rx="5.2" ry="5.6" fill="#7cc0ff" stroke-width="2.4"/><ellipse cx="${x}" cy="58.4" rx="1.7" ry="3.8" fill="${TINTA}" stroke="none"/><circle cx="${x + 1.8}" cy="56" r="1.3" fill="#fff" stroke="none"/>`;
    return ojo(36) + ojo(64);
  }
  if (a.ojoClaro) {
    const ojo = (x) => `<circle cx="${x}" cy="58" r="5.4" fill="#fffdf7" stroke="none"/><circle cx="${x}" cy="58.6" r="3.4" fill="${TINTA}" stroke="none"/><circle cx="${x + 1.4}" cy="57" r="1.1" fill="#fff" stroke="none"/>`;
    return ojo(36) + ojo(64);
  }
  return `<circle cx="36" cy="58" r="3.8" fill="${TINTA}" stroke="none"/><circle cx="64" cy="58" r="3.8" fill="${TINTA}" stroke="none"/>`;
}

function boca(a, tipo, expresion) {
  const y = a.boca === 'mapache' ? 6 : a.boca === 'siames' ? 7 : 0;
  if (expresion === 'triste') return `<path d="M43.5 ${72 + y}q6.5 -7 13 0" fill="none"/>`;
  if (expresion === 'desanimado') return `<path d="M44.5 ${69.5 + y}h11" fill="none"/>`;
  if (tipo === 'gato' || a.boca) return `<path d="M43 ${67 + y}q3.5 4 7 0q3.5 4 7 0" fill="none"/>`;
  return '<path d="M44.5 66.5q5.5 5.5 11 0" fill="none"/>';
}

// Caritas redondas para cada cuenta. `tipo` viene de config.js (`carita`).
// `expresion`: 'normal', 'triste' o 'desanimado' (true también es 'triste').
export function carita(tipo, color, expresion = 'normal') {
  const animo = expresion === true ? 'triste' : expresion || 'normal';
  const a = (ANIMALES[tipo] || ANIMALES.gato)(color);
  const pena = animo === 'triste'
    ? `<path d="M28.5 50.5l11 -4.5M71.5 50.5l-11 -4.5" fill="none" stroke="${a.ojoClaro ? '#fffdf7' : TINTA}" stroke-width="3"/>
       <path d="M31 63c3 4 4.6 6.2 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-2 1.6-4.2 4.6-8.2z" fill="#8fd3ff" stroke-width="2.4"/>`
    : animo === 'desanimado'
      ? `<path d="M76 34c2.6 3.6 4 5.6 4 7.4a4 4 0 0 1-8 0c0-1.8 1.4-3.8 4-7.4z" fill="#8fd3ff" stroke-width="2.2"/>
         <path d="M29 50l10 2M71 50l-10 2" fill="none" stroke="${a.ojoClaro ? '#fffdf7' : TINTA}" stroke-width="2.6"/>`
      : '';
  const bigotes = a.bigotes ? '<path d="M14 60l11 2M13 68l11-1.5M86 60l-11 2M87 68l-11-1.5" fill="none" stroke-width="2.4"/>' : '';
  const mejillas = animo === 'desanimado'
    ? ''
    : '<ellipse cx="27.5" cy="67" rx="6.2" ry="4" fill="#ff9db5" stroke="none" opacity=".85"/><ellipse cx="72.5" cy="67" rx="6.2" ry="4" fill="#ff9db5" stroke="none" opacity=".85"/>';
  return `<svg class="carita" viewBox="0 0 100 100" aria-hidden="true" stroke="${TINTA}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
    ${a.orejas}${a.cara}${ojos(a, animo)}${mejillas}${boca(a, tipo, animo)}${bigotes}${pena}
  </svg>`;
}

// Las caritas del 1 al 10 para "¿qué tanto?" al posponer.
const CARAS_MAL = ['🙂', '😐', '😕', '🙁', '😟', '😣', '😖', '😫', '🤒', '🤢'];
const CARAS_OCUPADO = ['🙂', '😐', '😶', '😬', '😓', '😩', '😵', '😵‍💫', '🥵', '🤯'];
export function caraDelNivel(motivo, nivel) {
  const lista = motivo === 'mal' ? CARAS_MAL : CARAS_OCUPADO;
  return lista[Math.min(10, Math.max(1, nivel)) - 1];
}
