// La racha (días seguidos dibujando los dos) y las reglas de "posponer".
//
// Posponer: si un día no puedes dibujar (estás ocupado o te sientes mal), lo pospones
// ESE MISMO DÍA. Eso congela la racha: ese día no suma, pero tampoco la rompe, mientras
// todavía estés a tiempo de hacerlo. Tienes hasta el final del día siguiente (más la
// hora de gracia de la madrugada) para dibujar el pospuesto, además del de ese día.
//   - No se puede posponer dos días seguidos (uno sí, otro no).
//   - El día pospuesto NO se puede recuperar con comodín: si se te pasa, la racha se
//     rompe. El otro día (el que no pospusiste) sí se puede recuperar con comodín.

const F = require('./fecha');

// ¿Todavía se puede dibujar (gratis) el día pospuesto `fecha`? El mismo día, el día
// siguiente entero y, el que sigue, hasta la hora de gracia.
function pospuestoATiempo(fecha, hoy, enGracia) {
  return fecha === hoy || fecha === F.sumarDias(hoy, -1) || (enGracia && fecha === F.sumarDias(hoy, -2));
}

// Hasta cuándo se puede dibujar el día pospuesto `fecha` (el día límite, completo).
const limitePospuesto = (fecha) => F.sumarDias(fecha, 1);

// Días seguidos hasta hoy (o hasta ayer, si hoy todavía no han terminado los dos).
//   completos:  fechas en que los dos dibujaron
//   recientes:  Map fecha -> Set de quién dibujó (basta con los últimos 3 días)
//   pospuestos: Map fecha -> Set de quién pospuso
//   quienes:    ['uno', 'dos']
function calcularRacha({ completos, recientes = new Map(), pospuestos = new Map(), quienes, hoy, enGracia = false }) {
  const hechos = completos instanceof Set ? completos : new Set(completos);
  let dia = hechos.has(hoy) ? hoy : F.sumarDias(hoy, -1);
  let n = 0;
  for (let vueltas = 0; vueltas < 800; vueltas += 1) {
    if (hechos.has(dia)) {
      n += 1;
    } else {
      // Un día congelado: a los que les falta, lo pospusieron y todavía están a tiempo.
      const dibujaron = recientes.get(dia) || new Set();
      const posp = pospuestos.get(dia) || new Set();
      const faltan = quienes.filter((q) => !dibujaron.has(q));
      const congelado = faltan.length > 0 && faltan.every((q) => posp.has(q)) && pospuestoATiempo(dia, hoy, enGracia);
      if (!congelado) break;
    }
    dia = F.sumarDias(dia, -1);
  }
  return n;
}

// Cómo se ve la racha: el fondo de la app (y de la postal) cambia con ella.
//   0-3 días: nada · 4-7: rosadito · 8-15: + corazones · 16-30: más fuerte, más corazones
//   y chispitas · 31-59: + burbujas de luz · 60 o más: todo, al máximo.
function nivelDeRacha(dias) {
  if (dias >= 60) return 5;
  if (dias >= 31) return 4;
  if (dias >= 16) return 3;
  if (dias >= 8) return 2;
  if (dias >= 4) return 1;
  return 0;
}

const MOTIVOS = {
  ocupado: { id: 'ocupado', nombre: 'Estoy ocupado', emoji: '💼' },
  mal: { id: 'mal', nombre: 'Me siento mal', emoji: '🤒' },
};

module.exports = { calcularRacha, nivelDeRacha, pospuestoATiempo, limitePospuesto, MOTIVOS };
