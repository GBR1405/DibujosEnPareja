// Garabatito, el lapicito de la casa. Vive en la pantalla de Hoy: flota, parpadea, cuenta
// cómo va el día en su globito y, si lo tocas, salta y dice alguna ocurrencia.
//
// Ánimos: 'normal', 'feliz' (ojitos de ^ ^) y 'dormido' (de noche, con zzz).

import { h } from './ui.js';

const TINTA = '#3a2745';

const DIBUJO = `<svg class="mascota-svg" viewBox="0 0 100 132" aria-hidden="true" stroke="${TINTA}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
  <g class="m-brazo m-brazo-izq"><path d="M29 74q-11 3-15-7" fill="none"/></g>
  <g class="m-brazo m-brazo-der"><path d="M71 74q11 3 15-7" fill="none"/></g>
  <path d="M28 96L50 126 72 96z" fill="#ffd9a8"/>
  <path d="M44.1 118L50 126 55.9 118z" fill="${TINTA}"/>
  <rect x="28" y="36" width="44" height="60" fill="#ffcf4a"/>
  <path d="M42.7 38v56M57.3 38v56" stroke-width="2" stroke-opacity=".22"/>
  <path d="M30 30V18a8 8 0 0 1 8-8h24a8 8 0 0 1 8 8v12z" fill="#ff9db5"/>
  <rect x="27" y="28" width="46" height="10" rx="2.5" fill="#ddd6ea"/>
  <g class="m-ojos"><circle cx="41" cy="60" r="3.8" fill="${TINTA}" stroke="none"/><circle cx="59" cy="60" r="3.8" fill="${TINTA}" stroke="none"/></g>
  <path class="m-ojos-felices" d="M37 62q4-6 8 0M55 62q4-6 8 0" fill="none"/>
  <path class="m-ojos-dormidos" d="M37 61q4 3 8 0M55 61q4 3 8 0" fill="none"/>
  <ellipse cx="34.5" cy="69" rx="4.6" ry="3" fill="#ff9db5" stroke="none" opacity=".9"/>
  <ellipse cx="65.5" cy="69" rx="4.6" ry="3" fill="#ff9db5" stroke="none" opacity=".9"/>
  <path class="m-boca" d="M45 68q5 5 10 0" fill="none"/>
  <g class="m-zzz" fill="none" stroke-width="2.6"><path d="M78 30h7l-7 8h7"/><path d="M88 14h5l-5 6h5"/></g>
</svg>`;

// Lo que dice cuando lo tocas (sin repetir la anterior).
const OCURRENCIAS = [
  '¡Jiji, me haces cosquillas!',
  'Soy Garabatito, el lápiz de la casa ✏️',
  'Toca un dibujo para verlo en grande 🔍',
  'En el calendario están todos los dibujos del año 📅',
  'Con «Postal» se llevan los dos dibujos juntos en una imagen 📮',
  'Si la medianoche te agarra dibujando, todavía puedes terminar el de ayer 🌙',
  'El borrador se guarda solito en este aparato 🤫',
  '¿Ya tomaste agua hoy? 💧',
  'Mi color favorito es el amarillo. Obvio 💛',
  '¡Me sacaron punta esta mañana! Me siento nuevo ✨',
  'Un dibujo al día y, al final del año… ¡un álbum entero! 📚',
  'Puedes dejarle una notita al dibujo de tu pareja 💌',
  'No tiene que quedar perfecto: tiene que quedar tuyo 💛',
];

export function crearMascota() {
  const boton = h('button', { type: 'button', class: 'mascota-boton', 'aria-label': 'Garabatito, la mascota. Tócalo para que diga algo.' });
  boton.innerHTML = DIBUJO;
  const texto = h('p', { class: 'mascota-texto' });
  const globo = h('div', { class: 'mascota-globo', role: 'status', 'aria-live': 'polite' }, texto);
  const el = h('section', { class: 'mascota', 'data-animo': 'normal', 'aria-label': 'Garabatito' }, boton, globo);

  let ultimo = '';
  let ocurrencia = -1;

  const repetirAnimacion = (nodo, clase) => {
    nodo.classList.remove(clase);
    void nodo.offsetWidth;
    nodo.classList.add(clase);
  };

  function decir(mensaje, { siempre = false } = {}) {
    if (mensaje === ultimo && !siempre) return;
    ultimo = mensaje;
    texto.textContent = mensaje;
    repetirAnimacion(globo, 'habla');
  }
  const saltar = () => repetirAnimacion(boton, 'salta');
  const animo = (cual) => { el.dataset.animo = cual || 'normal'; };

  boton.addEventListener('click', () => {
    let i;
    do { i = Math.floor(Math.random() * OCURRENCIAS.length); } while (i === ocurrencia && OCURRENCIAS.length > 1);
    ocurrencia = i;
    saltar();
    decir(OCURRENCIAS[i], { siempre: true });
  });
  boton.addEventListener('animationend', (e) => { if (e.animationName === 'mascota-salta') boton.classList.remove('salta'); });

  return { el, decir, saltar, animo };
}
