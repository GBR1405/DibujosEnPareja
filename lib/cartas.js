// Cartitas "Ábrela cuando…": una carta para tu pareja que se queda cerrada en su sobre
// hasta que llegue el momento. La mayoría se abren cuando la otra persona lo necesite
// ("cuando estés triste", "cuando me extrañes"…); la de `fecha` no se puede abrir antes
// del día elegido. Al abrirla, quien la escribió recibe un aviso.

const CUANDO = [
  { id: 'triste', texto: 'estés triste', emoji: '🌧️' },
  { id: 'extranes', texto: 'me extrañes', emoji: '🫂' },
  { id: 'dormir', texto: 'no puedas dormir', emoji: '🌙' },
  { id: 'reir', texto: 'necesites reírte', emoji: '😂' },
  { id: 'enojo', texto: 'te enojes conmigo', emoji: '😤' },
  { id: 'animo', texto: 'necesites ánimos', emoji: '💪' },
  { id: 'feliz', texto: 'estés muy feliz', emoji: '🌈' },
  { id: 'fecha', texto: 'llegue el día…', emoji: '📅' },
];

const COLORES_SOBRE = ['#ffc2d1', '#ffe08a', '#bfe2ff', '#c6f0dc', '#e2d6ff', '#ffd1ad'];
const LARGO_CARTA = 1000;

const porId = new Map(CUANDO.map((c) => [c.id, c]));

module.exports = { CUANDO, COLORES_SOBRE, LARGO_CARTA, cuandoDe: (id) => porId.get(id) || null };
