// La cartita de novedades: "¡Hola amor! Estuve actualizando la app…". Le sale una sola
// vez a quien diga config.novedades (el servidor recuerda que ya la vio). Para una tanda
// nueva, cambia el `id` en config.js y esta lista.

import { api } from './api.js';
import { h, hoja, lluviaDeCorazones } from './ui.js';
import { caritaDe } from './comun.js';

const NOVEDADES = [
  ['🔥', 'La racha brilla', 'Mientras más días seguidos dibujamos, más bonito se pone el fondo (y la postal): rosadito, corazones, chispitas… ¡y a los 60 días, todo!'],
  ['🌙', 'Posponer', 'Si un día no puedes dibujar (ocupada o malita), lo pospones y me cuentas por qué. La racha se congela y al otro día hacemos los dos.'],
  ['🦝', 'Nuestros personajes', 'Ahora somos un mapache y un gato siamés.'],
  ['🏆', 'Reto de la semana', 'Cada semana un juego para dibujar en pareja: mitad y mitad, adivina qué es, de memoria, elegir el tema de mañana…'],
  ['🎨', 'Herramientas nuevas', '2 capas, estabilizador, tinta, lápiz, marcador, aerógrafo, gotero, espejo y tus propios colores.'],
  ['🏠', 'Nuestra casita', 'Cada dibujo nos da monedas 🪙 para comprar muebles. Nuestros personajes viven ahí, caminan y se abrazan. ¡Y puedes dibujar el tuyo!'],
  ['☁️', 'Algo especial para ti', 'En la tienda hay un perrito nube y rollitos de canela… y el perrito esconde un secreto 🤫'],
  ['💭', 'Pregunta del día', 'Una preguntita para los dos; ves mi respuesta cuando respondes la tuya.'],
  ['💌', 'Cartitas «Ábrela cuando…»', 'Cartas que se quedan cerradas hasta que las necesites.'],
];

export function mostrarNovedades(sesion, { de } = {}) {
  const autor = de === sesion.yo.id ? sesion.yo : sesion.pareja;
  setTimeout(() => lluviaDeCorazones(24), 300);
  hoja({
    titulo: '¡Hola amor! 💛',
    clase: 'hoja-novedades',
    contenido: h('div', { class: 'novedades' },
      h('div', { class: 'novedades-cara' }, caritaDe(autor, 'grande')),
      h('p', { class: 'novedades-intro' }, `Estuve actualizando la app y le agregué ${NOVEDADES.length} cosas nuevas. Aquí están:`),
      h('ol', { class: 'novedades-lista' }, NOVEDADES.map(([emoji, titulo, texto], i) => h('li', { style: { '--i': i } },
        h('span', { class: 'novedad-emoji', 'aria-hidden': 'true' }, emoji),
        h('span', { class: 'novedad-texto' }, h('strong', null, titulo), texto)))),
      h('p', { class: 'novedades-firma' }, `Con todo mi cariño, ${autor.nombre} 💛`)),
    acciones: [{ texto: '¡Vamos a verlas! ✨', clase: 'fresa' }],
    alCerrar: () => { api.novedadesVistas().catch(() => {}); },
  });
}
