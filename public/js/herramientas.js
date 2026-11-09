// La barra de herramientas de la pantalla de dibujar.
//
//   ┌──────────────────────────────────────────────┐
//   │ ↶ ↷   ·────────●──────── (●)            ⚙   │  deshacer, rehacer, tamaño, ajustes
//   │ [Pincel▾] [Balde] [Formas▾] [Borrar] [Gotero] [Capas] │
//   │ Normales ••••·                                │
//   │ ‹ ● ● ● ● ● ●  ›                              │  colores (con flechitas)
//   │   ● ● ● ● ● ●                                 │
//   └──────────────────────────────────────────────┘
//
// Los paneles (pinceles, formas, capas y ajustes) aparecen sobre el lienzo, abajo.
// En pantalla ancha (iPad horizontal, compu) todo va en una columna a la izquierda.

import { h, aviso, confirmar } from './ui.js';
import { icono } from './iconos.js';
import { GROSOR, FACTOR_BORRADOR, PINCELES } from './lienzo.js';

// Cuatro grupos de 12 colores (y "Míos", los que eligen ustedes); con las flechas se pasa de uno a otro.
export const PALETAS = [
  {
    nombre: 'Normales',
    colores: [
      ['negro', '#2b2220'], ['gris', '#8c8794'], ['café', '#8a5a3c'], ['piel', '#ffd0b5'],
      ['rojo', '#e8424a'], ['naranja', '#ff8a3d'], ['amarillo', '#ffd23f'], ['verde', '#4cc26b'],
      ['turquesa', '#3fd0c9'], ['azul', '#3d8bff'], ['morado', '#8f5cff'], ['rosa', '#ff7fb0'],
    ],
  },
  {
    nombre: 'Suaves', // poco saturados: como de acuarela o de libro viejo
    colores: [
      ['gris pizarra', '#5b5866'], ['gris topo', '#a39a92'], ['arena', '#c9ad8b'], ['canela', '#b9805e'],
      ['terracota', '#b65c4f'], ['mostaza', '#c9a24a'], ['amarillo pálido', '#ecdca2'], ['verde oliva', '#8a9a5b'],
      ['verde salvia', '#9db89a'], ['azul grisáceo', '#7393ab'], ['malva', '#9d89ab'], ['rosa viejo', '#c98d98'],
    ],
  },
  {
    nombre: 'Vivos', // muy saturados
    colores: [
      ['rojo intenso', '#ff1a3c'], ['naranja fuego', '#ff6a00'], ['amarillo limón', '#ffe500'], ['verde lima', '#8cf000'],
      ['verde fuerte', '#00b14f'], ['verde azulado', '#00a99d'], ['cian', '#00cfff'], ['azul eléctrico', '#0050ff'],
      ['azul marino', '#1b2490'], ['violeta', '#8a00ff'], ['magenta', '#ff00c3'], ['carmesí', '#b0002d'],
    ],
  },
  {
    nombre: 'Pastel',
    colores: [
      ['rosa pastel', '#ffc2d6'], ['durazno', '#ffd1ad'], ['amarillo pastel', '#ffe88f'], ['pistacho', '#d6eda1'],
      ['menta', '#b5efcf'], ['aqua', '#a9ebe6'], ['celeste', '#bfe2ff'], ['azul bebé', '#a8c6ff'],
      ['lavanda', '#d5c5ff'], ['lila', '#ebb9f2'], ['coral pastel', '#ffb4a8'], ['gris perla', '#d4cfdd'],
    ],
  },
];
const TODOS = new Set(PALETAS.flatMap((p) => p.colores.map(([, hex]) => hex)));
export const nombreDeColor = (hex) => (PALETAS.flatMap((p) => p.colores).find(([, x]) => x === hex) || [hex])[0];

const FORMAS = [['linea', 'Línea'], ['flecha', 'Flecha'], ['circulo', 'Círculo'], ['cuadrado', 'Cuadrado'], ['rombo', 'Rombo'], ['triangulo', 'Triángulo'], ['corazon', 'Corazón'], ['estrella', 'Estrella']];

// ---- lo que se recuerda en cada aparato
const CLAVE_PINCEL = 'garabatos-pincel';
const CLAVE_MIOS = 'garabatos-mis-colores';
const HEX = /^#[0-9a-f]{6}$/;
function leerJSON(clave, otro) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? otro; } catch { return otro; }
}
function guardarJSON(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}
function misColores() {
  const lista = leerJSON(CLAVE_MIOS, []);
  return Array.isArray(lista) ? lista.filter((c) => HEX.test(c)).slice(0, 11) : [];
}
function pincelGuardado() {
  const p = leerJSON(CLAVE_PINCEL, {}) || {};
  const grosor = Number(p.grosor);
  const entre = (v, a, b, otro) => (Number.isFinite(Number(v)) && Number(v) >= a && Number(v) <= b ? Number(v) : otro);
  return {
    grupo: Number.isInteger(p.grupo) && p.grupo >= 0 && p.grupo <= PALETAS.length ? p.grupo : 0,
    color: TODOS.has(p.color) || misColores().includes(p.color) ? p.color : null,
    grosor: grosor >= GROSOR.min && grosor <= GROSOR.max ? grosor : GROSOR.inicial,
    pincel: PINCELES.some((x) => x.id === p.pincel) ? p.pincel : 'redondo',
    opacidad: entre(p.opacidad, 0.1, 1, 1),
    estabilizador: entre(p.estabilizador, 0, 10, 0),
  };
}

// La barra va de 0 a 100 pero el grosor crece en curva: así hay más control en los
// tamaños finos (de 2 a 12 en la primera mitad) y aun así se llega a uno bien grueso.
const RAZON = GROSOR.max / GROSOR.min;
const grosorDeBarra = (v) => Math.round(GROSOR.min * RAZON ** (v / 100) * 10) / 10;
const barraDeGrosor = (g) => Math.round((100 * Math.log(g / GROSOR.min)) / Math.log(RAZON));
const nombreDeGrosor = (v) => (v < 22 ? 'muy fino' : v < 42 ? 'fino' : v < 60 ? 'mediano' : v < 80 ? 'grueso' : 'muy grueso');
const nombreDeEstabilizador = (v) => (v === 0 ? 'apagado' : v <= 3 ? 'suave' : v <= 6 ? 'medio' : 'fuerte');

// `limites`: { paleta: [hex…] (solo esos colores), sinBalde, sinFormas, sinGotero }
export function crearDock({ lienzo, area, limites = {} }) {
  const e = lienzo.estado;
  const guardado = pincelGuardado();
  const paletaFija = Array.isArray(limites.paleta) && limites.paleta.length ? limites.paleta : null;
  e.grosor = guardado.grosor;
  e.pincel = guardado.pincel;
  e.opacidad = guardado.opacidad;
  e.estabilizador = guardado.estabilizador;
  e.color = paletaFija ? paletaFija[0] : guardado.color || e.color;
  let grupo = paletaFija ? 0 : guardado.grupo;
  let explicoBalde = false;
  let anterior = 'pluma'; // a dónde vuelve el gotero
  const recordar = () => {
    if (paletaFija) return; // con colores prestados (reto) no se toca lo guardado
    guardarJSON(CLAVE_PINCEL, { grupo, color: e.color, grosor: e.grosor, pincel: e.pincel, opacidad: e.opacidad, estabilizador: e.estabilizador });
  };

  // ---- botones de herramienta
  const botones = {};
  const boton = (clave, nombre, ic, alPulsar, clase = '') => {
    const b = h('button', { type: 'button', class: `herramienta ${clase}`, 'aria-label': nombre, title: nombre, onclick: alPulsar },
      icono(ic), h('span', { class: 'herramienta-nombre' }, nombre));
    botones[clave] = b;
    return b;
  };

  // ---- paneles flotantes
  let panel = null; // { el, de }
  function cerrarPanel() { if (panel) { panel.el.remove(); panel = null; } actualizar(); }
  function abrirPanel(de, contenido, etiqueta) {
    const mismo = panel && panel.de === de;
    if (panel) panel.el.remove();
    panel = null;
    if (mismo) { actualizar(); return; }
    const el = h('div', { class: `panel-flotante panel-${de}`, role: 'group', 'aria-label': etiqueta }, contenido());
    panel = { el, de, contenido };
    area.append(el);
    actualizar();
  }
  const repintarPanel = () => { if (panel) panel.el.replaceChildren(...[panel.contenido()].flat().filter(Boolean)); };

  const panelPinceles = () => h('div', { class: 'modos-rejilla' }, PINCELES.map((p) => h('button', {
    type: 'button', class: `modo ${p.id === e.pincel && e.herramienta === 'pluma' ? 'activa' : ''}`, 'aria-pressed': p.id === e.pincel,
    onclick: () => { e.pincel = p.id; e.herramienta = 'pluma'; recordar(); cerrarPanel(); },
  }, icono(p.id), h('span', { class: 'modo-nombre' }, p.nombre), h('span', { class: 'modo-ayuda' }, p.ayuda))));

  const panelFormas = () => [
    h('div', { class: 'formas-fila' }, FORMAS.map(([id, nombre]) => h('button', {
      type: 'button', class: `forma ${id === e.forma ? 'activa' : ''}`, 'aria-label': nombre, 'aria-pressed': id === e.forma, title: nombre,
      onclick: () => { e.forma = id; cerrarPanel(); },
    }, icono(id)))),
    h('div', { class: 'relleno-fila' },
      h('button', { type: 'button', class: `chip ${!e.relleno ? 'activa' : ''}`, onclick: () => { e.relleno = false; repintarPanel(); } }, 'Contorno'),
      h('button', { type: 'button', class: `chip ${e.relleno ? 'activa' : ''}`, onclick: () => { e.relleno = true; repintarPanel(); } }, 'Relleno')),
  ];

  function panelCapas() {
    const filas = [1, 0].map((i) => {
      const mini = h('canvas', { class: 'capa-mini', width: '45', height: Math.round((45 * lienzo.alto) / lienzo.ancho), 'aria-hidden': 'true' });
      lienzo.miniatura(i, mini);
      const visible = lienzo.capas[i].visible;
      const opacidad = h('input', {
        type: 'range', class: 'capa-opacidad', min: '5', max: '100', step: '5', value: String(Math.round(lienzo.capas[i].opacidad * 100)),
        'aria-label': `Transparencia de la capa ${i + 1}`,
        oninput: (ev) => { lienzo.ponerOpacidad(i, Number(ev.target.value) / 100); },
        onclick: (ev) => ev.stopPropagation(),
      });
      return h('div', {
        class: `capa-fila ${e.capa === i ? 'activa' : ''} ${visible ? '' : 'escondida'}`, role: 'button', tabindex: '0',
        'aria-pressed': e.capa === i, 'aria-label': `Dibujar en la capa ${i + 1}`,
        onclick: () => { lienzo.elegirCapa(i); repintarPanel(); actualizar(); },
        onkeydown: (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); lienzo.elegirCapa(i); repintarPanel(); actualizar(); } },
      },
      mini,
      h('span', { class: 'capa-texto' }, h('strong', null, `Capa ${i + 1}`), h('span', null, i === 1 ? 'arriba' : 'abajo'), opacidad),
      h('button', {
        type: 'button', class: 'capa-ojo', 'aria-label': visible ? `Esconder la capa ${i + 1}` : `Mostrar la capa ${i + 1}`, 'aria-pressed': !visible,
        onclick: (ev) => { ev.stopPropagation(); lienzo.ponerVisible(i, !visible); repintarPanel(); },
      }, icono(visible ? 'ojo' : 'ojo-no')));
    });
    return [
      h('p', { class: 'panel-titulo' }, icono('capas'), 'Capas'),
      h('div', { class: 'capas-lista' }, filas),
      h('div', { class: 'panel-botones' },
        h('button', {
          type: 'button', class: 'chip',
          onclick: async () => {
            if (!lienzo.tintaPorCapa()[1]) { aviso('La capa de arriba está vacía.'); return; }
            lienzo.juntarCapas();
            lienzo.elegirCapa(0);
            repintarPanel();
            aviso('Capas juntas en la de abajo (se puede deshacer).');
          },
        }, icono('juntar'), 'Juntar'),
        h('button', {
          type: 'button', class: 'chip',
          onclick: async () => {
            if (!lienzo.tintaPorCapa()[e.capa]) return;
            const si = await confirmar({ titulo: `¿Limpiar la capa ${e.capa + 1}?`, texto: 'Si te arrepientes, la flecha de deshacer la trae de vuelta.', no: 'Cancelar', si: 'Limpiar' });
            if (si) { lienzo.limpiar(e.capa); repintarPanel(); }
          },
        }, icono('basura'), 'Limpiar esta')),
      h('p', { class: 'panel-ayuda' }, 'Truco: haz las líneas en la capa de arriba y pinta en la de abajo: así el balde y el borrador no te arruinan las líneas.'),
    ];
  }

  function panelAjustes() {
    const textoOpacidad = h('span', { class: 'ajuste-valor' }, `${Math.round(e.opacidad * 100)} %`);
    const textoEstab = h('span', { class: 'ajuste-valor' }, nombreDeEstabilizador(e.estabilizador));
    return [
      h('label', { class: 'ajuste' }, h('span', { class: 'ajuste-nombre' }, 'Opacidad del pincel'), textoOpacidad,
        h('input', {
          type: 'range', class: 'ajuste-barra', min: '10', max: '100', step: '5', value: String(Math.round(e.opacidad * 100)),
          oninput: (ev) => { e.opacidad = Number(ev.target.value) / 100; textoOpacidad.textContent = `${ev.target.value} %`; actualizarPincel(); },
          onchange: recordar,
        })),
      h('label', { class: 'ajuste' }, h('span', { class: 'ajuste-nombre' }, 'Estabilizador'), textoEstab,
        h('input', {
          type: 'range', class: 'ajuste-barra', min: '0', max: '10', step: '1', value: String(e.estabilizador),
          oninput: (ev) => { e.estabilizador = Number(ev.target.value); textoEstab.textContent = nombreDeEstabilizador(e.estabilizador); },
          onchange: recordar,
        })),
      h('p', { class: 'panel-ayuda' }, 'El estabilizador suaviza el pulso: la línea sigue a tu dedo más despacito y sale más pareja.'),
      h('div', { class: 'panel-botones' },
        !limites.sinEspejo && h('button', {
          type: 'button', class: `chip ${e.espejo ? 'activa' : ''}`, 'aria-pressed': Boolean(e.espejo),
          onclick: () => { e.espejo = !e.espejo; repintarPanel(); actualizar(); if (e.espejo) aviso('Espejo: lo que dibujes sale reflejado ↔'); },
        }, icono('espejo'), 'Espejo'),
        h('button', {
          type: 'button', class: 'chip peligro',
          onclick: async () => {
            if (lienzo.estaVacio()) return;
            const si = await confirmar({ titulo: '¿Borrar todo el dibujo?', texto: 'Las dos capas quedan en blanco. Si te arrepientes, la flecha de deshacer lo trae de vuelta.', no: 'Cancelar', si: 'Borrar todo' });
            if (si) { lienzo.limpiar(); cerrarPanel(); }
          },
        }, icono('basura'), 'Borrar todo')),
    ];
  }

  function elegirHerramienta(nombre) {
    if (nombre === 'pluma' && e.herramienta === 'pluma') { abrirPanel('pinceles', panelPinceles, 'Pinceles'); return; }
    if (nombre === 'formas' && e.herramienta === 'formas') { abrirPanel('formas', panelFormas, 'Formas'); return; }
    if (nombre === 'gotero') anterior = e.herramienta === 'gotero' ? anterior : e.herramienta;
    e.herramienta = nombre;
    cerrarPanel();
    if (nombre === 'formas') abrirPanel('formas', panelFormas, 'Formas');
    if (nombre === 'balde' && !explicoBalde) { explicoBalde = true; aviso('Toca una zona para rellenarla 🪣'); }
    if (nombre === 'gotero') aviso('Toca el dibujo para copiar ese color 💧');
  }

  // El gotero encontró un color: se usa y se guarda en "Míos".
  function alGotero(hex) {
    if (paletaFija) return;
    agregarMio(hex);
    e.color = hex;
    e.herramienta = anterior === 'gotero' ? 'pluma' : anterior;
    if (e.herramienta === 'borrador') e.herramienta = 'pluma';
    grupo = PALETAS.length;
    pintarColores();
    actualizar();
    recordar();
  }

  // ---- colores
  const nombreGrupo = h('span', { class: 'paleta-nombre-texto' });
  const puntitos = h('span', { class: 'paleta-puntos', 'aria-hidden': 'true' }, [...PALETAS, null].map(() => h('i')));
  const coloresEl = h('div', { class: 'colores', role: 'group' });
  const selectorColor = h('input', { type: 'color', class: 'selector-color', 'aria-hidden': 'true', tabindex: '-1' });
  selectorColor.addEventListener('input', () => { e.color = selectorColor.value; if (e.herramienta === 'borrador' || e.herramienta === 'gotero') e.herramienta = 'pluma'; actualizar(); });
  selectorColor.addEventListener('change', () => { agregarMio(selectorColor.value); e.color = selectorColor.value; pintarColores(); actualizar(); recordar(); });

  function agregarMio(hex) {
    const lista = [hex, ...misColores().filter((c) => c !== hex)].slice(0, 11);
    guardarJSON(CLAVE_MIOS, lista);
  }

  function elegirColor(hex) {
    e.color = hex;
    if (e.herramienta === 'borrador' || e.herramienta === 'gotero') e.herramienta = 'pluma';
    actualizar();
    recordar();
  }

  const botonColor = (nombre, hex) => h('button', {
    type: 'button', class: 'color', 'data-color': hex, style: { '--tono': hex }, 'aria-label': nombre, title: nombre, onclick: () => elegirColor(hex),
  }, h('span', { class: 'color-punto' }));

  function pintarColores(paso = 0) {
    let lista;
    if (paletaFija) {
      nombreGrupo.textContent = 'Tus 3 colores';
      lista = paletaFija.map((hex) => botonColor(nombreDeColor(hex), hex));
    } else if (grupo === PALETAS.length) {
      nombreGrupo.textContent = 'Míos';
      lista = [
        h('button', { type: 'button', class: 'color color-nuevo', 'aria-label': 'Elegir otro color', title: 'Elegir otro color', onclick: () => { selectorColor.value = HEX.test(e.color) ? e.color : '#ff6f91'; selectorColor.click(); } },
          h('span', { class: 'color-punto' }, icono('mas'))),
        ...misColores().map((hex) => botonColor(`Mi color ${hex}`, hex)),
      ];
    } else {
      const paleta = PALETAS[grupo];
      nombreGrupo.textContent = paleta.nombre;
      lista = paleta.colores.map(([nombre, hex]) => botonColor(nombre, hex));
    }
    [...puntitos.children].forEach((p, i) => p.classList.toggle('activo', i === grupo));
    coloresEl.setAttribute('aria-label', `Colores: ${nombreGrupo.textContent.toLowerCase()}`);
    coloresEl.replaceChildren(...lista);
    if (paso) {
      coloresEl.classList.remove('desde-izq', 'desde-der');
      void coloresEl.offsetWidth;
      coloresEl.classList.add(paso > 0 ? 'desde-der' : 'desde-izq');
    }
  }

  function cambiarGrupo(paso) {
    const total = PALETAS.length + 1;
    grupo = (grupo + paso + total) % total;
    pintarColores(paso);
    actualizar();
    recordar();
  }
  const flecha = (paso, nombre) => h('button', {
    type: 'button', class: `paleta-flecha ${paso > 0 ? 'derecha' : ''}`, 'aria-label': nombre, title: nombre, onclick: () => cambiarGrupo(paso),
  }, icono('volver'));

  // ---- tamaño
  const barraPincel = h('input', {
    type: 'range', class: 'pincel-barra', min: '0', max: '100', step: '1', 'aria-label': 'Tamaño del pincel',
    oninput: (ev) => { e.grosor = grosorDeBarra(Number(ev.target.value)); actualizarPincel(); },
    onchange: recordar,
  });
  const puntoPincel = h('span', { class: 'pincel-punto' });
  const filaPincel = h('div', { class: 'pincel' },
    h('span', { class: 'pincel-chico', 'aria-hidden': 'true' }),
    barraPincel,
    h('span', { class: 'pincel-muestra', 'aria-hidden': 'true' }, puntoPincel));

  // La bolita muestra el tamaño real del trazo en la pantalla, en su color y transparencia.
  function actualizarPincel() {
    filaPincel.classList.toggle('apagada', e.herramienta === 'balde' || e.herramienta === 'gotero');
    const borrar = e.herramienta === 'borrador';
    const valor = barraDeGrosor(e.grosor);
    if (Number(barraPincel.value) !== valor) barraPincel.value = String(valor);
    barraPincel.style.setProperty('--lleno', `${valor}%`);
    barraPincel.setAttribute('aria-valuetext', nombreDeGrosor(valor));
    const factor = borrar ? FACTOR_BORRADOR : e.pincel === 'lapiz' ? 0.55 : e.pincel === 'marcador' ? 1.6 : 1;
    const enPantalla = e.grosor * factor * (lienzo.escala() || 0.3);
    const diametro = `${Math.max(3, Math.min(40, enPantalla))}px`;
    puntoPincel.style.width = diametro;
    puntoPincel.style.height = diametro;
    puntoPincel.style.background = borrar ? '' : e.color;
    puntoPincel.style.opacity = borrar ? '1' : String(Math.max(0.15, e.opacidad * (e.pincel === 'marcador' ? 0.5 : 1)));
    puntoPincel.classList.toggle('borrador', borrar);
  }

  function actualizar() {
    const activo = { pluma: e.herramienta === 'pluma', balde: e.herramienta === 'balde', formas: e.herramienta === 'formas', borrador: e.herramienta === 'borrador', gotero: e.herramienta === 'gotero' };
    for (const [t, si] of Object.entries(activo)) {
      if (!botones[t]) continue;
      botones[t].classList.toggle('activa', si);
      botones[t].setAttribute('aria-pressed', si);
    }
    const pincel = PINCELES.find((p) => p.id === e.pincel) || PINCELES[0];
    botones.pluma.replaceChildren(icono(pincel.id), h('span', { class: 'herramienta-nombre' }, pincel.nombre), h('span', { class: 'herramienta-mas', 'aria-hidden': 'true' }));
    botones.pluma.setAttribute('aria-label', `${pincel.nombre} (toca otra vez para cambiar de pincel)`);
    if (botones.formas) botones.formas.replaceChildren(icono(e.forma), h('span', { class: 'herramienta-nombre' }, 'Formas'), h('span', { class: 'herramienta-mas', 'aria-hidden': 'true' }));
    botones.capas.dataset.capa = String(e.capa + 1);
    botones.capas.classList.toggle('activa', panel?.de === 'capas');
    botones.ajustes.classList.toggle('activa', panel?.de === 'ajustes');
    botones.ajustes.classList.toggle('con-espejo', Boolean(e.espejo));
    for (const el of coloresEl.querySelectorAll('.color[data-color]')) {
      const si = el.dataset.color === e.color;
      el.classList.toggle('activa', si);
      el.setAttribute('aria-pressed', si);
    }
    actualizarPincel();
  }

  pintarColores();

  const el = h('div', { class: 'dock' },
    h('div', { class: 'dock-arriba' },
      boton('deshacer', 'Deshacer', 'deshacer', () => lienzo.deshacer(), 'accion'),
      boton('rehacer', 'Rehacer', 'rehacer', () => lienzo.rehacer(), 'accion'),
      filaPincel,
      boton('ajustes', 'Ajustes del pincel', 'ajustes', () => abrirPanel('ajustes', panelAjustes, 'Ajustes'), 'accion')),
    h('div', { class: 'herramientas' },
      boton('pluma', 'Pincel', 'redondo', () => elegirHerramienta('pluma')),
      !limites.sinBalde && boton('balde', 'Balde', 'balde', () => elegirHerramienta('balde')),
      !limites.sinFormas && boton('formas', 'Formas', 'corazon', () => elegirHerramienta('formas')),
      boton('borrador', 'Borrador', 'borrador', () => elegirHerramienta('borrador')),
      !paletaFija && !limites.sinGotero && boton('gotero', 'Gotero', 'gotero', () => elegirHerramienta('gotero')),
      boton('capas', 'Capas', 'capas', () => abrirPanel('capas', panelCapas, 'Capas'), 'capas')),
    h('div', { class: `paleta ${paletaFija ? 'fija' : ''}` },
      h('p', { class: 'paleta-nombre', 'aria-live': 'polite' }, nombreGrupo, !paletaFija && puntitos),
      h('div', { class: 'paleta-fila' },
        !paletaFija && flecha(-1, 'Colores anteriores'), coloresEl, !paletaFija && flecha(1, 'Más colores'))),
    selectorColor);

  botones.deshacer.disabled = true;
  botones.rehacer.disabled = true;
  actualizar();
  window.addEventListener('resize', actualizarPincel);

  return {
    el,
    actualizar,
    alGotero,
    cerrarPanel,
    // Lo llama el lienzo cuando cambia algo.
    alCambiar({ puedeDeshacer, puedeRehacer }) {
      botones.deshacer.disabled = !puedeDeshacer;
      botones.rehacer.disabled = !puedeRehacer;
      if (panel && panel.de === 'capas') repintarPanel();
    },
    destruir() {
      window.removeEventListener('resize', actualizarPincel);
      if (panel) panel.el.remove();
    },
  };
}
