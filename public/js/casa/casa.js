// La casa (#/casa): su casita en 2.5D, la alcancía 🪙, decorar (como en los Sims) y el
// editor del personaje (#/casa/personaje). La escena 3D está en escena.js.
//
// Decorar: abajo aparece el catálogo (Comprar · Mis cosas · Cuarto). Tocas un mueble y
// aparece en la casa: lo arrastras con el dedo (verde = cabe, rojo = no) y con los
// botoncitos de encima lo giras y lo compras (o lo pones, si ya era suyo). Lo que ya está
// puesto se arrastra directo y se guarda solo al soltarlo; si lo tocas, salen sus botones
// (girar, guardar, vender, cambiar el dibujo del cuadro).

import { api, urlAvatar, urlDibujo } from '../api.js';
import { h, aviso, hoja, confirmar, chispas } from '../ui.js';
import { icono } from '../iconos.js';
import { app, barraNav, cargarImagen, fechaCorta, navegar } from '../comun.js';
import { ponerRacha } from '../racha.js';
import { crearEscena } from './escena.js';
import { dibujarGuia, dibujarCuerpoBase, ANCHO as ANCHO_P, ALTO as ALTO_P } from './plantilla.js';

const CATEGORIAS = [['muebles', 'Muebles', '🛋️'], ['deco', 'Decoración', '🪴'], ['pared', 'Paredes', '🖼️']];
const MOTIVOS = { dibujo: '✏️ Dibujo', pareja: '💛 Dibujaron los dos', reto: '🏆 Reto de la semana', pregunta: '💭 Pregunta del día', carta: '💌 Cartita', racha: '🔥 Racha', venta: '🪙 Venta', prueba: '🧪' };
const DEL_CUARTO = new Set(['pintura', 'piso', 'casa']);

// La imagen del personaje de cada quien: la que dibujó, o la de fábrica.
async function imagenDePersonaje(cuenta, v) {
  if (v) {
    try { return await cargarImagen(urlAvatar(cuenta.id, v)); } catch { /* la de fábrica */ }
  }
  return dibujarCuerpoBase(cuenta);
}

export async function pantallaCasa(cont, vigente) {
  const datos = await api.casa();
  if (!vigente()) return undefined;
  const { yo, pareja } = app.sesion;
  const tipos = new Map(datos.catalogo.map((m) => [m.id, m]));
  const LADO = datos.lado;
  const esc = datos.escalera;

  const monedas = h('button', { type: 'button', class: 'monedas-chip grande', onclick: () => verAlcancia() });
  const selectorPiso = h('div', { class: 'casa-pisos', role: 'group', 'aria-label': 'Qué piso ver' });
  const flotante = h('div', { class: 'casa-flotante', hidden: true });
  const lugarEscena = h('div', { class: 'casa-escena', 'aria-label': 'La casa. Toca el piso para que tu personaje camine hasta allá.' }, selectorPiso, flotante);
  const ayuda = h('p', { class: 'casa-ayuda', 'aria-live': 'polite' });
  const barra = h('div', { class: 'casa-barra' });
  const decorar = h('section', { class: 'decorar', hidden: true, 'aria-label': 'Decorar' });
  const pantalla = h('main', { class: 'pantalla casa' },
    h('header', { class: 'casa-cabecera' }, h('h1', { class: 'cabecera-grande' }, 'Nuestra casa'), monedas),
    lugarEscena, ayuda, barra, decorar,
    h('p', { class: 'casa-afinando' }, 'Estoy afinando algunas cosas :p'));
  cont.append(pantalla, barraNav('casa'));

  const escena = crearEscena(lugarEscena, { lado: LADO, catalogo: datos.catalogo, pisos: datos.pisos, escalera: esc });
  escena.ponerCuarto(datos.ajustes, datos.pisos);

  // ---- los muebles (los cuadros con su dibujo)
  async function fotoDeCuadro(m) {
    if (!m.dibujo) return null;
    const [fecha, quien] = m.dibujo.split('/');
    try { return await cargarImagen(urlDibujo(fecha, quien, 'casa')); } catch { return null; }
  }
  function ponerUno(m) {
    escena.ponerMueble(m);
    if (m.tipo === 'cuadro' && m.dibujo) fotoDeCuadro(m).then((img) => { if (img) escena.ponerFotoEn(m.id, img); });
  }
  for (const m of datos.muebles) ponerUno(m);

  // ---- los personajes
  Promise.all([yo, pareja].map(async (c) => ({ c, img: await imagenDePersonaje(c, datos.avatares[c.id]) }))).then((lista) => {
    if (!vigente()) return;
    for (const { c, img } of lista) escena.ponerPersonaje(img, c, datos.animo[c.id] || {});
    const p = datos.animo[pareja.id] || {};
    setTimeout(() => {
      if (p.pospuso) escena.tocarPersonaje(pareja.id, p.pospuso === 'mal' ? '🤒' : '💼');
      else escena.tocarPersonaje(yo.id, '👋');
    }, 900);
  });

  const pintarMonedas = () => { monedas.replaceChildren('🪙 ', String(datos.monedas)); };
  pintarMonedas();

  // ---- los pisos
  function pintarPisos() {
    selectorPiso.hidden = datos.pisos < 2;
    selectorPiso.replaceChildren(...[1, 0].map((p) => h('button', {
      type: 'button', class: `casa-piso ${escena.piso === p ? 'activo' : ''}`, 'aria-pressed': escena.piso === p,
      onclick: () => { if (sel) cancelar(); escena.verPiso(p); pintarPisos(); escena.limpiarMarcas(); },
    }, p === 1 ? '2º piso' : '1er piso')));
  }
  pintarPisos();

  // ================================================================ decorar
  let modo = 'ver';
  let pestana = 'comprar';
  let categoria = 'muebles';
  let sel = null; // { id, tipo, nuevo, guardado, original, guardando }

  const guardadosCount = () => datos.muebles.filter((m) => m.x == null).length;

  function pintarBarra() {
    pintarFlotante();
    const b = (texto, ic, alTocar, clase = 'blanco') => h('button', { type: 'button', class: `boton chico ${clase}`, onclick: alTocar }, icono(ic), texto);
    if (modo === 'ver') {
      decorar.hidden = true;
      barra.hidden = false;
      ayuda.textContent = 'Toca el piso y tu personaje camina hasta allá. Toca un mueble para que lo use, o a tu pareja para darle un abrazo 💛';
      barra.replaceChildren(
        b('Decorar', 'mover', () => entrarDecorar(), 'sol'),
        b('Mi personaje', 'personaje', () => navegar('casa/personaje')));
      return;
    }
    barra.hidden = true;
    decorar.hidden = false;
    ayuda.textContent = sel
      ? (sel.nuevo ? 'Arrástralo con el dedo hasta donde lo quieras y toca «Comprar».' : sel.guardado ? 'Arrástralo hasta donde lo quieras y toca «Poner».' : 'Arrástralo para moverlo (se guarda solito al soltarlo).')
      : 'Elige algo del catálogo, o arrastra un mueble para moverlo.';
    pintarDecorar();
  }

  function pintarDecorar() {
    const pestanas = [['comprar', '🛍️ Comprar'], ['caja', `📦 Mis cosas${guardadosCount() ? ` (${guardadosCount()})` : ''}`], ['cuarto', '🎨 Cuarto']];
    const cabeza = h('div', { class: 'decorar-pestanas', role: 'tablist' },
      pestanas.map(([id, texto]) => h('button', { type: 'button', role: 'tab', class: `decorar-pestana ${pestana === id ? 'activa' : ''}`, 'aria-selected': pestana === id, onclick: () => { pestana = id; pintarDecorar(); } }, texto)),
      h('button', { type: 'button', class: 'boton fresa chico decorar-listo', onclick: salirDecorar }, icono('check'), 'Listo'));
    let lista = [];
    let cats = null;
    if (pestana === 'comprar') {
      cats = h('div', { class: 'decorar-cats' }, CATEGORIAS.map(([id, nombre, emoji]) => h('button', {
        type: 'button', class: `chip ${categoria === id ? 'activa' : ''}`, onclick: () => { categoria = id; pintarDecorar(); },
      }, `${emoji} ${nombre}`)));
      lista = datos.catalogo.filter((m) => m.cat === categoria).map((t) => tarjeta(t, {
        precio: `🪙 ${t.precio}`, caro: datos.monedas < t.precio,
        alTocar: () => (datos.monedas < t.precio ? aviso(`Les faltan ${t.precio - datos.monedas} 🪙. ¡A dibujar! ✏️`) : empezarNuevo(t)),
      }));
    } else if (pestana === 'caja') {
      const guardados = datos.muebles.filter((m) => m.x == null);
      lista = guardados.length
        ? guardados.map((m) => tarjeta(tipos.get(m.tipo), { precio: 'Ponerlo', alTocar: () => empezarGuardado(m) }))
        : [h('p', { class: 'decorar-vacio' }, 'Aquí aparece lo que guarden. ¡Por ahora nada! 📦')];
    } else {
      lista = datos.catalogo.filter((m) => DEL_CUARTO.has(m.cat)).map((t) => {
        const tiene = datos.tiene.includes(t.id);
        const puesto = (t.cat === 'pintura' || t.cat === 'piso') ? datos.ajustes[t.cat] === t.id : tiene;
        return tarjeta(t, {
          muestra: true,
          precio: puesto ? '✓ Puesto' : tiene ? 'Ponerlo' : t.precio ? `🪙 ${t.precio}` : 'Gratis',
          caro: !tiene && datos.monedas < t.precio,
          puesto,
          alTocar: () => cambiarCuarto(t),
        });
      });
    }
    decorar.replaceChildren(...[cabeza, cats, h('div', { class: 'decorar-tira' }, lista)].filter(Boolean));
  }

  function tarjeta(t, { precio, caro = false, puesto = false, muestra = false, alTocar }) {
    const cuantos = datos.muebles.filter((m) => m.tipo === t.id).length;
    return h('button', { type: 'button', class: `decorar-item ${caro ? 'caro' : ''} ${puesto ? 'puesto' : ''}`, onclick: alTocar, title: t.nombre },
      muestra
        ? h('span', { class: 'tienda-muestra', style: { '--tono': t.color } }, t.emoji)
        : h('img', { class: 'decorar-foto', src: escena.foto(t.id), alt: '', draggable: 'false' }),
      h('span', { class: 'decorar-nombre' }, t.nombre),
      h('span', { class: 'tienda-precio' }, precio),
      cuantos > 0 && !muestra && pestana === 'comprar' && h('span', { class: 'tienda-tienen' }, `×${cuantos}`));
  }

  function entrarDecorar() { modo = 'decorar'; escena.verRejilla(true); pintarBarra(); }
  function salirDecorar() { if (sel) cancelar(); modo = 'ver'; escena.verRejilla(false); escena.limpiarMarcas(); pintarBarra(); }

  // ---- ¿cabe? (las mismas reglas que el servidor, para pintar verde o rojo)
  const enEscalera = (x, z) => datos.pisos >= 2 && esc && x === esc.x && z >= esc.desde && z <= esc.hasta;
  function cabe(dato) {
    const t = tipos.get(dato.tipo);
    const piso = dato.piso || 0;
    if (t.cat === 'pared') {
      if (dato.x < 0 || dato.x + t.w > LADO) return false;
      return !datos.muebles.some((m) => m.id !== dato.id && m.x != null && (m.piso || 0) === piso && m.pared === dato.pared && tipos.get(m.tipo).cat === 'pared'
        && dato.x < m.x + tipos.get(m.tipo).w && m.x < dato.x + t.w);
    }
    const celdas = escena.casillasDe(dato);
    if (celdas.some(([x, z]) => x >= LADO || z >= LADO || x < 0 || z < 0 || enEscalera(x, z))) return false;
    const ocupadas = new Set();
    for (const m of datos.muebles) {
      if (m.id === dato.id || m.x == null || (m.piso || 0) !== piso) continue;
      const o = tipos.get(m.tipo);
      if (o.cat === 'pared' || Boolean(o.plano) !== Boolean(t.plano)) continue;
      for (const [x, z] of escena.casillasDe(m)) ocupadas.add(`${x},${z}`);
    }
    return celdas.every(([x, z]) => !ocupadas.has(`${x},${z}`));
  }
  function revisar() {
    if (!sel) return false;
    const e = escena.mueble(sel.id);
    const ok = cabe(e.dato);
    if (tipos.get(e.dato.tipo).cat === 'pared') escena.limpiarMarcas();
    else escena.marcar(escena.casillasDe(e.dato), ok, e.dato.piso || 0);
    sel.cabe = ok;
    pintarFlotante();
    return ok;
  }

  // El primer lugar libre del piso que se está mirando (cerca del centro).
  function primerLugar(t, id) {
    const piso = escena.piso;
    if (t.cat === 'pared') {
      for (const pared of ['der', 'izq']) {
        for (let x = 0; x <= LADO - t.w; x += 1) {
          const d = { id, tipo: t.id, x, z: 0, rot: 0, pared, piso };
          if (cabe(d)) return d;
        }
      }
      return { id, tipo: t.id, x: 0, z: 0, rot: 0, pared: 'der', piso };
    }
    const centro = (LADO - 1) / 2;
    const opciones = [];
    for (let x = 0; x <= LADO - t.w; x += 1) for (let z = 0; z <= LADO - t.d; z += 1) opciones.push({ x, z, d: Math.hypot(x + t.w / 2 - centro - 0.5, z + t.d / 2 - centro - 0.5) });
    opciones.sort((a, b) => a.d - b.d);
    for (const o of opciones) {
      const d = { id, tipo: t.id, x: o.x, z: o.z, rot: 0, pared: null, piso };
      if (cabe(d)) return d;
    }
    return { id, tipo: t.id, x: 0, z: 0, rot: 0, pared: null, piso };
  }

  function seleccionar(id, extra = {}) {
    const e = escena.mueble(id);
    sel = { id, tipo: e.dato.tipo, original: { ...e.dato }, ...extra };
    escena.seleccionar(id);
    revisar();
    pintarBarra();
  }

  function empezarNuevo(t) {
    if (sel) cancelar();
    const id = `nuevo-${Date.now()}`;
    escena.ponerMueble(primerLugar(t, id));
    seleccionar(id, { nuevo: true });
  }
  function empezarGuardado(m) {
    if (sel) cancelar();
    const lugar = primerLugar(tipos.get(m.tipo), m.id);
    escena.moverMueble(m.id, lugar);
    seleccionar(m.id, { guardado: true });
    sel.original = { ...m };
  }

  function moverA(casilla, pared) {
    const e = escena.mueble(sel.id);
    const t = tipos.get(e.dato.tipo);
    if (t.cat === 'pared') {
      if (!pared) return;
      const x = Math.max(0, Math.min(LADO - t.w, Math.round(pared.pos - t.w / 2)));
      escena.moverMueble(sel.id, { x, pared: pared.pared, z: 0, rot: 0, piso: pared.piso });
    } else {
      if (!casilla) return;
      const girado = e.dato.rot % 2 === 1;
      const we = girado ? t.d : t.w;
      const de = girado ? t.w : t.d;
      // el dedo queda en el centro del mueble
      const x = Math.max(0, Math.min(LADO - we, Math.round(casilla.fx - we / 2)));
      const z = Math.max(0, Math.min(LADO - de, Math.round(casilla.fz - de / 2)));
      if (x === e.dato.x && z === e.dato.z && casilla.p === (e.dato.piso || 0)) return;
      escena.moverMueble(sel.id, { x, z, piso: casilla.p });
    }
    revisar();
  }

  async function girar() {
    const e = escena.mueble(sel.id);
    const t = tipos.get(e.dato.tipo);
    if (t.cat === 'pared') return;
    const rot = (e.dato.rot + 1) % 4;
    const girado = rot % 2 === 1;
    const we = girado ? t.d : t.w;
    const de = girado ? t.w : t.d;
    escena.moverMueble(sel.id, { rot, x: Math.min(e.dato.x, LADO - we), z: Math.min(e.dato.z, LADO - de) });
    if (revisar() && !sel.nuevo && !sel.guardado) await guardarLugar();
  }

  // Deja todo como estaba (lo nuevo desaparece, lo guardado vuelve a la caja).
  function cancelar() {
    if (!sel) return;
    const { id, nuevo, guardado, original } = sel;
    escena.seleccionar(null);
    if (nuevo) escena.quitarMueble(id);
    else if (guardado) escena.moverMueble(id, { x: null });
    else escena.moverMueble(id, original);
    sel = null;
    escena.limpiarMarcas();
    pintarBarra();
  }

  // Lo que ya estaba puesto se guarda solito al soltarlo (si cabe).
  async function guardarLugar() {
    if (!sel || sel.nuevo || sel.guardado) return;
    const { dato } = escena.mueble(sel.id);
    if (!cabe(dato)) {
      aviso('Ahí no cabe 😅 Vuelve a su lugar.');
      escena.moverMueble(sel.id, sel.original);
      revisar();
      return;
    }
    try {
      await api.poner({ id: dato.id, x: dato.x, z: dato.z, rot: dato.rot, pared: dato.pared, piso: dato.piso || 0 });
      Object.assign(datos.muebles.find((m) => m.id === dato.id), { x: dato.x, z: dato.z, rot: dato.rot, pared: dato.pared, piso: dato.piso || 0 });
      sel.original = { ...dato };
    } catch (e) {
      aviso(e.datos?.error === 'lugar_ocupado' ? 'Ahí ya hay algo (quizá lo acaba de poner tu pareja).' : 'No se pudo guardar. Revisa la conexión.');
      escena.moverMueble(sel.id, sel.original);
      revisar();
    }
  }

  // Comprar lo nuevo / poner lo guardado, en el lugar donde quedó.
  async function confirmar() {
    if (!sel || sel.guardando) return;
    if (!revisar()) { aviso('Ahí no cabe: muévelo a un lugar verde 😅'); return; }
    const { dato } = escena.mueble(sel.id);
    const t = tipos.get(dato.tipo);
    const lugar = { x: dato.x, z: dato.z, rot: dato.rot, pared: dato.pared, piso: dato.piso || 0 };
    sel.guardando = true;
    try {
      if (sel.nuevo) {
        const r = await api.comprar(t.id);
        await api.poner({ id: r.id, ...lugar });
        datos.monedas = r.monedas;
        pintarMonedas();
        escena.seleccionar(null);
        escena.quitarMueble(sel.id);
        const nuevo = { id: r.id, tipo: t.id, ...lugar, dibujo: null, quien: yo.id };
        datos.muebles.push(nuevo);
        ponerUno(nuevo);
        chispas('🪙', monedas, 6);
        aviso(`¡Listo! ${t.nombre} ya está en la casa ✨`, 2400);
      } else {
        await api.poner({ id: sel.id, ...lugar });
        Object.assign(datos.muebles.find((m) => m.id === sel.id), lugar);
        escena.seleccionar(null);
      }
      sel = null;
      escena.limpiarMarcas();
      pintarBarra();
    } catch (e) {
      sel.guardando = false;
      if (e.datos?.error === 'sin_monedas') { datos.monedas = e.datos.monedas; pintarMonedas(); aviso('No les alcanza 😿'); return; }
      aviso(e.datos?.error === 'lugar_ocupado' ? 'Ahí ya hay algo. Prueba en otro lugar.' : 'No se pudo. Revisa la conexión.');
    }
  }

  async function guardarEnCaja() {
    const id = sel.id;
    try {
      await api.guardarMueble(id);
      escena.seleccionar(null);
      escena.moverMueble(id, { x: null });
      datos.muebles.find((m) => m.id === id).x = null;
      sel = null;
      escena.limpiarMarcas();
      pintarBarra();
      aviso('Guardado en «Mis cosas» 📦');
    } catch { aviso('No se pudo guardar. Revisa la conexión.'); }
  }

  async function vender() {
    const id = sel.id;
    const t = tipos.get(sel.tipo);
    const si = await confirmar_({ titulo: `¿Vender ${t.nombre.toLowerCase()}?`, texto: `Les devuelven ${Math.floor(t.precio / 2)} 🪙 (la mitad de lo que costó).`, no: 'No', si: 'Vender' });
    if (!si) return;
    try {
      const r = await api.vender(id);
      escena.seleccionar(null);
      escena.quitarMueble(id);
      datos.muebles = datos.muebles.filter((m) => m.id !== id);
      datos.monedas = r.monedas;
      pintarMonedas();
      sel = null;
      escena.limpiarMarcas();
      pintarBarra();
    } catch { aviso('No se pudo vender. Revisa la conexión.'); }
  }

  // ---- los botoncitos encima del mueble seleccionado
  function pintarFlotante() {
    if (!sel) { flotante.hidden = true; return; }
    const t = tipos.get(sel.tipo);
    const b = (ic, texto, alTocar, clase = '') => h('button', { type: 'button', class: `flotante-boton ${clase}`, onclick: alTocar, 'aria-label': texto, title: texto }, icono(ic), h('span', null, texto));
    const botones = [];
    if (t.cat !== 'pared') botones.push(b('girar', 'Girar', girar));
    if (sel.nuevo) botones.push(b('check', `Comprar 🪙${t.precio}`, confirmar, `principal ${sel.cabe ? '' : 'no'}`), b('cerrar', 'Quitar', cancelar));
    else if (sel.guardado) botones.push(b('check', 'Poner', confirmar, `principal ${sel.cabe ? '' : 'no'}`), b('cerrar', 'Quitar', cancelar));
    else {
      if (t.id === 'cuadro') botones.push(b('postal', 'Dibujo', () => elegirDibujo(sel.id)));
      botones.push(b('caja', 'Guardar', guardarEnCaja), b('moneda', 'Vender', vender), b('check', 'Listo', () => { if (!sel.cabe) cancelar(); else { escena.seleccionar(null); sel = null; escena.limpiarMarcas(); pintarBarra(); } }, 'principal'));
    }
    flotante.replaceChildren(...botones);
    flotante.hidden = false;
  }
  escena.alCuadro(() => {
    if (!sel || flotante.hidden) return;
    const p = escena.pantallaDe(sel.id);
    if (!p) return;
    const w = flotante.offsetWidth;
    const x = Math.max(6, Math.min(lugarEscena.clientWidth - w - 6, p.x - w / 2));
    const y = Math.max(6, p.y - flotante.offsetHeight - 14);
    flotante.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  });

  // ---- pintura, piso y segundo piso
  async function cambiarCuarto(t) {
    const tiene = datos.tiene.includes(t.id);
    if (t.cat === 'casa') {
      if (tiene) { escena.verPiso(1); pintarPisos(); return; }
      if (datos.monedas < t.precio) { aviso(`Les faltan ${t.precio - datos.monedas} 🪙 para el segundo piso. ¡A dibujar! ✏️`); return; }
      const si = await confirmar_({ titulo: '¿Comprar el segundo piso? 🏠', texto: `Cuesta ${t.precio} 🪙. Trae una escalera junto a la pared izquierda: si hay algo ahí, se guarda en «Mis cosas».`, no: 'Ahora no', si: '¡Comprarlo!' });
      if (!si) return;
      try {
        const r = await api.comprar(t.id);
        datos.monedas = r.monedas;
        datos.tiene.push(t.id);
        datos.pisos = 2;
        for (const id of r.guardados || []) { escena.moverMueble(id, { x: null }); datos.muebles.find((m) => m.id === id).x = null; }
        escena.ponerCuarto(datos.ajustes, 2);
        escena.verPiso(1);
        pintarPisos();
        pintarMonedas();
        pintarDecorar();
        chispas('🏠', monedas, 6);
        aviso('¡Ya tienen segundo piso! 🏠 Arriba hay espacio para decorar.', 3600);
      } catch { aviso('No se pudo comprar. Revisa la conexión.'); }
      return;
    }
    if (datos.ajustes[t.cat] === t.id) return;
    try {
      if (tiene) await api.cuarto(t.id);
      else {
        if (datos.monedas < t.precio) { aviso(`Les faltan ${t.precio - datos.monedas} 🪙.`); return; }
        const r = await api.comprar(t.id);
        datos.monedas = r.monedas;
        datos.tiene.push(t.id);
        pintarMonedas();
      }
      datos.ajustes[t.cat] = t.id;
      escena.ponerCuarto(datos.ajustes, datos.pisos);
      pintarDecorar();
    } catch { aviso('No se pudo cambiar. Revisa la conexión.'); }
  }

  // ================================================================ tocar la casa
  let toque = null; // { x, y, movio, arrastrando }
  escena.lienzo.addEventListener('pointerdown', (e) => {
    toque = { x: e.clientX, y: e.clientY, movio: false, arrastrando: false };
    if (modo !== 'decorar') return;
    const que = escena.queHay(e);
    if (sel && (sel.nuevo || sel.guardado || que.mueble === sel.id)) {
      toque.arrastrando = true;
    } else if (que.mueble != null && escena.mueble(que.mueble)) {
      if (sel) { if (!sel.cabe) cancelar(); else { escena.seleccionar(null); sel = null; } }
      seleccionar(que.mueble);
      toque.arrastrando = true;
    }
    if (toque.arrastrando) { try { escena.lienzo.setPointerCapture(e.pointerId); } catch { /* nada */ } }
  });
  escena.lienzo.addEventListener('pointermove', (e) => {
    if (!toque) return;
    if (!toque.movio && Math.hypot(e.clientX - toque.x, e.clientY - toque.y) > 8) toque.movio = true;
    if (modo === 'decorar' && toque.arrastrando && toque.movio && sel) {
      const que = escena.queHay(e, { soloPiso: true });
      moverA(que.casilla, que.pared);
    }
  });
  escena.lienzo.addEventListener('pointerup', async (e) => {
    const t = toque;
    toque = null;
    if (!t) return;
    if (modo === 'decorar') {
      if (t.arrastrando && t.movio) await guardarLugar();
      else if (!t.arrastrando && !t.movio && sel && !sel.nuevo && !sel.guardado) {
        // tocar el piso vacío suelta el mueble
        if (!sel.cabe) cancelar(); else { escena.seleccionar(null); sel = null; escena.limpiarMarcas(); pintarBarra(); }
      }
      return;
    }
    if (t.movio) return;
    const que = escena.queHay(e);
    if (que.personaje) {
      if (que.personaje === yo.id) {
        const a = datos.animo[yo.id] || {};
        escena.tocarPersonaje(yo.id, a.pospuso ? (a.pospuso === 'mal' ? '🤒' : '💼') : '😊');
      } else {
        // tocar a tu pareja: tu personaje va a darle un abrazo
        escena.irAbrazar(yo.id, pareja.id);
        escena.tocarPersonaje(pareja.id, '💛');
        const a = datos.animo[pareja.id] || {};
        aviso(a.pospuso ? `${pareja.nombre} ${a.pospuso === 'mal' ? 'no se siente bien hoy 🤒' : 'está ocupado hoy 💼'}. ¡Un abracito!` : `¡Abrazo para ${pareja.nombre}! 🤗`, 2200);
      }
      return;
    }
    // ☁️ Easter egg: si tocas al perrito nube, sale volando con sus orejas.
    if (que.mueble != null && escena.volarPerrito(que.mueble)) {
      aviso(['☁️ ¡Wiii! ¡Está volando con sus orejitas!', '☁️ Shh… es un perrito nube', '☁️ ¡Se fue a dar una vueltita por el cielo!'][Math.floor(Math.random() * 3)], 2400);
      chispas('☁️', lugarEscena, 6);
      return;
    }
    if (que.mueble != null && escena.mandarAUsar(yo.id, que.mueble)) return;
    if (que.casilla) escena.llamar(yo.id, que.casilla);
  });
  escena.lienzo.addEventListener('pointercancel', () => { toque = null; });

  // ================================================================ hojas
  function verAlcancia() {
    const g = datos.ganancias;
    hoja({
      titulo: `🪙 ${datos.monedas} monedas`,
      clase: 'hoja-alcancia',
      contenido: h('div', null,
        h('p', { class: 'hoja-texto' }, 'La alcancía es de los dos. Se llena así:'),
        h('ul', { class: 'ganancias' },
          h('li', null, `✏️ Cada dibujo: +${g.dibujo}`), h('li', null, `💛 Si dibujan los dos el mismo día: +${g.pareja}`),
          h('li', null, `🏆 Reto de la semana: +${g.reto}`), h('li', null, `🔥 Cada 7 días de racha: +${g.semana}`),
          h('li', null, `💭 Pregunta del día: +${g.pregunta}`), h('li', null, `💌 Una cartita al día: +${g.carta}`)),
        datos.movimientos.length > 0 && h('p', { class: 'subtitulo' }, 'Lo último'),
        h('ul', { class: 'movimientos' }, datos.movimientos.map((m) => {
          const compra = m.motivo.startsWith('compra:');
          const nombre = compra ? `🛍️ ${(tipos.get(m.motivo.slice(7)) || { nombre: 'Compra' }).nombre}` : MOTIVOS[m.motivo] || m.motivo;
          const quien = m.quien ? ` · ${m.quien === yo.id ? yo.nombre : pareja.nombre}` : '';
          return h('li', { class: m.cantidad < 0 ? 'gasto' : 'ganancia' }, h('span', null, `${nombre}${quien}`), h('strong', null, `${m.cantidad > 0 ? '+' : ''}${m.cantidad}`));
        }))),
      acciones: [{ texto: '¡A dibujar para ganar más!', clase: 'sol' }],
    });
  }

  // Elegir qué dibujo va en el cuadro (de este mes y el anterior).
  async function elegirDibujo(id) {
    const hoyDatos = await api.hoy().catch(() => null);
    if (!hoyDatos) return;
    const [a, m] = hoyDatos.fecha.split('-').map(Number);
    const meses = [`${a}-${String(m).padStart(2, '0')}`];
    if (m > 1) meses.push(`${a}-${String(m - 1).padStart(2, '0')}`);
    const dias = (await Promise.all(meses.map((x) => api.mes(x).catch(() => ({ dias: [] }))))).flatMap((r) => r.dias).reverse();
    const opciones = [];
    for (const d of dias) {
      if (d.yo) opciones.push({ fecha: d.fecha, quien: yo.id, mini: d.yo.mini, nombre: yo.nombre, tema: d.tema });
      if (d.pareja && d.pareja.visible) opciones.push({ fecha: d.fecha, quien: pareja.id, mini: d.pareja.mini, nombre: pareja.nombre, tema: d.tema });
    }
    let cerrar = () => {};
    ({ cerrar } = hoja({
      titulo: '¿Qué dibujo va en el cuadro?',
      clase: 'hoja-tienda',
      contenido: opciones.length
        ? h('div', { class: 'cuadro-rejilla' }, opciones.map((o) => h('button', {
          type: 'button', class: 'cuadro-opcion', 'aria-label': `${o.nombre}, ${fechaCorta(o.fecha)}: ${o.tema}`,
          onclick: async () => {
            try {
              await api.cuadro({ id, fecha: o.fecha, quien: o.quien });
              datos.muebles.find((x) => x.id === id).dibujo = `${o.fecha}/${o.quien}`;
              const img = await cargarImagen(urlDibujo(o.fecha, o.quien, 'casa'));
              escena.ponerFotoEn(id, img);
              cerrar();
            } catch { aviso('No se pudo poner ese dibujo.'); }
          },
        }, h('img', { src: o.mini, alt: '' }), h('span', null, `${o.nombre} · ${fechaCorta(o.fecha)}`))))
        : h('p', { class: 'vacio' }, 'Todavía no hay dibujos para colgar.'),
      acciones: [{ texto: 'Cerrar', clase: 'blanco' }],
    }));
  }

  pintarBarra();
  if (!datos.muebles.length) setTimeout(() => aviso(`¡Su casita está vacía! Tienen ${datos.monedas} 🪙: toquen «Decorar» 🛍️`, 4200), 1200);
  api.hoy().then((d) => ponerRacha(d.nivelRacha)).catch(() => {});

  return () => { escena.destruir(); };
}

// `confirmar` de ui.js (aquí "confirmar" es comprar lo que se está poniendo).
const confirmar_ = confirmar;

// ------------------------------------------------------------------ el editor del personaje
export async function modoPersonaje() {
  const { yo } = app.sesion;
  const datos = await api.casa();
  const guia = dibujarGuia();
  const actual = datos.avatares[yo.id] ? await cargarImagen(urlAvatar(yo.id, datos.avatares[yo.id])).catch(() => null) : null;
  return {
    chip: { texto: '🏠 Tu personaje', clase: 'reto', alTocar: () => aviso('Dibújate encima del monito gordito: cabeza, panza, bracitos y piernitas. ¡Así se va a mover en la casa!', 5200) },
    borrador: `personaje-${yo.id}`,
    lienzo: { ancho: ANCHO_P, alto: ALTO_P, papel: null, guia },
    textoTerminar: 'Guardar',
    alEntrar: 'Dibújate encima del monito: cada parte se mueve sola en la casa 🕺',
    volver: 'casa',
    radio: false,
    extras: [{
      texto: 'Cuerpo base', icono: 'cuerpo',
      async alTocar(lienzo) {
        const si = await confirmar({ titulo: '¿Poner el cuerpo de base?', texto: `Pone a tu ${yo.carita === 'mapache' ? 'mapache' : yo.carita === 'siames' ? 'gato siamés' : 'animalito'} en la capa de abajo, para que le dibujes ropita, peinado o lo que quieras encima.`, no: 'No', si: 'Ponerlo' });
        if (!si) return;
        lienzo.ponerImagen(await dibujarCuerpoBase(yo), 0);
        lienzo.elegirCapa(1);
        aviso('Listo: ahora estás en la capa de arriba ✏️');
      },
    }],
    async preparar(lienzo) {
      // Si ya tenía personaje (y no hay borrador), se empieza desde ese.
      if (actual && lienzo.estaVacio()) lienzo.cargarCapas([actual, null]);
    },
    async terminar(lienzo, ui) {
      ui.ocupado(true, 'Guardando…');
      try {
        await api.avatar(lienzo.exportarFinal({ ancho: 480, alto: 640 }));
        aviso('¡Tu personaje ya vive en la casa! 🏠', 3200);
        return true;
      } catch {
        aviso('No se pudo guardar. Revisa la conexión e inténtalo otra vez.', 4200);
        return false;
      }
    },
  };
}
