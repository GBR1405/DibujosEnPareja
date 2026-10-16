// Reacciones y notitas en los dibujos:
//  - la pegatina con el emoji, que se pega en la esquina de la polaroid,
//  - la burbuja con la notita que te dejó tu pareja,
//  - el panel para reaccionar al dibujo de tu pareja.
//
// La lista de emojis viene del servidor (/api/yo), así hay una sola lista.

import { api } from './api.js';
import { h, aviso, chispas } from './ui.js';
import { icono, carita } from './iconos.js';

let lista = [];
let largoComentario = 120;
const porId = new Map();

export function conocerReacciones({ reacciones, largoComentario: largo }) {
  lista = reacciones || [];
  largoComentario = largo || 120;
  porId.clear();
  for (const r of lista) porId.set(r.id, r);
}

export const emojiDe = (id) => (porId.get(id) || {}).emoji || null;

const caraChica = (cuenta) => {
  const el = h('span', { class: 'cara', style: { '--color': cuenta.color } });
  el.innerHTML = carita(cuenta.carita, cuenta.color);
  return el;
};

// ------------------------------------------------------------------ pegatina
export function pegatina(nota, { nueva = false } = {}) {
  const r = nota && porId.get(nota.reaccion);
  if (!r) return null;
  return h('span', { class: `pegatina ${nueva ? 'nueva' : ''}`, role: 'img', 'aria-label': `Reacción: ${r.nombre}` }, r.emoji);
}

// Cambia (o quita) la pegatina de una polaroid que ya está en pantalla.
export function repegar(polaroidEl, nota) {
  if (!polaroidEl) return;
  const vieja = polaroidEl.querySelector('.pegatina');
  if (vieja && nota && vieja.textContent === emojiDe(nota.reaccion)) return;
  if (vieja) vieja.remove();
  const nueva = pegatina(nota, { nueva: true });
  if (nueva) polaroidEl.append(nueva);
}

// ------------------------------------------------------------------ burbuja
// Lo que `autor` le dejó a tu dibujo: "Eli te dejó 🥰" o su notita entre comillas.
export function burbuja(autor, nota) {
  if (!nota) return null;
  const emoji = emojiDe(nota.reaccion);
  if (!emoji && !nota.comentario) return null;
  return h('div', { class: 'burbuja' },
    caraChica(autor),
    h('p', { class: 'burbuja-texto' },
      h('strong', null, autor.nombre),
      nota.comentario
        ? [' te dejó una notita:', h('span', { class: 'burbuja-notita' }, `${emoji ? `${emoji} ` : ''}«${nota.comentario}»`)]
        : ` reaccionó a tu dibujo ${emoji}`));
}

// ------------------------------------------------------------------ panel
// Para reaccionar al dibujo de `pareja` del día `fecha`. `alCambiar(nota, { animar })`
// avisa cada vez que cambia (para mover la pegatina, la mascota…).
// Devuelve { el, fecha, actualizar(nota) }.
export function panelReaccion({ fecha, pareja, nota, alCambiar }) {
  let confirmada = nota || null; // lo último que guardó el servidor
  let mostrada = confirmada; // lo que se ve (puede ir un paso adelante del servidor)
  let ultima = 0;
  let pendientes = 0;
  let cola = Promise.resolve(true);

  const botones = lista.map((r) => h('button', {
    type: 'button',
    class: 'reaccion',
    'data-id': r.id,
    'aria-label': r.nombre,
    title: r.nombre,
    onclick: (e) => elegir(r.id, e.currentTarget),
  }, h('span', { class: 'reaccion-emoji' }, r.emoji)));

  const entrada = h('input', {
    type: 'text',
    class: 'notita-entrada',
    maxlength: largoComentario,
    placeholder: `Déjale una notita a ${pareja.nombre}…`,
    enterkeyhint: 'send',
    autocomplete: 'off',
    'aria-label': `Notita para ${pareja.nombre}`,
  });
  entrada.value = (confirmada && confirmada.comentario) || '';
  const enviar = h('button', { type: 'submit', class: 'boton fresa chico notita-enviar', 'aria-label': 'Enviar la notita' }, icono('enviar'));
  const estado = h('p', { class: 'notita-estado', 'aria-live': 'polite' }, '');

  const el = h('section', { class: 'panel-reaccion', 'aria-label': `Reaccionar al dibujo de ${pareja.nombre}` },
    h('p', { class: 'panel-reaccion-titulo' }, `¿Qué te pareció el dibujo de ${pareja.nombre}?`),
    h('div', { class: 'reacciones', role: 'group', 'aria-label': 'Reacciones' }, botones),
    h('form', { class: 'notita', onsubmit: (e) => { e.preventDefault(); mandarNotita(); } }, entrada, enviar),
    estado);

  function mostrar(n, opciones = {}) {
    mostrada = n;
    for (const b of botones) {
      const activo = Boolean(n) && n.reaccion === b.dataset.id;
      b.classList.toggle('activa', activo);
      b.setAttribute('aria-pressed', activo);
    }
    if (document.activeElement !== entrada) entrada.value = (n && n.comentario) || '';
    if (alCambiar) alCambiar(n, opciones);
  }

  // Los cambios se mandan uno detrás de otro, así el último toque siempre gana.
  function guardar(cambio) {
    ultima += 1;
    const mia = ultima;
    pendientes += 1;
    cola = cola.then(async () => {
      try {
        const r = await api.reaccionar({ fecha, ...cambio });
        confirmada = r.nota;
        if (mia === ultima) mostrar(confirmada);
        return true;
      } catch (e) {
        if (mia === ultima) mostrar(confirmada);
        aviso(e.estado === 401 ? 'Se cerró tu sesión. Vuelve a entrar.' : 'No se pudo guardar. Revisa la conexión e inténtalo otra vez.', 3600);
        return false;
      } finally {
        pendientes -= 1;
      }
    });
    return cola;
  }

  function elegir(id, boton) {
    const quitar = Boolean(mostrada) && mostrada.reaccion === id;
    const comentario = (mostrada && mostrada.comentario) || null;
    const reaccion = quitar ? null : id;
    mostrar(reaccion || comentario ? { reaccion, comentario } : null, { animar: !quitar });
    if (!quitar) {
      chispas(emojiDe(id), boton);
      boton.classList.remove('rebota');
      void boton.offsetWidth;
      boton.classList.add('rebota');
    }
    guardar({ reaccion });
  }

  async function mandarNotita() {
    const texto = entrada.value.replace(/\s+/g, ' ').trim();
    if (texto === ((confirmada && confirmada.comentario) || '')) { entrada.blur(); return; }
    enviar.disabled = true;
    estado.textContent = '';
    const ok = await guardar({ comentario: texto });
    enviar.disabled = false;
    if (ok) {
      entrada.blur();
      entrada.value = texto;
      estado.textContent = texto ? `Notita enviada a ${pareja.nombre} 💌` : 'Notita borrada.';
      if (texto) chispas('💌', enviar, 5);
    }
  }

  mostrar(confirmada);

  return {
    el,
    fecha,
    // Datos nuevos del servidor (por ejemplo al volver a la app). Si hay algo guardándose,
    // no se pisa lo que se ve.
    actualizar(n) {
      if (pendientes > 0) return;
      confirmada = n || null;
      mostrar(confirmada);
    },
  };
}
