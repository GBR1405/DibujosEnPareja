// El álbum de stickers: 30 espacios, 10 por página, como un cuaderno de pegatinas. Cada
// día cae una estrella dorada en el cielo; si la atrapas, el sticker que sigue se pega
// aquí con su animación. Los stickers son public/galaxia/stickers/sticker-1.png …
// sticker-30.png (los pone Gabri). Mientras falte alguno, se dibuja uno provisional.

import { h } from '../ui.js';
import { fechaCorta } from '../comun.js';
import { crearPanel, crearEncima, chispitas, esperar, quieto, caminoEstrella, azar } from './marco.js';
import { ALBUM } from './textos.js';
import { arpegio, pop, fiu, campanita } from './sonido.js';
import { confetiSeguro } from './grieta.js';

const POR_PAGINA = 10;
// Dónde va cada sticker en su página (centro en %, y un poquito torcido).
const LUGARES = [
  [19, 17, -6], [51, 14, 4], [82, 19, -3],
  [33, 39, 5], [69, 40, -5],
  [16, 62, 3], [50, 63, -4], [83, 64, 6],
  [32, 86, -3], [68, 86, 4],
];
const PAPELES = ['#fff7fb', '#f6f8ff', '#f7fff9'];
const urlSticker = (n) => `/galaxia/stickers/sticker-${n}.png`;

// ------------------------------------------------------------------ el sticker provisional
const COLORES = [['#ffd1e3', '#ff7fae'], ['#d2e7ff', '#5f9dff'], ['#d6f6e8', '#41bf92'], ['#fff0b8', '#eba92c'], ['#e6dbff', '#8f6dff']];
const provisionales = new Map();
function stickerProvisional(n) {
  if (provisionales.has(n)) return provisionales.get(n);
  const c = document.createElement('canvas');
  c.width = 220;
  c.height = 220;
  const x = c.getContext('2d');
  const [claro, fuerte] = COLORES[n % COLORES.length];
  const forma = ['estrella', 'corazon', 'luna', 'nube', 'planeta'][(n - 1) % 5];
  let cara = [110, 112];
  const p = new Path2D();
  if (forma === 'estrella') p.addPath(new Path2D(caminoEstrella(110, 116, 84, 44)));
  if (forma === 'corazon') {
    p.addPath(new Path2D('M110 182 C42 134 28 78 66 56 C88 44 104 54 110 72 C116 54 132 44 154 56 C192 78 178 134 110 182Z'));
    cara = [110, 104];
  }
  if (forma === 'luna') {
    p.addPath(new Path2D('M140 38 A76 76 0 1 0 140 182 A78 78 0 0 1 140 38Z'));
    cara = [92, 112];
  }
  if (forma === 'nube') {
    for (const [cx, cy, r] of [[70, 124, 42], [110, 98, 52], [152, 122, 42], [112, 140, 44]]) { p.moveTo(cx + r, cy); p.arc(cx, cy, r, 0, Math.PI * 2); }
    cara = [110, 120];
  }
  if (forma === 'planeta') { p.moveTo(170, 112); p.arc(110, 112, 60, 0, Math.PI * 2); }
  // borde blanco de sticker recortado, con su sombrita
  x.save();
  x.shadowColor = 'rgba(40,20,80,.28)';
  x.shadowBlur = 10;
  x.shadowOffsetY = 4;
  x.lineJoin = 'round';
  x.lineWidth = 22;
  x.strokeStyle = '#fff';
  x.fillStyle = '#fff';
  x.stroke(p);
  x.fill(p);
  x.restore();
  x.fillStyle = claro;
  x.fill(p);
  if (forma === 'planeta') {
    x.save();
    x.translate(110, 116);
    x.rotate(-0.32);
    x.lineWidth = 11;
    x.strokeStyle = '#fff';
    x.beginPath();
    x.ellipse(0, 0, 96, 24, 0, 0.1, Math.PI - 0.1);
    x.stroke();
    x.lineWidth = 6;
    x.strokeStyle = fuerte;
    x.stroke();
    x.restore();
  }
  if (forma !== 'nube') {
    x.lineWidth = 4;
    x.strokeStyle = fuerte;
    x.stroke(p);
  }
  // brillito
  x.fillStyle = 'rgba(255,255,255,.55)';
  x.beginPath();
  x.ellipse(cara[0] - 30, cara[1] - 34, 13, 7, -0.6, 0, Math.PI * 2);
  x.fill();
  // carita
  const [fx, fy] = cara;
  x.fillStyle = '#3a2745';
  for (const lado of [-1, 1]) { x.beginPath(); x.ellipse(fx + lado * 15, fy, 5, 7, 0, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = 'rgba(255,120,170,.6)';
  for (const lado of [-1, 1]) { x.beginPath(); x.ellipse(fx + lado * 28, fy + 13, 8, 5, 0, 0, Math.PI * 2); x.fill(); }
  x.strokeStyle = '#3a2745';
  x.lineWidth = 3.5;
  x.lineCap = 'round';
  x.beginPath();
  x.arc(fx, fy + 8, 7, 0.2, Math.PI - 0.2);
  x.stroke();
  // el número
  x.fillStyle = '#fff';
  x.beginPath();
  x.arc(176, 180, 24, 0, Math.PI * 2);
  x.fill();
  x.lineWidth = 3.5;
  x.strokeStyle = fuerte;
  x.stroke();
  x.fillStyle = fuerte;
  x.font = '700 26px Mali, sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText(String(n), 176, 182);
  const url = c.toDataURL('image/png');
  provisionales.set(n, url);
  return url;
}

function imagenSticker(n, clase = '') {
  const img = h('img', { class: `gx-sticker-img ${clase}`, src: urlSticker(n), alt: '', draggable: 'false' });
  img.addEventListener('error', () => { img.src = stickerProvisional(n); }, { once: true });
  return img;
}

// ------------------------------------------------------------------ garabatitos de adorno
const ADORNOS = [
  '<path d="M10 2 Q11 9 18 10 Q11 11 10 18 Q9 11 2 10 Q9 9 10 2Z" fill="#ffd36b"/>',
  '<path d="M10 17 C3 12 2 6 6 4 C8 3 9.5 4 10 6 C10.5 4 12 3 14 4 C18 6 17 12 10 17Z" fill="#ff9fc0"/>',
  '<path d="M13 3 A7.5 7.5 0 1 0 13 17 A7 7 0 0 1 13 3Z" fill="#b8a4ff"/>',
  '<circle cx="10" cy="10" r="3" fill="#8fd6ff"/><circle cx="10" cy="10" r="6.5" fill="none" stroke="#8fd6ff" stroke-width="1.6" stroke-dasharray="2 2.6"/>',
];
function adorno(i, estilo) {
  const t = document.createElement('template');
  t.innerHTML = `<svg class="gx-adorno" viewBox="0 0 20 20" aria-hidden="true">${ADORNOS[i % ADORNOS.length]}</svg>`;
  const el = t.content.firstElementChild;
  Object.assign(el.style, estilo);
  return el;
}

// ================================================================== el panel
export function abrir(ctx) {
  const { datos, yo, desde, extra = {}, alCambiar, alCerrar } = ctx;
  const total = datos.totalStickers;
  const paginas = Math.ceil(total / POR_PAGINA);
  const nuevo = Number.isInteger(extra.nuevo) ? extra.nuevo : null;
  // El sticker nuevo todavía no se ve pegado: se pega con la animación.
  const tengo = new Map(datos.stickers.filter((s) => s.n !== nuevo).map((s) => [s.n, s.fecha]));
  const contador = h('span', { class: 'gx-album-contador', 'aria-live': 'polite' });
  const pintarContador = () => { contador.textContent = `${tengo.size}/${total}`; };
  pintarContador();

  const panel = crearPanel({ clase: 'gx-panel-album', titulo: 'Álbum de stickers', extra: contador, desde, alCerrar });

  // ---- las páginas
  const slots = new Map();
  const hojas = [];
  function pintarSlot(n) {
    const slot = slots.get(n);
    const fecha = tengo.get(n);
    slot.classList.toggle('lleno', Boolean(fecha));
    if (fecha) {
      slot.replaceChildren(imagenSticker(n));
      slot.setAttribute('aria-label', `Sticker ${n}, atrapado el ${fechaCorta(fecha)}`);
    } else {
      slot.replaceChildren(h('span', { class: 'gx-slot-numero' }, String(n)));
      slot.setAttribute('aria-label', `Espacio vacío para el sticker ${n}`);
    }
  }
  for (let p = 0; p < paginas; p += 1) {
    const hoja = h('div', { class: 'gx-pagina', style: { '--papel': PAPELES[p % PAPELES.length] }, 'aria-label': `Página ${p + 1} de ${paginas}` },
      h('span', { class: 'gx-cinta gx-cinta-1', 'aria-hidden': 'true' }),
      h('span', { class: 'gx-cinta gx-cinta-2', 'aria-hidden': 'true' }),
      adorno(p, { left: '4%', top: '28%', width: '18px', transform: 'rotate(-12deg)' }),
      adorno(p + 1, { right: '4%', top: '50%', width: '16px', transform: 'rotate(18deg)' }),
      adorno(p + 2, { left: '46%', top: '26%', width: '14px' }),
      adorno(p + 3, { left: '7%', bottom: '4%', width: '17px', transform: 'rotate(8deg)' }));
    if (p === 0) hoja.append(h('p', { class: 'gx-pagina-titulo' }, ALBUM.titulo({ yo })));
    for (let i = 0; i < POR_PAGINA; i += 1) {
      const n = p * POR_PAGINA + i + 1;
      if (n > total) break;
      const [x, y, giro] = LUGARES[i];
      const slot = h('button', { type: 'button', class: 'gx-slot', style: { left: `${x}%`, top: `${y}%`, '--giro': `${giro}deg` } });
      slot.addEventListener('click', () => (tengo.has(n) ? verSticker(n) : tocarVacio(slot)));
      slots.set(n, slot);
      pintarSlot(n);
      hoja.append(slot);
    }
    hoja.append(h('p', { class: 'gx-pagina-numero', 'aria-hidden': 'true' }, `${p + 1}`));
    hojas.push(hoja);
  }
  const libro = h('div', { class: 'gx-libro' }, hojas);

  // ---- pasar de página
  let actual = 0;
  let pasando = false;
  const puntos = h('div', { class: 'gx-puntos', 'aria-hidden': 'true' }, hojas.map(() => h('span')));
  const anterior = h('button', { type: 'button', class: 'gx-redondo gx-flecha', 'aria-label': 'Página anterior', onclick: () => irA(actual - 1) }, '‹');
  const siguiente = h('button', { type: 'button', class: 'gx-redondo gx-flecha', 'aria-label': 'Página siguiente', onclick: () => irA(actual + 1) }, '›');
  function pintarPagina() {
    hojas.forEach((hoja, i) => {
      hoja.classList.toggle('visible', i === actual);
      hoja.inert = i !== actual;
    });
    [...puntos.children].forEach((s, i) => s.classList.toggle('activo', i === actual));
    anterior.disabled = actual === 0;
    siguiente.disabled = actual === paginas - 1;
  }
  async function irA(p) {
    if (p < 0 || p >= paginas || p === actual || pasando) return;
    pasando = true;
    const sale = hojas[actual];
    const entra = hojas[p];
    const adelante = p > actual;
    actual = p;
    fiu({ desde: adelante ? 700 : 420, hasta: adelante ? 380 : 760, duracion: 0.22, volumen: 0.05 });
    if (!quieto()) {
      entra.classList.add('visible');
      const giro = adelante
        ? sale.animate([{ transform: 'rotateY(0deg)', opacity: 1 }, { transform: 'rotateY(-115deg)', opacity: 0.2 }], { duration: 560, easing: 'cubic-bezier(.45,0,.3,1)' })
        : entra.animate([{ transform: 'rotateY(-115deg)', opacity: 0.2 }, { transform: 'rotateY(0deg)', opacity: 1 }], { duration: 560, easing: 'cubic-bezier(.45,0,.3,1)' });
      (adelante ? sale : entra).style.zIndex = '2';
      await giro.finished.catch(() => {});
      sale.style.zIndex = '';
      entra.style.zIndex = '';
    }
    pintarPagina();
    pasando = false;
  }
  pintarPagina();
  // deslizar con el dedo
  let x0 = null;
  libro.addEventListener('pointerdown', (e) => { x0 = { x: e.clientX, y: e.clientY }; });
  libro.addEventListener('pointerup', (e) => {
    if (!x0) return;
    const dx = e.clientX - x0.x;
    const dy = e.clientY - x0.y;
    x0 = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.3) irA(actual + (dx < 0 ? 1 : -1));
  });

  const nota = h('p', { class: 'gx-album-nota' });
  const pintarNota = () => {
    if (!tengo.size && nuevo === null) nota.textContent = ALBUM.vacio;
    else if (tengo.size >= total) nota.textContent = ALBUM.completo;
    else nota.textContent = datos.estrella.atrapada ? '⭐ Mañana cae otra estrella dorada.' : '🌠 La estrella de hoy todavía anda suelta por el cielo…';
  };
  pintarNota();
  panel.cuerpo.append(libro, h('div', { class: 'gx-album-pie' }, anterior, puntos, siguiente), nota);

  // ---- tocar
  function tocarVacio(slot) {
    pop({ alto: 0.8, volumen: 0.08 });
    slot.classList.remove('meneo');
    void slot.offsetWidth;
    slot.classList.add('meneo');
  }
  function verSticker(n) {
    campanita(7, { volumen: 0.12 });
    const capa = crearEncima({ clase: 'gx-ver-sticker', etiqueta: `Sticker ${n}` });
    capa.el.append(h('div', { class: 'gx-ver-sticker-caja' },
      h('div', { class: 'gx-ver-sticker-img' }, imagenSticker(n)),
      h('p', { class: 'gx-ver-sticker-titulo' }, `Sticker #${n}`),
      h('p', { class: 'gx-ver-sticker-fecha' }, `Atrapado el ${fechaCorta(tengo.get(n))} ⭐`),
      h('button', { type: 'button', class: 'gx-boton', onclick: () => capa.cerrar() }, 'Listo')));
  }

  // ---- ¡un sticker nuevo!
  async function celebrar(n) {
    if (n === 0) {
      // ya estaba completo: igual se celebra la estrella
      const capa = crearEncima({ clase: 'gx-nuevo', etiqueta: 'Estrella atrapada' });
      capa.el.append(h('div', { class: 'gx-nuevo-caja' },
        h('p', { class: 'gx-nuevo-titulo' }, '¡Atrapaste la estrella! 🌟'),
        h('p', { class: 'gx-nuevo-texto' }, ALBUM.completo),
        h('button', { type: 'button', class: 'gx-boton', onclick: () => capa.cerrar() }, '💛')));
      arpegio([0, 2, 4, 7, 9, 11], { separacion: 0.08, volumen: 0.18 });
      return;
    }
    const grande = imagenSticker(n, 'gx-nuevo-sticker');
    let listo;
    const espera = new Promise((ok) => { listo = ok; });
    const capa = crearEncima({ clase: 'gx-nuevo', etiqueta: `Sticker número ${n}`, cerrarAlFondo: false });
    const boton = h('button', { type: 'button', class: 'gx-boton dorado', onclick: () => listo() }, 'Pegarlo en el álbum ✨');
    capa.el.append(h('div', { class: 'gx-nuevo-caja' },
      h('p', { class: 'gx-nuevo-titulo' }, `¡Sticker #${n}!`),
      h('div', { class: 'gx-nuevo-brillo' }, h('span', { class: 'gx-rayos', 'aria-hidden': 'true' }), grande),
      h('p', { class: 'gx-nuevo-texto' }, 'Atrapaste la estrella de hoy ✨'),
      boton));
    setTimeout(() => boton.focus({ preventScroll: true }), 300);
    arpegio([0, 4, 7, 9, 11], { separacion: 0.09, volumen: 0.2 });
    await espera;
    pop({ alto: 1.3 });
    const pagina = Math.floor((n - 1) / POR_PAGINA);
    const desdeR = grande.getBoundingClientRect();
    const volador = grande.cloneNode();
    volador.className = 'gx-sticker-volador';
    Object.assign(volador.style, { left: `${desdeR.left}px`, top: `${desdeR.top}px`, width: `${desdeR.width}px`, height: `${desdeR.height}px` });
    panel.el.append(volador);
    capa.cerrar();
    if (pagina !== actual) await irA(pagina);
    tengo.set(n, datos.hoy);
    pintarSlot(n);
    const slot = slots.get(n);
    slot.classList.add('pegando');
    const haciaR = slot.getBoundingClientRect();
    const dx = haciaR.left + haciaR.width / 2 - (desdeR.left + desdeR.width / 2);
    const dy = haciaR.top + haciaR.height / 2 - (desdeR.top + desdeR.height / 2);
    const s = haciaR.width / desdeR.width;
    if (!quieto()) {
      await volador.animate([
        { transform: 'translate(0,0) scale(1) rotate(0deg)' },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 60}px) scale(${(1 + s) / 2 + 0.1}) rotate(${azar(-14, 14)}deg)`, offset: 0.55 },
        { transform: `translate(${dx}px, ${dy}px) scale(${s}) rotate(0deg)` },
      ], { duration: 760, easing: 'cubic-bezier(.5,0,.25,1)', fill: 'forwards' }).finished.catch(() => {});
    }
    volador.remove();
    slot.classList.remove('pegando');
    slot.classList.add('recien');
    const centro = slot.getBoundingClientRect();
    chispitas(centro.left + centro.width / 2, centro.top + centro.height / 2, { cantidad: 14, lejos: 70, colores: ['#ffd36b', '#fff3c4', '#ffc4ec', '#cfe1ff'] });
    arpegio([0, 2, 4, 7], { separacion: 0.07, volumen: 0.2 });
    pintarContador();
    pintarNota();
    alCambiar();
    if (tengo.size >= total) {
      await esperar(700);
      const { confeti } = await import('../../vendor/confeti.js');
      const { disparar, quitar } = confetiSeguro(confeti, 120);
      disparar({ particleCount: 140, spread: 100, origin: { y: 0.6 }, colors: ['#ffd36b', '#ff9fc6', '#9fd8ff', '#c9b0ff', '#ffffff'], shapes: ['star', 'circle'] }).then(quitar, quitar);
      arpegio([0, 2, 4, 5, 7, 9, 11], { separacion: 0.1, volumen: 0.2 });
    }
  }
  if (nuevo !== null) setTimeout(() => celebrar(nuevo), 480);
  else {
    // abrir en la página del último sticker pegado
    const ultimo = Math.max(0, ...tengo.keys());
    const p = Math.min(paginas - 1, Math.floor(Math.max(0, ultimo - 1) / POR_PAGINA));
    if (p > 0) { actual = p; pintarPagina(); }
  }
}
