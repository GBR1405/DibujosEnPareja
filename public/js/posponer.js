// Posponer el dibujo de hoy: "Estoy ocupado" o "Me siento mal", qué tanto (del 1 al 10,
// con caritas) y por qué. Las reglas están en lib/racha.js; aquí solo se explican.

import { api } from './api.js';
import { h, aviso, hoja } from './ui.js';
import { icono, caraDelNivel } from './iconos.js';
import { app, caritaDe, fechaLarga, fechaCorta } from './comun.js';

const REGLAS = [
  'Tu racha se congela: hoy no suma, pero tampoco se rompe.',
  'Mañana te tocan dos: el de hoy y el de mañana.',
  'Si no haces el pospuesto, la racha vuelve a 0 (el día pospuesto no se recupera con comodín).',
  'No se puede posponer dos días seguidos: uno sí, otro no.',
];

const POR_QUE_NO = {
  ya_dibujaste: 'Ya hiciste el dibujo de hoy 💛',
  ya_pospusiste: 'Ya pospusiste el de hoy.',
  ayer_pospusiste: 'Ayer ya pospusiste, así que hoy no se puede (uno sí, otro no). ¡Tú puedes! ✏️',
};

export function explicarPorQueNo(porque) {
  aviso(POR_QUE_NO[porque] || 'Hoy no se puede posponer.', 4200);
}

// La hoja para posponer. `alListo()` se llama cuando se guardó.
export function hojaPosponer({ motivos, largoTexto, alListo }) {
  const pareja = app.sesion.pareja;
  let motivo = null;
  let nivel = 5;
  let enviando = false;

  const cara = h('span', { class: 'posponer-cara', 'aria-hidden': 'true' }, caraDelNivel('ocupado', nivel));
  const numero = h('span', { class: 'posponer-numero' }, `${nivel}/10`);
  const barra = h('input', {
    type: 'range', class: 'posponer-barra', min: '1', max: '10', step: '1', value: String(nivel), 'aria-label': '¿Qué tanto? Del 1 al 10',
    oninput: (e) => { nivel = Number(e.target.value); pintar(); },
  });
  const texto = h('textarea', {
    class: 'posponer-texto', rows: '3', maxlength: String(largoTexto), placeholder: `Cuéntale a ${pareja.nombre} por qué…`,
    'aria-label': 'Por qué', oninput: () => pintar(),
  });
  const cuenta = h('span', { class: 'posponer-cuenta' });
  const opciones = motivos.map((m) => h('button', {
    type: 'button', class: 'posponer-motivo', 'aria-pressed': 'false', 'data-motivo': m.id,
    onclick: () => { motivo = m.id; pintar(); },
  }, h('span', { class: 'posponer-motivo-emoji', 'aria-hidden': 'true' }, m.emoji), h('span', null, m.nombre)));
  const botonSi = h('button', { type: 'button', class: 'boton fresa', onclick: enviar }, 'Posponer');
  const error = h('p', { class: 'posponer-error', role: 'status' });

  function pintar() {
    for (const b of opciones) b.setAttribute('aria-pressed', String(b.dataset.motivo === motivo));
    cara.textContent = caraDelNivel(motivo || 'ocupado', nivel);
    numero.textContent = `${nivel}/10`;
    barra.style.setProperty('--lleno', `${((nivel - 1) / 9) * 100}%`);
    const largo = [...texto.value.trim()].length;
    cuenta.textContent = `${largo}/${largoTexto}`;
    botonSi.disabled = !motivo || largo === 0 || enviando;
  }

  const { cerrar } = hoja({
    titulo: '¿Hoy no puedes dibujar?',
    clase: 'hoja-posponer',
    contenido: h('div', { class: 'posponer' },
      h('div', { class: 'posponer-motivos' }, opciones),
      h('p', { class: 'posponer-pregunta' }, '¿Qué tanto?'),
      h('div', { class: 'posponer-nivel' }, cara, barra, numero),
      h('label', { class: 'posponer-label' }, h('span', null, '¿Por qué?'), cuenta),
      texto,
      h('ul', { class: 'posponer-reglas' }, REGLAS.map((r) => h('li', null, r))),
      error,
      h('div', { class: 'hoja-acciones' },
        h('button', { type: 'button', class: 'boton blanco', onclick: () => cerrar() }, 'Mejor no'),
        botonSi)),
  });
  pintar();

  async function enviar() {
    if (enviando || botonSi.disabled) return;
    enviando = true;
    pintar();
    try {
      await api.posponer({ motivo, nivel, texto: texto.value });
      cerrar();
      aviso(`Pospuesto. Mañana te esperan dos dibujos ✏️✏️`, 3600);
      if (alListo) alListo();
    } catch (e) {
      error.textContent = POR_QUE_NO[e.datos?.error] || 'No se pudo posponer. Revisa la conexión.';
    } finally {
      enviando = false;
      pintar();
    }
  }
}

const NOMBRE_MOTIVO = { ocupado: 'Está ocupado', mal: 'Se siente mal' };
const EMOJI_MOTIVO = { ocupado: '💼', mal: '🤒' };

// La tarjeta que muestra un día pospuesto: la carita desanimada, el motivo y por qué.
// `quien`: la cuenta; `p`: { motivo, nivel, texto }; `mia`: si la pospuse yo.
export function tarjetaPospuesto({ cuenta, p, mia, alAnimar, extra }) {
  return h('section', { class: `pospuesto ${mia ? 'mio' : 'suyo'}`, 'aria-label': mia ? 'Pospusiste el dibujo de hoy' : `${cuenta.nombre} pospuso el dibujo de hoy` },
    h('div', { class: 'pospuesto-cara' }, caritaDe(cuenta, '', 'desanimado'), h('span', { class: 'pospuesto-emoji', 'aria-hidden': 'true' }, EMOJI_MOTIVO[p.motivo] || '⏸')),
    h('div', { class: 'pospuesto-texto' },
      h('p', { class: 'pospuesto-titulo' }, mia ? 'Pospusiste el de hoy' : `${cuenta.nombre} pospuso el de hoy`),
      h('p', { class: 'pospuesto-motivo' },
        mia ? (p.motivo === 'mal' ? 'Te sientes mal' : 'Estás ocupado') : NOMBRE_MOTIVO[p.motivo] || 'Pospuso',
        ' · ', h('span', { class: 'pospuesto-nivel' }, caraDelNivel(p.motivo, p.nivel), ` ${p.nivel}/10`)),
      h('p', { class: 'pospuesto-porque' }, `«${p.texto}»`),
      extra,
      alAnimar && h('button', { type: 'button', class: 'boton blanco chico', onclick: alAnimar }, '💛 Mandarle ánimos')));
}

// "Te falta el de ayer": el pospuesto que hay que hacer hoy (o se rompe la racha).
export function tarjetaPendiente(p, hoy) {
  const ultimoDia = p.hasta === hoy;
  return h('a', { class: 'pendiente', href: `#/dibujar/${p.fecha}` },
    h('span', { class: 'pendiente-icono', 'aria-hidden': 'true' }, '⏰'),
    h('span', { class: 'pendiente-texto' },
      h('strong', null, `Te falta el que pospusiste (${fechaLarga(p.fecha)})`),
      h('span', null, `Tema: ${p.tema}. ${ultimoDia ? 'Hoy es el último día' : `Tienes hasta el ${fechaCorta(p.hasta)}`}, o la racha vuelve a 0.`)),
    h('span', { class: 'pendiente-ir' }, icono('pluma'), 'Dibujarlo'));
}

export async function mandarAnimos() {
  try {
    await api.animos();
    aviso(`Le mandaste ánimos a ${app.sesion.pareja.nombre} 💛`);
  } catch (e) {
    aviso(e.datos?.error === 'ya_mandaste' ? 'Ya le mandaste ánimos hoy 💛' : 'No se pudo mandar. Revisa la conexión.');
  }
}
