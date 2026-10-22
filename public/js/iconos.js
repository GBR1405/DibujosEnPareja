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

// Caritas redondas para cada cuenta. `carita` viene de config.js.
export function carita(tipo, color, triste = false) {
  const orejas = {
    gato: `<path d="M17 44L19 12l26 15z" fill="${color}"/><path d="M83 44L81 12 55 27z" fill="${color}"/>
           <path d="M23 34l1.4-12 11 6.5z" fill="#ffc2d1" stroke="none"/><path d="M77 34l-1.4-12-11 6.5z" fill="#ffc2d1" stroke="none"/>`,
    conejo: `<ellipse cx="33" cy="25" rx="9.5" ry="22" fill="${color}" transform="rotate(-9 33 25)"/>
             <ellipse cx="67" cy="25" rx="9.5" ry="22" fill="${color}" transform="rotate(9 67 25)"/>
             <ellipse cx="33" cy="26" rx="4" ry="15" fill="#ffc2d1" stroke="none" transform="rotate(-9 33 26)"/>
             <ellipse cx="67" cy="26" rx="4" ry="15" fill="#ffc2d1" stroke="none" transform="rotate(9 67 26)"/>`,
  }[tipo] || '';
  const boca = triste
    ? '<path d="M43.5 72q6.5 -7 13 0" fill="none"/>'
    : tipo === 'gato'
      ? '<path d="M43 67q3.5 4 7 0q3.5 4 7 0" fill="none"/>'
      : '<path d="M44.5 66.5q5.5 5.5 11 0" fill="none"/>';
  // Carita triste: cejas caídas y una lagrimita.
  const pena = triste
    ? `<path d="M28.5 50.5l11 -4.5M71.5 50.5l-11 -4.5" fill="none" stroke-width="3"/>
       <path d="M31 63c3 4 4.6 6.2 4.6 8.2a4.6 4.6 0 0 1-9.2 0c0-2 1.6-4.2 4.6-8.2z" fill="#8fd3ff" stroke-width="2.4"/>`
    : '';
  const bigotes = tipo === 'gato'
    ? '<path d="M14 60l11 2M13 68l11-1.5M86 60l-11 2M87 68l-11-1.5" fill="none" stroke-width="2.4"/>'
    : '';
  return `<svg class="carita" viewBox="0 0 100 100" aria-hidden="true" stroke="${TINTA}" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round">
    ${orejas}
    <ellipse cx="50" cy="62" rx="37" ry="31" fill="${color}"/>
    <circle cx="36" cy="58" r="3.8" fill="${TINTA}" stroke="none"/>
    <circle cx="64" cy="58" r="3.8" fill="${TINTA}" stroke="none"/>
    <ellipse cx="27.5" cy="67" rx="6.2" ry="4" fill="#ff9db5" stroke="none" opacity=".85"/>
    <ellipse cx="72.5" cy="67" rx="6.2" ry="4" fill="#ff9db5" stroke="none" opacity=".85"/>
    ${boca}${bigotes}${pena}
  </svg>`;
}
