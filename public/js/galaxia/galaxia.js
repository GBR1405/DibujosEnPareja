// La galaxia secreta (#/galaxia): el rincón de las estrellas de Eli.
//
// Se llega rompiendo la pantalla de Hoy (grieta.js). Es un cielo en 3D (cielo.js) con
// cinco planetas, cada uno abre algo:
//
//   📖 Nuestra historia     los recuerdos de los dos, con fotos (recuerdos.js)
//   🫙 Frasco de estrellitas  frases bonitas para cuando dude de su arte (frasco.js)
//   ✨ Constelaciones        unir estrellas, sin apuro (constelaciones.js)
//   🪐 Saltitos estelares    saltar de planeta en planeta (saltitos.js)
//   ⭐ Álbum de stickers     cada día cae una estrella dorada: si la atrapas, sticker (album.js)
//
// La primera vez, Estelita da la bienvenida. La música (public/galaxia/musica.mp3) suena
// mientras estés aquí.

import { api, urlRecuerdo } from '../api.js';
import { h, aviso, svg } from '../ui.js';
import { app, navegar, cargarImagen } from '../comun.js';
import { vieneDeRomper } from './grieta.js';
import * as sonido from './sonido.js';
import { bienvenida, dichos, INICIO } from './textos.js';
import { animacionDeInicio } from './inicio.js';
import { ponerRaiz, dialogo, burbujaEn, chispitas, elegir, esperar, granoDePelicula, azar } from './marco.js';

const PLANETAS = ['recuerdos', 'frasco', 'constelaciones', 'saltitos', 'album'];
const NOMBRES = {
  recuerdos: ['📖', 'Nuestra historia'],
  frasco: ['🫙', 'Frasco de estrellitas'],
  constelaciones: ['✨', 'Constelaciones'],
  saltitos: ['🪐', 'Saltitos estelares'],
  album: ['⭐', 'Álbum de stickers'],
};
const MODULOS = {
  recuerdos: () => import('./recuerdos.js'),
  frasco: () => import('./frasco.js'),
  constelaciones: () => import('./constelaciones.js'),
  saltitos: () => import('./saltitos.js'),
  album: () => import('./album.js'),
};

// Los estilos de la galaxia van aparte (no hace falta bajarlos para usar la app).
let estilos = null;
export function cargarEstilos() {
  if (!estilos) {
    estilos = new Promise((ok) => {
      const l = document.createElement('link');
      l.rel = 'stylesheet';
      l.href = '/galaxia.css';
      l.onload = ok;
      l.onerror = ok;
      document.head.append(l);
    });
  }
  return estilos;
}

const ICONO_SONIDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M15.5 8.8a4.6 4.6 0 0 1 0 6.4M18 6.4a8 8 0 0 1 0 11.2" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICONO_MUDO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" fill="currentColor"/><path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

export async function pantallaGalaxia(cont, vigente) {
  const [datos] = await Promise.all([api.galaxia(), cargarEstilos()]);
  if (!vigente()) return undefined;
  const { yo, pareja } = app.sesion;
  const duena = datos.duena === yo.id ? yo : pareja;
  const estado = {
    datos, yo, pareja, esSuya: datos.paraMi, duena,
    regala: duena.id === yo.id ? pareja : yo, // quien le hizo la galaxia (firma las frases de fábrica)
  };
  const rota = vieneDeRomper();
  document.body.classList.add('en-galaxia');

  // ---------------------------------------------------------------- lo de HTML
  const etiquetas = {};
  const cuentaAlbum = h('span', { class: 'gx-etiqueta-cuenta' });
  const capaEtiquetas = h('div', { class: 'gx-etiquetas' }, PLANETAS.map((id) => {
    const [emoji, nombre] = NOMBRES[id];
    const b = h('button', { type: 'button', class: `gx-etiqueta gx-etiqueta-${id}`, onclick: () => abrir(id) },
      h('span', { class: 'gx-etiqueta-emoji', 'aria-hidden': 'true' }, emoji), h('span', { class: 'gx-etiqueta-nombre' }, nombre),
      id === 'album' && cuentaAlbum);
    etiquetas[id] = b;
    return b;
  }));
  const botonSonido = h('button', { type: 'button', class: 'gx-redondo gx-sonido', onclick: () => alternarSonido() });
  const pintarSonido = () => {
    const mudo = sonido.estaSilenciado();
    botonSonido.replaceChildren(svg(mudo ? ICONO_MUDO : ICONO_SONIDO));
    botonSonido.setAttribute('aria-label', mudo ? 'Prender la música' : 'Silenciar la música');
    botonSonido.classList.toggle('mudo', mudo);
  };
  pintarSonido();
  const pie = h('p', { class: 'gx-pie', 'aria-live': 'polite' });
  const telon = h('div', { class: `gx-telon ${rota ? 'rapido' : ''}`, 'aria-hidden': 'true' });
  const escenaEl = h('div', { class: 'gx-escena' });
  const raizEl = h('main', { class: 'galaxia', 'aria-label': `El rincón de ${duena.nombre}` },
    escenaEl,
    h('div', { class: 'gx-vineta', 'aria-hidden': 'true' }),
    h('div', { class: 'gx-grano', 'aria-hidden': 'true', style: { backgroundImage: `url(${granoDePelicula()})` } }),
    capaEtiquetas,
    h('header', { class: 'gx-arriba' },
      h('button', { type: 'button', class: 'gx-redondo gx-volver', 'aria-label': 'Volver a Garabatos', onclick: () => salir() }, '‹'),
      h('h1', { class: 'gx-titulo' }, h('span', { class: 'gx-titulo-chico' }, 'el rincón de'), duena.nombre),
      botonSonido),
    pie,
    telon);
  cont.append(raizEl);
  ponerRaiz(raizEl);
  requestAnimationFrame(() => telon.classList.add('fuera'));

  // ---------------------------------------------------------------- sonido
  // (la música empieza cuando aparece la galaxia: la primera vez, después del mensaje)
  const quitarDesbloqueo = sonido.instalarDesbloqueo();
  function alternarSonido() {
    sonido.silenciar(!sonido.estaSilenciado());
    pintarSonido();
    if (!sonido.estaSilenciado()) sonido.campanita(7, { volumen: 0.15 });
  }

  // ---------------------------------------------------------------- el cielo
  let cielo = null;
  let ultimoDicho = '';
  try {
    const { crearCielo } = await import('./cielo.js');
    if (!vigente()) return undefined;
    cielo = crearCielo(escenaEl, {
      alTocarPlaneta: (id) => abrir(id),
      alAtrapar: atrapada,
      alTocarAmiguito: ({ x, y }) => {
        const lista = dichos(estado).filter((d) => d !== ultimoDicho);
        ultimoDicho = elegir(lista);
        burbujaEn(x, y, ultimoDicho);
        const base = Math.floor(azar(0, 5));
        sonido.arpegio([base, base + 2, base + 4], { separacion: 0.08, volumen: 0.16 });
      },
      alTocarRecuerdo: (id) => abrir('recuerdos', { ver: id }),
      alTocarVacio: ({ x, y }) => {
        chispitas(x, y, { cantidad: 7, lejos: 44, tam: 11 });
        sonido.campanita(Math.floor(azar(3, 11)), { volumen: 0.09, duracion: 2.2 });
      },
      alCuadro: moverEtiquetas,
    });
  } catch (e) {
    // Sin 3D (WebGL apagado o un teléfono muy viejito): los planetas quedan como lista.
    console.warn('galaxia sin 3D', e);
    raizEl.classList.add('sin-3d');
  }

  // Para probar en la computadora (?depurar): dónde va la estrella dorada.
  let doradaEn = null;
  if (new URLSearchParams(location.search).has('depurar')) window.galaxiaDepurar = { dorada: () => doradaEn };
  function moverEtiquetas({ etiquetas: pos, enfocado, dorada }) {
    doradaEn = dorada;
    for (const id of PLANETAS) {
      const p = pos[id];
      const b = etiquetas[id];
      if (!p) continue;
      const k = Math.min(1, p.escala);
      b.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) translate(-50%, 0) scale(${(0.6 + 0.4 * k).toFixed(3)})`;
      b.style.opacity = enfocado || !p.visible ? '0' : k.toFixed(2);
      b.style.pointerEvents = enfocado || k < 0.5 ? 'none' : '';
    }
  }

  function pintarCuenta() {
    cuentaAlbum.textContent = `${datos.stickers.length}/${datos.totalStickers}`;
  }
  pintarCuenta();

  // Las burbujas con fotos de los recuerdos (las 8 más recientes con foto).
  let fotosPuestas = '';
  async function ponerBurbujas() {
    if (!cielo) return;
    const conFoto = datos.recuerdos.filter((r) => r.foto).slice(-8);
    const clave = conFoto.map((r) => `${r.id}:${r.foto}`).join(',');
    if (clave === fotosPuestas) return;
    fotosPuestas = clave;
    const lista = (await Promise.all(conFoto.map(async (r) => {
      try { return { id: r.id, img: await cargarImagen(urlRecuerdo(r.id, r.foto, true)) }; } catch { return null; }
    }))).filter(Boolean);
    if (vigente() && cielo) cielo.ponerRecuerdos(lista);
  }

  // Lo que cambió adentro de un panel (un sticker nuevo, un recuerdo, una constelación).
  function alCambiar({ constelacion = null } = {}) {
    pintarCuenta();
    if (cielo) cielo.ponerConstelaciones(datos.datos.constelaciones || [], { nueva: constelacion });
    ponerBurbujas();
  }

  // ---------------------------------------------------------------- abrir un planeta
  let abierto = null;
  async function abrir(id, extra = {}) {
    // (no mientras pasa el mensaje de inicio o Estelita está hablando)
    if (abierto || !vigente() || raizEl.querySelector('.gx-inicio, .gx-dialogo')) return;
    abierto = id;
    sonido.pop({ alto: 1.2 });
    esconderPie();
    const desde = cielo ? cielo.pantallaDe(id) : { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let modulo;
    try {
      [modulo] = await Promise.all([MODULOS[id](), cielo ? cielo.enfocar(id) : null]);
    } catch (e) {
      console.error(e);
      aviso('No se pudo abrir 😿 Revisa tu conexión.');
      abierto = null;
      if (cielo) cielo.volver();
      return;
    }
    if (!vigente()) return;
    if (cielo) cielo.pausar(true);
    modulo.abrir({
      ...estado, desde, extra, alCambiar,
      alCerrar: () => {
        abierto = null;
        if (cielo) { cielo.pausar(false); cielo.volver(); }
      },
    });
  }

  // ---------------------------------------------------------------- la estrella del día
  async function atrapada({ x, y }) {
    chispitas(x, y, { cantidad: 18, lejos: 110, tam: 18, colores: ['#fff3c4', '#ffd36b', '#ffe9a8', '#ffc4ec', '#ffffff'] });
    sonido.arpegio([4, 5, 7, 9, 11], { separacion: 0.07, volumen: 0.22 });
    if (navigator.vibrate) navigator.vibrate([20, 40, 30]);
    esconderPie();
    let r;
    try {
      r = await api.atraparEstrella();
    } catch (e) {
      if (e.estado === 409) r = { sticker: e.datos.sticker, repetida: true };
      else { aviso('No se pudo guardar la estrella 😿 Revisa tu conexión y vuelve a intentarlo.'); if (cielo) cielo.lanzarDorada(6); return; }
    }
    datos.estrella = { atrapada: true, sticker: r.sticker };
    if (r.sticker > 0 && !datos.stickers.some((s) => s.n === r.sticker)) datos.stickers.push({ n: r.sticker, fecha: datos.hoy });
    if (!r.repetida) datos.estrellasAtrapadas += 1;
    pintarCuenta();
    await esperar(1350);
    if (!vigente()) return;
    abrir('album', { nuevo: r.sticker, completo: r.completo });
  }

  // ---------------------------------------------------------------- el pie
  let relojPie = null;
  function mostrarPie(texto, ms = 7000) {
    pie.textContent = texto;
    pie.classList.add('visible');
    clearTimeout(relojPie);
    relojPie = setTimeout(esconderPie, ms);
  }
  function esconderPie() { pie.classList.remove('visible'); clearTimeout(relojPie); }

  // ---------------------------------------------------------------- salir
  let saliendo = false;
  function salir() {
    if (saliendo) return;
    saliendo = true;
    sonido.fiu({ desde: 1200, hasta: 420, duracion: 0.6, volumen: 0.08 });
    sonido.pararMusica({ fundido: 0.8 });
    telon.classList.remove('fuera', 'rapido');
    telon.classList.add('saliendo');
    setTimeout(() => navegar('hoy'), 650);
  }

  // ---------------------------------------------------------------- arrancar
  alCambiar();
  const yaVino = Boolean(datos.datos.intro);
  (async () => {
    if (!yaVino) {
      // La primera vez: el mensaje en el cielo oscuro (mientras caen los pedazos de la
      // pantalla). Al terminar aparece la galaxia y empieza la música.
      if (cielo) cielo.pausar(true);
      await esperar(rota ? 1500 : 400);
      if (!vigente()) return;
      await animacionDeInicio(raizEl, {
        frases: INICIO.frases(estado),
        firma: INICIO.firma(estado),
        nota: estado.esSuya ? null : `(así lo va a ver ${duena.nombre} la primera vez)`,
      });
      if (!vigente()) return;
      // ya lo vio (aunque cierre la app mientras Estelita habla, no se repite)
      datos.datos.intro = true;
      api.datoGalaxia('intro', true).catch(() => {});
      if (cielo) cielo.pausar(false);
    }
    sonido.iniciarMusica({ fundido: yaVino ? 2.5 : 5 });
    if (cielo) await cielo.entrada({ rapida: yaVino && !rota });
    if (!vigente()) return;
    if (!yaVino) {
      await esperar(300);
      await dialogo(bienvenida(estado));
      if (!vigente()) return;
    }
    if (!datos.estrella.atrapada) {
      mostrarPie('🌠 Hoy va a caer una estrella dorada… ¡atrápala!', 9000);
      if (cielo) cielo.lanzarDorada(yaVino ? 2.5 : 1.5);
    } else {
      mostrarPie(datos.stickers.length >= datos.totalStickers ? '⭐ ¡Tu álbum está completo!' : '⭐ Ya atrapaste la estrella de hoy. Mañana cae otra.', 5000);
    }
  })();

  return () => {
    clearTimeout(relojPie);
    if (cielo) cielo.destruir();
    cielo = null;
    sonido.dormir({ fundido: 0.6 });
    quitarDesbloqueo();
    ponerRaiz(null);
    document.body.classList.remove('en-galaxia');
  };
}
