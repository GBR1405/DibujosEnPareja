// Comodines: para recuperar un día que se les pasó sin perder la racha.
//
// Cada persona tiene los suyos. Se empieza con el máximo (2); cada vez que se usa uno se
// anota el mes ('AAAA-MM'); el día 1 de cada mes se recarga 1, sin pasar del máximo.
// El saldo se calcula siempre desde esas anotaciones, así no hay un contador que se
// pueda desincronizar.

const siguienteMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
};

// `usos`: la lista de meses en que se usó un comodín (uno por uso).
function saldo(usos, mesActual, { maximo = 2, porMes = 1 } = {}) {
  const validos = usos.filter((m) => m <= mesActual).sort();
  if (!validos.length) return maximo;
  const porMesUsados = new Map();
  for (const m of validos) porMesUsados.set(m, (porMesUsados.get(m) || 0) + 1);
  let quedan = maximo;
  for (let mes = validos[0]; mes <= mesActual; mes = siguienteMes(mes)) {
    if (mes !== validos[0]) quedan = Math.min(maximo, quedan + porMes);
    quedan -= porMesUsados.get(mes) || 0;
  }
  return Math.max(0, quedan);
}

module.exports = { saldo, siguienteMes };
