// "Nosotros": la pregunta del día (los dos responden y se ven al responder) y las
// cartitas "Ábrela cuando…" (quedan cerradas en su sobre hasta que la otra persona las
// necesite, o hasta el día elegido).

import { api } from './api.js';
import { h, aviso, hoja, confirmar, chispas } from './ui.js';
import { icono } from './iconos.js';
import { app, barraNav, caritaDe, fechaCorta, fechaLarga, sumarDias, monedasGanadas } from './comun.js';

// ------------------------------------------------------------------ pregunta del día
function burbujaRespuesta(cuenta, texto, { esperando = false } = {}) {
  return h('div', { class: `respuesta ${esperando ? 'esperando' : ''}` },
    caritaDe(cuenta, 'chica'),
    h('p', { class: 'respuesta-texto' }, h('strong', null, cuenta.nombre), texto || (esperando ? 'todavía no responde…' : '')));
}

function hojaResponder(pregunta, largo) {
  return new Promise((resolver) => {
    let enviado = null;
    const texto = h('textarea', { class: 'campo', rows: '4', maxlength: String(largo), placeholder: 'Tu respuesta…', 'aria-label': 'Tu respuesta' });
    const cuenta = h('span', { class: 'campo-cuenta' }, `0/${largo}`);
    texto.addEventListener('input', () => { cuenta.textContent = `${[...texto.value].length}/${largo}`; });
    const boton = h('button', {
      type: 'button', class: 'boton fresa',
      onclick: async () => {
        if (!texto.value.trim()) { aviso('Escribe algo 💭'); return; }
        boton.disabled = true;
        try {
          enviado = await api.responder(texto.value);
          cerrar();
        } catch (e) {
          boton.disabled = false;
          aviso(e.datos?.error === 'ya_respondiste' ? 'Ya habías respondido hoy.' : 'No se pudo guardar. Revisa la conexión.');
          if (e.datos?.error === 'ya_respondiste') cerrar();
        }
      },
    }, icono('enviar'), 'Responder');
    const { cerrar } = hoja({
      titulo: pregunta,
      clase: 'hoja-pregunta',
      contenido: h('div', null,
        h('p', { class: 'hoja-texto chiquito' }, `${app.sesion.pareja.nombre} verá tu respuesta cuando responda la suya (y tú la suya). Ya no se puede cambiar.`),
        texto, cuenta,
        h('div', { class: 'hoja-acciones' }, h('button', { type: 'button', class: 'boton blanco', onclick: () => cerrar() }, 'Ahora no'), boton)),
      alCerrar: () => resolver(enviado),
    });
    setTimeout(() => texto.focus(), 250);
  });
}

// La tarjeta de la pregunta (en Hoy y en Nosotros). Se repinta sola al responder.
export function tarjetaPregunta(datos, { alCambiar } = {}) {
  const el = h('section', { class: 'pregunta', 'aria-label': 'Pregunta del día' });
  let p = datos;
  function pintar() {
    const d = p.hoy;
    const { yo, pareja } = app.sesion;
    el.replaceChildren(
      h('p', { class: 'pregunta-intro' }, icono('pregunta'), 'Pregunta del día'),
      h('h2', { class: 'pregunta-texto' }, d.pregunta),
      d.mia
        ? h('div', { class: 'respuestas' }, burbujaRespuesta(yo, d.mia), burbujaRespuesta(pareja, d.suya, { esperando: !d.suya }))
        : h('div', { class: 'pregunta-pie' },
          d.parejaRespondio && h('p', { class: 'pregunta-nota' }, `${pareja.nombre} ya respondió 👀 Responde para ver qué dijo.`),
          h('button', {
            type: 'button', class: 'boton sol chico',
            onclick: async () => {
              const r = await hojaResponder(d.pregunta, p.largo || 280);
              if (!r) return;
              monedasGanadas(r.monedas);
              try { p = await api.pregunta(); } catch { /* se queda como estaba */ }
              pintar();
              if (alCambiar) alCambiar(p);
              chispas('💭', el, 6);
            },
          }, icono('pluma'), 'Responder')));
  }
  pintar();
  return el;
}

// ------------------------------------------------------------------ cartitas
function sobre(carta, { alAbrir }) {
  const cerrada = !carta.abierta;
  const conFecha = carta.cuando === 'fecha';
  const bloqueada = cerrada && conFecha && carta.fecha > carta.hoy;
  return h('button', {
    type: 'button', class: `sobre ${cerrada ? 'cerrado' : 'abierto'} ${bloqueada ? 'bloqueado' : ''}`, style: { '--sobre': carta.color },
    'aria-label': `Cartita de ${carta.deNombre}: ábrela cuando ${conFecha ? `llegue el ${fechaCorta(carta.fecha)}` : carta.cuandoTexto}`,
    onclick: () => alAbrir(carta),
  },
  h('span', { class: 'sobre-papel', 'aria-hidden': 'true' }),
  h('span', { class: 'sobre-solapa', 'aria-hidden': 'true' }),
  h('span', { class: 'sobre-sello', 'aria-hidden': 'true' }, bloqueada ? icono('candado') : cerrada ? '💌' : '💛'),
  h('span', { class: 'sobre-texto' }, h('em', null, 'Ábrela cuando…'), h('strong', null, conFecha ? `llegue el ${fechaCorta(carta.fecha)}` : `${carta.cuandoTexto} ${carta.emoji}`)));
}

function leerCarta(carta) {
  const de = carta.de === app.sesion.yo.id ? app.sesion.yo : app.sesion.pareja;
  hoja({
    titulo: carta.cuando === 'fecha' ? `Para el ${fechaCorta(carta.fecha)}` : `Para cuando ${carta.cuandoTexto}`,
    clase: 'hoja-carta',
    contenido: h('div', { class: 'carta-papel', style: { '--sobre': carta.color } },
      h('p', { class: 'carta-texto' }, carta.texto),
      h('p', { class: 'carta-firma' }, caritaDe(de, 'chica'), `Con cariño, ${de.nombre}`),
      h('p', { class: 'carta-fecha' }, `Escrita el ${fechaLarga(carta.creado.slice(0, 10))}${carta.abierta ? ` · abierta el ${fechaCorta(carta.abierta.slice(0, 10))}` : ''}`)),
    acciones: [{ texto: 'Guardarla en su sobre 💌', clase: 'sol' }],
  });
}

function hojaEscribir({ cuando, colores, largo, hoy }, alListo) {
  let elegido = null;
  let color = colores[0];
  const fecha = h('input', { type: 'date', class: 'campo', min: sumarDias(hoy, 1), value: sumarDias(hoy, 30), 'aria-label': 'El día en que se puede abrir' });
  const filaFecha = h('label', { class: 'campo-fecha', hidden: true }, 'Se abre el ', fecha);
  const texto = h('textarea', { class: 'campo', rows: '6', maxlength: String(largo), placeholder: `Querido/a ${app.sesion.pareja.nombre}…`, 'aria-label': 'La cartita' });
  const cuenta = h('span', { class: 'campo-cuenta' }, `0/${largo}`);
  texto.addEventListener('input', () => { cuenta.textContent = `${[...texto.value].length}/${largo}`; });
  const chipsCuando = h('div', { class: 'cuando-chips' }, cuando.map((c) => h('button', {
    type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-id': c.id,
    onclick: () => {
      elegido = c.id;
      for (const b of chipsCuando.children) b.setAttribute('aria-pressed', String(b.dataset.id === elegido));
      filaFecha.hidden = elegido !== 'fecha';
    },
  }, `${c.emoji} ${c.texto}`)));
  const chipsColor = h('div', { class: 'sobre-colores' }, colores.map((c) => h('button', {
    type: 'button', class: 'sobre-color', style: { '--sobre': c }, 'aria-label': 'Color del sobre', 'aria-pressed': String(c === color), 'data-color': c,
    onclick: () => { color = c; for (const b of chipsColor.children) b.setAttribute('aria-pressed', String(b.dataset.color === color)); },
  })));
  const boton = h('button', {
    type: 'button', class: 'boton fresa',
    onclick: async () => {
      if (!elegido) { aviso('Elige cuándo se puede abrir 💌'); return; }
      if (!texto.value.trim()) { aviso('Escríbele algo bonito ✏️'); return; }
      boton.disabled = true;
      try {
        const r = await api.escribirCarta({ cuando: elegido, fecha: elegido === 'fecha' ? fecha.value : undefined, texto: texto.value, color });
        cerrar();
        aviso(`¡Cartita enviada a ${app.sesion.pareja.nombre}! 💌`, 3200);
        monedasGanadas(r.monedas);
        alListo();
      } catch (e) {
        boton.disabled = false;
        aviso(e.datos?.error === 'fecha_invalida' ? 'Elige un día que todavía no haya pasado.' : 'No se pudo enviar. Revisa la conexión.');
      }
    },
  }, icono('enviar'), 'Enviar');
  const { cerrar } = hoja({
    titulo: `Una cartita para ${app.sesion.pareja.nombre}`,
    clase: 'hoja-escribir',
    contenido: h('div', null,
      h('p', { class: 'escribir-intro' }, 'Ábrela cuando…'),
      chipsCuando,
      filaFecha,
      texto, cuenta,
      h('p', { class: 'escribir-intro' }, 'Color del sobre'),
      chipsColor,
      h('div', { class: 'hoja-acciones' }, h('button', { type: 'button', class: 'boton blanco', onclick: () => cerrar() }, 'Cancelar'), boton)),
  });
}

// ------------------------------------------------------------------ la pantalla
export async function pantallaNosotros(cont, vigente) {
  let [pregunta, cartas] = await Promise.all([api.pregunta(), api.cartas()]);
  if (!vigente()) return undefined;
  const pantalla = h('main', { class: 'pantalla nosotros' });
  cont.append(pantalla, barraNav('nosotros'));
  const nombre = (id) => (id === app.sesion.yo.id ? app.sesion.yo : app.sesion.pareja).nombre;

  async function recargarCartas() {
    try { cartas = await api.cartas(); pintar(); } catch { /* nada */ }
  }

  async function abrir(carta) {
    if (carta.abierta) { leerCarta(carta); return; }
    if (carta.cuando === 'fecha' && carta.fecha > cartas.hoy) {
      aviso(`Esta se abre el ${fechaLarga(carta.fecha)} 🔒 ¡Paciencia!`, 3600);
      return;
    }
    if (carta.cuando !== 'fecha') {
      const si = await confirmar({ titulo: `¿Ahora ${carta.cuandoTexto}?`, texto: `${nombre(carta.de)} la escribió para ese momento. Ábrela solo si es cierto 💛`, no: 'Todavía no', si: 'Abrirla', claseSi: 'fresa' });
      if (!si) return;
    }
    try {
      const r = await api.abrirCarta(carta.id);
      leerCarta({ ...r.carta, hoy: cartas.hoy });
      recargarCartas();
    } catch (e) {
      aviso(e.datos?.error === 'todavia_no' ? 'Todavía no se puede abrir 🔒' : 'No se pudo abrir. Revisa la conexión.');
    }
  }

  function pintar() {
    const recibidas = cartas.recibidas.map((c) => ({ ...c, hoy: cartas.hoy, deNombre: nombre(c.de) }));
    const cerradas = recibidas.filter((c) => !c.abierta);
    const abiertas = recibidas.filter((c) => c.abierta);
    pantalla.replaceChildren(...[
      h('header', { class: 'cabecera' }, h('h1', { class: 'cabecera-grande' }, 'Nosotros'),
        h('span', { class: 'nosotros-caras' }, caritaDe(app.sesion.yo, 'chica'), icono('corazon', { relleno: true }), caritaDe(app.sesion.pareja, 'chica'))),
      tarjetaPregunta(pregunta, { alCambiar: (p) => { pregunta = p; } }),
      pregunta.anteriores.length > 0 && h('details', { class: 'pregunta-historial' },
        h('summary', null, `Preguntas anteriores (${pregunta.anteriores.length})`),
        pregunta.anteriores.map((d) => h('div', { class: 'pregunta-vieja' },
          h('p', { class: 'pregunta-vieja-fecha' }, fechaLarga(d.fecha)),
          h('p', { class: 'pregunta-vieja-texto' }, d.pregunta),
          h('div', { class: 'respuestas' },
            burbujaRespuesta(app.sesion.yo, d.mia || '—'),
            burbujaRespuesta(app.sesion.pareja, d.suya || '—'))))),

      h('section', { class: 'cartitas' },
        h('h2', { class: 'seccion-titulo' }, '💌 Cartitas «Ábrela cuando…»'),
        h('p', { class: 'seccion-texto' }, `Escríbele a ${app.sesion.pareja.nombre} una carta para un momento especial. Se queda cerradita hasta que la necesite.`),
        h('button', { type: 'button', class: 'boton fresa', onclick: () => hojaEscribir(cartas, recargarCartas) }, icono('sobre'), 'Escribir una cartita'),
        h('h3', { class: 'subtitulo' }, cerradas.length ? `Para ti (${cerradas.length} sin abrir)` : 'Para ti'),
        cerradas.length
          ? h('div', { class: 'sobres' }, cerradas.map((c) => sobre(c, { alAbrir: abrir })))
          : h('p', { class: 'vacio chico' }, recibidas.length ? 'Ya abriste todas 💛' : `Todavía no tienes cartitas de ${app.sesion.pareja.nombre}.`),
        abiertas.length > 0 && h('details', { class: 'cartas-abiertas' },
          h('summary', null, `Las que ya abriste (${abiertas.length})`),
          h('div', { class: 'sobres' }, abiertas.map((c) => sobre(c, { alAbrir: abrir })))),
        cartas.enviadas.length > 0 && h('details', { class: 'cartas-enviadas' },
          h('summary', null, `Las que escribiste (${cartas.enviadas.length})`),
          h('ul', { class: 'enviadas' }, cartas.enviadas.map((c) => h('li', { class: c.abierta ? 'abierta' : '' },
            h('span', { class: 'enviada-sello', style: { '--sobre': c.color } }, c.abierta ? '💛' : '💌'),
            h('span', { class: 'enviada-texto' },
              h('strong', null, `Ábrela cuando ${c.cuando === 'fecha' ? `llegue el ${fechaCorta(c.fecha)}` : c.cuandoTexto}`),
              h('span', null, c.abierta ? `${app.sesion.pareja.nombre} la abrió el ${fechaCorta(c.abierta.slice(0, 10))} 🥹` : 'Todavía cerradita')),
            h('button', { type: 'button', class: 'chip', onclick: () => leerCarta(c) }, 'Leer'))))))].filter(Boolean));
  }

  pintar();
  return undefined;
}
