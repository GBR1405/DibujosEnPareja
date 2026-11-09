// El reto de la semana: uno por semana (de lunes a domingo), de alguno de estos 6 tipos.
// Ninguno es "al mismo tiempo": siempre uno hace su parte y luego el otro.
//
//   mitad     Mitad y mitad: un solo lienzo; quien empieza dibuja la mitad izquierda y
//             la otra persona, viéndola, completa la derecha.
//   tema      Tú eliges el tema: quien empieza decide qué dibujan los dos mañana.
//   garabato  Termina mi garabato: quien empieza hace un garabato de 3 trazos y la otra
//             persona lo convierte en un dibujo (y le pone nombre).
//   adivina   Adivina qué es: quien empieza elige una palabra secreta y la dibuja; la
//             otra persona tiene 3 intentos para adivinarla.
//   colores   Tus colores, mi dibujo: cada quien le elige 3 colores al otro y los dos
//             dibujan la consigna solo con esos colores.
//   memoria   De memoria: quien empieza dibuja algo; la otra persona lo ve 10 segundos
//             (una sola vez) y lo dibuja de memoria.
//
// El tipo, la consigna y quién empieza salen de la fecha (como el tema del día): no se
// guardan, así las dos personas ven siempre lo mismo. Lo que sí se guarda es lo que
// cada quien va haciendo.

const F = require('./fecha');

const TIPOS = {
  mitad: {
    nombre: 'Mitad y mitad', emoji: '✂️',
    explica: '{a} dibuja la mitad izquierda del lienzo. Después {b} la ve y completa la otra mitad. ¡Un solo dibujo entre los dos!',
  },
  tema: {
    nombre: 'Tú eliges el tema', emoji: '🎲',
    explica: '{a} decide qué dibujan los dos mañana. Es sorpresa: {b} lo descubre mañana.',
  },
  garabato: {
    nombre: 'Termina mi garabato', emoji: '🌀',
    explica: '{a} hace un garabato de solo 3 trazos. {b} lo convierte en un dibujo y le pone nombre.',
  },
  adivina: {
    nombre: 'Adivina qué es', emoji: '🔍',
    explica: '{a} elige una palabra secreta y la dibuja (¡sin letras!). {b} tiene 3 intentos para adivinarla.',
  },
  colores: {
    nombre: 'Tus colores, mi dibujo', emoji: '🎨',
    explica: 'Cada quien le elige 3 colores al otro. Después los dos dibujan «{consigna}» solo con esos colores.',
  },
  memoria: {
    nombre: 'De memoria', emoji: '🧠',
    explica: '{a} dibuja «{consigna}». {b} lo ve solo 10 segundos, una vez, y lo dibuja de memoria.',
  },
};
const ORDEN = Object.keys(TIPOS);

const CONSIGNAS = {
  mitad: ['un monstruo amigable', 'nuestra casa soñada', 'un robot', 'un animal inventado', 'un pastel gigante', 'un castillo',
    'una nave espacial', 'un jardín mágico', 'una cara muy graciosa', 'un dragón', 'una ciudad de golosinas', 'un barco pirata'],
  garabato: ['lo que se te ocurra'],
  colores: ['un atardecer', 'tu comida favorita', 'un animal del bosque', 'un día de lluvia', 'un ramo de flores', 'el mar',
    'un bosque encantado', 'una noche de estrellas', 'un jardín', 'un postre'],
  memoria: ['tu animal favorito', 'una casita', 'un paisaje', 'un personaje inventado', 'algo de tu cuarto', 'una planta rara',
    'un monstruo', 'tu desayuno ideal'],
  tema: ['el tema de mañana'],
  adivina: ['una palabra secreta'],
};

const PALABRAS = ['paraguas', 'cohete', 'bicicleta', 'faro', 'pulpo', 'tortuga', 'helado', 'guitarra', 'volcán', 'arcoíris',
  'fantasma', 'castillo', 'sirena', 'dinosaurio', 'tren', 'cactus', 'piña', 'robot', 'globo', 'tiburón', 'búho', 'vela',
  'llave', 'reloj', 'mariposa', 'pingüino', 'hamburguesa', 'unicornio', 'teléfono', 'semáforo', 'regadera', 'tostadora',
  'lupa', 'ancla', 'corona', 'trofeo', 'cometa', 'escalera', 'muñeco de nieve', 'caracol', 'hongo', 'medusa', 'cangrejo',
  'camaleón', 'mapache', 'luna', 'planeta', 'astronauta', 'bruja', 'panda', 'sandía', 'taco', 'sushi', 'dona', 'cupcake',
  'tienda de campaña', 'avión', 'gato', 'jirafa', 'elefante', 'flor', 'abeja', 'sol', 'nube', 'casa', 'árbol', 'estrella de mar',
  'zapato', 'gafas', 'sombrero', 'cámara', 'libro', 'lápiz', 'taza', 'pizza', 'manzana', 'fresa', 'barco', 'auto', 'oso'];

// Generador pseudoaleatorio determinista (mulberry32), como en tema-del-dia.js.
function azar(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function barajar(lista, semilla) {
  const r = azar(semilla);
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// El lunes de la semana de `fecha` ('AAAA-MM-DD').
function lunesDe(fecha) {
  const [a, m, d] = fecha.split('-').map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return F.sumarDias(fecha, -((dia + 6) % 7));
}

// Número de semana contando desde el lunes 1 de enero de 2024.
function numeroDeSemana(lunes) {
  const [a, m, d] = lunes.split('-').map(Number);
  return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(2024, 0, 1)) / (7 * 86400000));
}

// Qué reto toca la semana de `fecha`. `quienes`: ['uno', 'dos'].
function retoDeLaSemana(fecha, quienes) {
  const semana = lunesDe(fecha);
  const n = numeroDeSemana(semana);
  const vuelta = Math.floor(n / ORDEN.length);
  const tipo = barajar(ORDEN, 9173 + vuelta * 131)[((n % ORDEN.length) + ORDEN.length) % ORDEN.length];
  const consignas = CONSIGNAS[tipo];
  const consigna = consignas[(n * 7 + 3) % consignas.length];
  const primero = quienes[n % 2 === 0 ? 0 : 1];
  const segundo = quienes.find((q) => q !== primero);
  return { semana, hasta: F.sumarDias(semana, 6), numero: n, tipo, consigna, primero, segundo, ...TIPOS[tipo] };
}

// Las 3 palabras secretas para elegir (del reto "adivina").
function opcionesDePalabra(semana) {
  return barajar(PALABRAS, numeroDeSemana(semana) * 17 + 5).slice(0, 3);
}

// Para comparar lo que escriben al adivinar: sin tildes, sin artículos, sin plurales.
function normalizar(texto) {
  return String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zñ0-9 ]+/g, ' ')
    .replace(/\b(un|una|unos|unas|el|la|los|las|de|del)\b/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map((p) => p.replace(/(es|s)$/, ''))
    .join(' ');
}
function adivino(intento, palabra) {
  const a = normalizar(intento);
  const b = normalizar(palabra);
  return Boolean(a && b) && (a === b || ` ${a} `.includes(` ${b} `));
}

module.exports = { TIPOS, ORDEN, CONSIGNAS, PALABRAS, lunesDe, numeroDeSemana, retoDeLaSemana, opcionesDePalabra, normalizar, adivino };
