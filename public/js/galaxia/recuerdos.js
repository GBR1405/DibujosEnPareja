// Nuestra historia: los recuerdos de los dos, como un cuento. Cada recuerdo es una
// polaroid colgada de un caminito de estrellas, del más viejito al más nuevo.
//
// Al abrir uno, la foto se "revela" como una instantánea, con grano de película, una luz
// cálida de las de antes y la fecha naranja de las cámaras viejitas. Cualquiera de los dos
// puede guardar recuerdos (con foto o sin foto); solo quien lo guardó lo puede borrar.

import { api, urlRecuerdo } from '../api.js';
import { h, aviso, confirmar } from '../ui.js';
import { MESES, cargarImagen, fechaLarga } from '../comun.js';
import { crearPanel, crearEncima, chispitas, granoDePelicula, azar, quieto } from './marco.js';
import { arpegio, campanita, pop } from './sonido.js';

const diaDe = (r) => r.fecha || String(r.creado).slice(0, 10);
const ordenar = (lista) => lista.sort((a, b) => (diaDe(a) < diaDe(b) ? -1 : diaDe(a) > diaDe(b) ? 1 : a.id - b.id));
const sello = (fecha) => { const [a, m, d] = fecha.split('-'); return `'${a.slice(2)} ${m} ${d}`; };
const fechaBonita = (fecha) => { const [a, m, d] = fecha.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${a}`; };

// La foto elegida se achica en el teléfono antes de subirla (máximo 1600 px, JPEG).
async function prepararFoto(archivo) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await cargarImagen(url);
    for (const [max, calidad] of [[1600, 0.85], [1280, 0.78], [1024, 0.7]]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.round(img.naturalWidth * k));
      c.height = Math.max(1, Math.round(img.naturalHeight * k));
      const x = c.getContext('2d');
      x.fillStyle = '#fff';
      x.fillRect(0, 0, c.width, c.height);
      x.drawImage(img, 0, 0, c.width, c.height);
      const datos = c.toDataURL('image/jpeg', calidad);
      if (datos.length < 2_600_000) return datos;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function abrir(ctx) {
  const { datos, yo, pareja, desde, extra = {}, alCambiar, alCerrar } = ctx;
  const nombreDe = (id) => (id === yo.id ? yo.nombre : pareja.nombre);
  const recuerdos = ordenar(datos.recuerdos);
  const panel = crearPanel({ clase: 'gx-panel-historia', titulo: 'Nuestra historia', desde, alCerrar });

  const linea = h('ol', { class: 'gx-linea' });
  const vacio = h('p', { class: 'gx-vacio gx-historia-vacia' }, 'Todavía no hay recuerdos guardados. ¿Guardamos el primero? 📷');
  panel.cuerpo.append(
    h('div', { class: 'gx-historia' },
      h('p', { class: 'gx-historia-inicio' }, 'Había una vez, entre todas las estrellas…'),
      vacio,
      linea,
      h('p', { class: 'gx-historia-fin' }, '…y la historia sigue ✨'),
      h('button', { type: 'button', class: 'gx-boton dorado gx-nuevo-recuerdo', onclick: () => formulario() }, '📷 Guardar un recuerdo')));

  function tarjeta(r, i) {
    const dia = diaDe(r);
    const giro = (i % 2 ? 1 : -1) * azar(1.5, 4);
    const foto = r.foto
      ? h('span', { class: 'gx-polaroid-foto' }, h('img', { src: urlRecuerdo(r.id, r.foto, true), alt: '', loading: 'lazy' }))
      : h('span', { class: 'gx-polaroid-foto sin-foto', 'aria-hidden': 'true' }, h('span', null, '✦'));
    return h('li', { class: `gx-recuerdo ${i % 2 ? 'der' : 'izq'}`, 'data-id': r.id },
      h('button', { type: 'button', class: 'gx-polaroid', style: { '--giro': `${giro.toFixed(1)}deg` }, onclick: () => ver(r.id), 'aria-label': `${r.titulo}, ${fechaBonita(dia)}` },
        foto,
        h('span', { class: 'gx-polaroid-titulo' }, r.titulo),
        h('span', { class: 'gx-polaroid-fecha' }, fechaBonita(dia))));
  }
  function pintar() {
    vacio.hidden = recuerdos.length > 0;
    linea.replaceChildren(...recuerdos.map(tarjeta));
  }
  pintar();

  // ---- ver un recuerdo
  function ver(id) {
    let i = recuerdos.findIndex((r) => r.id === id);
    if (i < 0) return;
    const alTeclado = (e) => {
      if (e.key === 'ArrowRight') mover(1);
      if (e.key === 'ArrowLeft') mover(-1);
    };
    document.addEventListener('keydown', alTeclado);
    const capa = crearEncima({ clase: 'gx-visor-recuerdo', etiqueta: 'Un recuerdo', alCerrar: () => document.removeEventListener('keydown', alTeclado) });
    const caja = h('div', { class: 'gx-visor' });
    capa.el.append(caja);
    const anterior = h('button', { type: 'button', class: 'gx-redondo', 'aria-label': 'Recuerdo anterior', onclick: () => mover(-1) }, '‹');
    const siguiente = h('button', { type: 'button', class: 'gx-redondo', 'aria-label': 'Recuerdo siguiente', onclick: () => mover(1) }, '›');
    function mover(d) {
      const j = i + d;
      if (j < 0 || j >= recuerdos.length) return;
      i = j;
      pop({ alto: d > 0 ? 1.2 : 0.9, volumen: 0.08 });
      pintarUno(d);
    }
    function pintarUno(direccion = 0) {
      const r = recuerdos[i];
      const dia = diaDe(r);
      const giro = azar(-2.5, 2.5);
      const foto = r.foto
        ? h('img', { class: `gx-foto ${quieto() ? '' : 'revelando'}`, src: urlRecuerdo(r.id, r.foto), alt: r.titulo })
        : h('div', { class: 'gx-foto gx-foto-postal' }, h('span', { class: 'gx-postal-luna', 'aria-hidden': 'true' }, '☾'), h('span', { class: 'gx-postal-titulo' }, r.titulo));
      const mio = r.quien === yo.id;
      caja.replaceChildren(
        h('figure', { class: `gx-polaroid-grande ${direccion > 0 ? 'desde-der' : direccion < 0 ? 'desde-izq' : ''}`, style: { '--giro': `${giro.toFixed(1)}deg` } },
          h('div', { class: 'gx-foto-marco' },
            foto,
            h('span', { class: 'gx-luz-fuga', 'aria-hidden': 'true' }),
            h('span', { class: 'gx-grano-foto', 'aria-hidden': 'true', style: { backgroundImage: `url(${granoDePelicula()})` } }),
            h('span', { class: 'gx-sello-fecha', 'aria-hidden': 'true' }, sello(dia))),
          h('figcaption', { class: 'gx-polaroid-pie' }, r.titulo)),
        r.texto && h('div', { class: 'gx-recuerdo-texto' }, r.texto),
        h('p', { class: 'gx-recuerdo-autor' }, `${fechaLarga(dia)} · lo guardó ${nombreDe(r.quien)}`),
        h('div', { class: 'gx-visor-nav' },
          anterior,
          h('button', { type: 'button', class: 'gx-boton blanco chico', onclick: () => capa.cerrar() }, 'Cerrar'),
          mio && h('button', { type: 'button', class: 'gx-boton blanco chico gx-borrar', onclick: () => borrar(r) }, 'Borrar'),
          siguiente));
      anterior.disabled = i === 0;
      siguiente.disabled = i === recuerdos.length - 1;
      campanita(5 + (i % 5), { volumen: 0.08, duracion: 2.6 });
    }
    async function borrar(r) {
      const si = await confirmar({ titulo: '¿Borrar este recuerdo?', texto: `«${r.titulo}» se va a borrar para los dos.`, si: 'Borrar', no: 'Dejarlo' });
      if (!si) return;
      try {
        await api.borrarRecuerdo(r.id);
        const k = recuerdos.findIndex((x) => x.id === r.id);
        if (k >= 0) recuerdos.splice(k, 1);
        datos.recuerdos = recuerdos;
        pintar();
        alCambiar();
        capa.cerrar();
      } catch { aviso('No se pudo borrar 😿'); }
    }
    // deslizar para pasar
    let x0 = null;
    caja.addEventListener('pointerdown', (e) => { x0 = { x: e.clientX, y: e.clientY }; });
    caja.addEventListener('pointerup', (e) => {
      if (!x0) return;
      const dx = e.clientX - x0.x;
      const dy = e.clientY - x0.y;
      x0 = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.4) mover(dx < 0 ? 1 : -1);
    });
    pintarUno();
  }

  // ---- guardar un recuerdo
  function formulario() {
    const { titulo: largoTitulo, texto: largoTexto } = datos.largos;
    const capa = crearEncima({ clase: 'gx-formulario', etiqueta: 'Guardar un recuerdo', cerrarAlFondo: false });
    let foto = null;
    const vista = h('span', { class: 'gx-foto-vacia' }, h('span', { class: 'gx-foto-vacia-icono', 'aria-hidden': 'true' }, '📷'), 'Elegir una foto', h('small', null, '(si quieres)'));
    const archivo = h('input', { type: 'file', accept: 'image/*', class: 'gx-oculto' });
    const elegir = h('label', { class: 'gx-foto-elegir' }, vista, archivo);
    const quitar = h('button', { type: 'button', class: 'gx-quitar-foto', hidden: true, 'aria-label': 'Quitar la foto' }, '×');
    archivo.addEventListener('change', async () => {
      const a = archivo.files && archivo.files[0];
      if (!a) return;
      vista.replaceChildren(h('span', { class: 'gx-cargando' }, 'Revelando…'));
      try {
        foto = await prepararFoto(a);
        if (!foto) throw new Error('grande');
        vista.replaceChildren(h('img', { class: 'gx-foto revelando', src: foto, alt: 'La foto elegida' }));
        quitar.hidden = false;
        campanita(7, { volumen: 0.1 });
      } catch {
        foto = null;
        vista.replaceChildren(h('span', { class: 'gx-foto-vacia-icono', 'aria-hidden': 'true' }, '📷'), 'No se pudo abrir esa foto. Prueba con otra.');
      }
    });
    quitar.addEventListener('click', () => {
      foto = null;
      archivo.value = '';
      quitar.hidden = true;
      vista.replaceChildren(h('span', { class: 'gx-foto-vacia-icono', 'aria-hidden': 'true' }, '📷'), 'Elegir una foto', h('small', null, '(si quieres)'));
    });
    const titulo = h('input', { type: 'text', class: 'gx-campo', maxlength: String(largoTitulo), placeholder: 'Un título (por ejemplo: «Nuestra primera cita»)', required: true });
    const fecha = h('input', { type: 'date', class: 'gx-campo', max: datos.hoy, 'aria-label': '¿Cuándo fue?' });
    const texto = h('textarea', { class: 'gx-campo', maxlength: String(largoTexto), rows: '5', placeholder: 'Cuéntalo como si fuera un cuento… (si quieres)' });
    const guardar = h('button', { type: 'button', class: 'gx-boton dorado' }, 'Guardarlo entre las estrellas ✨');
    const hoja = h('div', { class: 'gx-hoja-oscura gx-form-recuerdo' },
      h('h3', { class: 'gx-hoja-titulo' }, 'Un recuerdo nuevo'),
      h('div', { class: 'gx-foto-caja' }, elegir, quitar),
      titulo,
      h('label', { class: 'gx-etiqueta-campo' }, h('span', null, '¿Cuándo fue?'), fecha),
      texto,
      h('div', { class: 'gx-fila' }, h('button', { type: 'button', class: 'gx-boton blanco', onclick: () => capa.cerrar() }, 'Cancelar'), guardar));
    capa.el.append(hoja);
    setTimeout(() => titulo.focus(), 300);
    guardar.addEventListener('click', async () => {
      if (!titulo.value.trim()) { titulo.focus(); titulo.classList.add('falta'); return; }
      guardar.disabled = true;
      guardar.textContent = 'Guardando…';
      try {
        const { recuerdo } = await api.guardarRecuerdo({ titulo: titulo.value.trim(), texto: texto.value.trim(), fecha: fecha.value || null, foto });
        recuerdos.push(recuerdo);
        ordenar(recuerdos);
        datos.recuerdos = recuerdos;
        pintar();
        alCambiar();
        capa.cerrar();
        arpegio([0, 2, 4, 7, 9], { separacion: 0.08, volumen: 0.18 });
        setTimeout(() => {
          const li = linea.querySelector(`[data-id="${recuerdo.id}"]`);
          if (!li) return;
          li.scrollIntoView({ behavior: quieto() ? 'auto' : 'smooth', block: 'center' });
          li.classList.add('recien');
          setTimeout(() => {
            const r = li.getBoundingClientRect();
            chispitas(r.left + r.width / 2, r.top + r.height / 2, { cantidad: 14, lejos: 90 });
          }, 500);
        }, 420);
      } catch (e) {
        guardar.disabled = false;
        guardar.textContent = 'Guardarlo entre las estrellas ✨';
        const mensajes = { titulo_invalido: 'Ponle un título 💛', fecha_invalida: 'Esa fecha no se puede (¿es del futuro?)', foto_invalida: 'Esa foto no se pudo guardar. Prueba con otra.' };
        aviso(mensajes[e.message] || 'No se pudo guardar 😿 Revisa tu conexión.');
      }
    });
  }

  if (extra.ver) setTimeout(() => ver(extra.ver), 380);
}
