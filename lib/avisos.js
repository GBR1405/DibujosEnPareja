// Avisos al teléfono (Web Push con claves VAPID, sin Firebase).
//
// El servidor de Vercel se "congela" en cuanto responde, así que los avisos se mandan
// ANTES de responder, pero sin esperar nunca más de `tope` ms: si el servicio de avisos
// de Apple o Google tarda o falla, la respuesta sale igual y la app sigue como si nada.

const webpush = require('web-push');

// Revisa las claves. Si faltan o están mal, los avisos quedan apagados (sin romper nada).
function prepararClaves({ clavePublica, clavePrivada, contacto }) {
  const faltan = [
    !clavePublica && 'VAPID_PUBLIC_KEY',
    !clavePrivada && 'VAPID_PRIVATE_KEY',
    !contacto && 'VAPID_SUBJECT',
  ].filter(Boolean);
  if (faltan.length) return { listo: false, motivo: `faltan ${faltan.join(', ')}` };
  try {
    webpush.setVapidDetails(contacto, clavePublica, clavePrivada);
  } catch (err) {
    return { listo: false, motivo: `las claves VAPID no son válidas (${err.message})` };
  }
  return { listo: true };
}

const enviarConWebPush = (aparato, carga, opciones) => webpush.sendNotification(aparato, carga, opciones);

function crearAvisos({ base, claves }) {
  const estado = prepararClaves(claves);
  if (!estado.listo) console.warn(`🔕 Avisos al teléfono desactivados: ${estado.motivo}. Mira el README.`);

  // Se puede cambiar en las pruebas para no salir a internet.
  let enviar = enviarConWebPush;

  // Manda `mensaje` a todos los aparatos de `quien`. Si el servicio dice que el aparato
  // ya no existe (404 o 410: desinstalaron la app, quitaron el permiso…), se borra.
  async function enviarA(quien, mensaje, cuenta, tope) {
    const aparatos = await base.aparatosDe(quien);
    const carga = JSON.stringify({ titulo: mensaje.titulo, texto: mensaje.texto, tag: mensaje.tag, url: '/' });
    const resultados = await Promise.allSettled(aparatos.map(async (aparato) => {
      try {
        await enviar(aparato, carga, { TTL: mensaje.ttl, urgency: 'high', timeout: tope });
        cuenta.enviados += 1;
      } catch (err) {
        if (err && (err.statusCode === 404 || err.statusCode === 410)) {
          cuenta.borrados += 1;
          await base.borrarAparato(aparato.endpoint);
        }
        throw err;
      }
    }));
    for (const r of resultados) {
      if (r.status === 'rejected' && ![404, 410].includes(r.reason?.statusCode)) {
        console.warn(`No se pudo mandar un aviso a ${quien}:`, r.reason?.statusCode || r.reason?.message || r.reason);
      }
    }
  }

  // `destinos`: lista de { quien, mensaje }, o una función (async) que la devuelve.
  // Nunca lanza error y nunca tarda más de `tope` ms. Devuelve cuántos avisos salieron.
  async function avisar(destinos, { tope = 3000 } = {}) {
    const cuenta = { enviados: 0, borrados: 0 };
    if (!estado.listo) return cuenta;
    let reloj;
    const limite = new Promise((ok) => { reloj = setTimeout(ok, tope, 'tope'); });
    const trabajo = (async () => {
      const lista = typeof destinos === 'function' ? await destinos() : destinos;
      await Promise.allSettled(lista.map((d) => enviarA(d.quien, d.mensaje, cuenta, tope)));
    })();
    try {
      if (await Promise.race([trabajo, limite]) === 'tope') console.warn(`Los avisos tardaron más de ${tope} ms; se siguió sin esperarlos.`);
    } catch (err) {
      console.error('No se pudieron mandar los avisos:', err.message);
    } finally {
      clearTimeout(reloj);
    }
    trabajo.catch(() => {}); // si siguió en segundo plano y falló después, que no truene
    return { ...cuenta };
  }

  return {
    get disponible() { return estado.listo; },
    clavePublica: estado.listo ? claves.clavePublica : null,
    avisar,
    usarEnviador(fn) { enviar = fn; },
  };
}

module.exports = { crearAvisos };
