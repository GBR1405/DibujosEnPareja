// La casa (#/casa): su cuartito en 2.5D, la alcancía 🪙, la tienda, decorar y el editor
// del personaje (#/casa/personaje). La escena 3D está en escena.js.

import { api, urlAvatar, urlDibujo } from '../api.js';
import { h, aviso, hoja, confirmar, chispas } from '../ui.js';
import { icono } from '../iconos.js';
import { app, barraNav, cargarImagen, fechaCorta, navegar } from '../comun.js';
import { ponerRacha } from '../racha.js';
import { crearEscena } from './escena.js';
import { dibujarGuia, dibujarCuerpoBase, ANCHO as ANCHO_P, ALTO as ALTO_P } from './plantilla.js';

const CATEGORIAS = [['muebles', 'Muebles', '🛋️'], ['deco', 'Decoración', '🪴'], ['pared', 'Paredes', '🖼️'], ['cuarto', 'Pintura y piso', '🎨']];
const MOTIVOS = { dibujo: '✏️ Dibujo', pareja: '💛 Dibujaron los dos', reto: '🏆 Reto de la semana', pregunta: '💭 Pregunta del día', carta: '💌 Cartita', racha: '🔥 Racha', venta: '🪙 Venta', prueba: '🧪' };

// La imagen del personaje de cada quien: la que dibujó, o la de fábrica.
async function imagenDePersonaje(cuenta, v) {
  if (v) {
    try { return await cargarImagen(urlAvatar(cuenta.id, v)); } catch { /* la de fábrica */ }
  }
  return dibujarCuerpoBase(cuenta);
}

export async function pantallaCasa(cont, vigente) {
  let datos = await api.casa();
  if (!vigente()) return undefined;
  const { yo, pareja } = app.sesion;
  const tipos = new Map(datos.catalogo.map((m) => [m.id, m]));

  const monedas = h('button', { type: 'button', class: 'monedas-chip grande', onclick: () => verAlcancia() });
  const lugarEscena = h('div', { class: 'casa-escena', 'aria-label': 'La casa. Toca el piso para que tu personaje camine hasta allá.' });
  const barra = h('div', { class: 'casa-barra' });
  const ayuda = h('p', { class: 'casa-ayuda', 'aria-live': 'polite' });
  const pantalla = h('main', { class: 'pantalla casa' },
    h('header', { class: 'casa-cabecera' }, h('h1', { class: 'cabecera-grande' }, 'Nuestra casa'), monedas),
    lugarEscena, ayuda, barra);
  cont.append(pantalla, barraNav('casa'));

  const escena = crearEscena(lugarEscena, { lado: datos.lado, catalogo: datos.catalogo });
  escena.ponerCuarto(datos.ajustes);

  // ---- los muebles (los cuadros con su dibujo)
  async function fotoDeCuadro(m) {
    if (!m.dibujo) return null;
    const [fecha, quien] = m.dibujo.split('/');
    try { return await cargarImagen(urlDibujo(fecha, quien, 'casa')); } catch { return null; }
  }
  function ponerTodos() {
    for (const m of datos.muebles) {
      escena.ponerMueble(m);
      if (m.tipo === 'cuadro' && m.dibujo && m.x != null) fotoDeCuadro(m).then((img) => { if (img) escena.ponerFotoEn(m.id, img); });
    }
  }
  ponerTodos();

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

  // ================================================================ modos
  let modo = 'ver'; // 'ver' | 'decorar'
  let sel = null;   // { id, nuevo, original }

  function pintarBarra() {
    const b = (texto, ic, alTocar, clase = 'blanco') => h('button', { type: 'button', class: `boton chico ${clase}`, onclick: alTocar }, icono(ic), texto);
    if (modo === 'ver') {
      ayuda.textContent = 'Toca el piso y tu personaje camina hasta allá. Tócalos para saludarlos 💛';
      barra.replaceChildren(
        b('Tienda', 'tienda', () => abrirTienda(), 'sol'),
        b('Decorar', 'mover', () => entrarDecorar()),
        b('Mi personaje', 'personaje', () => navegar('casa/personaje')));
      return;
    }
    if (sel) {
      const t = tipos.get(escena.mueble(sel.id).dato.tipo);
      ayuda.textContent = t.cat === 'pared' ? `${t.nombre}: toca una pared para moverlo.` : `${t.nombre}: toca el piso para moverlo.`;
      barra.replaceChildren(...[
        t.cat !== 'pared' && b('Girar', 'girar', girar),
        t.id === 'cuadro' && b('Dibujo', 'postal', () => elegirDibujo(sel.id)),
        b('Guardar', 'caja', guardarSel),
        b('Vender', 'moneda', venderSel),
        b('Listo', 'check', confirmarSel, 'fresa')].filter(Boolean));
      return;
    }
    const guardados = datos.muebles.filter((m) => m.x == null).length;
    ayuda.textContent = 'Toca un mueble para moverlo, girarlo o guardarlo.';
    barra.replaceChildren(
      b(`Mis cosas${guardados ? ` (${guardados})` : ''}`, 'caja', abrirInventario),
      b('Tienda', 'tienda', () => abrirTienda(), 'sol'),
      b('Pintura y piso', 'balde', () => abrirTienda('cuarto')),
      b('Listo', 'check', salirDecorar, 'fresa'));
  }

  function entrarDecorar() { modo = 'decorar'; escena.verRejilla(true); pintarBarra(); }
  function salirDecorar() { if (sel) cancelarSel(); modo = 'ver'; escena.verRejilla(false); escena.limpiarMarcas(); pintarBarra(); }

  // ---- mover un mueble (el que está seleccionado)
  function revisar() {
    const e = escena.mueble(sel.id);
    const t = tipos.get(e.dato.tipo);
    if (t.cat === 'pared') { escena.limpiarMarcas(); return true; }
    const celdas = escena.casillasDe(e.dato);
    const ocupadas = new Set();
    for (const m of datos.muebles) {
      if (m.id === sel.id || m.x == null) continue;
      const o = tipos.get(m.tipo);
      if (o.cat === 'pared' || Boolean(o.plano) !== Boolean(t.plano)) continue;
      for (const [x, z] of escena.casillasDe(escena.mueble(m.id).dato)) ocupadas.add(`${x},${z}`);
    }
    const ok = celdas.every(([x, z]) => x < datos.lado && z < datos.lado && !ocupadas.has(`${x},${z}`));
    escena.marcar(celdas, ok);
    return ok;
  }

  function seleccionarMueble(id, { nuevo = false } = {}) {
    if (sel && sel.id !== id) cancelarSel();
    const e = escena.mueble(id);
    sel = { id, nuevo, original: { ...e.dato } };
    escena.seleccionar(id);
    revisar();
    pintarBarra();
  }

  function moverA(casilla, pared) {
    const e = escena.mueble(sel.id);
    const t = tipos.get(e.dato.tipo);
    if (t.cat === 'pared') {
      if (!pared) return;
      const x = Math.max(0, Math.min(datos.lado - t.w, Math.round(pared.pos - t.w / 2)));
      escena.moverMueble(sel.id, { x, pared: pared.pared, z: 0, rot: 0 });
    } else {
      if (!casilla) return;
      const girado = e.dato.rot % 2 === 1;
      const we = girado ? t.d : t.w;
      const de = girado ? t.w : t.d;
      const x = Math.max(0, Math.min(datos.lado - we, casilla[0] - Math.floor((we - 1) / 2)));
      const z = Math.max(0, Math.min(datos.lado - de, casilla[1] - Math.floor((de - 1) / 2)));
      escena.moverMueble(sel.id, { x, z });
    }
    revisar();
  }

  function girar() {
    const e = escena.mueble(sel.id);
    const t = tipos.get(e.dato.tipo);
    const rot = (e.dato.rot + 1) % 4;
    const girado = rot % 2 === 1;
    const we = girado ? t.d : t.w;
    const de = girado ? t.w : t.d;
    escena.moverMueble(sel.id, { rot, x: Math.min(e.dato.x, datos.lado - we), z: Math.min(e.dato.z, datos.lado - de) });
    revisar();
  }

  function cancelarSel() {
    if (!sel) return;
    const { id, original, nuevo } = sel;
    escena.seleccionar(null);
    escena.moverMueble(id, nuevo ? { x: null } : original);
    sel = null;
    escena.limpiarMarcas();
  }

  async function confirmarSel() {
    if (!revisar()) { aviso('Ahí no cabe: se encima con otro mueble 😅'); return; }
    const { dato } = escena.mueble(sel.id);
    try {
      await api.poner({ id: dato.id, x: dato.x, z: dato.z, rot: dato.rot, pared: dato.pared });
      Object.assign(datos.muebles.find((m) => m.id === dato.id), { x: dato.x, z: dato.z, rot: dato.rot, pared: dato.pared });
      escena.seleccionar(null);
      sel = null;
      escena.limpiarMarcas();
      pintarBarra();
      chispas('✨', barra, 5);
    } catch (e) {
      aviso(e.datos?.error === 'lugar_ocupado' ? 'Ahí ya hay algo (quizá lo acaba de poner tu pareja). Prueba en otro lugar.' : 'No se pudo guardar. Revisa la conexión.');
    }
  }

  async function guardarSel() {
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

  async function venderSel() {
    const id = sel.id;
    const t = tipos.get(escena.mueble(id).dato.tipo);
    const si = await confirmar({ titulo: `¿Vender ${t.nombre.toLowerCase()}?`, texto: `Les devuelven ${Math.floor(t.precio / 2)} 🪙 (la mitad de lo que costó).`, no: 'No', si: 'Vender' });
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

  // Poner algo que estaba guardado: aparece en el primer lugar libre y queda seleccionado.
  function ponerDesdeCaja(id) {
    if (modo !== 'decorar') entrarDecorar();
    const m = datos.muebles.find((x) => x.id === id);
    const t = tipos.get(m.tipo);
    let lugar;
    if (t.cat === 'pared') {
      lugar = null;
      for (const pared of ['der', 'izq']) {
        for (let x = 0; x <= datos.lado - t.w && !lugar; x += 1) {
          const usado = datos.muebles.some((o) => o.id !== id && o.x != null && o.pared === pared && tipos.get(o.tipo).cat === 'pared' && x < o.x + tipos.get(o.tipo).w && o.x < x + t.w);
          if (!usado) lugar = { x, pared, z: 0, rot: 0 };
        }
        if (lugar) break;
      }
      lugar = lugar || { x: 0, pared: 'der', z: 0, rot: 0 };
    } else {
      lugar = { x: Math.floor((datos.lado - t.w) / 2), z: Math.floor((datos.lado - t.d) / 2), rot: 0 };
      outer: for (let z = 2; z <= datos.lado - t.d; z += 1) {
        for (let x = 1; x <= datos.lado - t.w; x += 1) {
          escena.moverMueble(id, { x, z, rot: 0 });
          sel = { id, nuevo: true, original: { ...m } };
          if (revisar()) { lugar = { x, z, rot: 0 }; break outer; }
        }
      }
    }
    escena.moverMueble(id, lugar);
    seleccionarMueble(id, { nuevo: true });
  }

  // ---- tocar la casa
  let tocando = null;
  escena.lienzo.addEventListener('pointerdown', (e) => { tocando = { x: e.clientX, y: e.clientY }; });
  escena.lienzo.addEventListener('pointerup', (e) => {
    if (!tocando || Math.hypot(e.clientX - tocando.x, e.clientY - tocando.y) > 12) { tocando = null; return; }
    tocando = null;
    const que = escena.queHay(e);
    if (modo === 'ver') {
      if (que.personaje) {
        const es = que.personaje === yo.id ? yo : pareja;
        const a = datos.animo[es.id] || {};
        escena.tocarPersonaje(es.id, a.pospuso ? (a.pospuso === 'mal' ? '🤒' : '💼') : es.id === yo.id ? '😊' : '💛');
        aviso(es.id === yo.id ? `¡Hola, ${yo.nombre}!` : `${pareja.nombre}${a.pospuso ? (a.pospuso === 'mal' ? ' no se siente bien hoy 🤒' : ' está ocupado hoy 💼') : a.dibujo ? ' ya dibujó hoy 🎨' : ' te saluda 💛'}`, 2200);
        return;
      }
      // ☁️ Easter egg: si tocas al perrito nube, sale volando con sus orejas.
      if (que.mueble != null && escena.volarPerrito(que.mueble)) {
        aviso(['☁️ ¡Wiii! ¡Está volando con sus orejitas!', '☁️ Shh… es un perrito nube', '☁️ ¡Se fue a dar una vueltita por el cielo!'][Math.floor(Math.random() * 3)], 2400);
        chispas('☁️', lugarEscena, 6);
        return;
      }
      // Si tocaste un mueble, tu personaje va a usarlo (a sentarse, a mirar la tele…).
      if (que.mueble != null && escena.mandarAUsar(yo.id, que.mueble)) return;
      if (que.casilla) escena.llamar(yo.id, que.casilla);
      return;
    }
    // decorando
    if (sel) {
      if (que.mueble != null && que.mueble !== sel.id && !(tipos.get(escena.mueble(que.mueble).dato.tipo).plano)) { seleccionarMueble(que.mueble); return; }
      moverA(que.casilla, que.pared);
      return;
    }
    if (que.mueble != null) seleccionarMueble(que.mueble);
  });

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

  async function comprar(t, cerrarHoja) {
    if (datos.monedas < t.precio) { aviso(`Les faltan ${t.precio - datos.monedas} 🪙. ¡A dibujar! ✏️`); return; }
    const si = await confirmar({ titulo: `¿Comprar ${t.nombre.toLowerCase()}?`, texto: `Cuesta ${t.precio} 🪙 de la alcancía de los dos (les quedan ${datos.monedas - t.precio}).`, no: 'Ahora no', si: 'Comprar' });
    if (!si) return;
    try {
      const r = await api.comprar(t.id);
      datos.monedas = r.monedas;
      pintarMonedas();
      chispas('🪙', monedas, 6);
      if (t.cat === 'pintura' || t.cat === 'piso') {
        datos.tiene.push(t.id);
        datos.ajustes[t.cat] = t.id;
        escena.ponerCuarto(datos.ajustes);
        aviso('¡Quedó precioso! ✨');
        if (cerrarHoja) cerrarHoja();
        return;
      }
      const nuevo = { id: r.id, tipo: t.id, x: null, z: null, rot: 0, pared: null, dibujo: null, quien: yo.id };
      datos.muebles.push(nuevo);
      escena.ponerMueble(nuevo);
      if (cerrarHoja) cerrarHoja();
      ponerDesdeCaja(r.id);
      aviso('¡Comprado! Tócalo en el piso donde lo quieras y luego «Listo».', 3800);
    } catch (e) {
      if (e.datos?.error === 'sin_monedas') { datos.monedas = e.datos.monedas; pintarMonedas(); aviso('No les alcanza 😿'); } else aviso('No se pudo comprar. Revisa la conexión.');
    }
  }

  function abrirTienda(categoria = 'muebles') {
    let cat = categoria;
    const cuerpo = h('div', { class: 'tienda' });
    let cerrar = () => {};
    function pintar() {
      const lista = cat === 'cuarto' ? datos.catalogo.filter((m) => m.cat === 'pintura' || m.cat === 'piso') : datos.catalogo.filter((m) => m.cat === cat);
      cuerpo.replaceChildren(
        h('div', { class: 'tienda-pestanas', role: 'tablist' }, CATEGORIAS.map(([id, nombre, emoji]) => h('button', {
          type: 'button', role: 'tab', class: `chip ${id === cat ? 'activa' : ''}`, 'aria-selected': id === cat, onclick: () => { cat = id; pintar(); },
        }, `${emoji} ${nombre}`))),
        h('div', { class: 'tienda-rejilla' }, lista.map((t) => {
          const delCuarto = t.cat === 'pintura' || t.cat === 'piso';
          const lo = delCuarto && datos.tiene.includes(t.id);
          const puesto = delCuarto && datos.ajustes[t.cat] === t.id;
          const cuantos = datos.muebles.filter((m) => m.tipo === t.id).length;
          const foto = delCuarto
            ? h('span', { class: 'tienda-muestra', style: { '--tono': t.color } }, t.emoji)
            : h('img', { class: 'tienda-foto', src: escena.foto(t.id), alt: '', draggable: 'false' });
          return h('button', {
            type: 'button', class: `tienda-item ${puesto ? 'puesto' : ''} ${!lo && datos.monedas < t.precio ? 'caro' : ''}`,
            onclick: async () => {
              if (lo) {
                if (puesto) return;
                try { await api.cuarto(t.id); datos.ajustes[t.cat] = t.id; escena.ponerCuarto(datos.ajustes); pintar(); } catch { aviso('No se pudo cambiar.'); }
                return;
              }
              await comprar(t, delCuarto ? null : cerrar);
              if (delCuarto) pintar();
            },
          }, foto,
          h('span', { class: 'tienda-nombre' }, t.nombre),
          h('span', { class: 'tienda-precio' }, puesto ? '✓ Puesto' : lo ? 'Ponerlo' : t.precio === 0 ? 'Gratis' : `🪙 ${t.precio}`),
          cuantos > 0 && h('span', { class: 'tienda-tienen' }, `Tienen ${cuantos}`));
        })));
    }
    pintar();
    ({ cerrar } = hoja({ titulo: `Tienda · 🪙 ${datos.monedas}`, clase: 'hoja-tienda', contenido: cuerpo, acciones: [{ texto: 'Cerrar', clase: 'blanco' }] }));
  }

  function abrirInventario() {
    const guardados = datos.muebles.filter((m) => m.x == null);
    let cerrar = () => {};
    ({ cerrar } = hoja({
      titulo: 'Mis cosas 📦',
      clase: 'hoja-tienda',
      contenido: guardados.length
        ? h('div', { class: 'tienda-rejilla' }, guardados.map((m) => {
          const t = tipos.get(m.tipo);
          return h('button', { type: 'button', class: 'tienda-item', onclick: () => { cerrar(); ponerDesdeCaja(m.id); } },
            h('img', { class: 'tienda-foto', src: escena.foto(t.id), alt: '', draggable: 'false' }),
            h('span', { class: 'tienda-nombre' }, t.nombre),
            h('span', { class: 'tienda-precio' }, 'Ponerlo'));
        }))
        : h('p', { class: 'vacio' }, 'No hay nada guardado. Lo que compren o guarden aparece aquí.'),
      acciones: [{ texto: 'Cerrar', clase: 'blanco' }],
    }));
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
  // Si no tienen nada todavía, una ayudita.
  if (!datos.muebles.length) setTimeout(() => aviso(`¡Su casita está vacía! Tienen ${datos.monedas} 🪙: entren a la tienda 🛍️`, 4200), 1200);

  // Si cambia la racha mientras tanto, que el fondo siga.
  api.hoy().then((d) => ponerRacha(d.nivelRacha)).catch(() => {});

  return () => { escena.destruir(); };
}

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
