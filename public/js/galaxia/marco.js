// Piezas que comparten todas las partes de la galaxia: los paneles (Nuestra historia, el
// frasco, el álbum, los juegos), Estelita hablando con máquina de escribir, la estrellita
// en SVG y las chispitas que salen al tocar.

import { h, svg } from '../ui.js';
import { campanita, pop } from './sonido.js';

export const azar = (a, b) => a + Math.random() * (b - a);
export const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];
export const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esperar = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

// La galaxia (el <main>) donde se montan los paneles: al salir se borra todo junto.
let raizGalaxia = null;
export function ponerRaiz(el) { raizGalaxia = el; }
const raiz = () => raizGalaxia || document.body;

// ------------------------------------------------------------------ la estrellita
// Una estrella redondita de `puntas` puntas, como camino SVG (con las esquinas suaves).
export function caminoEstrella(cx, cy, R, r, { puntas = 5, redondeo = 0.22 } = {}) {
  const pts = [];
  for (let i = 0; i < puntas * 2; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / puntas;
    const rr = i % 2 === 0 ? R : r;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
  }
  const n = pts.length;
  const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  let d = '';
  for (let i = 0; i < n; i += 1) {
    const ant = pts[(i - 1 + n) % n];
    const act = pts[i];
    const sig = pts[(i + 1) % n];
    const t = i % 2 === 0 ? redondeo : redondeo * 0.7;
    const a = mezcla(act, ant, t);
    const b = mezcla(act, sig, t);
    d += `${i ? 'L' : 'M'}${a[0].toFixed(2)} ${a[1].toFixed(2)}Q${act[0].toFixed(2)} ${act[1].toFixed(2)} ${b[0].toFixed(2)} ${b[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

// Estelita (o cualquier estrellita): `cara` = 'feliz' | 'ojitos' (cerrados, contenta) | null.
export function estrellaSvg({ color = '#ffe27a', borde = '#f0b443', cara = 'feliz', clase = '' } = {}) {
  const ojos = cara === 'ojitos'
    ? '<path d="M37 52 Q41 47 45 52 M55 52 Q59 47 63 52" stroke="#3a2745" stroke-width="2.8" fill="none" stroke-linecap="round"/>'
    : '<ellipse cx="41" cy="52" rx="3.8" ry="5.2" fill="#3a2745"/><ellipse cx="59" cy="52" rx="3.8" ry="5.2" fill="#3a2745"/>'
      + '<circle cx="42.4" cy="50" r="1.5" fill="#fff"/><circle cx="60.4" cy="50" r="1.5" fill="#fff"/>';
  const carita = cara
    ? `${ojos}<ellipse cx="33.5" cy="60" rx="5.2" ry="3.1" fill="#ff8fb6" opacity=".75"/><ellipse cx="66.5" cy="60" rx="5.2" ry="3.1" fill="#ff8fb6" opacity=".75"/>`
      + '<path d="M45.5 60.5 Q50 65 54.5 60.5" stroke="#3a2745" stroke-width="2.6" fill="none" stroke-linecap="round"/>'
    : '';
  return svg(`<svg class="gx-estrellita ${clase}" viewBox="0 0 100 100" aria-hidden="true">
    <path d="${caminoEstrella(50, 55, 46, 25)}" fill="${color}" stroke="${borde}" stroke-width="3.2" stroke-linejoin="round"/>
    <path d="${caminoEstrella(46, 49, 30, 15)}" fill="#fff" opacity=".28"/>
    ${carita}</svg>`);
}

// ------------------------------------------------------------------ chispitas
// Unas estrellitas que salen de un punto de la pantalla.
export function chispitas(x, y, { cantidad = 10, colores = ['#fff6c9', '#ffd6f5', '#cfe1ff', '#ffe27a'], lejos = 70, tam = 14 } = {}) {
  if (quieto()) return;
  const capa = h('div', { class: 'gx-chispitas', 'aria-hidden': 'true', style: { left: `${x}px`, top: `${y}px` } });
  for (let i = 0; i < cantidad; i += 1) {
    const ang = (i / cantidad) * Math.PI * 2 + azar(-0.3, 0.3);
    const d = lejos * azar(0.5, 1.1);
    const s = svg(`<svg viewBox="0 0 20 20"><path d="M10 0 Q11 9 20 10 Q11 11 10 20 Q9 11 0 10 Q9 9 10 0Z" fill="${elegir(colores)}"/></svg>`);
    s.classList.add('gx-chispita');
    s.style.setProperty('--dx', `${(Math.cos(ang) * d).toFixed(1)}px`);
    s.style.setProperty('--dy', `${(Math.sin(ang) * d).toFixed(1)}px`);
    s.style.setProperty('--tam', `${Math.round(tam * azar(0.6, 1.3))}px`);
    s.style.setProperty('--giro', `${Math.round(azar(-120, 120))}deg`);
    s.style.setProperty('--demora', `${Math.round(azar(0, 90))}ms`);
    capa.append(s);
  }
  raiz().append(capa);
  setTimeout(() => capa.remove(), 1300);
}

// ------------------------------------------------------------------ paneles
// Un panel de la galaxia (ocupa toda la pantalla). `desde`: el punto de la pantalla del
// que sale (el planeta que tocaste), para que se abra desde ahí.
export function crearPanel({ clase = '', titulo, extra = null, alCerrar, desde = null }) {
  const cuerpo = h('div', { class: 'gx-panel-cuerpo' });
  const botonCerrar = h('button', { type: 'button', class: 'gx-redondo gx-cerrar', 'aria-label': 'Volver al cielo', onclick: () => cerrar() }, '‹');
  const el = h('section', { class: `gx-panel ${clase}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo, tabindex: '-1' },
    h('header', { class: 'gx-panel-cabeza' }, botonCerrar, h('h2', { class: 'gx-panel-titulo' }, titulo), extra || h('span', { class: 'gx-hueco', 'aria-hidden': 'true' })),
    cuerpo);
  if (desde) el.style.transformOrigin = `${Math.round(desde.x)}px ${Math.round(desde.y)}px`;
  raiz().append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('abierto')));
  setTimeout(() => el.focus({ preventScroll: true }), 60);
  let cerrado = false;
  const alTeclado = (e) => {
    if (e.key !== 'Escape' || cerrado) return;
    // si hay algo encima (un visor, un formulario), se cierra primero eso
    const encima = [...raiz().querySelectorAll('.gx-encima')];
    if (encima.length) return;
    cerrar();
  };
  document.addEventListener('keydown', alTeclado);
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', alTeclado);
    el.classList.remove('abierto');
    el.classList.add('cerrando');
    setTimeout(() => el.remove(), 420);
    if (alCerrar) alCerrar();
  }
  return { el, cuerpo, cerrar, estaCerrado: () => cerrado };
}

// Algo que se abre encima de un panel (un visor, un formulario). Escape y el fondo lo cierran.
export function crearEncima({ clase = '', etiqueta = '', alCerrar, cerrarAlFondo = true }) {
  const el = h('div', { class: `gx-encima ${clase}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': etiqueta });
  if (cerrarAlFondo) el.addEventListener('click', (e) => { if (e.target === el) cerrar(); });
  raiz().append(el);
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('abierto')));
  let cerrado = false;
  const alTeclado = (e) => {
    if (e.key !== 'Escape' || cerrado) return;
    const todos = [...raiz().querySelectorAll('.gx-encima')];
    if (todos[todos.length - 1] === el) { e.stopPropagation(); cerrar(); }
  };
  document.addEventListener('keydown', alTeclado);
  function cerrar() {
    if (cerrado) return;
    cerrado = true;
    document.removeEventListener('keydown', alTeclado);
    el.classList.remove('abierto');
    el.classList.add('cerrando');
    setTimeout(() => el.remove(), 360);
    if (alCerrar) alCerrar();
  }
  return { el, cerrar };
}

// ------------------------------------------------------------------ máquina de escribir
// Escribe `texto` letra por letra en `el`. Devuelve { listo (promesa), completar() }.
// Con `voz`, cada tantas letras suena una notita (como si hablara).
export function escribir(el, texto, { velocidad = 32, voz = true, tono = 0 } = {}) {
  const letras = Array.from(texto);
  let i = 0;
  let reloj = null;
  let terminar;
  const listo = new Promise((ok) => { terminar = ok; });
  if (quieto()) {
    el.textContent = texto;
    terminar();
    return { listo, completar: () => {}, escribiendo: () => false };
  }
  el.textContent = '';
  const paso = () => {
    i += 1;
    el.textContent = letras.slice(0, i).join('');
    const letra = letras[i - 1];
    if (voz && i % 3 === 1 && /[a-záéíóúñ]/i.test(letra)) {
      campanita(tono + 4 + (letra.toLowerCase().charCodeAt(0) % 5), { volumen: 0.035, duracion: 0.22, conEco: false });
    }
    if (i >= letras.length) { reloj = null; terminar(); return; }
    const pausa = /[.,!?…:]/.test(letra) ? velocidad * 6 : velocidad;
    reloj = setTimeout(paso, pausa);
  };
  reloj = setTimeout(paso, velocidad);
  return {
    listo,
    completar() {
      if (reloj === null) return;
      clearTimeout(reloj);
      reloj = null;
      i = letras.length;
      el.textContent = texto;
      terminar();
    },
    escribiendo: () => reloj !== null,
  };
}

// Estelita dice varias cosas, una tras otra (se avanza tocando). Devuelve una promesa
// que se cumple cuando termina (o si la saltan).
export function dialogo(lineas, { quien = 'Estelita', color, borde } = {}) {
  return new Promise((ok) => {
    const texto = h('p', { class: 'gx-dialogo-texto' });
    const sigue = h('span', { class: 'gx-dialogo-sigue', 'aria-hidden': 'true' }, '✦');
    const avatar = h('div', { class: 'gx-dialogo-avatar' }, estrellaSvg({ color, borde }));
    const saltar = h('button', { type: 'button', class: 'gx-dialogo-saltar' }, 'Saltar');
    const caja = h('div', { class: 'gx-dialogo', role: 'dialog', 'aria-label': `${quien} te habla`, tabindex: '-1' },
      avatar,
      h('div', { class: 'gx-dialogo-burbuja' }, h('p', { class: 'gx-dialogo-quien' }, quien), texto, sigue),
      saltar);
    raiz().append(caja);
    requestAnimationFrame(() => requestAnimationFrame(() => caja.classList.add('abierto')));
    caja.focus({ preventScroll: true });
    let n = -1;
    let actual = null;
    let fin = false;
    const terminarTodo = () => {
      if (fin) return;
      fin = true;
      document.removeEventListener('keydown', alTeclado);
      caja.classList.remove('abierto');
      caja.classList.add('cerrando');
      setTimeout(() => caja.remove(), 420);
      ok();
    };
    const siguiente = () => {
      if (actual && actual.escribiendo()) { actual.completar(); return; }
      n += 1;
      if (n >= lineas.length) { terminarTodo(); return; }
      sigue.classList.remove('visible');
      avatar.classList.remove('salta');
      void avatar.offsetWidth;
      avatar.classList.add('salta');
      actual = escribir(texto, lineas[n]);
      actual.listo.then(() => { if (!fin) sigue.classList.add('visible'); });
    };
    function alTeclado(e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); siguiente(); }
      if (e.key === 'Escape') terminarTodo();
    }
    document.addEventListener('keydown', alTeclado);
    caja.addEventListener('click', (e) => { if (e.target !== saltar) { pop({ alto: 1.4, volumen: 0.06 }); siguiente(); } });
    saltar.addEventListener('click', (e) => { e.stopPropagation(); terminarTodo(); });
    setTimeout(siguiente, 350);
  });
}

// Una burbujita de texto que sale de un punto (cuando tocas una estrellita).
export function burbujaEn(x, y, texto, { ms = 2600 } = {}) {
  const b = h('p', { class: 'gx-burbuja', role: 'status' }, texto);
  raiz().append(b);
  const ancho = Math.min(240, window.innerWidth - 24);
  b.style.maxWidth = `${ancho}px`;
  const r = b.getBoundingClientRect();
  const izq = Math.min(window.innerWidth - r.width - 12, Math.max(12, x - r.width / 2));
  const arriba = Math.max(12, y - r.height - 18);
  b.style.left = `${izq}px`;
  b.style.top = `${arriba}px`;
  b.style.setProperty('--pico', `${Math.min(r.width - 18, Math.max(18, x - izq))}px`);
  requestAnimationFrame(() => b.classList.add('visible'));
  setTimeout(() => { b.classList.remove('visible'); setTimeout(() => b.remove(), 400); }, ms);
}

// Una imagen de ruido (el "grano" de las fotos viejitas), como dirección blob:.
let grano = null;
export function granoDePelicula() {
  if (grano) return grano;
  const c = document.createElement('canvas');
  c.width = 160;
  c.height = 160;
  const x = c.getContext('2d');
  const img = x.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random() * 255;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = Math.random() * 90;
  }
  x.putImageData(img, 0, 0);
  grano = c.toDataURL('image/png');
  return grano;
}
