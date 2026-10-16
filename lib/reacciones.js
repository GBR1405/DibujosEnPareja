// Las reacciones que se le pueden poner al dibujo de la pareja. Esta es la única lista:
// la app la recibe del servidor en /api/yo. Se guarda el `id`, así que se pueden cambiar
// el emoji o el nombre sin perder nada; si quitas una, las que ya estaban se ignoran.

const REACCIONES = [
  { id: 'corazon', emoji: '❤️', nombre: 'Corazón' },
  { id: 'amor', emoji: '🥰', nombre: 'Amor' },
  { id: 'encanta', emoji: '😍', nombre: 'Me encanta' },
  { id: 'asombro', emoji: '😮', nombre: '¡Wow!' },
  { id: 'risa', emoji: '😂', nombre: 'Me hizo reír' },
  { id: 'ternura', emoji: '🥺', nombre: 'Ternurita' },
  { id: 'estrella', emoji: '🌟', nombre: '¡Estrella!' },
  { id: 'aplausos', emoji: '👏', nombre: 'Aplausos' },
];

const porId = new Map(REACCIONES.map((r) => [r.id, r]));

// La notita puede ser cortita: como mucho esto (contando emojis como una letra).
const LARGO_COMENTARIO = 120;

module.exports = { REACCIONES, reaccionPorId: (id) => porId.get(id) || null, LARGO_COMENTARIO };
