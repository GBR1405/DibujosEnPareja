// ☁️ Easter egg: un perrito nube (blanquito, orejas largas, colita de rollito de canela)
// que cruza la pantalla volando con sus orejas. Sale si tocas a Garabatito 7 veces seguidas.

import { h } from './ui.js';

const TINTA = '#3a2745';
const PERRITO = `<svg viewBox="0 0 140 112" aria-hidden="true" stroke="${TINTA}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
  <g class="pn-oreja pn-oreja-i"><path d="M44 40C22 30 4 44 6 60c2 10 18 8 40-6z" fill="#fff"/></g>
  <g class="pn-oreja pn-oreja-d"><path d="M96 40c22-10 40 4 38 20-2 10-18 8-40-6z" fill="#fff"/></g>
  <ellipse cx="70" cy="84" rx="21" ry="16" fill="#fff"/>
  <path d="M90 84c6-2 11 2 10 7s-8 6-10 2 2-6 5-4" fill="#fff"/>
  <ellipse cx="70" cy="50" rx="35" ry="29" fill="#fff"/>
  <ellipse cx="57" cy="52" rx="4.6" ry="5.8" fill="#4f8fe0" stroke="none"/>
  <ellipse cx="83" cy="52" rx="4.6" ry="5.8" fill="#4f8fe0" stroke="none"/>
  <circle cx="58.5" cy="49.5" r="1.6" fill="#fff" stroke="none"/><circle cx="84.5" cy="49.5" r="1.6" fill="#fff" stroke="none"/>
  <ellipse cx="47" cy="61" rx="6.5" ry="3.6" fill="#ffb3c7" stroke="none"/>
  <ellipse cx="93" cy="61" rx="6.5" ry="3.6" fill="#ffb3c7" stroke="none"/>
  <path d="M66 62q4 4 8 0" fill="none" stroke-width="2.8"/>
</svg>`;

let volando = false;

export function perritoNube(mensaje = '☁️ ¡Hola! Soy el perrito nube') {
  if (volando || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  volando = true;
  const perrito = h('div', { class: 'perrito-nube', 'aria-hidden': 'true' });
  perrito.innerHTML = PERRITO;
  const globo = h('p', { class: 'perrito-globo' }, mensaje);
  const capa = h('div', { class: 'perrito-vuelo', role: 'status' }, h('div', { class: 'perrito-camino' }, perrito, globo));
  // nubecitas que va dejando
  for (let i = 0; i < 7; i += 1) capa.append(h('span', { class: 'perrito-nubecita', style: { '--i': i, '--y': `${30 + Math.sin(i) * 8}%` } }));
  document.body.append(capa);
  setTimeout(() => { capa.remove(); volando = false; }, 5600);
}
