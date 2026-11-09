// La pantalla de dibujar. La usan el dibujo del día, los retos y el personaje de la casa;
// cada uno pasa un "modo" que dice cómo es el lienzo y qué hacer al terminar:
//
//   chip          { texto, clase, alTocar }  el cartelito de arriba (el tema)
//   borrador      clave del borrador en este aparato (o null: sin borrador)
//   lienzo        { ancho, alto, papel, zona, fijo (url), guia (canvas), maxTrazos }
//   limites       { paleta, sinBalde, sinFormas, sinGotero, sinEspejo }  (ver herramientas.js)
//   textoTerminar el botón de arriba a la derecha ("Terminar", "Guardar"…)
//   extras        [{ texto, icono, alTocar(lienzo) }] botones extra en el encabezado
//   preparar      async (lienzo) antes de empezar (por ejemplo, cargar el personaje)
//   terminar      async (lienzo, ui) => true si ya se guardó (y se sale de la pantalla)
//   volver        a dónde vuelve la flechita
//   radio         false para no mostrar la radio
//   alEntrar      un textito que aparece al entrar

import { h, aviso } from './ui.js';
import { icono } from './iconos.js';
import { crearLienzo } from './lienzo.js';
import { crearDock } from './herramientas.js';
import { crearRadio } from './radio.js';
import { navegar, cargarImagen, leerBorrador, guardarBorrador, borrarBorrador } from './comun.js';

export async function pantallaLienzo(cont, vigente, modo) {
  const opcionesLienzo = modo.lienzo || {};
  // Lo que hay que bajar antes de armar el lienzo (la imagen fija del reto).
  const fijo = opcionesLienzo.fijo ? await cargarImagen(opcionesLienzo.fijo).catch(() => null) : null;
  if (opcionesLienzo.fijo && !fijo) { aviso('No se pudo cargar el dibujo de tu pareja. Revisa la conexión.', 3600); navegar(modo.volver || 'hoy'); return undefined; }
  if (!vigente()) return undefined;

  document.body.classList.add('modo-dibujo');
  const caja = h('div', { class: 'lienzo-caja' });
  const area = h('div', { class: 'area-lienzo' }, caja);
  let sucio = false;
  let temporizador = null;
  let terminando = false;
  let cerrado = false; // ya se terminó: no hay que guardar más borradores

  const botonTerminar = h('button', { type: 'button', class: 'boton fresa chico', onclick: pedirTerminar }, icono('check'), h('span', null, modo.textoTerminar || 'Terminar'));
  const radio = modo.radio === false ? null : crearRadio();
  const chip = modo.chip || { texto: '' };

  let dock = null;
  const lienzo = crearLienzo(caja, {
    ...opcionesLienzo,
    fijo,
    alCambiar: (estado) => { if (dock) dock.alCambiar(estado); programarGuardado(); },
    alGotero: (hex) => dock && dock.alGotero(hex),
    alLimite: () => aviso(`¡Ya usaste tus ${opcionesLienzo.maxTrazos} trazos! Puedes deshacer alguno.`, 3200),
    alAviso: (texto) => aviso(texto, 2600),
  });
  dock = crearDock({ lienzo, area, limites: { ...(modo.limites || {}), sinEspejo: Boolean(opcionesLienzo.zona) || (modo.limites || {}).sinEspejo } });

  const extras = (modo.extras || []).map((x) => h('button', {
    type: 'button', class: 'extra-boton', 'aria-label': x.texto, title: x.texto, onclick: async () => { await x.alTocar(lienzo); dock.actualizar(); },
  }, icono(x.icono || 'mas'), h('span', { class: 'extra-texto' }, x.texto)));

  const pantalla = h('main', { class: 'pantalla dibujar' },
    h('header', { class: 'dibujar-cabecera' },
      h('button', { type: 'button', class: 'volver', 'aria-label': 'Volver', onclick: volver }, icono('volver')),
      h('button', {
        type: 'button', class: `tema-chip ${chip.clase || ''}`, title: chip.texto,
        onclick: () => (chip.alTocar ? chip.alTocar() : aviso(chip.texto, 4000)),
      }, h('span', { class: 'tema-chip-texto' }, chip.texto)),
      ...extras,
      radio && radio.boton,
      botonTerminar),
    area,
    dock.el,
    radio && radio.panel);
  cont.append(pantalla);
  if (modo.alEntrar) setTimeout(() => aviso(modo.alEntrar, 3800), 400);

  // ---- borrador en este aparato (no viaja a internet hasta que terminas)
  function programarGuardado() {
    if (!modo.borrador) return;
    sucio = true;
    clearTimeout(temporizador);
    temporizador = setTimeout(guardarLocal, 1200);
  }

  async function guardarLocal() {
    clearTimeout(temporizador);
    if (!modo.borrador || !sucio || cerrado || terminando) return;
    sucio = false;
    try {
      const capas = await lienzo.exportarCapas();
      if (cerrado) return;
      if (lienzo.estaVacio()) { await borrarBorrador(modo.borrador); return; }
      await guardarBorrador(modo.borrador, {
        capas,
        visibles: lienzo.capas.map((c) => c.visible),
        opacidades: lienzo.capas.map((c) => c.opacidad),
      });
    } catch { /* sin espacio o sin almacenamiento: se sigue sin borrador */ }
  }

  const alOcultar = () => { if (document.hidden) guardarLocal(); };
  document.addEventListener('visibilitychange', alOcultar);
  window.addEventListener('pagehide', guardarLocal);

  // ---- recuperar lo que ya se había dibujado en este aparato
  if (modo.borrador) {
    try {
      const guardado = await leerBorrador(modo.borrador);
      if (guardado && guardado.viejo) {
        lienzo.cargarBase(await cargarImagen(guardado.viejo));
      } else if (guardado && guardado.capas) {
        const imagenes = await Promise.all(guardado.capas.map(async (b) => {
          if (!b) return null;
          const url = URL.createObjectURL(b);
          try { return await cargarImagen(url); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
        }));
        lienzo.cargarCapas(imagenes);
        (guardado.visibles || []).forEach((v, i) => lienzo.ponerVisible(i, v !== false));
        (guardado.opacidades || []).forEach((o, i) => lienzo.ponerOpacidad(i, Number(o) || 1));
        dock.actualizar();
      }
    } catch { /* se empieza en blanco */ }
  }
  if (modo.preparar) await modo.preparar(lienzo);
  if (!vigente()) { limpiar(); return undefined; }

  // ---- terminar
  async function pedirTerminar() {
    if (terminando) return;
    if (lienzo.estaVacio() && !modo.permitirVacio) { aviso('Dibuja algo antes de terminar.'); return; }
    const escondida = lienzo.tintaPorCapa().findIndex((hay, i) => hay && !lienzo.capas[i].visible);
    if (escondida >= 0) aviso(`Ojo: la capa ${escondida + 1} está escondida y no va a salir.`, 3600);
    terminando = true;
    dock.cerrarPanel();
    const texto = botonTerminar.lastChild;
    const original = texto.textContent;
    const ui = {
      ocupado: (si, mensaje = 'Guardando…') => { botonTerminar.disabled = si; texto.textContent = si ? mensaje : original; },
    };
    try {
      const listo = await modo.terminar(lienzo, ui);
      if (listo) {
        cerrado = true;
        if (modo.borrador) await borrarBorrador(modo.borrador);
        if (listo !== 'quedarse') navegar(modo.despues || modo.volver || 'hoy');
      }
    } finally {
      terminando = false;
      if (!cerrado) ui.ocupado(false);
    }
  }

  function volver() {
    guardarLocal();
    navegar(modo.volver || 'hoy');
  }

  function limpiar() {
    document.removeEventListener('visibilitychange', alOcultar);
    window.removeEventListener('pagehide', guardarLocal);
    clearTimeout(temporizador);
    dock.destruir();
    lienzo.destruir();
    if (radio) radio.destruir();
    document.body.classList.remove('modo-dibujo');
  }

  return async () => {
    await guardarLocal();
    limpiar();
  };
}
