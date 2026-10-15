// El tema de cada día sale de la fecha, sin guardar nada en la base de datos.
//
// Para cada año se baraja la lista de temas con una semilla fija (el año), así que:
//  - las dos personas ven siempre el mismo tema,
//  - no se repite ninguno hasta agotar la lista (la lista tiene ~200; el año, 365,
//    así que a partir del día ~200 empieza una segunda vuelta con otro orden),
//  - el calendario puede mostrar el tema de cualquier día pasado.
//
// Ojo: si agregan o quitan temas a mitad de año, cambia el orden y los temas de los
// días que ya pasaron "se mueven". Lo mejor es editar la lista a fin de año.

const { TEMAS } = require('./temas');
const { diaDelAnio } = require('./fecha');

// Generador pseudoaleatorio pequeño y determinista (mulberry32).
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
  if (memoria.has(clave)) return memoria.get(clave);
  const azar = semilla(anio * 31 + vuelta * 7919 + TEMAS.length);
  const lista = TEMAS.map((_, i) => i);
  for (let i = lista.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  memoria.set(clave, lista);
  return lista;
}

function temaDelDia(fecha) {
  const anio = Number(fecha.slice(0, 4));
  const n = diaDelAnio(fecha);
  const vuelta = Math.floor(n / TEMAS.length);
  return TEMAS[orden(anio, vuelta)[n % TEMAS.length]];
}

module.exports = { temaDelDia };
