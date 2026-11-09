// El fondo de la app cambia con la racha (días seguidos dibujando juntos):
//
//   nivel 0   0-3 días    nada
//   nivel 1   4-7         el fondo se pone rosadito
//   nivel 2   8-15        + corazones que suben flotando
//   nivel 3   16-30       más rosado, más corazones y chispitas que brillan
//   nivel 4   31-59       + burbujas de luz
//   nivel 5   60 o más    todo al máximo: una aurora de colores y estrellas fugaces
//
// El nivel lo calcula el servidor (lib/racha.js). Se recuerda en el aparato para que al
// abrir la app ya salga con su fondo, sin esperar al servidor.

import { h } from './ui.js';
import { icono } from './iconos.js';

const CLAVE = 'garabatos-nivel-racha';
const CANTIDAD = [
  null,
  { corazones: 0, chispas: 0, burbujas: 0, fugaces: 0 },
  { corazones: 7, chispas: 0, burbujas: 0, fugaces: 0 },
  { corazones: 13, chispas: 10, burbujas: 0, fugaces: 0 },
  { corazones: 16, chispas: 14, burbujas: 8, fugaces: 0 },
  { corazones: 22, chispas: 18, burbujas: 10, fugaces: 3 },
];
const COLORES = ['#ff6f91', '#ff9db5', '#ffb3c7', '#ff7fb0', '#ffc2d1', '#ffcf4a'];

let capa = null;
let nivelActual = -1;

export function nivelGuardado() {
  try { return Math.min(5, Math.max(0, Number(localStorage.getItem(CLAVE)) || 0)); } catch { return 0; }
}

const azar = (a, b) => a + Math.random() * (b - a);

function armar(nivel) {
  const cuanto = CANTIDAD[nivel];
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hijos = [];
  for (let i = 0; i < cuanto.corazones; i += 1) {
    const c = icono('corazon', { relleno: true });
    c.classList.add('racha-corazon');
    c.style.setProperty('--x', `${azar(2, 96).toFixed(1)}%`);
    c.style.setProperty('--y', `${azar(4, 92).toFixed(1)}%`);
    c.style.setProperty('--tam', `${Math.round(azar(12, nivel >= 3 ? 34 : 26))}px`);
    c.style.setProperty('--dur', `${azar(nivel >= 4 ? 9 : 12, nivel >= 4 ? 16 : 20).toFixed(1)}s`);
    c.style.setProperty('--demora', `${(-azar(0, 20)).toFixed(1)}s`);
    c.style.setProperty('--deriva', `${Math.round(azar(-40, 40))}px`);
    c.style.setProperty('--color', COLORES[i % COLORES.length]);
    c.style.setProperty('--opa', azar(0.25, nivel >= 3 ? 0.6 : 0.45).toFixed(2));
    hijos.push(c);
  }
  for (let i = 0; i < cuanto.chispas; i += 1) {
    hijos.push(h('span', {
      class: 'racha-chispa',
      style: {
        '--x': `${azar(2, 98).toFixed(1)}%`, '--y': `${azar(2, 96).toFixed(1)}%`, '--tam': `${Math.round(azar(8, 18))}px`,
        '--dur': `${azar(1.8, 3.6).toFixed(1)}s`, '--demora': `${(-azar(0, 4)).toFixed(1)}s`,
      },
    }));
  }
  for (let i = 0; i < cuanto.burbujas; i += 1) {
    hijos.push(h('span', {
      class: 'racha-burbuja',
      style: {
        '--x': `${azar(0, 95).toFixed(1)}%`, '--tam': `${Math.round(azar(40, 110))}px`,
        '--dur': `${azar(16, 30).toFixed(1)}s`, '--demora': `${(-azar(0, 30)).toFixed(1)}s`, '--deriva': `${Math.round(azar(-60, 60))}px`,
      },
    }));
  }
  for (let i = 0; i < cuanto.fugaces; i += 1) {
    hijos.push(h('span', { class: 'racha-fugaz', style: { '--y': `${azar(5, 45).toFixed(1)}%`, '--demora': `${(i * 4.3 + azar(0, 2)).toFixed(1)}s` } }));
  }
  const el = h('div', { class: `efecto-racha ${quieto ? 'quieto' : ''}`, 'aria-hidden': 'true' }, nivel >= 5 && h('span', { class: 'racha-aurora' }), hijos);
  return el;
}

// Pone el fondo del nivel `nivel` (0 a 5). Si ya estaba, no hace nada.
export function ponerRacha(nivel) {
  const n = Math.min(5, Math.max(0, Number(nivel) || 0));
  try { localStorage.setItem(CLAVE, String(n)); } catch { /* sin almacenamiento */ }
  if (n === nivelActual) return;
  nivelActual = n;
  document.body.dataset.racha = String(n);
  if (capa) { capa.remove(); capa = null; }
  if (n >= 2) {
    capa = armar(n);
    document.body.prepend(capa);
  }
}

// Al abrir la app: el fondo que tenían la última vez.
export function rachaInicial() { ponerRacha(nivelGuardado()); }

export const NOMBRES_NIVEL = ['', 'Rosadito', 'Con corazones', '¡Encendida!', '¡Brillante!', '¡Al máximo!'];
