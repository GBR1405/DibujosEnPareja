// La radio para dibujar. Solo existe en la pantalla de dibujar: al salir de ahí (o al
// terminar el dibujo) se apaga sola.
//
// Las emisoras las da el servidor (/api/radio) y el audio llega directo de cada emisora.
// En este aparato se recuerdan el estilo, la emisora y el volumen, pero la música nunca
// arranca sola: siempre con un toque (así no suena de golpe en un lugar callado, y el
// iPhone tampoco lo permitiría).

import { api } from './api.js';
import { h } from './ui.js';
import { icono } from './iconos.js';

const CLAVE = 'garabatos-radio';
function recordado() {
  try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; }
}
function recordar(cambios) {
  try { localStorage.setItem(CLAVE, JSON.stringify({ ...recordado(), ...cambios })); } catch { /* sin almacenamiento */ }
}

// Un solo <audio> para toda la app: en el iPhone, cuando ya sonó una vez tras un toque,
// puede cambiar de emisora sin pedir otro toque.
let audio = null;
const elAudio = () => {
  if (!audio) { audio = new Audio(); audio.preload = 'none'; }
  return audio;
};

// En iPhone y iPad el volumen solo se cambia con los botones del aparato.
const volumenFunciona = (() => {
  try { const a = new Audio(); a.volume = 0.5; return a.volume === 0.5; } catch { return false; }
})();

// El catálogo se pide una vez por visita y se reusa.
let catalogo = null;
function pedirCatalogo() {
  if (!catalogo) catalogo = api.radio().then((r) => r.estilos).catch((e) => { catalogo = null; throw e; });
  return catalogo;
}

const ESPERA_MAXIMA = 12000; // si una emisora no arranca en este tiempo, se prueba otra

export function crearRadio() {
  const a = elAudio();
  let estilos = [];
  let estilo = null;
  let indice = 0;
  let estado = 'parada'; // 'parada' | 'cargando' | 'sonando' | 'error'
  let fallidas = 0;
  let reloj = null;
  let abierta = false;
  let vivo = true;
  let volumen = Number.isFinite(recordado().volumen) ? recordado().volumen : 0.7;

  // ---------------------------------------------------------------- piezas
  const boton = h('button', {
    type: 'button', class: 'radio-boton', 'aria-label': 'Radio para dibujar', 'aria-expanded': 'false', onclick: () => (abierta ? cerrar() : abrir()),
  }, icono('musica'), h('span', { class: 'radio-ondas', 'aria-hidden': 'true' }, h('i'), h('i'), h('i')));

  const chips = h('div', { class: 'radio-estilos', role: 'group', 'aria-label': 'Estilos de música' }, h('p', { class: 'radio-cargando' }, 'Buscando emisoras…'));
  const nombre = h('p', { class: 'radio-emisora' }, 'Elige un estilo');
  const detalle = h('p', { class: 'radio-detalle', 'aria-live': 'polite' }, 'Música para dibujar tranquilos');
  const play = h('button', { type: 'button', class: 'radio-play', 'aria-label': 'Escuchar', onclick: alternarSonido }, icono('play'));
  const otra = h('button', { type: 'button', class: 'radio-otra', 'aria-label': 'Otra emisora del mismo estilo', title: 'Otra emisora', onclick: siguiente }, icono('siguiente'));
  const barra = volumenFunciona && h('input', {
    type: 'range', class: 'radio-volumen', min: '0', max: '100', value: String(Math.round(volumen * 100)), 'aria-label': 'Volumen',
    oninput: (e) => { volumen = Number(e.target.value) / 100; a.volume = volumen; recordar({ volumen }); },
  });

  const panel = h('div', { class: 'radio', role: 'dialog', 'aria-label': 'Radio para dibujar' },
    h('p', { class: 'radio-titulo' }, icono('musica'), 'Radio para dibujar'),
    chips,
    h('div', { class: 'radio-reproductor' }, play, h('div', { class: 'radio-info' }, nombre, detalle), otra),
    barra && h('label', { class: 'radio-volumen-fila' }, icono('volumen'), barra),
    h('p', { class: 'radio-pie' }, 'Radios de internet en vivo · radio-browser.info'));
  panel.hidden = true;

  // ---------------------------------------------------------------- estado
  const actual = () => (estilo ? estilo.emisoras[indice % estilo.emisoras.length] : null);

  function pintar(mensaje) {
    const e = actual();
    boton.classList.toggle('sonando', estado === 'sonando');
    boton.classList.toggle('cargando', estado === 'cargando');
    const suena = estado === 'sonando' || estado === 'cargando';
    play.replaceChildren(icono(suena ? 'pausa' : 'play'));
    play.setAttribute('aria-label', suena ? 'Pausar' : 'Escuchar');
    otra.disabled = !estilo || estilo.emisoras.length < 2;
    nombre.textContent = e ? e.nombre : 'Elige un estilo';
    const cual = estilo ? `${estilo.emoji} ${estilo.nombre}${estilo.emisoras.length > 1 ? ` · ${(indice % estilo.emisoras.length) + 1} de ${estilo.emisoras.length}` : ''}` : '';
    detalle.textContent = mensaje || {
      parada: estilo ? `${cual} · en pausa` : 'Música para dibujar tranquilos',
      cargando: 'Sintonizando…',
      sonando: cual,
      error: 'No se pudo conectar.',
    }[estado];
    for (const c of chips.querySelectorAll('.radio-estilo')) {
      const elegido = Boolean(estilo) && c.dataset.id === estilo.id;
      c.classList.toggle('activa', elegido);
      c.setAttribute('aria-pressed', elegido);
    }
  }

  function apagarAudio() {
    clearTimeout(reloj);
    a.pause();
    a.removeAttribute('src');
    a.load(); // corta la descarga
  }

  // Tiene que llamarse dentro del toque (por el iPhone): nada de esperas antes del play().
  function sonar(mensaje) {
    const e = actual();
    if (!e || !vivo) return;
    clearTimeout(reloj);
    estado = 'cargando';
    pintar(mensaje);
    a.src = e.url;
    if (volumenFunciona) a.volume = volumen;
    const promesa = a.play();
    if (promesa) {
      promesa.catch((err) => {
        if (!vivo || err.name === 'AbortError') return;
        if (err.name === 'NotAllowedError') { estado = 'parada'; clearTimeout(reloj); pintar('Toca ▶ para escuchar'); } else fallo();
      });
    }
    reloj = setTimeout(() => { if (estado === 'cargando') fallo(); }, ESPERA_MAXIMA);
    recordar({ estilo: estilo.id, emisora: e.id });
    sesionDeMedios(e);
  }

  // La emisora no respondió: se prueba la siguiente del mismo estilo (todas, una vez).
  function fallo() {
    if (!vivo || !estilo) return;
    fallidas += 1;
    if (fallidas >= estilo.emisoras.length) {
      fallidas = 0;
      apagarAudio();
      estado = 'error';
      pintar('Ninguna emisora de este estilo respondió. Revisa tu internet o prueba otro estilo.');
      return;
    }
    indice = (indice + 1) % estilo.emisoras.length;
    sonar('Esa emisora no respondió; probando otra…');
  }

  function pausar() {
    apagarAudio();
    estado = 'parada';
    pintar();
  }

  function alternarSonido() {
    if (estado === 'sonando' || estado === 'cargando') { pausar(); return; }
    if (!estilo && estilos.length) estilo = estilos[0];
    fallidas = 0;
    sonar();
  }

  function siguiente() {
    if (!estilo) return;
    indice = (indice + 1) % estilo.emisoras.length;
    fallidas = 0;
    sonar();
  }

  function elegir(id) {
    const nuevo = estilos.find((e) => e.id === id);
    if (!nuevo) return;
    if (estilo && nuevo.id === estilo.id && (estado === 'sonando' || estado === 'cargando')) return;
    estilo = nuevo;
    const guardada = recordado().emisora;
    indice = Math.max(0, estilo.emisoras.findIndex((e) => e.id === guardada));
    fallidas = 0;
    sonar();
  }

  // Lo que se ve en la pantalla bloqueada y en los controles de música del teléfono.
  function sesionDeMedios(e) {
    if (!('mediaSession' in navigator)) return;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: e.nombre,
        artist: `Radio ${estilo.nombre}`,
        album: 'Garabatos',
        artwork: [{ src: '/icono-512.png', sizes: '512x512', type: 'image/png' }],
      });
      navigator.mediaSession.setActionHandler('play', () => sonar());
      navigator.mediaSession.setActionHandler('pause', pausar);
      navigator.mediaSession.setActionHandler('stop', pausar);
      navigator.mediaSession.setActionHandler('nexttrack', siguiente);
    } catch { /* no todos los navegadores la tienen completa */ }
  }

  // ---------------------------------------------------------------- eventos del audio
  const alSonar = () => { if (!vivo) return; clearTimeout(reloj); fallidas = 0; estado = 'sonando'; pintar(); };
  const alEsperar = () => { if (vivo && estado === 'sonando') { estado = 'cargando'; pintar('Se cortó un poquito; reconectando…'); } };
  const alError = () => { if (vivo && a.getAttribute('src') && (estado === 'cargando' || estado === 'sonando')) fallo(); };
  // El teléfono la pausó por su cuenta (una llamada, los controles de la pantalla bloqueada…).
  const alPausar = () => { if (vivo && estado === 'sonando') { clearTimeout(reloj); estado = 'parada'; pintar(); } };
  a.addEventListener('playing', alSonar);
  a.addEventListener('waiting', alEsperar);
  a.addEventListener('error', alError);
  a.addEventListener('pause', alPausar);

  // ---------------------------------------------------------------- abrir y cerrar
  const fuera = (e) => { if (!panel.contains(e.target) && !boton.contains(e.target)) cerrar(); };
  const escape = (e) => { if (e.key === 'Escape') cerrar(); };

  function abrir() {
    abierta = true;
    panel.hidden = false;
    boton.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', fuera, true);
    document.addEventListener('keydown', escape);
  }
  function cerrar() {
    abierta = false;
    panel.hidden = true;
    boton.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', fuera, true);
    document.removeEventListener('keydown', escape);
  }

  // ---------------------------------------------------------------- catálogo
  function cargar() {
    pedirCatalogo().then((lista) => {
      if (!vivo) return;
      estilos = lista;
      chips.replaceChildren(...estilos.map((e) => h('button', {
        type: 'button', class: 'radio-estilo', 'data-id': e.id, onclick: () => elegir(e.id),
      }, h('span', { class: 'radio-estilo-emoji', 'aria-hidden': 'true' }, e.emoji), e.nombre)));
      const r = recordado();
      estilo = estilos.find((e) => e.id === r.estilo) || null;
      if (estilo) indice = Math.max(0, estilo.emisoras.findIndex((e) => e.id === r.emisora));
      pintar();
    }).catch(() => {
      if (!vivo) return;
      chips.replaceChildren(
        h('p', { class: 'radio-cargando' }, 'No se pudo cargar la radio. Revisa tu internet.'),
        h('button', { type: 'button', class: 'chip', onclick: () => { chips.replaceChildren(h('p', { class: 'radio-cargando' }, 'Buscando emisoras…')); cargar(); } }, 'Reintentar'));
    });
  }
  cargar();
  pintar();

  return {
    boton,
    panel,
    // Al salir de la pantalla de dibujar: silencio y todo limpio.
    destruir() {
      vivo = false;
      cerrar();
      apagarAudio();
      a.removeEventListener('playing', alSonar);
      a.removeEventListener('waiting', alEsperar);
      a.removeEventListener('error', alError);
      a.removeEventListener('pause', alPausar);
      panel.remove();
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.metadata = null;
          ['play', 'pause', 'stop', 'nexttrack'].forEach((accion) => navigator.mediaSession.setActionHandler(accion, null));
        } catch { /* nada */ }
      }
    },
  };
}
