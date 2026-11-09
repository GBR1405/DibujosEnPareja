import { api, urlDibujo } from './api.js';
import { h, aviso, hoja, confirmar, lluviaDeCorazones } from './ui.js';
import { icono } from './iconos.js';
import { controlAvisos, sincronizarAvisos, salirConAvisos } from './avisos.js';
import { conocerReacciones, emojiDe, pegatina, repegar, burbuja, panelReaccion } from './reacciones.js';
import { crearPostal, abrirPostal } from './postal.js';
import { crearMascota } from './mascota.js';
import {
  app, MESES, DIAS, partes, diaSemana, fechaLarga, fechaCorta, diasEntre, caritaDe, navegar, alNavegar, barraNav,
  abrirVisor, hayBorrador, limpiarBorradores, monedasGanadas,
} from './comun.js';
import { pantallaLienzo } from './dibujar.js';
import { ponerRacha, rachaInicial, NOMBRES_NIVEL } from './racha.js';
import { hojaPosponer, tarjetaPospuesto, tarjetaPendiente, explicarPorQueNo, mandarAnimos } from './posponer.js';
import { tarjetaReto, pantallaReto, modoReto } from './reto.js';
import { tarjetaPregunta, pantallaNosotros } from './nosotros.js';
import { mostrarNovedades } from './novedades.js';

const raiz = document.getElementById('app');
let sesion = null; // { yo, pareja }
let soltar = null; // limpieza de la pantalla actual
let generacion = 0;

const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// Quién soy, quién es mi pareja y la lista de reacciones.
async function pedirSesion() {
  const s = await api.yo();
  conocerReacciones(s);
  return s;
}
function ponerSesion(s) { sesion = s; app.sesion = s; }

// La clave del borrador del dibujo de un día (en este aparato).
const claveBorrador = (fecha) => `${sesion.yo.id}-${fecha}`;

// ================================================================== entrada
function pantallaEntrar(cont) {
  const pantalla = h('main', { class: 'pantalla entrar' });
  cont.append(pantalla);
  let alTeclado = null;
  const soltarTeclado = () => { if (alTeclado) { document.removeEventListener('keydown', alTeclado); alTeclado = null; } };

  api.cuentas().then(({ nombreApp, cuentas }) => {
    const titulo = h('h1', { class: 'logo' }, nombreApp.toLowerCase());
    const bajada = h('p', { class: 'entrar-bajada' }, 'Un ratito para dibujar juntos, cada día.');

    function elegir() {
      soltarTeclado();
      pantalla.replaceChildren(titulo, bajada,
        h('p', { class: 'entrar-pregunta' }, '¿Quién va a dibujar?'),
        h('div', { class: 'quien-eres' }, cuentas.map((c, i) => h('button', {
          type: 'button',
          class: 'pegatina-cara',
          style: { '--giro': i % 2 ? '2.5deg' : '-2.5deg' },
          onclick: () => pedirPin(c),
        }, caritaDe(c, 'grande'), h('span', { class: 'pegatina-nombre' }, c.nombre)))));
    }

    function pedirPin(cuenta) {
      let pin = '';
      let ocupado = false;
      const casillas = Array.from({ length: cuenta.largoPin }, () => h('span', { class: 'casilla' }, icono('corazon', { relleno: true })));
      const fila = h('div', { class: `casillas largo-${cuenta.largoPin}` }, casillas);
      const mensaje = h('p', { class: 'pin-mensaje', role: 'status' }, '');

      const pintar = () => casillas.forEach((c, i) => c.classList.toggle('llena', i < pin.length));

      async function enviar() {
        ocupado = true;
        try {
          await api.entrar(cuenta.id, pin);
          ponerSesion(await pedirSesion());
          soltarTeclado();
          navegar('hoy');
        } catch (e) {
          pin = '';
          pintar();
          ocupado = false;
          mensaje.textContent = e.estado === 429
            ? `Demasiados intentos. Espera ${e.datos.espera} s e inténtalo otra vez.`
            : 'Ese PIN no es. Inténtalo otra vez.';
          fila.classList.remove('sacude');
          void fila.offsetWidth;
          fila.classList.add('sacude');
        }
      }

      function tecla(valor) {
        if (ocupado) return;
        mensaje.textContent = '';
        if (valor === 'borrar') pin = pin.slice(0, -1);
        else if (pin.length < cuenta.largoPin) pin += valor;
        pintar();
        if (pin.length === cuenta.largoPin) enviar();
      }

      const teclas = ['1', '2', '3', '4', '5', '6', '7', '8', '9', null, '0', 'borrar'].map((t) => (t === null
        ? h('span')
        : h('button', {
          type: 'button',
          class: `tecla ${t === 'borrar' ? 'tecla-borrar' : ''}`,
          'aria-label': t === 'borrar' ? 'Borrar un número' : t,
          onclick: () => tecla(t),
        }, t === 'borrar' ? icono('retroceso') : t)));

      // En computadora también se puede escribir con el teclado.
      soltarTeclado();
      alTeclado = (e) => {
        if (/^\d$/.test(e.key)) tecla(e.key);
        else if (e.key === 'Backspace') tecla('borrar');
      };
      document.addEventListener('keydown', alTeclado);

      pantalla.replaceChildren(
        h('button', { type: 'button', class: 'volver-suelto', 'aria-label': 'Elegir otra persona', onclick: elegir }, icono('volver')),
        caritaDe(cuenta, 'grande'),
        h('p', { class: 'pin-titulo' }, `Escribe tu PIN, ${cuenta.nombre}`),
        fila,
        mensaje,
        h('div', { class: 'teclado' }, teclas),
      );
    }

    elegir();
  }).catch(() => {
    pantalla.replaceChildren(h('p', { class: 'vacio' }, 'No se pudo conectar con el servidor.'),
      h('button', { type: 'button', class: 'boton sol', onclick: ir }, 'Reintentar'));
  });

  return soltarTeclado;
}

function botonPerfil() {
  return h('button', {
    type: 'button',
    class: 'perfil',
    'aria-label': `Cuenta de ${sesion.yo.nombre}`,
    onclick: () => hoja({
      titulo: `Estás como ${sesion.yo.nombre}`,
      contenido: h('div', { class: 'hoja-cara' }, caritaDe(sesion.yo, 'grande')),
      acciones: [
        { texto: 'Quedarme', clase: 'blanco' },
        {
          texto: 'Salir',
          clase: 'fresa',
          onClick: async () => { await salirConAvisos(); ponerSesion(null); navegar('entrar'); },
        },
      ],
    }),
  }, caritaDe(sesion.yo));
}

// ================================================================== polaroids
// `nota`: la reacción que le dejaron a este dibujo (sale como pegatina en la esquina).
function polaroid({ src, nombre, giro, alAbrir, nuevo, nota }) {
  return h('button', {
    type: 'button',
    class: `polaroid ${nuevo ? 'aparece' : ''}`,
    style: { '--giro': giro },
    'aria-label': `Ver el dibujo de ${nombre}`,
    onclick: alAbrir,
  },
  h('img', { src, alt: `Dibujo de ${nombre}`, draggable: 'false' }),
  h('span', { class: 'polaroid-nombre' }, nombre),
  pegatina(nota));
}

// Cuando alguien no dibujó ese día: solo su carita triste (o desanimada, si lo pospuso).
function polaroidTriste({ cuenta, giro, pospuso }) {
  return h('div', { class: 'polaroid vacia triste', style: { '--giro': giro } },
    h('span', { class: 'polaroid-espera', role: 'img', 'aria-label': `${cuenta.nombre} ${pospuso ? 'lo pospuso' : 'no ha dibujado'}` }, caritaDe(cuenta, '', pospuso ? 'desanimado' : 'triste')),
    h('span', { class: 'polaroid-nombre' }, cuenta.nombre));
}

// Los dos marcos de un día: el mío y el de mi pareja (dibujo o carita triste).
// `fuente(fecha, cuenta, v)` devuelve de dónde cargar la imagen completa.
// `notaMia` es lo que mi pareja le dejó a mi dibujo; `notaSuya`, lo que yo le dejé al suyo.
function marcosDelDia({ fecha, tema, miV, parejaV, nuevo, fuente, notaMia, notaSuya, pospuse, pospuso }) {
  const abrir = (cuenta, v) => () => abrirVisor({
    src: fuente(fecha, cuenta, v),
    nombre: cuenta.nombre,
    titulo: tema,
    archivo: `garabato-${fecha}-${cuenta.nombre.toLowerCase().replace(/\s+/g, '-')}`,
  });
  const mio = miV
    ? polaroid({ src: fuente(fecha, sesion.yo, miV), nombre: sesion.yo.nombre, giro: '-2.2deg', alAbrir: abrir(sesion.yo, miV), nota: notaMia })
    : polaroidTriste({ cuenta: sesion.yo, giro: '-2.2deg', pospuso: pospuse });
  const suyo = parejaV
    ? polaroid({ src: fuente(fecha, sesion.pareja, parejaV), nombre: sesion.pareja.nombre, giro: '2.4deg', alAbrir: abrir(sesion.pareja, parejaV), nuevo, nota: notaSuya })
    : polaroidTriste({ cuenta: sesion.pareja, giro: '2.4deg', pospuso });
  return { mio, suyo };
}

const desdeElServidor = (fecha, cuenta, v) => urlDibujo(fecha, cuenta.id, v);
let rachaParaPostal = { dias: 0, nivel: 0 };

// El botón "Postal": arma una imagen con los dos dibujos del día. `datos()` se lee al
// tocarlo, así la postal lleva las reacciones más recientes. El fondo de la postal lleva
// los efectos de la racha de ahora (como el de la app).
function botonPostal(datos) {
  return h('button', {
    type: 'button',
    class: 'boton blanco postal-boton',
    onclick: () => {
      const { fecha, tema, miV, parejaV, notaMia, notaSuya, fuente } = datos();
      const lados = [
        { cuenta: sesion.yo, src: miV ? fuente(fecha, sesion.yo, miV) : null, nota: notaMia, autor: sesion.pareja },
        { cuenta: sesion.pareja, src: parejaV ? fuente(fecha, sesion.pareja, parejaV) : null, nota: notaSuya, autor: sesion.yo },
      ];
      abrirPostal({
        nombreArchivo: `garabatos-${fecha}`,
        armar: () => crearPostal({ fechaTexto: `${fechaLarga(fecha)} de ${partes(fecha)[0]}`, tema, dibujos: lados, emojiDe, racha: rachaParaPostal }),
      });
    },
  }, icono('postal'), 'Postal de los dos');
}

// Lo que dice Garabatito en la pantalla de Hoy, según cómo va el día.
function queDiceGarabatito(d, reto) {
  const p = sesion.pareja.nombre;
  const hora = new Date().getHours();
  const deHoy = (lista) => lista[[...d.fecha].reduce((suma, c) => suma + c.charCodeAt(0), 0) % lista.length];
  const notaMia = d.notas && d.notas.mio;
  const pos = d.posponer || {};
  if ((pos.pendientes || []).length) return { texto: '¡Hoy te tocan dos! El que pospusiste y el de hoy ✏️✏️ Que no se pierda la racha.', animo: 'normal' };
  if (!d.yoListo && pos.mio) return { texto: `Descansa, ${sesion.yo.nombre} 💛 Mañana dibujamos el doble.`, animo: 'dormido' };
  if (pos.suyo && !d.parejaListo) return { texto: `${p} no puede dibujar hoy… ¿le mandas ánimos? 💛`, animo: 'normal' };
  if (!d.yoListo) {
    if (d.parejaListo) return { texto: `¡${p} ya dibujó! Te está esperando 👀`, animo: 'feliz' };
    if (d.temaElegidoPor && d.temaElegidoPor !== sesion.yo.id) return { texto: `¡El tema de hoy lo eligió ${p}! 🎲`, animo: 'feliz' };
    if (hora >= 21) return { texto: 'Todavía estás a tiempo: el día termina a medianoche 🌙', animo: 'normal' };
    if (d.racha >= 2) return { texto: `¡Llevan ${d.racha} días seguidos! Que no se rompa la racha 🔥`, animo: 'normal' };
    return {
      texto: deHoy([
        `¿Cómo te imaginas «${d.tema}»? ¡Quiero verlo!`,
        'Un garabato chiquito también cuenta ✏️',
        'No tiene que quedar perfecto: tiene que quedar tuyo 💛',
        `Apuesto a que ${p} va a sonreír con tu dibujo.`,
        '¡Ya me sacaron punta! ¿Empezamos? ✏️',
      ]),
      animo: 'normal',
    };
  }
  if (!d.parejaV) return { texto: deHoy([`¡Te quedó precioso! Ahora a esperar a ${p} ⏳`, `Guardadito. Cuando ${p} termine, aparece aquí ✨`]), animo: 'feliz' };
  if (notaMia && notaMia.comentario) return { texto: `¡${p} te dejó una notita! Mírala abajo 💌`, animo: 'feliz' };
  if (notaMia && notaMia.reaccion) return { texto: `¡${p} reaccionó a tu dibujo! ${emojiDe(notaMia.reaccion) || ''}`, animo: 'feliz' };
  if (reto && reto.fase === 'mi_turno') return { texto: `¡Te toca en el reto de la semana! ${reto.emoji} ${reto.nombre}`, animo: 'feliz' };
  const recuperable = (d.perdidos || []).find((x) => x.gratis || (d.comodines && d.comodines.quedan > 0));
  if (recuperable) {
    return recuperable.gratis
      ? { texto: `¡El de ayer todavía es gratis hasta las ${d.horasDeGracia}:00! Corre a dibujarlo 🏃`, animo: 'normal' }
      : { texto: `Se te pasó ${nombreCortoDia(recuperable.fecha, d.fecha).toLowerCase()} 😿 ¡Recupéralo con un comodín y la racha sigue! 🎟️`, animo: 'normal' };
  }
  if (!(d.notas && d.notas.suyo)) return { texto: `¿Qué te pareció el de ${p}? Déjale una reacción 💛`, animo: 'normal' };
  if (hora >= 22 || hora < 5) return { texto: 'Buenas noches… mañana dibujamos otra vez 🌙', animo: 'dormido' };
  if ([7, 15, 30, 60, 100, 200, 300, 365].includes(d.racha)) return { texto: `¡${d.racha} días seguidos dibujando juntos! Miren cómo brilla el fondo ✨`, animo: 'feliz' };
  return { texto: deHoy(['¡Qué lindos les quedaron! Mañana más 🌈', '¡Otro día para el álbum! Pueden guardar la postal 📮', 'Hoy vi dos obras de arte 🖼️', `Con las monedas 🪙 pueden comprarle algo a la casa 🏠`]), animo: 'feliz' };
}

// ================================================================== comodines
const comodinesTexto = (n) => (n === 1 ? '1 comodín' : `${n} comodines`);
const teQuedan = (n) => (n === 1 ? 'Te queda 1' : `Te quedan ${n}`);
const nombreCortoDia = (fecha, hoy) => (diasEntre(fecha, hoy) === 1 ? 'Ayer' : `el ${DIAS[diaSemana(fecha)]} ${partes(fecha)[2]}`);

// Al tocar la pastillita 🎟️: qué son y cuántos quedan.
function explicarComodines(d) {
  const { quedan, maximo, proximo } = d.comodines;
  hoja({
    titulo: '🎟️ Comodines',
    contenido: h('div', { class: 'hoja-comodines' },
      h('p', { class: 'comodines-boletos', 'aria-hidden': 'true' },
        Array.from({ length: maximo }, (_, i) => h('span', { class: `boleto ${i < quedan ? 'lleno' : ''}` }, '🎟️'))),
      h('p', { class: 'hoja-texto' },
        'Si un día se te pasa dibujar, con un comodín puedes dibujarlo después (hasta una semana) y la racha no se rompe.'),
      h('p', { class: 'hoja-texto' },
        `${teQuedan(quedan)} de ${maximo}. Cada mes se recarga 1${proximo ? `: el próximo llega el ${fechaCorta(proximo)}` : ''}.`),
      h('p', { class: 'hoja-texto chiquito' }, `El dibujo de ayer se puede terminar gratis hasta las ${d.horasDeGracia}:00 a. m. Un día que pospusiste no se recupera con comodín.`)),
    acciones: [{ texto: 'Entendido', clase: 'sol' }],
  });
}

// Al tocar la racha: qué nivel tiene el fondo y cuál sigue.
function explicarRacha(d) {
  const siguientes = [[4, 'el fondo se pone rosadito'], [8, 'aparecen corazones'], [16, 'más corazones y chispitas'], [31, 'burbujas de luz'], [60, '¡todo al máximo!']];
  const prox = siguientes.find(([n]) => d.racha < n);
  hoja({
    titulo: `${d.racha} ${d.racha === 1 ? 'día' : 'días'} seguidos 🔥`,
    contenido: h('div', null,
      h('p', { class: 'hoja-texto' }, d.nivelRacha ? `El fondo está «${NOMBRES_NIVEL[d.nivelRacha]}». La postal también lo lleva.` : 'Mientras más días seguidos dibujen los dos, más bonito se pone el fondo (y la postal).'),
      prox && h('p', { class: 'hoja-texto' }, `A los ${prox[0]} días: ${prox[1]}. ¡Faltan ${prox[0] - d.racha}!`),
      h('p', { class: 'hoja-texto chiquito' }, 'Si un día no pueden, se puede posponer: la racha se congela hasta el día siguiente.')),
    acciones: [{ texto: '¡A seguir!', clase: 'sol' }],
  });
}

// La tarjeta de "¿Se te pasó un día?" con los días que se pueden recuperar.
function tarjetaPerdidos(d) {
  const perdidos = d.perdidos || [];
  if (!perdidos.length) return null;
  const { quedan, proximo } = d.comodines;
  const gratis = perdidos.some((p) => p.gratis);
  let texto;
  if (gratis) texto = `El de ayer todavía lo puedes terminar gratis, hasta las ${d.horasDeGracia}:00 a. m.`;
  else if (quedan > 0) texto = `Dibújalo con un comodín 🎟️ y la racha sigue. ${teQuedan(quedan)}.`;
  else texto = `No te quedan comodines 😿${proximo ? ` El próximo llega el ${fechaCorta(proximo)}.` : ''}`;
  return h('section', { class: 'perdidos', 'aria-label': 'Días que se te pasaron' },
    h('p', { class: 'perdidos-titulo' }, perdidos.length === 1 ? '¿Se te pasó un día?' : `Se te pasaron ${perdidos.length} días`),
    h('p', { class: 'perdidos-texto' }, texto),
    h('div', { class: 'perdidos-dias' }, perdidos.map((p) => {
      const puede = p.gratis || quedan > 0;
      const contenido = [h('strong', null, nombreCortoDia(p.fecha, d.fecha).replace(/^el /, '')), h('span', null, p.tema), p.gratis && h('em', null, 'gratis')];
      return puede
        ? h('a', { class: 'perdido', href: `#/dibujar/${p.fecha}`, 'aria-label': `Dibujar el del ${fechaLarga(p.fecha)}: ${p.tema}` }, contenido)
        : h('span', { class: 'perdido bloqueado' }, contenido);
    })));
}

// ================================================================== hoy
async function pantallaHoy(cont, vigente) {
  let [datos, reto, pregunta] = await Promise.all([api.hoy(), api.reto().catch(() => null), api.pregunta().catch(() => null)]);
  if (!vigente()) return undefined;
  reto = reto && reto.reto;

  const pantalla = h('main', { class: 'pantalla hoy' });
  cont.append(pantalla, barraNav('hoy'));
  const claveReveal = () => `garabatos-reveal-${sesion.yo.id}-${datos.fecha}`;
  const yaVisto = () => { try { return localStorage.getItem(claveReveal()) === '1'; } catch { return false; } };
  const marcarVisto = () => { try { localStorage.setItem(claveReveal(), '1'); } catch { /* sin almacenamiento */ } };
  const avisos = controlAvisos(sesion);
  // Estos se crean una sola vez y se vuelven a poner en cada repintado, así no se
  // pierde lo que estés escribiendo en la notita ni se reinicia la mascota.
  const mascota = crearMascota({ saludo: `☁️ ¡Hola, ${sesion.yo.nombre}! Soy el perrito nube 💛` });
  let panel = null;
  let polaroidSuya = null;
  let primeraVez = true;

  const quien = (cuenta, listo, pospuso) => h('li', { class: `quien ${listo ? 'listo' : ''} ${pospuso ? 'pospuso' : ''}` },
    caritaDe(cuenta, 'chica', listo ? 'normal' : pospuso ? 'desanimado' : 'triste'),
    h('span', { class: 'quien-texto' }, h('strong', null, cuenta.nombre), listo ? ' ya dibujó' : pospuso ? ' lo pospuso' : ' todavía no dibuja'));

  function hablaGarabatito() {
    const { texto, animo } = queDiceGarabatito(datos, reto);
    mascota.animo(animo);
    mascota.decir(texto);
  }

  // Cuando reacciono al dibujo de mi pareja: la pegatina cambia al instante.
  function alReaccionar(nota, { animar } = {}) {
    datos.notas = { ...datos.notas, suyo: nota };
    repegar(polaroidSuya, nota);
    hablaGarabatito();
    if (animar) mascota.saltar();
  }

  function pintar() {
    const { fecha, tema, yoListo, parejaListo, racha, diasParaReinicio } = datos;
    const notas = datos.notas || {};
    const pos = datos.posponer || {};
    ponerRacha(datos.nivelRacha);
    rachaParaPostal = { dias: racha, nivel: datos.nivelRacha || 0 };
    const hijos = [
      h('header', { class: 'cabecera' }, h('p', { class: 'fecha' }, fechaLarga(fecha)), botonPerfil()),
      h('div', { class: 'chips-hoy' },
        racha > 0 && h('button', { type: 'button', class: `racha nivel-${datos.nivelRacha || 0}`, onclick: () => explicarRacha(datos) },
          icono('corazon', { relleno: true }), `${racha} ${racha === 1 ? 'día' : 'días'} dibujando juntos`),
        datos.comodines && h('button', {
          type: 'button', class: 'comodines-chip', onclick: () => explicarComodines(datos),
          'aria-label': `${comodinesTexto(datos.comodines.quedan)}. Toca para saber qué son.`,
        }, '🎟️ ', comodinesTexto(datos.comodines.quedan)),
        h('a', { class: 'monedas-chip', href: '#/casa', 'aria-label': `${datos.monedas || 0} monedas para la casa` }, '🪙 ', String(datos.monedas || 0))),
      h('section', { class: `tema ${primeraVez ? 'entra' : ''}`, 'aria-label': 'Tema de hoy' },
        h('p', { class: 'tema-intro' }, 'Hoy toca dibujar'),
        h('h1', { class: 'tema-texto' }, tema),
        datos.temaElegidoPor && h('p', { class: 'tema-eligio' }, datos.temaElegidoPor === sesion.yo.id ? '🎲 Este tema lo elegiste tú' : `🎲 Lo eligió ${sesion.pareja.nombre}`)),
      mascota.el,
      ...(pos.pendientes || []).map((p) => tarjetaPendiente(p, fecha)),
    ];

    if (!yoListo) {
      if (pos.mio) {
        hijos.push(
          tarjetaPospuesto({ cuenta: sesion.yo, p: pos.mio, mia: true, extra: h('p', { class: 'pospuesto-nota' }, 'Mañana te tocan dos dibujos: este y el de mañana.') }),
          h('a', { href: '#/dibujar', class: 'boton blanco grande secundario' }, icono('pluma'), 'Dibujar igual'));
      } else {
        hijos.push(
          h('ul', { class: 'quienes' }, quien(sesion.yo, false, false), quien(sesion.pareja, parejaListo, Boolean(pos.suyo))),
          h('a', { href: '#/dibujar', class: 'boton fresa grande' }, icono('pluma'), hayBorrador(claveBorrador(fecha)) ? 'Seguir dibujando' : '¡A dibujar!'),
          h('button', {
            type: 'button', class: `posponer-boton ${pos.puedo ? '' : 'no-se-puede'}`,
            onclick: () => (pos.puedo ? hojaPosponer({ motivos: pos.motivos, largoTexto: pos.largoTexto, alListo: refrescar }) : explicarPorQueNo(pos.porque)),
          }, icono('luna'), 'Hoy no puedo… posponer'));
      }
    } else {
      const nuevo = Boolean(datos.parejaV) && !yaVisto();
      const { mio, suyo } = marcosDelDia({
        fecha, tema, miV: datos.miV, parejaV: datos.parejaV, nuevo, fuente: desdeElServidor, notaMia: notas.mio, notaSuya: notas.suyo, pospuso: Boolean(pos.suyo),
      });
      polaroidSuya = datos.parejaV ? suyo : null;
      if (datos.parejaV) {
        if (!panel || panel.fecha !== fecha) panel = panelReaccion({ fecha, pareja: sesion.pareja, nota: notas.suyo, alCambiar: alReaccionar });
        else panel.actualizar(notas.suyo);
      }
      const esperando = pos.suyo ? `${sesion.pareja.nombre} pospuso el suyo: lo verás cuando lo haga (mañana).` : `Cuando ${sesion.pareja.nombre} termine el suyo, aparece aquí.`;
      hijos.push(
        h('section', { class: 'revelado' },
          h('h2', { class: 'revelado-titulo' }, datos.parejaV ? 'Los dibujos de hoy' : 'Tu dibujo ya está guardado'),
          !datos.parejaV && h('p', { class: 'revelado-texto' }, esperando),
          h('div', { class: 'polaroids' }, mio, suyo),
          burbuja(sesion.pareja, notas.mio),
          datos.parejaV && panel.el,
          datos.parejaV && botonPostal(() => ({
            fecha, tema, miV: datos.miV, parejaV: datos.parejaV, notaMia: (datos.notas || {}).mio, notaSuya: (datos.notas || {}).suyo, fuente: desdeElServidor,
          }))));
      if (nuevo) {
        marcarVisto();
        setTimeout(() => { lluviaDeCorazones(); mascota.saltar(); }, 450);
      }
    }

    if (pos.suyo) hijos.push(tarjetaPospuesto({ cuenta: sesion.pareja, p: pos.suyo, mia: false, alAnimar: mandarAnimos }));
    if ((pos.suyosPendientes || []).length) {
      hijos.push(h('p', { class: 'nota-suave' }, `⏰ Hoy ${sesion.pareja.nombre} tiene que hacer también el que pospuso ayer.`));
    }
    hijos.push(reto && tarjetaReto(reto), pregunta && tarjetaPregunta(pregunta, { alCambiar: (p) => { pregunta = p; } }));
    hijos.push(tarjetaPerdidos(datos), avisos.el);

    if (diasParaReinicio <= 30) {
      hijos.push(h('a', { href: '#/calendario', class: 'aviso-anio' },
        diasParaReinicio === 0
          ? 'Hoy es el último día del año. Mañana los dibujos se borran: guarden los que quieran conservar.'
          : `El 31 de diciembre empieza un año nuevo y los dibujos se borran. Guarden los que quieran conservar (faltan ${diasParaReinicio} ${diasParaReinicio === 1 ? 'día' : 'días'}).`));
    }
    pantalla.replaceChildren(...hijos.filter(Boolean));
    hablaGarabatito();
    primeraVez = false;
  }

  async function refrescar() {
    try {
      const [nuevo, r] = await Promise.all([api.hoy(), api.reto().catch(() => null)]);
      if (!vigente()) return;
      datos = nuevo;
      if (r) reto = r.reto;
      pintar();
    } catch (e) {
      if (e.estado === 401) { ponerSesion(null); navegar('entrar'); }
    }
  }

  // Si ya terminé, el borrador local sobra.
  if (datos.yoListo) limpiarBorradores(claveBorrador(datos.fecha));

  pintar();
  // Si ya terminé y mi pareja todavía no, reviso cada rato si ya lo hizo.
  const cada = setInterval(() => {
    if (!document.hidden && datos.yoListo && !datos.parejaV) refrescar();
  }, 12000);
  const alVolver = () => { if (!document.hidden) { refrescar(); avisos.actualizar(); } };
  document.addEventListener('visibilitychange', alVolver);
  return () => { clearInterval(cada); document.removeEventListener('visibilitychange', alVolver); };
}

// ================================================================== dibujar
// El dibujo del día. `fechaRecuperar`: dibujar un día que se te pasó (con un comodín, o
// gratis si es el de ayer y todavía es de madrugada) o uno que pospusiste (gratis).
async function modoDiario(fechaRecuperar) {
  const datos = await api.hoy();
  ponerRacha(datos.nivelRacha);
  let recuperando = null;
  let pospuesto = null;
  if (fechaRecuperar) {
    pospuesto = ((datos.posponer || {}).pendientes || []).find((p) => p.fecha === fechaRecuperar) || null;
    recuperando = pospuesto ? null : (datos.perdidos || []).find((p) => p.fecha === fechaRecuperar) || null;
    if (!pospuesto && (!recuperando || (!recuperando.gratis && datos.comodines.quedan < 1))) {
      aviso(recuperando ? 'No te quedan comodines para recuperar ese día.' : 'Ese día ya no se puede dibujar.', 3600);
      navegar('hoy');
      return null;
    }
  } else if (datos.yoListo) { navegar('hoy'); return null; }

  const { fecha, tema } = pospuesto || recuperando || datos;
  if (!fechaRecuperar) {
    // Se guardan solo los borradores de días que todavía se pueden dibujar.
    const vigentes = [fecha, ...(datos.perdidos || []).map((p) => p.fecha), ...((datos.posponer || {}).pendientes || []).map((p) => p.fecha)].map(claveBorrador);
    limpiarBorradores(`${sesion.yo.id}-`, vigentes);
  }

  // ¿Este dibujo gasta un comodín? (el de ayer es gratis solo hasta las `horasDeGracia`)
  const cuestaComodin = () => Boolean(recuperando) && !(recuperando.gratis && new Date().getHours() < datos.horasDeGracia);

  async function guardar(lienzo, ui, conComodin) {
    ui.ocupado(true);
    try {
      const r = await api.terminar({ fecha, imagen: lienzo.exportarFinal(), ...(conComodin ? { comodin: true } : {}) });
      if (recuperando) setTimeout(() => aviso('¡Día recuperado! 🎟️ La racha sigue.', 3600), 300);
      if (pospuesto) setTimeout(() => aviso('¡Listo el que pospusiste! 💪 La racha sigue.', 3600), 300);
      monedasGanadas(r.monedas);
      return true;
    } catch (e) {
      ui.ocupado(false);
      if (e.estado === 409) return true;
      if (e.estado === 401) { ponerSesion(null); navegar('entrar'); return false; }
      if (e.estado === 403 && e.datos.error === 'sin_comodines') {
        aviso('Ya no te quedan comodines 😿 El dibujo queda guardado solo en este aparato.', 4800);
        return false;
      }
      if (e.estado === 400 && e.datos.error === 'pospuesto_vencido') {
        aviso('Ya pasó el plazo del día pospuesto 😿 Ese ya no se puede guardar.', 4800);
        return false;
      }
      // Empezaste ayer, la medianoche te agarró dibujando y ya pasó la hora de gracia:
      // se puede guardar igual, con un comodín.
      if (e.estado === 400 && e.datos.error === 'fecha_invalida' && !conComodin) {
        const usar = await confirmar({
          titulo: 'Ya pasó la hora para terminar el de ayer',
          texto: datos.comodines.quedan > 0
            ? `¿Usar 1 comodín 🎟️ para guardarlo? (te ${datos.comodines.quedan === 1 ? 'queda 1' : `quedan ${datos.comodines.quedan}`})`
            : 'No te quedan comodines, así que no se puede guardar 😿',
          no: 'Ahora no', si: datos.comodines.quedan > 0 ? 'Usar comodín' : 'Entendido',
        });
        if (usar && datos.comodines.quedan > 0) return guardar(lienzo, ui, true);
        return false;
      }
      aviso(e.estado === 400
        ? 'No se pudo guardar: el dibujo no es válido. Prueba a terminar de nuevo.'
        : 'No se pudo guardar el dibujo. Revisa la conexión e inténtalo otra vez.', 4200);
      return false;
    }
  }

  const quedan = datos.comodines.quedan;
  return {
    chip: {
      texto: pospuesto ? `⏰ ${tema}` : recuperando ? `🎟️ ${tema}` : tema,
      clase: pospuesto || recuperando ? 'recuperando' : '',
      alTocar: () => aviso(pospuesto || recuperando ? `${fechaLarga(fecha)}: ${tema}` : tema, 4000),
    },
    borrador: claveBorrador(fecha),
    alEntrar: pospuesto ? `⏰ Estás haciendo el que pospusiste (${fechaLarga(fecha)})` : recuperando ? `🎟️ Estás dibujando el del ${fechaLarga(fecha)}` : null,
    volver: 'hoy',
    async terminar(lienzo, ui) {
      const si = await confirmar(pospuesto
        ? { titulo: '¿Terminar el que pospusiste?', texto: 'No gasta comodín. Después ya no se puede cambiar.', no: 'Seguir dibujando', si: 'Terminar' }
        : recuperando
          ? {
            titulo: `¿Terminar el dibujo del ${fechaLarga(fecha)}?`,
            texto: cuestaComodin()
              ? `Se usará 1 comodín 🎟️ (te ${quedan === 1 ? 'queda 1' : `quedan ${quedan}`}; después, ${quedan - 1}). Ya no se podrá cambiar.`
              : 'Todavía es gratis: no gasta comodín. Ya no se podrá cambiar.',
            no: 'Seguir dibujando', si: cuestaComodin() ? 'Usar comodín' : 'Terminar',
          }
          : {
            titulo: '¿Terminar el dibujo de hoy?',
            texto: `Después ya no se puede cambiar. ${sesion.pareja.nombre} podrá verlo cuando termine el suyo.`,
            no: 'Seguir dibujando', si: 'Terminar',
          });
      if (!si) return false;
      return guardar(lienzo, ui, Boolean(recuperando));
    },
  };
}

// ================================================================== calendario
// Al entrar a un mes aparece un papel que dice "Cargando…" mientras se baja todo el mes:
// los días, las miniaturas y los dibujos completos. Cuando termina, se ve el calendario
// y al tocar un día los dibujos abren al instante.

function papelDeCarga() {
  const contador = h('p', { class: 'papel-contador' }, '');
  const papel = h('div', { class: 'papel-carga', role: 'status', 'aria-live': 'polite' },
    h('span', { class: 'papel-cinta', 'aria-hidden': 'true' }),
    h('p', { class: 'papel-titulo' }, 'Cargando…'),
    h('span', { class: 'papel-garabato', 'aria-hidden': 'true' }),
    contador);
  return { papel, avance: (n, total) => { contador.textContent = total ? `${n} de ${total} ${total === 1 ? 'dibujo' : 'dibujos'}` : ''; } };
}

const MOTIVO_TEXTO = { ocupado: 'estaba ocupado', mal: 'se sentía mal' };

async function pantallaCalendario(cont, vigente) {
  const hoyDatos = await api.hoy();
  if (!vigente()) return undefined;
  ponerRacha(hoyDatos.nivelRacha);
  rachaParaPostal = { dias: hoyDatos.racha, nivel: hoyDatos.nivelRacha || 0 };

  const pantalla = h('main', { class: 'pantalla calendario' });
  cont.append(pantalla, barraNav('calendario'));

  const anioActual = partes(hoyDatos.fecha)[0];
  let mes = partes(hoyDatos.fecha)[1];
  const hoyFecha = hoyDatos.fecha;
  const completas = new Map(); // "fecha/quien" -> dirección local (blob:) del dibujo completo
  let carga = 0;

  const cuerpo = h('div', { class: 'calendario-cuerpo' });
  const flecha = (texto, derecha, destino) => h('button', {
    type: 'button', class: `mes-flecha ${derecha ? 'derecha' : ''}`, 'aria-label': texto,
    disabled: derecha ? mes === 12 : mes === 1,
    onclick: () => { mes += destino; mostrar(); },
  }, icono('volver'));

  function cabecera() {
    return h('header', { class: 'mes-cabecera' },
      flecha('Mes anterior', false, -1),
      h('h1', { class: 'mes-nombre' }, MESES[mes - 1], h('span', { class: 'mes-anio' }, ` ${anioActual}`)),
      flecha('Mes siguiente', true, 1));
  }

  const fuenteLocal = (fecha, cuenta, v) => completas.get(`${fecha}/${cuenta.id}`) || urlDibujo(fecha, cuenta.id, v);

  function abrirDia(d) {
    const visible = Boolean(d.pareja && d.pareja.visible);
    const notaMia = (d.yo && d.yo.nota) || null;
    const posp = d.pospuesto || {};
    const { mio, suyo } = marcosDelDia({
      fecha: d.fecha, tema: d.tema,
      miV: d.yo?.v, parejaV: visible ? d.pareja.v : null,
      fuente: fuenteLocal, notaMia, notaSuya: visible ? d.pareja.nota : null,
      pospuse: Boolean(posp.yo), pospuso: Boolean(posp.pareja),
    });
    // Si reacciono aquí, se guarda en `d` para que al volver a abrir el día ya esté.
    const panel = visible && panelReaccion({
      fecha: d.fecha,
      pareja: sesion.pareja,
      nota: d.pareja.nota,
      alCambiar: (nota) => { d.pareja.nota = nota; repegar(suyo, nota); },
    });
    // ¿Se me pasó este día y todavía lo puedo recuperar? (o lo pospuse y estoy a tiempo)
    const perdido = !d.yo && (hoyDatos.perdidos || []).find((p) => p.fecha === d.fecha);
    const pendiente = !d.yo && ((hoyDatos.posponer || {}).pendientes || []).find((p) => p.fecha === d.fecha);
    const puedoRecuperar = perdido && (perdido.gratis || hoyDatos.comodines.quedan > 0);
    const notas = [
      d.temaElegidoPor && (d.temaElegidoPor === sesion.yo.id ? '🎲 Ese tema lo elegiste tú.' : `🎲 Ese tema lo eligió ${sesion.pareja.nombre}.`),
      d.yo?.recuperado && '🎟️ Lo recuperaste con un comodín.',
      visible && d.pareja.recuperado && `🎟️ ${sesion.pareja.nombre} lo recuperó con un comodín.`,
      posp.yo && `⏸ Lo pospusiste porque ${MOTIVO_TEXTO[posp.yo.motivo] === 'estaba ocupado' ? 'estabas ocupado' : 'te sentías mal'} (${posp.yo.nivel}/10): «${posp.yo.texto}».`,
      posp.pareja && `⏸ ${sesion.pareja.nombre} lo pospuso porque ${MOTIVO_TEXTO[posp.pareja.motivo] || 'no pudo'} (${posp.pareja.nivel}/10): «${posp.pareja.texto}».`,
      d.pareja && !visible && posp.pendiente && `Verás el de ${sesion.pareja.nombre} cuando hagas el tuyo.`,
    ].filter(Boolean);
    hoja({
      titulo: fechaLarga(d.fecha),
      clase: 'hoja-dia',
      contenido: h('div', null,
        h('p', { class: 'hoja-tema' }, d.tema ? `Ese día tocó dibujar ${d.tema}.` : ''),
        h('div', { class: 'polaroids chicos' }, mio, suyo),
        notas.length > 0 && h('div', { class: 'hoja-recuperado' }, notas.map((n) => h('p', null, n))),
        pendiente && h('p', { class: 'hoja-recuperado' }, `Todavía lo puedes dibujar (sin comodín) hasta el ${fechaCorta(pendiente.hasta)} ⏰`),
        perdido && h('p', { class: 'hoja-recuperado' }, puedoRecuperar
          ? (perdido.gratis ? 'Todavía lo puedes dibujar gratis 🏃' : `Puedes dibujarlo con un comodín 🎟️ (${teQuedan(hoyDatos.comodines.quedan).toLowerCase()}).`)
          : 'Se te pasó, y no te quedan comodines 😿'),
        burbuja(sesion.pareja, notaMia),
        panel && panel.el,
        (d.yo || visible) && botonPostal(() => ({
          fecha: d.fecha, tema: d.tema, miV: d.yo?.v, parejaV: visible ? d.pareja.v : null,
          notaMia, notaSuya: visible ? d.pareja.nota : null, fuente: fuenteLocal,
        }))),
      acciones: pendiente
        ? [{ texto: 'Cerrar', clase: 'blanco' }, { texto: '⏰ Dibujarlo', clase: 'fresa', onClick: () => navegar(`dibujar/${d.fecha}`) }]
        : puedoRecuperar
          ? [{ texto: 'Cerrar', clase: 'blanco' }, { texto: '🎟️ Dibujarlo', clase: 'fresa', onClick: () => navegar(`dibujar/${d.fecha}`) }]
          : [{ texto: 'Cerrar', clase: 'sol' }],
    });
  }

  function pintarMes(respuesta, clave) {
    const huecos = diaSemana(`${clave}-01`);
    const celdas = [];
    for (let i = 0; i < huecos; i += 1) celdas.push(h('li', { class: 'hueco', 'aria-hidden': 'true' }));

    for (const d of respuesta.dias) {
      const esHoy = d.fecha === hoyFecha;
      const miniaturas = [];
      if (d.yo) miniaturas.push(h('img', { class: 'mini mia', src: d.yo.mini, alt: '', draggable: 'false' }));
      if (d.pareja?.visible) miniaturas.push(h('img', { class: 'mini suya', src: d.pareja.mini, alt: '', draggable: 'false' }));
      else if (d.pareja) miniaturas.push(h('span', { class: 'mini suya sorpresa' }, icono('sobre')));
      const posp = d.pospuesto || {};
      const marquita = (posp.yo && !d.yo) || (posp.pareja && !d.pareja) ? h('span', { class: 'dia-pospuesto', 'aria-hidden': 'true' }, '⏸') : null;

      const etiqueta = `${fechaLarga(d.fecha)}${d.yo ? ', tu dibujo está terminado' : ''}${d.pareja ? `, ${sesion.pareja.nombre} terminó el suyo` : ''}${posp.yo || posp.pareja ? ', con un dibujo pospuesto' : ''}`;
      celdas.push(h('li', null, h('button', {
        type: 'button',
        class: `dia ${esHoy ? 'hoy' : ''} ${d.futuro ? 'futuro' : ''} ${d.yo || d.pareja ? 'con-dibujos' : ''}`,
        disabled: d.futuro,
        'aria-label': etiqueta,
        onclick: () => (esHoy ? navegar('hoy') : abrirDia(d)),
      }, h('span', { class: 'dia-numero' }, Number(d.fecha.slice(8))), marquita, miniaturas.length ? h('span', { class: 'minis' }, miniaturas) : null)));
    }

    cuerpo.replaceChildren(
      h('ol', { class: 'semana', 'aria-hidden': 'true' }, DIAS_CORTOS.map((n) => h('li', null, n))),
      h('ol', { class: 'mes' }, celdas),
      h('p', { class: 'calendario-pie' }, 'Toca un día para ver sus dibujos. ⏸ = alguien lo pospuso.'));
  }

  async function mostrar() {
    const mia = ++carga;
    const clave = `${anioActual}-${String(mes).padStart(2, '0')}`;
    pantalla.replaceChildren(cabecera(), cuerpo);
    const { papel, avance } = papelDeCarga();
    cuerpo.replaceChildren(papel);

    let respuesta;
    try {
      respuesta = await api.mes(clave);
    } catch (e) {
      if (mia !== carga || !vigente()) return;
      if (e.estado === 401) { ponerSesion(null); navegar('entrar'); return; }
      cuerpo.replaceChildren(
        h('p', { class: 'vacio' }, 'No se pudo cargar el mes. Revisa la conexión.'),
        h('button', { type: 'button', class: 'boton sol', onclick: mostrar }, 'Reintentar'));
      return;
    }
    if (mia !== carga || !vigente()) return;

    // Todo lo que hay que bajar: la miniatura (ya viene en la respuesta) y el dibujo completo.
    const tareas = [];
    const agregar = (fecha, cuenta, dibujo) => tareas.push(async () => {
      const miniatura = new Image();
      miniatura.src = dibujo.mini;
      await miniatura.decode().catch(() => {});
      const clavePropia = `${fecha}/${cuenta.id}`;
      if (completas.has(clavePropia)) return;
      try {
        const r = await fetch(urlDibujo(fecha, cuenta.id, dibujo.v), { credentials: 'same-origin' });
        if (r.ok) completas.set(clavePropia, URL.createObjectURL(await r.blob()));
      } catch { /* si falla, al tocar el día se pide de nuevo */ }
    });
    for (const d of respuesta.dias) {
      if (d.yo) agregar(d.fecha, sesion.yo, d.yo);
      if (d.pareja?.visible) agregar(d.fecha, sesion.pareja, d.pareja);
    }

    let hechas = 0;
    let siguiente = 0;
    avance(0, tareas.length);
    const trabajador = async () => {
      while (siguiente < tareas.length && mia === carga) {
        const tarea = tareas[siguiente++];
        // eslint-disable-next-line no-await-in-loop
        await tarea();
        hechas += 1;
        if (mia === carga) avance(hechas, tareas.length);
      }
    };
    await Promise.all(Array.from({ length: Math.min(6, tareas.length) }, trabajador));
    if (mia !== carga || !vigente()) return;
    pintarMes(respuesta, clave);
  }

  await mostrar();
  return () => {
    carga += 1;
    for (const url of completas.values()) URL.revokeObjectURL(url);
    completas.clear();
  };
}

// ================================================================== versión nueva
// En iPhone, la app instalada puede quedarse "dormida" en memoria con el código viejo:
// al tocar el ícono vuelve tal como estaba, sin bajar nada nuevo. Por eso, al volver a
// abrirla (y al cambiar de pantalla) se pregunta al servidor qué versión hay publicada;
// si cambió, la página se recarga sola. Mientras dibujas no: espera a que salgas.
const AVISO_ACTUALIZADA = 'garabatos-actualizada';
let versionCargada = null;
let hayVersionNueva = false;
let ultimaRevision = 0;
const dibujandoAhora = () => /^#\/(dibujar|reto\/dibujar|casa\/personaje)/.test(location.hash);

function recargarSiToca() {
  if (!hayVersionNueva || dibujandoAhora()) return false;
  try { sessionStorage.setItem(AVISO_ACTUALIZADA, '1'); } catch { /* sin almacenamiento */ }
  location.reload();
  return true;
}

async function revisarVersion({ ya = false } = {}) {
  if (!ya && Date.now() - ultimaRevision < 30_000) return;
  ultimaRevision = Date.now();
  try {
    const { version } = await api.version();
    if (!versionCargada) versionCargada = version;
    else if (version !== versionCargada) { hayVersionNueva = true; recargarSiToca(); }
  } catch { /* sin conexión: se revisa la próxima vez */ }
}

document.addEventListener('visibilitychange', () => { if (!document.hidden) revisarVersion({ ya: true }); });
try {
  if (sessionStorage.getItem(AVISO_ACTUALIZADA)) {
    sessionStorage.removeItem(AVISO_ACTUALIZADA);
    setTimeout(() => aviso('¡Garabatos se actualizó! ✨'), 700);
  }
} catch { /* sin almacenamiento */ }

// ================================================================== router
// #/hoy · #/dibujar[/fecha] · #/calendario · #/reto[/dibujar] · #/casa[/personaje] · #/nosotros
const PANTALLAS = {
  hoy: pantallaHoy,
  calendario: pantallaCalendario,
  nosotros: pantallaNosotros,
  async dibujar(cont, vigente, fecha) {
    const modo = await modoDiario(fecha);
    if (!modo || !vigente()) return undefined;
    return pantallaLienzo(cont, vigente, modo);
  },
  async reto(cont, vigente, sub) {
    if (sub !== 'dibujar') return pantallaReto(cont, vigente);
    const modo = await modoReto();
    if (!modo || !vigente()) return undefined;
    return pantallaLienzo(cont, vigente, modo);
  },
  // La casa (con Three.js) se baja solo cuando se entra a ella.
  async casa(cont, vigente, sub) {
    const casa = await import('./casa/casa.js');
    if (!vigente()) return undefined;
    if (sub !== 'personaje') return casa.pantallaCasa(cont, vigente);
    const modo = await casa.modoPersonaje();
    if (!modo || !vigente()) return undefined;
    return pantallaLienzo(cont, vigente, modo);
  },
};

async function ir() {
  if (recargarSiToca()) return;
  revisarVersion();
  generacion += 1;
  const mia = generacion;
  const vigente = () => mia === generacion;

  if (soltar) { const f = soltar; soltar = null; try { await f(); } catch { /* ya se fue */ } }
  if (!vigente()) return;

  raiz.replaceChildren();
  document.body.classList.remove('modo-dibujo');
  const [ruta, parametro] = (location.hash.replace(/^#\//, '') || 'hoy').split('/');

  try {
    if (!sesion) {
      try { ponerSesion(await pedirSesion()); } catch (e) { if (e.estado !== 401) throw e; }
    }
    if (!vigente()) return;

    if (!sesion) {
      if (ruta !== 'entrar') { location.replace('#/entrar'); return; }
      ponerRacha(0);
      soltar = pantallaEntrar(raiz);
      return;
    }
    if (ruta === 'entrar') { location.replace('#/hoy'); return; }
    sincronizarAvisos(sesion.yo);
    // La cartita de novedades (una sola vez), cuando no se está dibujando.
    if (sesion.novedades && !dibujandoAhora()) {
      const { de } = sesion.novedades;
      sesion.novedades = null;
      setTimeout(() => mostrarNovedades(sesion, { de }), 900);
    }

    const construir = PANTALLAS[ruta];
    if (!construir) { location.replace('#/hoy'); return; }
    const limpieza = await construir(raiz, vigente, parametro);
    if (!vigente()) { if (limpieza) limpieza(); return; }
    soltar = limpieza || null;
  } catch (e) {
    if (!vigente()) return;
    if (e.estado === 401) { ponerSesion(null); location.replace('#/entrar'); return; }
    console.error(e);
    raiz.replaceChildren(h('main', { class: 'pantalla' },
      h('p', { class: 'vacio' }, 'No se pudo conectar con el servidor. Revisa tu conexión.'),
      h('button', { type: 'button', class: 'boton sol', onclick: ir }, 'Reintentar')));
  }
}

alNavegar(ir);
rachaInicial();
window.addEventListener('hashchange', ir);
// Evita el zoom por pellizco de iOS fuera del lienzo.
document.addEventListener('gesturestart', (e) => e.preventDefault());
ir();
