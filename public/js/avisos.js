// Avisos al teléfono: el cuadrito de "Activar avisos" en la pantalla de Hoy y lo que
// hace falta para registrarse (service worker /sw.js + suscripción push).
//
// El permiso se pide SOLO al tocar el botón (iPhone y Chrome lo exigen así).

import { api } from './api.js';
import { h, aviso } from './ui.js';
import { icono, carita } from './iconos.js';

const soportaPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
const esIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent)
  || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1); // iPad que se hace pasar por Mac
const aparatoIOS = () => (/iPhone|iPod/.test(navigator.userAgent) ? 'iPhone' : 'iPad');
const instalada = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;

// Si esta persona activó los avisos en este aparato (para volver a suscribir sola si el
// navegador pierde la suscripción).
const claveQuiere = (id) => `garabatos-avisos-${id}`;
function quiere(id) { try { return localStorage.getItem(claveQuiere(id)) === '1'; } catch { return false; } }
function marcarQuiere(id, si) {
  try { if (si) localStorage.setItem(claveQuiere(id), '1'); else localStorage.removeItem(claveQuiere(id)); } catch { /* sin almacenamiento */ }
}

// La clave pública del servidor (null si los avisos no están configurados).
let clave = null;
function pedirClave() {
  if (!clave) clave = api.claveAvisos().then((r) => r.clave || null).catch((e) => { clave = null; throw e; });
  return clave;
}

let registro = null;
function registrar() {
  if (!registro) {
    registro = navigator.serviceWorker.register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .catch((e) => { registro = null; throw e; });
  }
  return registro;
}

function aBytes(base64url) {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (base64url.length % 4)) % 4);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// ¿La suscripción se hizo con la clave actual del servidor? (si la cambian, hay que rehacerla)
function mismaClave(sub, k) {
  const actual = sub.options && sub.options.applicationServerKey;
  if (!actual) return true;
  const a = new Uint8Array(actual);
  const b = aBytes(k);
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

async function suscribir(reg, k) {
  let sub = await reg.pushManager.getSubscription();
  if (sub && !mismaClave(sub, k)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  return sub || reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(k) });
}

// Al abrir la app con el permiso ya dado: le recuerda al servidor este aparato (por si
// la suscripción cambió o el servidor la borró). Una vez por cuenta y por carga.
let sincronizada = null;
export async function sincronizarAvisos(yo) {
  if (sincronizada === yo.id || !soportaPush() || Notification.permission !== 'granted') return;
  sincronizada = yo.id;
  try {
    const k = await pedirClave();
    if (!k) return;
    const reg = await registrar();
    const yaHabia = await reg.pushManager.getSubscription();
    if (!yaHabia && !quiere(yo.id)) return;
    const sub = await suscribir(reg, k);
    await api.activarAvisos(sub.toJSON());
    marcarQuiere(yo.id, true);
  } catch {
    sincronizada = null; // se intenta otra vez la próxima
  }
}

// Al cerrar sesión, este aparato deja de recibir los avisos de esa cuenta.
export async function salirConAvisos() {
  let sub = null;
  try {
    if (soportaPush()) {
      const reg = await navigator.serviceWorker.getRegistration('/');
      sub = reg ? await reg.pushManager.getSubscription() : null;
    }
  } catch { /* sin avisos */ }
  await api.salir(sub ? sub.endpoint : undefined).catch(() => {});
  if (sub) await sub.unsubscribe().catch(() => {});
  sincronizada = null;
}

// ------------------------------------------------------------------ el cuadrito
export function controlAvisos({ yo, pareja }) {
  const caja = h('section', { class: 'control-avisos', 'aria-label': 'Avisos', 'aria-live': 'polite' });
  caja.hidden = true;
  let ocupado = false;

  const cara = () => {
    const el = h('span', { class: 'cara', style: { '--color': pareja.color } });
    el.innerHTML = carita(pareja.carita, pareja.color);
    return el;
  };
  const mostrar = (clase, texto, boton) => {
    caja.className = `control-avisos ${clase}`;
    caja.replaceChildren(cara(), h('p', { class: 'control-avisos-texto' }, ...texto), ...(boton ? [boton] : []));
    caja.hidden = false;
  };

  async function estado() {
    let k;
    try { k = await pedirClave(); } catch { return { nombre: 'oculto' }; }
    if (!k) return { nombre: 'oculto' };
    if (esIOS() && !instalada()) return { nombre: 'instalar' };
    if (!soportaPush()) return { nombre: 'sin-soporte' };
    if (Notification.permission === 'denied') return { nombre: 'bloqueado' };
    // Se registra ya, para que al tocar "Activar" el permiso se pida sin esperar nada antes.
    let reg;
    try { reg = await registrar(); } catch { return { nombre: 'sin-soporte' }; }
    const sub = Notification.permission === 'granted' ? await reg.pushManager.getSubscription().catch(() => null) : null;
    return { nombre: sub ? 'activo' : 'apagado', k, reg };
  }

  async function pintar() {
    if (ocupado) return;
    const e = await estado();
    if (ocupado) return;
    switch (e.nombre) {
      case 'oculto':
        caja.hidden = true;
        break;
      case 'instalar':
        mostrar('suave', [
          h('strong', null, '¿Quieres avisos? '),
          `En tu ${aparatoIOS()} primero hay que agregar Garabatos a la pantalla de inicio: toca `,
          h('strong', null, 'Compartir'), ' (el cuadrito con la flechita) y luego ',
          h('strong', null, '“Agregar a pantalla de inicio”'),
          '. Ábrela desde ese ícono y activa los avisos aquí. Necesita iOS 16.4 o más nuevo.']);
        break;
      case 'sin-soporte':
        mostrar('suave', [esIOS()
          ? `Para recibir avisos, tu ${aparatoIOS()} necesita iOS 16.4 o más nuevo. Cuando lo actualices, aquí aparece el botón.`
          : 'Este navegador no sabe mostrar avisos. Prueba abriendo Garabatos en Chrome o Safari.']);
        break;
      case 'bloqueado':
        mostrar('suave', [h('strong', null, 'Los avisos están bloqueados. '), esIOS()
          ? 'Para recibirlos ve a Ajustes → Notificaciones → Garabatos y activa “Permitir notificaciones”.'
          : 'Para recibirlos, abre los ajustes del sitio (el candadito junto a la dirección, o mantén presionado el ícono de la app → Información) y permite las notificaciones.',
        ' Después vuelve a abrir Garabatos.']);
        break;
      case 'activo':
        mostrar('activo', [h('strong', null, 'Avisos activados 💛 '), `Te cuento cuando ${pareja.nombre} dibuje.`],
          h('button', { type: 'button', class: 'boton blanco chico', onclick: () => desactivar(e.reg) }, 'Desactivar'));
        break;
      default:
        mostrar('apagado', [`¿Te aviso cuando ${pareja.nombre} dibuje? Y al mediodía, si todavía no has dibujado.`],
          h('button', { type: 'button', class: 'boton sol chico', onclick: (ev) => activar(ev.currentTarget, e) }, icono('campana'), 'Activar avisos'));
    }
  }

  async function activar(boton, { k, reg }) {
    if (ocupado) return;
    ocupado = true;
    boton.disabled = true;
    // Lo primero de todo, todavía dentro del toque: pedir permiso.
    let permiso;
    try { permiso = await Notification.requestPermission(); } catch { permiso = Notification.permission; }
    try {
      if (permiso === 'granted') {
        const sub = await suscribir(reg, k);
        await api.activarAvisos(sub.toJSON());
        marcarQuiere(yo.id, true);
        aviso('¡Listo! Te avisaré 💛');
      }
    } catch {
      aviso('No se pudieron activar los avisos. Inténtalo otra vez en un ratito.', 3600);
    }
    ocupado = false;
    pintar();
  }

  async function desactivar(reg) {
    if (ocupado) return;
    ocupado = true;
    try {
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await api.desactivarAvisos(sub.endpoint).catch(() => {});
        await sub.unsubscribe().catch(() => {});
      }
      marcarQuiere(yo.id, false);
      aviso('Avisos desactivados.');
    } catch {
      aviso('No se pudieron desactivar los avisos. Inténtalo otra vez.');
    }
    ocupado = false;
    pintar();
  }

  pintar();
  // `actualizar` sirve al volver a la app (por ejemplo, después de cambiar el permiso en Ajustes).
  return { el: caja, actualizar: pintar };
}
