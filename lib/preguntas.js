// La pregunta del día: los dos la responden y solo ven la respuesta del otro cuando ya
// respondieron la suya (o cuando ya pasó el día). Sale de la fecha, igual que el tema.

const { diaDelAnio } = require('./fecha');

const PREGUNTAS = [
  '¿Cuál fue el primer detalle mío que te gustó?',
  '¿Qué canción te hace pensar en mí?',
  'Si pudiéramos viajar mañana, ¿a dónde iríamos?',
  '¿Cuál es tu recuerdo favorito de los dos?',
  '¿Qué comida te gustaría que cocináramos juntos?',
  '¿Qué es lo más gracioso que nos ha pasado?',
  'Si fuéramos animales, ¿cuáles seríamos?',
  '¿Qué te gustaría que hiciéramos este fin de semana?',
  '¿Qué cosa pequeña que hago te alegra el día?',
  '¿Cómo sería nuestra cita perfecta?',
  'Si tuviéramos una casa en un árbol, ¿qué tendría adentro?',
  '¿Qué película veríamos hoy abrazados?',
  '¿Qué es algo que aprendiste de mí?',
  'Describe nuestro día ideal en tres palabras.',
  '¿Cuál es tu apodo favorito para mí?',
  '¿Qué superpoder te gustaría que tuviéramos los dos?',
  '¿Qué te hace sentir querido o querida?',
  '¿Qué sueño te gustaría que cumpliéramos juntos?',
  'Si escribieran un libro sobre nosotros, ¿cómo se llamaría?',
  '¿Qué es lo primero que pensaste cuando me conociste?',
  '¿Qué olor te recuerda a mí?',
  '¿Qué te gustaría que te dibujara?',
  '¿Cuál es tu momento favorito del día y por qué?',
  '¿Qué te dio risa hoy?',
  'Si tuviéramos una mascota, ¿cómo se llamaría?',
  '¿Qué lugar de nuestra ciudad es "nuestro lugar"?',
  '¿Qué te gustaría que hiciéramos cuando seamos viejitos?',
  '¿Qué postre nos representa?',
  '¿Qué es algo que siempre quisiste decirme y no has dicho?',
  '¿Cuál es tu foto favorita de los dos?',
  '¿Qué videojuego jugaríamos en equipo?',
  'Si fuéramos personajes de una caricatura, ¿de cuál?',
  '¿Qué es lo que más extrañas cuando no estamos juntos?',
  '¿Qué te gustaría aprender juntos?',
  '¿Cuál es tu palabra favorita?',
  '¿Qué harías si tuvieras un día entero sin obligaciones?',
  '¿Qué cosa mía siempre te hace sonreír?',
  '¿Qué tradición inventarías para los dos?',
  'Si pudiéramos vivir en cualquier época, ¿cuál elegirías?',
  '¿Cuál es la mejor sorpresa que te han dado?',
  '¿Qué tres cosas llevarías a una isla desierta (además de mí)?',
  '¿Qué es algo que te da miedo pero quieres intentar?',
  '¿Qué color le pondrías a nuestro amor?',
  '¿Cuál fue el mejor regalo que te he dado?',
  '¿Qué te gustaría que te dijera más seguido?',
  '¿Qué canción pondríamos en nuestro auto en un viaje largo?',
  '¿A qué hora del día te gusta más hablar conmigo?',
  '¿Qué es lo más bonito que has visto esta semana?',
  'Si tuviéramos un restaurante, ¿qué venderíamos?',
  '¿Qué te ayuda cuando tienes un mal día?',
  '¿Cómo te imaginas nuestra casa en el futuro?',
  '¿Qué es algo que hago y que te parece tierno?',
  '¿Qué estación del año nos queda mejor?',
  '¿Qué cosa te gustaría coleccionar conmigo?',
  '¿Qué fue lo último que te hizo pensar en mí?',
  '¿Cuál es tu dulce favorito de la infancia?',
  'Si pudieras darme un abrazo ahora mismo, ¿cómo sería?',
  '¿Qué te gustaría que celebráramos este mes?',
  '¿Qué serie veríamos de principio a fin?',
  '¿Cuál es tu manera favorita de decir "te quiero"?',
  '¿Qué deporte o juego te gustaría que intentáramos?',
  'Si nuestra relación fuera un lugar, ¿cómo sería?',
  '¿Qué es lo que más te gusta de nuestras conversaciones?',
  '¿Qué meta tienes para este mes?',
  '¿Qué cosa nueva descubriste de ti este año?',
  '¿Cómo sería un domingo perfecto conmigo?',
  '¿Qué emoji nos describe?',
  '¿Qué te gustaría que dibujáramos juntos algún día?',
  '¿Cuál es tu recuerdo favorito de la infancia?',
  '¿Qué es lo que más admiras de mí?',
];

function semilla(n) {
  let a = n >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const memoria = new Map();
function orden(anio, vuelta) {
  const clave = `${anio}/${vuelta}`;
  if (!memoria.has(clave)) {
    const r = semilla(anio * 53 + vuelta * 4111 + PREGUNTAS.length);
    const lista = PREGUNTAS.map((_, i) => i);
    for (let i = lista.length - 1; i > 0; i -= 1) {
      const j = Math.floor(r() * (i + 1));
      [lista[i], lista[j]] = [lista[j], lista[i]];
    }
    memoria.set(clave, lista);
  }
  return memoria.get(clave);
}

function preguntaDelDia(fecha) {
  const n = diaDelAnio(fecha);
  return PREGUNTAS[orden(Number(fecha.slice(0, 4)), Math.floor(n / PREGUNTAS.length))[n % PREGUNTAS.length]];
}

const LARGO_RESPUESTA = 280;

module.exports = { PREGUNTAS, preguntaDelDia, LARGO_RESPUESTA };
