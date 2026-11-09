// Cómo se juega cada reto: qué le toca a cada quien, qué puede ver y qué pasa con cada
// acción. Todo lo guardado del reto vive en `datos` (un JSON en la tabla retos):
//
//   datos.imgs      { clave: 'creado' }  qué dibujos ya se hicieron (los guarda retos_imagenes)
//   mitad           imgs.base (quien empieza, mitad izquierda) · imgs.final (el otro, todo)
//   tema            tema, fecha (el día en que se dibuja)
//   garabato        imgs.base (el garabato) · imgs.final · titulo
//   adivina         palabra · imgs.dibujo · intentos [] · acertado (true/false/undefined)
//   colores         para.uno, para.dos (los 3 colores que le eligieron a cada quien) · imgs.uno, imgs.dos
//   memoria         imgs.dibujo · visto (cuándo lo miró el otro) · imgs.copia
//
// Las funciones no tocan la base: reciben el estado y devuelven qué hacer.

const { opcionesDePalabra, adivino } = require('./retos');

const SEGUNDOS_MEMORIA = 10;
const INTENTOS = 3;
const MAX_TRAZOS = 3;
const PREMIO = 40;
const PREMIO_ACERTAR = 20;

function fallo(codigo) {
  const e = new Error(codigo);
  e.codigo = codigo;
  return e;
}

const hecho = (datos, clave) => Boolean(datos.imgs && datos.imgs[clave]);

// ¿Ya terminaron el reto?
function completo(tipo, datos) {
  switch (tipo) {
    case 'mitad': case 'garabato': return hecho(datos, 'final');
    case 'tema': return Boolean(datos.tema);
    case 'adivina': return datos.acertado === true || datos.acertado === false;
    case 'colores': return hecho(datos, 'uno') && hecho(datos, 'dos');
    case 'memoria': return hecho(datos, 'copia');
    default: return false;
  }
}

// ¿El otro todavía está mirando (o puede mirar) el dibujo del reto "memoria"?
function mirandoAun(datos, ahora = Date.now()) {
  return Boolean(datos.visto) && ahora - Date.parse(datos.visto) < (SEGUNDOS_MEMORIA + 5) * 1000;
}

// Qué dibujo le toca hacer a `yo` ahora (o null): el lugar donde se guarda y cómo es el lienzo.
function planDeDibujo(reto, datos, yo) {
  const soyPrimero = yo === reto.primero;
  switch (reto.tipo) {
    case 'mitad':
      if (soyPrimero && !hecho(datos, 'base')) return { clave: 'base', zona: 'izq' };
      if (!soyPrimero && hecho(datos, 'base') && !hecho(datos, 'final')) return { clave: 'final', zona: 'der', fondo: 'base' };
      return null;
    case 'garabato':
      if (soyPrimero && !hecho(datos, 'base')) return { clave: 'base', maxTrazos: MAX_TRAZOS, sinBalde: true };
      if (!soyPrimero && hecho(datos, 'base') && !hecho(datos, 'final')) return { clave: 'final', fondo: 'base', pideTitulo: true };
      return null;
    case 'adivina':
      if (soyPrimero && datos.palabra && !hecho(datos, 'dibujo')) return { clave: 'dibujo', secreto: datos.palabra };
      return null;
    case 'colores':
      if (datos.para && datos.para[yo] && !hecho(datos, yo)) return { clave: yo, paleta: datos.para[yo] };
      return null;
    case 'memoria':
      if (soyPrimero && !hecho(datos, 'dibujo')) return { clave: 'dibujo' };
      if (!soyPrimero && datos.visto && hecho(datos, 'dibujo') && !hecho(datos, 'copia')) return { clave: 'copia' };
      return null;
    default:
      return null;
  }
}

// ¿Puede `yo` ver la imagen `clave` de este reto?
function puedeVer(reto, datos, yo, clave, ahora = Date.now()) {
  if (!hecho(datos, clave)) return false;
  const soyPrimero = yo === reto.primero;
  const listo = completo(reto.tipo, datos);
  switch (reto.tipo) {
    case 'mitad': case 'garabato': return true; // la base la necesita el otro para seguir
    case 'adivina': return true;
    case 'colores': return clave === yo || hecho(datos, yo) || listo;
    case 'memoria':
      if (clave === 'copia' || soyPrimero || listo) return true;
      return mirandoAun(datos, ahora);
    default: return false;
  }
}

const COLOR = /^#[0-9a-f]{6}$/i;

// Aplica una acción que no es un dibujo. Devuelve los datos nuevos o lanza un error.
function aplicar(reto, datos, yo, accion, cuerpo, { hoy, manana, ahora = new Date() } = {}) {
  const soyPrimero = yo === reto.primero;
  const otra = soyPrimero ? reto.segundo : reto.primero;
  const d = { ...datos };
  switch (`${reto.tipo}/${accion}`) {
    case 'tema/tema': {
      if (!soyPrimero) throw fallo('no_te_toca');
      if (d.tema) throw fallo('ya_hecho');
      const tema = typeof cuerpo.tema === 'string' ? cuerpo.tema.replace(/[\s\u0000-\u001f\u007f]+/g, ' ').trim() : '';
      if ([...tema].length < 3 || [...tema].length > 80) throw fallo('tema_invalido');
      d.tema = tema;
      d.fecha = manana;
      d.elegido = hoy;
      return d;
    }
    case 'adivina/palabra': {
      if (!soyPrimero) throw fallo('no_te_toca');
      if (d.palabra) throw fallo('ya_hecho');
      if (!opcionesDePalabra(reto.semana).includes(cuerpo.palabra)) throw fallo('palabra_invalida');
      d.palabra = cuerpo.palabra;
      return d;
    }
    case 'adivina/adivinar': {
      if (soyPrimero) throw fallo('no_te_toca');
      if (!hecho(d, 'dibujo')) throw fallo('todavia_no');
      if (d.acertado === true || d.acertado === false) throw fallo('ya_hecho');
      const intento = typeof cuerpo.intento === 'string' ? cuerpo.intento.replace(/\s+/g, ' ').trim().slice(0, 40) : '';
      if (!intento) throw fallo('intento_invalido');
      d.intentos = [...(d.intentos || []), intento];
      if (adivino(intento, d.palabra)) d.acertado = true;
      else if (d.intentos.length >= INTENTOS) d.acertado = false;
      return d;
    }
    case 'colores/colores': {
      const colores = Array.isArray(cuerpo.colores) ? cuerpo.colores.map((c) => String(c).toLowerCase()) : [];
      if (colores.length !== 3 || !colores.every((c) => COLOR.test(c)) || new Set(colores).size !== 3) throw fallo('colores_invalidos');
      if (d.para && d.para[otra]) throw fallo('ya_hecho');
      d.para = { ...(d.para || {}), [otra]: colores };
      return d;
    }
    case 'memoria/mirar': {
      if (soyPrimero) throw fallo('no_te_toca');
      if (!hecho(d, 'dibujo')) throw fallo('todavia_no');
      if (d.visto) throw fallo('ya_hecho');
      d.visto = ahora.toISOString();
      return d;
    }
    default:
      throw fallo('accion_invalida');
  }
}

// Lo que ve `yo` del reto: de quién es el turno, qué acción tiene a mano y un textito.
function vista(reto, guardado, yo, nombres, { hoy, ahora = Date.now() } = {}) {
  const datos = (guardado && guardado.datos) || {};
  const soyPrimero = yo === reto.primero;
  const otra = soyPrimero ? reto.segundo : reto.primero;
  const ella = nombres[otra];
  const listo = completo(reto.tipo, datos);
  const vencido = !listo && hoy > reto.hasta;
  const plan = vencido ? null : planDeDibujo(reto, datos, yo);
  let accion = plan ? { tipo: 'dibujar', ...plan } : null;
  let texto;
  const extra = {};

  switch (reto.tipo) {
    case 'mitad':
      if (listo) texto = '¡Su dibujo a dos manos quedó listo! ✂️💛';
      else if (plan) texto = soyPrimero ? 'Te toca empezar: dibuja la mitad izquierda.' : `${ella} ya hizo su mitad. ¡Complétala!`;
      else texto = soyPrimero ? `Listo tu lado. Ahora ${ella} hace la otra mitad.` : `Espera a que ${ella} dibuje su mitad.`;
      break;
    case 'tema':
      if (soyPrimero) {
        extra.tema = datos.tema || null;
        extra.temaFecha = datos.fecha || null;
        if (!datos.tema && !vencido) accion = { tipo: 'elegir_tema' };
        const cuando = datos.fecha > hoy ? 'de mañana' : datos.fecha === hoy ? 'de hoy' : 'de ese día';
        texto = datos.tema ? `Elegiste el tema ${cuando}: «${datos.tema}».` : 'Tú eliges qué dibujan los dos mañana. ¡Piensa en algo bonito!';
      } else {
        const revelado = datos.tema && datos.fecha <= hoy;
        extra.tema = revelado ? datos.tema : null;
        extra.temaFecha = datos.fecha || null;
        texto = !datos.tema ? `${ella} está pensando qué van a dibujar 🤔` : revelado ? `El tema de hoy lo eligió ${ella}: «${datos.tema}».` : `${ella} ya eligió el tema de mañana. ¡Es sorpresa! 🤫`;
      }
      break;
    case 'garabato':
      extra.titulo = datos.titulo || null;
      if (listo) texto = datos.titulo ? `El garabato se volvió «${datos.titulo}» 🌀` : '¡El garabato ya es un dibujo! 🌀';
      else if (plan) texto = soyPrimero ? `Haz un garabato de solo ${MAX_TRAZOS} trazos para ${ella}.` : `${ella} te dejó un garabato. ¿En qué lo conviertes?`;
      else texto = soyPrimero ? `${ella} está convirtiendo tu garabato en algo…` : `Espera el garabato de ${ella}.`;
      break;
    case 'adivina':
      extra.intentos = datos.intentos || [];
      extra.acertado = datos.acertado === undefined ? null : datos.acertado;
      extra.quedan = INTENTOS - extra.intentos.length;
      if (soyPrimero || listo) extra.palabra = datos.palabra || null;
      if (soyPrimero && !datos.palabra && !vencido) { accion = { tipo: 'elegir_palabra' }; extra.opciones = opcionesDePalabra(reto.semana); }
      if (!soyPrimero && hecho(datos, 'dibujo') && !listo && !vencido) accion = { tipo: 'adivinar' };
      if (listo) texto = datos.acertado ? `¡Adivinó${soyPrimero ? ` ${ella}` : 'ste'}! Era «${datos.palabra}» 🎉` : `No ${soyPrimero ? 'adivinó' : 'adivinaste'}… era «${datos.palabra}» 🙈`;
      else if (soyPrimero) texto = !datos.palabra ? 'Elige una palabra secreta para dibujarla.' : hecho(datos, 'dibujo') ? `${ella} está intentando adivinar…` : `Dibuja «${datos.palabra}» sin letras. ¡Que no se note tanto!`;
      else texto = hecho(datos, 'dibujo') ? `¿Qué dibujó ${ella}? Tienes ${extra.quedan} ${extra.quedan === 1 ? 'intento' : 'intentos'}.` : `${ella} está dibujando una palabra secreta…`;
      break;
    case 'colores': {
      const mios = (datos.para && datos.para[yo]) || null;
      const paraElla = (datos.para && datos.para[otra]) || null;
      extra.colores = { mios, paraElOtro: paraElla };
      // Si me faltan las dos cosas, primero elijo los colores del otro (después, a dibujar).
      if (!paraElla && !vencido) accion = { tipo: 'elegir_colores' };
      if (listo) texto = '¡Los dos dibujaron con los colores del otro! 🎨';
      else if (!paraElla) texto = `Elige 3 colores para ${ella}.`;
      else if (!mios) texto = `Espera a que ${ella} te elija tus 3 colores.`;
      else if (!hecho(datos, yo)) texto = `Ya tienes tus colores: dibuja «${reto.consigna}» solo con ellos.`;
      else texto = `Listo el tuyo. Falta el de ${ella}.`;
      break;
    }
    case 'memoria':
      extra.visto = datos.visto || null;
      extra.segundos = SEGUNDOS_MEMORIA;
      if (!soyPrimero && hecho(datos, 'dibujo') && !datos.visto && !vencido) accion = { tipo: 'mirar' };
      if (listo) texto = '¡Miren qué tanto se parecen! 🧠';
      else if (soyPrimero) texto = hecho(datos, 'dibujo') ? `${ella} lo va a ver 10 segundos y lo dibujará de memoria.` : `Dibuja «${reto.consigna}» para que ${ella} lo memorice.`;
      else if (!hecho(datos, 'dibujo')) texto = `${ella} está dibujando algo para que lo memorices…`;
      else if (!datos.visto) texto = `Tienes 10 segundos para memorizar el dibujo de ${ella}. ¡Solo una vez!`;
      else texto = '¿Te acuerdas? ¡Dibújalo de memoria!';
      break;
    default:
      texto = '';
  }
  if (vencido) texto = `Se acabó la semana y el reto quedó sin terminar 😿 ${texto}`;

  const imagenes = {};
  for (const [clave, v] of Object.entries(datos.imgs || {})) {
    if (puedeVer(reto, datos, yo, clave, ahora)) imagenes[clave] = v;
  }
  const fase = listo ? 'listo' : vencido ? 'vencido' : accion ? 'mi_turno' : 'esperando';
  return {
    semana: reto.semana,
    hasta: reto.hasta,
    tipo: reto.tipo,
    nombre: reto.nombre,
    emoji: reto.emoji,
    consigna: reto.consigna,
    explica: reto.explica.replaceAll('{a}', nombres[reto.primero]).replaceAll('{b}', nombres[reto.segundo]).replaceAll('{consigna}', reto.consigna),
    primero: reto.primero,
    segundo: reto.segundo,
    soyPrimero,
    fase,
    texto,
    accion,
    imagenes,
    extra,
    completado: (guardado && guardado.completado) || null,
    premio: PREMIO + (reto.tipo === 'adivina' ? PREMIO_ACERTAR : 0),
  };
}

module.exports = { completo, planDeDibujo, puedeVer, aplicar, vista, mirandoAun, PREMIO, PREMIO_ACERTAR, SEGUNDOS_MEMORIA, MAX_TRAZOS };
