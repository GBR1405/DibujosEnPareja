import { api, urlDibujo } from './api.js';
import { h, aviso, hoja, confirmar, lluviaDeCorazones } from './ui.js';
import { icono, carita } from './iconos.js';
import { crearLienzo } from './lienzo.js';

const raiz = document.getElementById('app');
let sesion = null; // { yo, pareja }
let soltar = null; // limpieza de la pantalla actual
let generacion = 0;

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const DIAS_CORTOS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

const partes = (fecha) => fecha.split('-').map(Number);
const diaSemana = (fecha) => { const [a, m, d] = partes(fecha); return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); };
function fechaLarga(fecha) {
  const [, m, d] = partes(fecha);
  return `${DIAS[diaSemana(fecha)]} ${d} de ${MESES[m - 1]}`;
}

const caritaDe = (cuenta, clase = '', triste = false) => {
  const el = h('span', { class: `cara ${clase}`, style: { '--color': cuenta.color } });
  el.innerHTML = carita(cuenta.carita, cuenta.color, triste);
  return el;
};

function navegar(ruta) {
  if (location.hash === `#/${ruta}`) ir(); else location.hash = `#/${ruta}`;
}

// El borrador de hoy se guarda solo en este aparato (el servidor solo recibe el dibujo terminado).
const claveBorrador = (fecha) => `garabatos-borrador-${sesion.yo.id}-${fecha}`;
function hayBorrador(fecha) {
  try { return localStorage.getItem(claveBorrador(fecha)) !== null; } catch { return false; }
}
function limpiarBorradoresViejos(fechaDeHoy) {
  try {
    const prefijo = `garabatos-borrador-${sesion.yo.id}-`;
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith(prefijo) && k !== claveBorrador(fechaDeHoy)) localStorage.removeItem(k);
    }
  } catch { /* sin almacenamiento */ }
}

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
          sesion = await api.yo();
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

// ================================================================== navegación inferior
function barraNav(actual) {
  const enlace = (ruta, nombre, ic) => h('a', {
    href: `#/${ruta}`,
    class: `nav-item ${actual === ruta ? 'activa' : ''}`,
    'aria-current': actual === ruta ? 'page' : null,
  }, icono(ic), h('span', null, nombre));
  return h('nav', { class: 'nav', 'aria-label': 'Secciones' },
    enlace('hoy', 'Hoy', 'hoy'),
    enlace('calendario', 'Calendario', 'calendario'));
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
          onClick: async () => { await api.salir().catch(() => {}); sesion = null; navegar('entrar'); },
        },
      ],
    }),
  }, caritaDe(sesion.yo));
}

// ================================================================== polaroids y visor
function polaroid({ src, nombre, giro, alAbrir, nuevo }) {
  return h('button', {
    type: 'button',
    class: `polaroid ${nuevo ? 'aparece' : ''}`,
    style: { '--giro': giro },
    'aria-label': `Ver el dibujo de ${nombre}`,
    onclick: alAbrir,
  },
  h('img', { src, alt: `Dibujo de ${nombre}`, draggable: 'false' }),
  h('span', { class: 'polaroid-nombre' }, nombre));
}

// Cuando alguien no dibujó ese día: solo su carita triste.
function polaroidTriste({ cuenta, giro }) {
  return h('div', { class: 'polaroid vacia triste', style: { '--giro': giro } },
    h('span', { class: 'polaroid-espera', role: 'img', 'aria-label': `${cuenta.nombre} no ha dibujado` }, caritaDe(cuenta, '', true)),
    h('span', { class: 'polaroid-nombre' }, cuenta.nombre));
}

// El dibujo se baja como PNG, que se abre en cualquier aplicación (el WebP no siempre).
async function guardarImagen(src, nombreArchivo) {
  try {
    const original = await (await fetch(src)).blob();
    const imagen = await new Promise((ok, fallo) => {
      const img = new Image();
      const url = URL.createObjectURL(original);
      img.onload = () => { URL.revokeObjectURL(url); ok(img); };
      img.onerror = fallo;
      img.src = url;
    });
    const c = document.createElement('canvas');
    c.width = imagen.naturalWidth;
    c.height = imagen.naturalHeight;
    c.getContext('2d').drawImage(imagen, 0, 0);
    const png = await new Promise((ok) => { c.toBlob(ok, 'image/png'); });
    const url = URL.createObjectURL(png);
    const a = h('a', { href: url, download: `${nombreArchivo}.png` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  } catch {
    aviso('No se pudo guardar la imagen. Mantén presionada la imagen para guardarla.');
  }
}

function abrirVisor({ src, nombre, titulo, archivo }) {
  const visor = h('div', { class: 'visor', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Dibujo de ${nombre}` });
  const cerrar = () => { visor.classList.add('se-va'); setTimeout(() => visor.remove(), 200); document.removeEventListener('keydown', alTeclado); };
  function alTeclado(e) { if (e.key === 'Escape') cerrar(); }
  document.addEventListener('keydown', alTeclado);
  visor.append(
    h('div', { class: 'visor-marco' },
      h('img', { src, alt: `Dibujo de ${nombre}` }),
      h('p', { class: 'visor-pie' }, `${nombre} · ${titulo}`)),
    h('div', { class: 'visor-acciones' },
      h('button', { type: 'button', class: 'boton blanco', onclick: () => guardarImagen(src, archivo) }, icono('descargar'), 'Guardar'),
      h('button', { type: 'button', class: 'boton sol', onclick: cerrar }, 'Cerrar')),
  );
  visor.addEventListener('click', (e) => { if (e.target === visor) cerrar(); });
  document.body.append(visor);
}

// Los dos marcos de un día: el mío y el de mi pareja (dibujo o carita triste).
// `fuente(fecha, cuenta, v)` devuelve de dónde cargar la imagen completa.
function marcosDelDia({ fecha, tema, miV, parejaV, nuevo, fuente }) {
  const abrir = (cuenta, v) => () => abrirVisor({
    src: fuente(fecha, cuenta, v),
    nombre: cuenta.nombre,
    titulo: tema,
    archivo: `garabato-${fecha}-${cuenta.nombre.toLowerCase().replace(/\s+/g, '-')}`,
  });
  const mio = miV
    ? polaroid({ src: fuente(fecha, sesion.yo, miV), nombre: sesion.yo.nombre, giro: '-2.2deg', alAbrir: abrir(sesion.yo, miV) })
    : polaroidTriste({ cuenta: sesion.yo, giro: '-2.2deg' });
  const suyo = parejaV
    ? polaroid({ src: fuente(fecha, sesion.pareja, parejaV), nombre: sesion.pareja.nombre, giro: '2.4deg', alAbrir: abrir(sesion.pareja, parejaV), nuevo })
    : polaroidTriste({ cuenta: sesion.pareja, giro: '2.4deg' });
  return { mio, suyo };
}

const desdeElServidor = (fecha, cuenta, v) => urlDibujo(fecha, cuenta.id, v);

// ================================================================== hoy
async function pantallaHoy(cont, vigente) {
  let datos = await api.hoy();
  if (!vigente()) return undefined;

  const pantalla = h('main', { class: 'pantalla hoy' });
  cont.append(pantalla, barraNav('hoy'));
  const claveReveal = () => `garabatos-reveal-${sesion.yo.id}-${datos.fecha}`;
  const yaVisto = () => { try { return localStorage.getItem(claveReveal()) === '1'; } catch { return false; } };
  const marcarVisto = () => { try { localStorage.setItem(claveReveal(), '1'); } catch { /* sin almacenamiento */ } };

  const quien = (cuenta, listo) => h('li', { class: `quien ${listo ? 'listo' : ''}` },
    caritaDe(cuenta, 'chica', !listo),
    h('span', { class: 'quien-texto' }, h('strong', null, cuenta.nombre), listo ? ' ya dibujó' : ' todavía no dibuja'));

  function pintar() {
    const { fecha, tema, yoListo, parejaListo, racha, diasParaReinicio } = datos;
    const hijos = [
      h('header', { class: 'cabecera' }, h('p', { class: 'fecha' }, fechaLarga(fecha)), botonPerfil()),
      racha > 0 && h('p', { class: 'racha' }, icono('corazon', { relleno: true }), `${racha} ${racha === 1 ? 'día' : 'días'} dibujando juntos`),
      h('section', { class: 'tema', 'aria-label': 'Tema de hoy' },
        h('p', { class: 'tema-intro' }, 'Hoy toca dibujar'),
        h('h1', { class: 'tema-texto' }, tema)),
    ];

    if (!yoListo) {
      hijos.push(
        h('ul', { class: 'quienes' }, quien(sesion.yo, false), quien(sesion.pareja, parejaListo)),
        h('a', { href: '#/dibujar', class: 'boton fresa grande' }, icono('pluma'), hayBorrador(fecha) ? 'Seguir dibujando' : '¡A dibujar!'));
    } else {
      const nuevo = Boolean(datos.parejaV) && !yaVisto();
      const { mio, suyo } = marcosDelDia({ fecha, tema, miV: datos.miV, parejaV: datos.parejaV, nuevo, fuente: desdeElServidor });
      hijos.push(
        h('section', { class: 'revelado' },
          h('h2', { class: 'revelado-titulo' }, datos.parejaV ? 'Los dibujos de hoy' : 'Tu dibujo ya está guardado'),
          !datos.parejaV && h('p', { class: 'revelado-texto' }, `Cuando ${sesion.pareja.nombre} termine el suyo, aparece aquí.`),
          h('div', { class: 'polaroids' }, mio, suyo)));
      if (nuevo) {
        marcarVisto();
        setTimeout(() => lluviaDeCorazones(), 450);
      }
    }

    if (diasParaReinicio <= 30) {
      hijos.push(h('a', { href: '#/calendario', class: 'aviso-anio' },
        diasParaReinicio === 0
          ? 'Hoy es el último día del año. Mañana los dibujos se borran: guarden los que quieran conservar.'
          : `El 31 de diciembre empieza un año nuevo y los dibujos se borran. Guarden los que quieran conservar (faltan ${diasParaReinicio} ${diasParaReinicio === 1 ? 'día' : 'días'}).`));
    }
    pantalla.replaceChildren(...hijos.filter(Boolean));
  }

  async function refrescar() {
    try {
      const nuevo = await api.hoy();
      if (!vigente()) return;
      datos = nuevo;
      pintar();
    } catch (e) {
      if (e.estado === 401) { sesion = null; navegar('entrar'); }
    }
  }

  // Si ya terminé, el borrador local sobra.
  if (datos.yoListo) { try { localStorage.removeItem(claveBorrador(datos.fecha)); } catch { /* nada */ } }

  pintar();
  // Si ya terminé y mi pareja todavía no, reviso cada rato si ya lo hizo.
  const cada = setInterval(() => {
    if (!document.hidden && datos.yoListo && !datos.parejaV) refrescar();
  }, 12000);
  const alVolver = () => { if (!document.hidden) refrescar(); };
  document.addEventListener('visibilitychange', alVolver);
  return () => { clearInterval(cada); document.removeEventListener('visibilitychange', alVolver); };
}

// ================================================================== dibujar
const COLORES = [
  ['negro', '#2b2220'], ['gris', '#8c8794'], ['café', '#8a5a3c'], ['piel', '#ffd0b5'],
  ['rojo', '#e8424a'], ['naranja', '#ff8a3d'], ['amarillo', '#ffd23f'], ['verde', '#4cc26b'],
  ['turquesa', '#3fd0c9'], ['azul', '#3d8bff'], ['morado', '#8f5cff'], ['rosa', '#ff7fb0'],
];
const FORMAS = [['linea', 'Línea'], ['circulo', 'Círculo'], ['cuadrado', 'Cuadrado'], ['triangulo', 'Triángulo'], ['corazon', 'Corazón'], ['estrella', 'Estrella']];
const TAMANOS = [['fina', 'Fino'], ['media', 'Mediano'], ['gruesa', 'Grueso']];

function cargarImagen(url) {
  return new Promise((ok, fallo) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = fallo;
    img.src = url;
  });
}

async function pantallaDibujar(cont, vigente) {
  const datos = await api.hoy();
  if (!vigente()) return undefined;
  if (datos.yoListo) { navegar('hoy'); return undefined; }

  const { fecha, tema } = datos;
  const claveLocal = claveBorrador(fecha);
  limpiarBorradoresViejos(fecha);
  document.body.classList.add('modo-dibujo');

  // ---- armado de la pantalla
  const caja = h('div', { class: 'lienzo-caja' });
  const area = h('div', { class: 'area-lienzo' }, caja);
  let lienzo;
  let sucio = false;
  let temporizador = null;
  let terminando = false;
  let cerrado = false; // ya se terminó (o ya estaba terminado): no hay que guardar más borradores

  const botones = {};
  function boton(clave, nombre, ic, alPulsar, extra = {}) {
    const b = h('button', { type: 'button', class: `herramienta ${extra.clase || ''}`, 'aria-label': nombre, title: nombre, onclick: alPulsar }, icono(ic), h('span', { class: 'herramienta-nombre' }, extra.texto || nombre));
    botones[clave] = b;
    return b;
  }

  // Selector de formas (aparece sobre el lienzo al elegir "Formas").
  let selectorForma = null;
  function cerrarSelector() { selectorForma?.remove(); selectorForma = null; }
  function abrirSelector() {
    cerrarSelector();
    const elegida = lienzo.estado.forma;
    selectorForma = h('div', { class: 'selector-formas', role: 'group', 'aria-label': 'Formas' },
      h('div', { class: 'formas-fila' }, FORMAS.map(([id, nombre]) => h('button', {
        type: 'button', class: `forma ${id === elegida ? 'activa' : ''}`, 'aria-label': nombre, 'aria-pressed': id === elegida, title: nombre,
        onclick: () => { lienzo.estado.forma = id; actualizarHerramientas(); cerrarSelector(); },
      }, icono(id)))),
      h('div', { class: 'relleno-fila' },
        h('button', { type: 'button', class: `chip ${!lienzo.estado.relleno ? 'activa' : ''}`, onclick: () => { lienzo.estado.relleno = false; abrirSelector(); } }, 'Contorno'),
        h('button', { type: 'button', class: `chip ${lienzo.estado.relleno ? 'activa' : ''}`, onclick: () => { lienzo.estado.relleno = true; abrirSelector(); } }, 'Relleno')));
    area.append(selectorForma);
  }

  function elegirHerramienta(nombre) {
    if (nombre === 'formas' && lienzo.estado.herramienta === 'formas') {
      if (selectorForma) cerrarSelector(); else abrirSelector();
      return;
    }
    lienzo.estado.herramienta = nombre;
    cerrarSelector();
    actualizarHerramientas();
    if (nombre === 'formas') abrirSelector();
  }

  function actualizarHerramientas() {
    const e = lienzo.estado;
    for (const t of ['pluma', 'formas', 'borrador']) {
      botones[t].classList.toggle('activa', e.herramienta === t);
      botones[t].setAttribute('aria-pressed', e.herramienta === t);
    }
    botones.formas.replaceChildren(icono(e.forma), h('span', { class: 'herramienta-nombre' }, 'Formas'));
    for (const el of dock.querySelectorAll('.color')) {
      const activo = el.dataset.color === e.color;
      el.classList.toggle('activa', activo);
      el.setAttribute('aria-pressed', activo);
    }
    for (const el of dock.querySelectorAll('.tamano')) {
      const activo = el.dataset.tamano === e.grosor;
      el.classList.toggle('activa', activo);
      el.setAttribute('aria-pressed', activo);
    }
  }

  const dock = h('div', { class: 'dock' },
    h('div', { class: 'herramientas' },
      boton('pluma', 'Bolígrafo', 'pluma', () => elegirHerramienta('pluma')),
      boton('formas', 'Formas', 'corazon', () => elegirHerramienta('formas')),
      boton('borrador', 'Borrador', 'borrador', () => elegirHerramienta('borrador')),
      boton('deshacer', 'Deshacer', 'deshacer', () => lienzo.deshacer(), { clase: 'accion separada' }),
      boton('rehacer', 'Rehacer', 'rehacer', () => lienzo.rehacer(), { clase: 'accion' }),
      boton('limpiar', 'Borrar todo', 'basura', async () => {
        if (lienzo.estaVacio()) return;
        const si = await confirmar({ titulo: '¿Borrar todo el dibujo?', texto: 'Si te arrepientes, la flecha de deshacer lo trae de vuelta.', no: 'Cancelar', si: 'Borrar todo' });
        if (si) lienzo.limpiar();
      }, { clase: 'accion' })),
    h('div', { class: 'paleta' },
      h('div', { class: 'colores', role: 'group', 'aria-label': 'Colores' }, COLORES.map(([nombre, hex]) => h('button', {
        type: 'button', class: 'color', 'data-color': hex, style: { '--tono': hex }, 'aria-label': nombre, title: nombre,
        onclick: () => {
          lienzo.estado.color = hex;
          if (lienzo.estado.herramienta === 'borrador') lienzo.estado.herramienta = 'pluma';
          actualizarHerramientas();
        },
      }, h('span', { class: 'color-punto' })))),
      h('div', { class: 'tamanos', role: 'group', 'aria-label': 'Grosor' }, TAMANOS.map(([id, nombre]) => h('button', {
        type: 'button', class: 'tamano', 'data-tamano': id, 'aria-label': nombre, title: nombre,
        onclick: () => { lienzo.estado.grosor = id; actualizarHerramientas(); },
      }, h('span', { class: `tamano-punto t-${id}` }))))));

  const botonTerminar = h('button', { type: 'button', class: 'boton fresa chico', onclick: pedirTerminar }, icono('check'), 'Terminar');

  const pantalla = h('main', { class: 'pantalla dibujar' },
    h('header', { class: 'dibujar-cabecera' },
      h('button', { type: 'button', class: 'volver', 'aria-label': 'Volver a Hoy', onclick: volver }, icono('volver')),
      h('button', { type: 'button', class: 'tema-chip', onclick: () => aviso(tema, 4000), title: tema }, h('span', { class: 'tema-chip-texto' }, tema)),
      botonTerminar),
    area,
    dock);
  cont.append(pantalla);

  lienzo = crearLienzo(caja, {
    alCambiar: ({ puedeDeshacer, puedeRehacer }) => {
      botones.deshacer.disabled = !puedeDeshacer;
      botones.rehacer.disabled = !puedeRehacer;
      programarGuardado();
    },
  });
  botones.deshacer.disabled = true;
  botones.rehacer.disabled = true;
  actualizarHerramientas();

  // ---- borrador en este aparato (no viaja a internet hasta que pulsas "Terminar")
  function programarGuardado() {
    sucio = true;
    clearTimeout(temporizador);
    temporizador = setTimeout(guardarLocal, 1200);
  }

  function guardarLocal() {
    clearTimeout(temporizador);
    if (!sucio || cerrado || terminando) return;
    sucio = false;
    try {
      localStorage.setItem(claveLocal, JSON.stringify({ t: Date.now(), img: lienzo.exportarBorrador() }));
    } catch { /* sin espacio o sin almacenamiento: se sigue sin borrador */ }
  }

  const alOcultar = () => { if (document.hidden) guardarLocal(); };
  document.addEventListener('visibilitychange', alOcultar);
  window.addEventListener('pagehide', guardarLocal);

  // ---- recuperar lo que ya se había dibujado hoy en este aparato
  try {
    const guardado = JSON.parse(localStorage.getItem(claveLocal) || 'null');
    if (guardado?.img) {
      const img = await cargarImagen(guardado.img);
      if (!vigente()) return undefined;
      lienzo.cargarBase(img);
    }
  } catch { /* se empieza en blanco */ }

  // ---- terminar
  async function pedirTerminar() {
    if (terminando) return;
    if (lienzo.estaVacio()) { aviso('Dibuja algo antes de terminar.'); return; }
    const si = await confirmar({
      titulo: '¿Terminar el dibujo de hoy?',
      texto: `Después ya no se puede cambiar. ${sesion.pareja.nombre} podrá verlo cuando termine el suyo.`,
      no: 'Seguir dibujando', si: 'Terminar',
    });
    if (!si) return;
    terminando = true;
    clearTimeout(temporizador);
    botonTerminar.disabled = true;
    botonTerminar.lastChild.textContent = 'Guardando…';
    try {
      await api.terminar({ fecha, imagen: lienzo.exportarFinal() });
      cerrado = true;
      try { localStorage.removeItem(claveLocal); } catch { /* nada */ }
      navegar('hoy');
    } catch (e) {
      terminando = false;
      botonTerminar.disabled = false;
      botonTerminar.lastChild.textContent = 'Terminar';
      if (e.estado === 409) { cerrado = true; try { localStorage.removeItem(claveLocal); } catch { /* nada */ } navegar('hoy'); return; }
      if (e.estado === 401) { sesion = null; navegar('entrar'); return; }
      aviso(e.estado === 400
        ? 'No se pudo guardar: el dibujo no es válido. Prueba a terminar de nuevo.'
        : 'No se pudo guardar el dibujo. Revisa la conexión e inténtalo otra vez.', 4200);
    }
  }

  function volver() {
    guardarLocal();
    navegar('hoy');
  }

  return () => {
    document.removeEventListener('visibilitychange', alOcultar);
    window.removeEventListener('pagehide', guardarLocal);
    cerrarSelector();
    guardarLocal();
    lienzo.destruir();
    document.body.classList.remove('modo-dibujo');
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

async function pantallaCalendario(cont, vigente) {
  const hoyDatos = await api.hoy();
  if (!vigente()) return undefined;

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
    const { mio, suyo } = marcosDelDia({
      fecha: d.fecha, tema: d.tema,
      miV: d.yo?.v, parejaV: d.pareja?.visible ? d.pareja.v : null,
      fuente: fuenteLocal,
    });
    hoja({
      titulo: fechaLarga(d.fecha),
      clase: 'hoja-dia',
      contenido: h('div', null,
        h('p', { class: 'hoja-tema' }, d.tema ? `Ese día tocó dibujar ${d.tema}.` : ''),
        h('div', { class: 'polaroids chicos' }, mio, suyo)),
      acciones: [{ texto: 'Cerrar', clase: 'sol' }],
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

      const etiqueta = `${fechaLarga(d.fecha)}${d.yo ? ', tu dibujo está terminado' : ''}${d.pareja ? `, ${sesion.pareja.nombre} terminó el suyo` : ''}`;
      celdas.push(h('li', null, h('button', {
        type: 'button',
        class: `dia ${esHoy ? 'hoy' : ''} ${d.futuro ? 'futuro' : ''} ${d.yo || d.pareja ? 'con-dibujos' : ''}`,
        disabled: d.futuro,
        'aria-label': etiqueta,
        onclick: () => (esHoy ? navegar('hoy') : abrirDia(d)),
      }, h('span', { class: 'dia-numero' }, Number(d.fecha.slice(8))), miniaturas.length ? h('span', { class: 'minis' }, miniaturas) : null)));
    }

    cuerpo.replaceChildren(
      h('ol', { class: 'semana', 'aria-hidden': 'true' }, DIAS_CORTOS.map((n) => h('li', null, n))),
      h('ol', { class: 'mes' }, celdas),
      h('p', { class: 'calendario-pie' }, 'Toca un día para ver sus dibujos.'));
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
      if (e.estado === 401) { sesion = null; navegar('entrar'); return; }
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

// ================================================================== router
async function ir() {
  generacion += 1;
  const mia = generacion;
  const vigente = () => mia === generacion;

  if (soltar) { const f = soltar; soltar = null; try { await f(); } catch { /* ya se fue */ } }
  if (!vigente()) return;

  raiz.replaceChildren();
  document.body.classList.remove('modo-dibujo');
  const ruta = location.hash.replace(/^#\//, '') || 'hoy';

  try {
    if (!sesion) {
      try { sesion = await api.yo(); } catch (e) { if (e.estado !== 401) throw e; }
    }
    if (!vigente()) return;

    if (!sesion) {
      if (ruta !== 'entrar') { location.replace('#/entrar'); return; }
      soltar = pantallaEntrar(raiz);
      return;
    }
    if (ruta === 'entrar') { location.replace('#/hoy'); return; }

    const pantallas = { hoy: pantallaHoy, dibujar: pantallaDibujar, calendario: pantallaCalendario };
    const construir = pantallas[ruta];
    if (!construir) { location.replace('#/hoy'); return; }
    const limpieza = await construir(raiz, vigente);
    if (!vigente()) { if (limpieza) limpieza(); return; }
    soltar = limpieza || null;
  } catch (e) {
    if (!vigente()) return;
    if (e.estado === 401) { sesion = null; location.replace('#/entrar'); return; }
    raiz.replaceChildren(h('main', { class: 'pantalla' },
      h('p', { class: 'vacio' }, 'No se pudo conectar con el servidor. Revisa tu conexión.'),
      h('button', { type: 'button', class: 'boton sol', onclick: ir }, 'Reintentar')));
  }
}

window.addEventListener('hashchange', ir);
// Evita el zoom por pellizco de iOS fuera del lienzo.
document.addEventListener('gesturestart', (e) => e.preventDefault());
ir();
