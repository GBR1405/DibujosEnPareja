// El reto de la semana: la tarjeta de Hoy, su pantalla (#/reto) y el lienzo para
// dibujar la parte que te toca (#/reto/dibujar). Las reglas están en lib/reto-juego.js.

import { api, urlReto } from './api.js';
import { h, aviso, hoja, confirmar, lluviaDeCorazones } from './ui.js';
import { icono } from './iconos.js';
import { app, navegar, cabeceraConVolver, fechaCorta, diasEntre, caritaDe, abrirVisor, monedasGanadas } from './comun.js';
import { PALETAS, nombreDeColor } from './herramientas.js';
import { ANCHO, ALTO } from './lienzo.js';

const nombreDe = (id) => (app.sesion.yo.id === id ? app.sesion.yo : app.sesion.pareja).nombre;
const yoSoy = (id) => app.sesion.yo.id === id;

function quedanDias(reto, hoy) {
  const n = diasEntre(hoy, reto.hasta);
  return n <= 0 ? 'Hoy es el último día' : n === 1 ? 'Queda 1 día' : `Quedan ${n} días`;
}
const hoyLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Costa_Rica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

// Qué es cada imagen del reto (para el piecito).
function pieDe(reto, clave) {
  const a = nombreDe(reto.primero);
  const b = nombreDe(reto.segundo);
  return {
    mitad: { base: `La mitad de ${a}`, final: 'El dibujo de los dos' },
    garabato: { base: `El garabato de ${a}`, final: reto.extra.titulo ? `«${reto.extra.titulo}», de ${b}` : `Lo que hizo ${b}` },
    adivina: { dibujo: `El dibujo de ${a}` },
    colores: { uno: `El de ${nombreDe('uno')}`, dos: `El de ${nombreDe('dos')}` },
    memoria: { dibujo: `El original de ${a}`, copia: `De memoria, por ${b}` },
  }[reto.tipo]?.[clave] || '';
}

// Qué imágenes se muestran (en orden) cuando ya se ven.
function imagenesParaVer(reto) {
  const orden = { mitad: ['final', 'base'], garabato: ['final', 'base'], adivina: ['dibujo'], colores: ['uno', 'dos'], memoria: ['dibujo', 'copia'] }[reto.tipo] || [];
  // El dibujo para memorizar no se queda en la pantalla de quien lo tiene que memorizar.
  const escondido = (c) => reto.tipo === 'memoria' && c === 'dibujo' && !reto.soyPrimero && reto.fase !== 'listo';
  return orden.filter((c) => reto.imagenes[c] && !escondido(c));
}

// ------------------------------------------------------------------ la tarjeta de Hoy
export function tarjetaReto(reto) {
  const hoy = hoyLocal();
  const etiqueta = reto.fase === 'mi_turno' ? '¡Te toca!' : reto.fase === 'listo' ? '¡Listo!' : reto.fase === 'vencido' ? 'Se acabó' : 'Esperando';
  return h('a', { class: `reto-tarjeta fase-${reto.fase}`, href: '#/reto', 'aria-label': `Reto de la semana: ${reto.nombre}. ${reto.texto}` },
    h('span', { class: 'reto-tarjeta-emoji', 'aria-hidden': 'true' }, reto.emoji),
    h('span', { class: 'reto-tarjeta-texto' },
      h('span', { class: 'reto-tarjeta-intro' }, 'Reto de la semana', h('em', { class: 'reto-etiqueta' }, etiqueta)),
      h('strong', null, reto.nombre),
      h('span', null, reto.texto),
      reto.fase !== 'listo' && reto.fase !== 'vencido' && h('span', { class: 'reto-tarjeta-plazo' }, `${quedanDias(reto, hoy)} · premio ${reto.premio} 🪙`)),
    icono('volver'));
}

// Un textito que se pide en una hoja (devuelve el texto o null).
function pedirTexto({ titulo, texto, placeholder, max = 40, si = 'Listo', no = 'Saltar' }) {
  return new Promise((resolver) => {
    let valor = null;
    const entrada = h('input', { class: 'campo', type: 'text', maxlength: String(max), placeholder, enterkeyhint: 'done' });
    entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') { valor = entrada.value.trim() || null; cerrar(); } });
    const { cerrar } = hoja({
      titulo,
      contenido: h('div', null, texto && h('p', { class: 'hoja-texto' }, texto), entrada),
      acciones: [
        { texto: no, clase: 'blanco', onClick: () => { valor = null; } },
        { texto: si, clase: 'fresa', onClick: () => { valor = entrada.value.trim() || null; } },
      ],
      alCerrar: () => resolver(valor),
    });
    setTimeout(() => entrada.focus(), 250);
  });
}

// ------------------------------------------------------------------ la pantalla
export async function pantallaReto(cont, vigente) {
  let [{ reto }, historial] = await Promise.all([api.reto(), api.retos().catch(() => ({ retos: [] }))]);
  if (!vigente()) return undefined;
  const pantalla = h('main', { class: 'pantalla reto' });
  cont.append(pantalla);
  let ocupado = false;

  async function accion(nombre, cuerpo, { exito } = {}) {
    if (ocupado) return;
    ocupado = true;
    try {
      const r = await api.retoAccion(nombre, cuerpo);
      reto = r.reto;
      if (exito) aviso(exito, 3200);
      pintar();
    } catch (e) {
      const errores = {
        tema_invalido: 'El tema tiene que tener entre 3 y 80 letras.', colores_invalidos: 'Elige 3 colores distintos.',
        ya_hecho: 'Eso ya estaba hecho.', no_te_toca: 'Todavía no te toca.', intento_invalido: 'Escribe qué crees que es.',
      };
      aviso(errores[e.datos?.error] || 'No se pudo. Revisa la conexión e inténtalo otra vez.', 3600);
    } finally {
      ocupado = false;
    }
  }

  function figura(clave, { grande = false } = {}) {
    const src = urlReto(reto.semana, clave, reto.imagenes[clave]);
    const pie = pieDe(reto, clave);
    return h('button', { type: 'button', class: `reto-dibujo ${grande ? 'grande' : ''}`, onclick: () => abrirVisor({ src, nombre: pie, titulo: reto.nombre, archivo: `reto-${reto.semana}-${clave}` }) },
      h('img', { src, alt: pie, draggable: 'false' }),
      h('span', { class: 'reto-dibujo-pie' }, pie));
  }

  function zonaDeAccion() {
    const a = reto.accion;
    if (!a) return null;
    switch (a.tipo) {
      case 'dibujar':
        return h('div', { class: 'reto-accion' },
          a.secreto && h('p', { class: 'reto-secreto' }, 'Tu palabra secreta: ', h('strong', null, `«${a.secreto}»`), ' 🤫'),
          a.paleta && h('p', { class: 'reto-paleta' }, 'Tus colores: ', a.paleta.map((c) => h('span', { class: 'reto-color', style: { '--tono': c }, title: nombreDeColor(c) }))),
          h('a', { class: 'boton fresa grande', href: '#/reto/dibujar' }, icono('pluma'), a.clave === 'copia' ? 'Dibujarlo de memoria' : '¡A dibujar!'));
      case 'elegir_tema': {
        const entrada = h('input', { class: 'campo', type: 'text', maxlength: '80', placeholder: 'Por ejemplo: un dragón con lentes', 'aria-label': 'El tema de mañana' });
        return h('div', { class: 'reto-accion' },
          entrada,
          h('button', {
            type: 'button', class: 'boton fresa',
            onclick: async () => {
              const tema = entrada.value.trim();
              if ([...tema].length < 3) { aviso('Escribe un tema (3 letras o más).'); return; }
              const si = await confirmar({ titulo: `¿Mañana dibujan «${tema}»?`, texto: `${app.sesion.pareja.nombre} lo verá hasta mañana. Ya no se puede cambiar.`, no: 'Pensarlo', si: 'Elegir' });
              if (si) accion('tema', { tema }, { exito: '¡Listo! Mañana es sorpresa 🤫' });
            },
          }, '🎲 Elegir el tema de mañana'));
      }
      case 'elegir_palabra':
        return h('div', { class: 'reto-accion' },
          h('p', { class: 'reto-pista' }, 'Elige una (solo tú la ves):'),
          h('div', { class: 'reto-palabras' }, (reto.extra.opciones || []).map((p) => h('button', {
            type: 'button', class: 'chip grande',
            onclick: async () => {
              const si = await confirmar({ titulo: `¿Dibujar «${p}»?`, texto: 'Después ya no se puede cambiar.', no: 'Otra', si: '¡Esa!' });
              if (si) accion('palabra', { palabra: p });
            },
          }, p))));
      case 'adivinar': {
        const entrada = h('input', { class: 'campo', type: 'text', maxlength: '40', placeholder: '¿Qué es?', 'aria-label': 'Tu respuesta', enterkeyhint: 'send' });
        const enviar = () => {
          const intento = entrada.value.trim();
          if (!intento) return;
          accion('adivinar', { intento });
        };
        entrada.addEventListener('keydown', (e) => { if (e.key === 'Enter') enviar(); });
        return h('div', { class: 'reto-accion' },
          reto.imagenes.dibujo && figura('dibujo', { grande: true }),
          (reto.extra.intentos || []).length > 0 && h('p', { class: 'reto-intentos' }, 'Ya probaste: ', reto.extra.intentos.map((i) => h('span', { class: 'reto-intento' }, `✗ ${i}`))),
          h('div', { class: 'fila-campo' }, entrada, h('button', { type: 'button', class: 'boton fresa chico', onclick: enviar }, '¡Es esto!')),
          h('p', { class: 'reto-pista' }, `Te ${reto.extra.quedan === 1 ? 'queda 1 intento' : `quedan ${reto.extra.quedan} intentos`}.`));
      }
      case 'elegir_colores': {
        const elegidos = [];
        const boton = h('button', { type: 'button', class: 'boton fresa', disabled: true }, 'Regalarle estos 3');
        const muestras = h('div', { class: 'reto-elegidos', 'aria-live': 'polite' });
        const pintarElegidos = () => {
          muestras.replaceChildren(...[0, 1, 2].map((i) => h('span', { class: `reto-color grande ${elegidos[i] ? '' : 'vacio'}`, style: { '--tono': elegidos[i] || 'transparent' } })));
          boton.disabled = elegidos.length !== 3;
          for (const b of rejilla.querySelectorAll('.color')) b.classList.toggle('activa', elegidos.includes(b.dataset.color));
        };
        const rejilla = h('div', { class: 'reto-rejilla' }, PALETAS.flatMap((p) => p.colores).map(([nombre, hex]) => h('button', {
          type: 'button', class: 'color', 'data-color': hex, style: { '--tono': hex }, 'aria-label': nombre, title: nombre,
          onclick: () => {
            const i = elegidos.indexOf(hex);
            if (i >= 0) elegidos.splice(i, 1);
            else if (elegidos.length < 3) elegidos.push(hex);
            else aviso('Ya elegiste 3. Toca uno para quitarlo.');
            pintarElegidos();
          },
        }, h('span', { class: 'color-punto' }))));
        boton.addEventListener('click', () => accion('colores', { colores: elegidos }, { exito: `¡Le regalaste sus colores a ${app.sesion.pareja.nombre}! 🎨` }));
        pintarElegidos();
        return h('div', { class: 'reto-accion' }, h('p', { class: 'reto-pista' }, `Elige 3 colores para ${app.sesion.pareja.nombre}:`), muestras, rejilla, boton);
      }
      case 'mirar':
        return h('div', { class: 'reto-accion' },
          h('button', {
            type: 'button', class: 'boton fresa grande',
            onclick: async () => {
              const si = await confirmar({ titulo: '¿Listo para mirar?', texto: `Lo verás solo ${reto.extra.segundos} segundos, una vez. ¡Concéntrate! 🧠`, no: 'Todavía no', si: '¡Mirar!' });
              if (!si) return;
              await accion('mirar', {});
              if (reto.imagenes.dibujo) mirarUnRato();
            },
          }, `👀 Mirar ${reto.extra.segundos} segundos`));
      default:
        return null;
    }
  }

  // El dibujo a memorizar: en grande, con la cuenta regresiva. Después desaparece.
  function mirarUnRato() {
    let quedan = reto.extra.segundos;
    const cuenta = h('p', { class: 'memoria-cuenta' }, String(quedan));
    const capa = h('div', { class: 'visor memoria', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Memoriza el dibujo' },
      h('div', { class: 'visor-marco' }, h('img', { src: urlReto(reto.semana, 'dibujo', reto.imagenes.dibujo), alt: 'El dibujo para memorizar' })),
      cuenta);
    document.body.append(capa);
    const reloj = setInterval(() => {
      quedan -= 1;
      cuenta.textContent = String(Math.max(0, quedan));
      if (quedan <= 0) {
        clearInterval(reloj);
        capa.classList.add('se-va');
        setTimeout(() => { capa.remove(); aviso('¡Ahora dibújalo de memoria! ✏️', 3200); pintar(); }, 250);
      }
    }, 1000);
  }

  function pintar() {
    const hoy = hoyLocal();
    const ver = imagenesParaVer(reto);
    const listo = reto.fase === 'listo';
    const yaPuedeVer = reto.accion?.tipo !== 'adivinar';
    pantalla.replaceChildren(...[
      cabeceraConVolver('Reto de la semana', 'hoy'),
      h('section', { class: `reto-grande fase-${reto.fase}` },
        h('span', { class: 'reto-emoji', 'aria-hidden': 'true' }, reto.emoji),
        h('h2', { class: 'reto-nombre' }, reto.nombre),
        h('p', { class: 'reto-explica' }, reto.explica),
        h('div', { class: 'reto-turnos' },
          [reto.primero, reto.segundo].map((id, i) => {
            const cuenta = yoSoy(id) ? app.sesion.yo : app.sesion.pareja;
            return h('span', { class: 'reto-turno' }, caritaDe(cuenta, 'chica'), h('span', null, `${i + 1}. ${cuenta.nombre}`));
          })),
        h('p', { class: 'reto-estado' }, reto.texto),
        !listo && reto.fase !== 'vencido' && h('p', { class: 'reto-plazo' }, `Hasta el domingo ${fechaCorta(reto.hasta)} · ${quedanDias(reto, hoy)} · premio ${reto.premio} 🪙`),
        zonaDeAccion(),
        yaPuedeVer && ver.length > 0 && h('div', { class: `reto-dibujos ${ver.length > 1 ? 'dos' : ''}` }, ver.map((c, i) => figura(c, { grande: i === 0 && ver.length === 1 })))),
      historial.retos.length > 0 && h('section', { class: 'reto-historial' },
        h('h2', { class: 'seccion-titulo' }, 'Retos anteriores'),
        h('ul', { class: 'historial-lista' }, historial.retos.map((r) => {
          const claves = imagenesParaVer(r);
          return h('li', { class: `historial-item fase-${r.fase}` },
            h('span', { class: 'historial-emoji', 'aria-hidden': 'true' }, r.emoji),
            h('span', { class: 'historial-texto' }, h('strong', null, r.nombre), h('span', null, `Semana del ${fechaCorta(r.semana)} · ${r.fase === 'listo' ? '¡completado!' : 'sin terminar'}`)),
            h('span', { class: 'historial-minis' }, claves.slice(0, 2).map((c) => h('img', { src: `${urlReto(r.semana, c, r.imagenes[c])}&mini=1`, alt: pieDe(r, c), loading: 'lazy' }))));
        })))].filter(Boolean));

    // Al completarlo, una sola vez: corazones.
    const clave = `garabatos-reto-${reto.semana}-${app.sesion.yo.id}`;
    try {
      if (listo && !localStorage.getItem(clave)) {
        localStorage.setItem(clave, '1');
        setTimeout(() => { lluviaDeCorazones(26); aviso(`¡Reto completado! +${reto.premio} 🪙 para la casa`, 3800); }, 400);
      }
    } catch { /* sin almacenamiento */ }
  }

  pintar();
  // Si estoy esperando a mi pareja, reviso cada rato.
  const cada = setInterval(async () => {
    if (document.hidden || reto.fase !== 'esperando' || ocupado) return;
    try { const r = await api.reto(); if (vigente()) { const antes = reto.fase; reto = r.reto; if (reto.fase !== antes) pintar(); } } catch { /* nada */ }
  }, 15000);
  return () => clearInterval(cada);
}

// ------------------------------------------------------------------ el lienzo del reto
export async function modoReto() {
  const { reto } = await api.reto();
  const a = reto.accion;
  if (!a || a.tipo !== 'dibujar') { navegar('reto'); return null; }
  const zona = a.zona === 'izq' ? { x: 0, y: 0, w: ANCHO / 2, h: ALTO } : a.zona === 'der' ? { x: ANCHO / 2, y: 0, w: ANCHO / 2, h: ALTO } : null;
  const chip = {
    mitad: a.zona === 'izq' ? '✂️ Tu mitad: la izquierda' : '✂️ Completa la mitad derecha',
    garabato: a.clave === 'base' ? `🌀 Garabato: solo ${a.maxTrazos} trazos` : '🌀 ¿En qué conviertes el garabato?',
    adivina: `🔍 🤫 ${a.secreto}`,
    colores: `🎨 ${reto.consigna}`,
    memoria: a.clave === 'copia' ? '🧠 ¡De memoria!' : `🧠 ${reto.consigna}`,
  }[reto.tipo] || reto.nombre;
  const entrada = {
    mitad: a.zona === 'izq' ? 'Dibuja en la mitad izquierda; la otra es de tu pareja ✂️' : 'Tu pareja ya hizo su mitad: ¡complétala! ✂️',
    garabato: a.clave === 'base' ? `Haz un garabato con solo ${a.maxTrazos} trazos 🌀` : 'Convierte el garabato en algo 🌀',
    adivina: `Dibuja «${a.secreto}» sin escribir letras 🤫`,
    colores: 'Solo con los 3 colores que te regalaron 🎨',
    memoria: a.clave === 'copia' ? '¿Te acuerdas? ¡Dibújalo! 🧠' : `Dibuja «${reto.consigna}» para que lo memorice 🧠`,
  }[reto.tipo];
  return {
    chip: { texto: chip, clase: 'reto', alTocar: () => aviso(reto.explica, 5200) },
    borrador: `reto-${reto.semana}-${a.clave}-${app.sesion.yo.id}`,
    lienzo: { zona, fijo: a.fondo ? urlReto(reto.semana, a.fondo, reto.imagenes[a.fondo]) : null, maxTrazos: a.maxTrazos || null },
    limites: { paleta: a.paleta || null, sinBalde: Boolean(a.sinBalde), sinFormas: false },
    alEntrar: entrada,
    volver: 'reto',
    async terminar(lienzo, ui) {
      const si = await confirmar({ titulo: '¿Terminar tu parte del reto?', texto: 'Después ya no se puede cambiar.', no: 'Seguir dibujando', si: 'Terminar' });
      if (!si) return false;
      const titulo = a.pideTitulo ? await pedirTexto({ titulo: '¿Qué es? Ponle nombre', placeholder: 'Por ejemplo: un caracol astronauta', si: 'Ponerle nombre' }) : null;
      ui.ocupado(true);
      try {
        const r = await api.retoDibujo({ imagen: lienzo.exportarFinal(), ...(titulo ? { titulo } : {}) });
        if (r.reto.fase === 'listo') monedasGanadas(r.reto.premio);
        else aviso(`¡Listo! Ahora le toca a ${app.sesion.pareja.nombre}.`, 3200);
        return true;
      } catch (e) {
        if (e.estado === 409) { aviso('Esta parte ya estaba hecha.'); return true; }
        aviso('No se pudo guardar. Revisa la conexión e inténtalo otra vez.', 4200);
        return false;
      }
    },
  };
}
