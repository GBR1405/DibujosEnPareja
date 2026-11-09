// Piezas pequeñas de interfaz: crear elementos, avisos, hojas y confeti de corazones.

import { icono } from './iconos.js';

export function h(etiqueta, atributos, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(atributos || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, valor] of Object.entries(v)) {
        if (prop.startsWith('--')) el.style.setProperty(prop, valor);
        else el.style[prop] = valor;
      }
    } else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo == null || hijo === false) continue;
    el.append(hijo.nodeType ? hijo : document.createTextNode(hijo));
  }
  return el;
}

export function svg(texto) {
  const t = document.createElement('template');
  t.innerHTML = texto.trim();
  return t.content.firstElementChild;
}

// ------------------------------------------------------------------ avisos
export function aviso(texto, ms = 2600) {
  let caja = document.getElementById('avisos');
  if (!caja) {
    caja = h('div', { id: 'avisos', role: 'status', 'aria-live': 'polite' });
    document.body.append(caja);
  }
  const el = h('p', { class: 'aviso' }, texto);
  caja.append(el);
  setTimeout(() => {
    el.classList.add('se-va');
    setTimeout(() => el.remove(), 260);
  }, ms);
}

// ------------------------------------------------------------------ hojas
export function hoja({ titulo, contenido, acciones = [], alCerrar, clase = '' }) {
  const anterior = document.activeElement;
  let cerrada = false;

  const fondo = h('div', { class: 'fondo-hoja', onclick: (e) => { if (e.target === fondo) cerrar(); } });
  const botones = acciones.map((a) => h('button', {
    type: 'button',
    class: `boton ${a.clase || ''}`,
    onclick: async () => {
      const resultado = a.onClick ? await a.onClick() : undefined;
      if (a.cierra !== false) cerrar(resultado);
    },
  }, a.texto));

  const panel = h('div', { class: `hoja ${clase}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': titulo || 'Ventana' },
    h('span', { class: 'hoja-asa', 'aria-hidden': 'true' }),
    titulo && h('h2', { class: 'hoja-titulo' }, titulo),
    contenido,
    botones.length > 0 && h('div', { class: 'hoja-acciones' }, botones));
  fondo.append(panel);

  function alTeclado(e) { if (e.key === 'Escape') cerrar(); }
  function cerrar(valor) {
    if (cerrada) return;
    cerrada = true;
    document.removeEventListener('keydown', alTeclado);
    fondo.classList.add('se-va');
    setTimeout(() => { fondo.remove(); if (anterior && anterior.focus) anterior.focus(); }, 200);
    if (alCerrar) alCerrar(valor);
  }
  document.addEventListener('keydown', alTeclado);
  document.body.append(fondo);
  (botones[botones.length - 1] || panel).focus?.({ preventScroll: true });
  return { cerrar };
}

export function confirmar({ titulo, texto, si, no, claseSi = 'fresa' }) {
  return new Promise((resolver) => {
    let respuesta = false;
    hoja({
      titulo,
      contenido: texto ? h('p', { class: 'hoja-texto' }, texto) : null,
      acciones: [
        { texto: no, clase: 'blanco', onClick: () => { respuesta = false; } },
        { texto: si, clase: claseSi, onClick: () => { respuesta = true; } },
      ],
      alCerrar: () => resolver(respuesta),
    });
  });
}

// ------------------------------------------------------------------ archivos
// Baja un archivo (un Blob) con ese nombre.
export function descargar(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: nombreArchivo });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// ------------------------------------------------------------------ chispitas
// Unos cuantos `emoji` que salen volando hacia arriba desde `desde` (un elemento).
export function chispas(emoji, desde, cantidad = 7) {
  if (!emoji || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = desde.getBoundingClientRect();
  const capa = h('div', { class: 'chispas', 'aria-hidden': 'true', style: { left: `${r.left + r.width / 2}px`, top: `${r.top + r.height / 2}px` } });
  for (let i = 0; i < cantidad; i += 1) {
    capa.append(h('span', {
      class: 'chispa',
      style: {
        '--dx': `${Math.round((Math.random() - 0.5) * 140)}px`,
        '--dy': `${-60 - Math.round(Math.random() * 90)}px`,
        '--giro': `${Math.round(Math.random() * 70 - 35)}deg`,
        '--demora': `${i * 40}ms`,
        '--tam': `${20 + Math.round(Math.random() * 14)}px`,
      },
    }, emoji));
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 1400);
}

// ------------------------------------------------------------------ confeti
export function lluviaDeCorazones(cantidad = 18) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const colores = ['#ff6f91', '#ffcf4a', '#7fdcc0', '#8fc4ff', '#ffb3c7'];
  const capa = h('div', { class: 'lluvia', 'aria-hidden': 'true' });
  for (let i = 0; i < cantidad; i += 1) {
    const c = icono('corazon', { relleno: true });
    c.classList.add('lluvia-corazon');
    c.style.setProperty('--x', `${Math.round(Math.random() * 100)}%`);
    c.style.setProperty('--tam', `${18 + Math.round(Math.random() * 20)}px`);
    c.style.setProperty('--color', colores[i % colores.length]);
    c.style.setProperty('--demora', `${Math.round(Math.random() * 700)}ms`);
    c.style.setProperty('--giro', `${Math.round(Math.random() * 60 - 30)}deg`);
    capa.append(c);
  }
  document.body.append(capa);
  setTimeout(() => capa.remove(), 3200);
}
