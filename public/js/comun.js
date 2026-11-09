// Lo que comparten todas las pantallas: la sesión, las fechas, las caritas, la barra de
// abajo, el visor de dibujos y el borrador de este aparato.

import { h, aviso, descargar } from './ui.js';
import { icono, carita } from './iconos.js';
import { almacen } from './almacen.js';

// La sesión: { yo, pareja, reacciones… }. La pone app.js al entrar.
export const app = { sesion: null };

export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export const partes = (fecha) => fecha.split('-').map(Number);
export const diaSemana = (fecha) => { const [a, m, d] = partes(fecha); return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); };
export function fechaLarga(fecha) {
  const [, m, d] = partes(fecha);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}
export const fechaCorta = (fecha) => `${partes(fecha)[2]} de ${MESES[partes(fecha)[1] - 1]}`;
export function diasEntre(desde, hasta) {
  const [a1, m1, d1] = partes(desde);
  const [a2, m2, d2] = partes(hasta);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}
export function sumarDias(fecha, n) {
  const [a, m, d] = partes(fecha);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}

// La carita de una cuenta. `expresion`: 'normal', 'triste' (o true) o 'desanimado'.
export function caritaDe(cuenta, clase = '', expresion = 'normal') {
  const el = h('span', { class: `cara ${clase}`, style: { '--color': cuenta.color } });
  el.innerHTML = carita(cuenta.carita, cuenta.color, expresion);
  return el;
}

// ------------------------------------------------------------------ navegación
let irA = () => {};
export function alNavegar(fn) { irA = fn; }
export function navegar(ruta) {
  if (location.hash === `#/${ruta}`) irA(); else location.hash = `#/${ruta}`;
}

export function barraNav(actual) {
  const enlace = (ruta, nombre, ic) => h('a', {
    href: `#/${ruta}`,
    class: `nav-item ${actual === ruta ? 'activa' : ''}`,
    'aria-current': actual === ruta ? 'page' : null,
  }, icono(ic), h('span', null, nombre));
  return h('nav', { class: 'nav', 'aria-label': 'Secciones' },
    enlace('hoy', 'Hoy', 'hoy'),
    enlace('calendario', 'Calendario', 'calendario'),
    enlace('casa', 'Casa', 'casa'),
    enlace('nosotros', 'Nosotros', 'nosotros'));
}

// Un encabezado con flechita para volver.
export function cabeceraConVolver(titulo, destino = 'hoy', extra = null) {
  return h('header', { class: 'cabecera-volver' },
    h('button', { type: 'button', class: 'volver', 'aria-label': 'Volver', onclick: () => navegar(destino) }, icono('volver')),
    h('h1', { class: 'cabecera-titulo' }, titulo),
    extra || h('span', { class: 'cabecera-hueco', 'aria-hidden': 'true' }));
}

// ------------------------------------------------------------------ imágenes
export function cargarImagen(url) {
  return new Promise((ok, fallo) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fallo;
    img.src = url;
  });
}

// El dibujo se baja como PNG, que se abre en cualquier aplicación (el WebP no siempre).
export async function guardarImagen(src, nombreArchivo) {
  try {
    // Se carga como <img> y no con fetch: en el calendario `src` es una dirección blob:
    // y la CSP (connect-src 'self') no deja hacer fetch a esas.
    const imagen = await cargarImagen(src);
    const c = document.createElement('canvas');
    c.width = imagen.naturalWidth;
    c.height = imagen.naturalHeight;
    c.getContext('2d').drawImage(imagen, 0, 0);
    const png = await new Promise((ok) => { c.toBlob(ok, 'image/png'); });
    descargar(png, `${nombreArchivo}.png`);
  } catch {
    aviso('No se pudo guardar la imagen. Mantén presionada la imagen para guardarla.');
  }
}

export function abrirVisor({ src, nombre, titulo, archivo }) {
  const visor = h('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Dibujo de ${nombre}` });
  const cerrar = () => { visor.classList.add('se-va'); setTimeout(() => visor.remove(), 200); document.removeEventListener('keydown', alTeclado); };
  function alTeclado(e) { if (e.key === 'Escape') cerrar(); }
  document.addEventListener('keydown', alTeclado);
  visor.append(
    h('div', { class: 'visor-marco' },
      h('img', { src, alt: `Dibujo de ${nombre}` }),
      h('p', { class: 'visor-pie' }, `${nombre} · ${titulo}`)),
    h('div', { class: 'visor-acciones' },
      archivo && h('button', { type: 'button', class: 'boton blanco', onclick: () => guardarImagen(src, archivo) }, icono('descargar'), 'Guardar'),
      h('button', { type: 'button', class: 'boton sol', onclick: cerrar }, 'Cerrar')),
  );
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrar(); });
  document.body.append(visor);
}

// ------------------------------------------------------------------ borradores
// Lo que se va dibujando se guarda solo en este aparato: las capas en IndexedDB y, en
// localStorage, una marquita para saber rápido que hay borrador ("Seguir dibujando").
const marca = (clave) => `garabatos-borrador-${clave}`;

export function hayBorrador(clave) {
  try { return localStorage.getItem(marca(clave)) !== null; } catch { return false; }
}

export async function leerBorrador(clave) {
  let guardado = null;
  try { guardado = JSON.parse(localStorage.getItem(marca(clave)) || 'null'); } catch { /* nada */ }
  if (!guardado) return null;
  if (guardado.img) return { viejo: guardado.img }; // un borrador de antes de las capas
  return almacen.leer(clave);
}

export async function guardarBorrador(clave, datos) {
  const ok = await almacen.guardar(clave, { t: Date.now(), ...datos });
  try {
    if (ok) localStorage.setItem(marca(clave), JSON.stringify({ t: Date.now(), idb: 1 }));
  } catch { /* sin espacio: queda solo en IndexedDB */ }
  return ok;
}

export async function borrarBorrador(clave) {
  try { localStorage.removeItem(marca(clave)); } catch { /* nada */ }
  await almacen.borrar(clave);
}

// Borra los borradores que empiezan con `prefijo`, salvo los de `quedarse`.
export async function limpiarBorradores(prefijo, quedarse = []) {
  try {
    for (const k of Object.keys(localStorage)) {
      const clave = k.slice('garabatos-borrador-'.length);
      if (k.startsWith(`garabatos-borrador-${prefijo}`) && !quedarse.includes(clave)) localStorage.removeItem(k);
    }
  } catch { /* sin almacenamiento */ }
  for (const clave of await almacen.claves()) {
    if (String(clave).startsWith(prefijo) && !quedarse.includes(clave)) almacen.borrar(clave);
  }
}

// ------------------------------------------------------------------ monedas
export function monedasGanadas(n) {
  if (n > 0) setTimeout(() => aviso(`+${n} 🪙 para la casa`, 2600), 900);
}
