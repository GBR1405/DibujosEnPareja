// Utilidades de fecha. Las fechas se manejan como texto "AAAA-MM-DD"
// calculado en la zona horaria de la app, nunca en la del servidor.

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

function claveDeHoy(zona, ahora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(ahora);
}

function esFecha(texto) {
  const m = RE_FECHA.exec(String(texto));
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

function sumarDias(clave, n) {
  const m = RE_FECHA.exec(clave);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)).toISOString().slice(0, 10);
}

const anioDe = (clave) => Number(clave.slice(0, 4));

const diasDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate();

// 0 para el 1 de enero, 364 (o 365) para el 31 de diciembre.
function diaDelAnio(clave) {
  const m = RE_FECHA.exec(clave);
  return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(+m[1], 0, 1)) / 86400000);
}

// Días que faltan para el 31 de diciembre del año de `clave` (0 el mismo 31).
function diasHastaFinDeAnio(clave) {
  const m = RE_FECHA.exec(clave);
  return Math.round((Date.UTC(+m[1], 11, 31) - Date.UTC(+m[1], +m[2] - 1, +m[3])) / 86400000);
}

// La hora (0 a 23) en esa zona horaria.
function horaEn(zona, ahora = new Date()) {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: zona, hour: '2-digit', hourCycle: 'h23' }).format(ahora));
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// '2026-10-12' -> '12 de octubre'
const fechaCorta = (clave) => `${Number(clave.slice(8, 10))} de ${MESES[Number(clave.slice(5, 7)) - 1]}`;

module.exports = { claveDeHoy, esFecha, sumarDias, anioDe, diasDelMes, diaDelAnio, diasHastaFinDeAnio, fechaCorta, horaEn };
