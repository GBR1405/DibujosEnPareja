// Temas sencillos para dibujar en un ratito. Se pueden agregar o quitar con
// libertad: la app escoge uno al azar cada día y no repite hasta agotar la lista.

const TEMAS = [
  // Animalitos
  'un gato dormilón', 'un perro con orejas largas', 'un pez globo', 'una rana con sombrero',
  'un pollito recién nacido', 'una tortuga con casita', 'un conejo comiendo zanahoria',
  'un pingüino con bufanda', 'un osito con globo', 'una mariposa', 'un caracol', 'una abejita',
  'un búho de noche', 'un perezoso colgado de una rama', 'una mariquita', 'un pulpo sonriente',
  'un elefante pequeñito', 'una jirafa de cuello larguísimo', 'un delfín saltando', 'una oveja nube',
  'un zorro curioso', 'un panda comiendo bambú', 'un tucán', 'una ballena con su chorrito',
  'un cangrejo de playa', 'una lagartija al sol', 'un cerdito rosado', 'un koala abrazado a un árbol',
  'una vaca con manchas', 'un erizo con manzanas en la espalda',

  // Comida y bebida
  'una taza de café', 'un helado derritiéndose', 'una pizza', 'un pan con mantequilla',
  'unas fresas', 'un sándwich', 'una dona con chispitas', 'un pastel de cumpleaños',
  'una sandía en rodajas', 'unas palomitas de maíz', 'un vaso de jugo con sombrillita',
  'un plato de arroz con frijoles', 'un taco', 'un huevo frito', 'una piña', 'un aguacate partido',
  'un cono de papas fritas', 'unos churros', 'una galleta mordida', 'un sushi',
  'una hamburguesa', 'una taza de chocolate caliente', 'una banana', 'unas cerezas',
  'un cupcake', 'una paleta de hielo', 'una tetera', 'un queso con agujeros', 'unas uvas',
  'tu postre favorito', 'lo que cenaste anoche',

  // Naturaleza y clima
  'una nube con carita', 'un arcoíris', 'una luna sonriente', 'un sol con lentes',
  'una montaña con nieve', 'un volcán dormido', 'una flor', 'un girasol', 'un cactus con flor',
  'un árbol con columpio', 'una hoja de otoño', 'un hongo rojo con lunares', 'una gota de lluvia',
  'una estrella fugaz', 'una isla chiquita con una palmera', 'una ola', 'un charco con botas',
  'un copo de nieve', 'una noche con muchas estrellas', 'un campo de tulipanes',
  'una cascada', 'una planta en maceta', 'un ramo de flores', 'un rayo y una nube de tormenta',
  'una playa al atardecer', 'un bosque de pinos', 'un trébol de cuatro hojas',

  // Cosas de casa
  'una casita con chimenea', 'una lámpara', 'una silla', 'un sillón cómodo', 'una cama con muchas almohadas',
  'un reloj despertador', 'un paraguas', 'unos calcetines', 'una bufanda', 'un par de zapatos',
  'una mochila', 'un libro abierto', 'una vela encendida', 'una llave', 'una bombilla encendida',
  'un espejo', 'una ventana con cortina', 'una maceta con cara', 'un regalo con lazo', 'un sombrero',
  'unos lentes', 'un calcetín solitario', 'un cojín con forma de corazón', 'un cepillo de dientes feliz',
  'un teléfono antiguo', 'una cafetera', 'un candado', 'una bolsa de compras', 'una tijera',

  // Transporte y lugares
  'un barquito de papel', 'un globo aerostático', 'una bicicleta', 'un autobús', 'un cohete',
  'un avioncito', 'un tren', 'un faro junto al mar', 'una carretera con curvas', 'una tienda de campaña',
  'un castillo', 'un puente', 'una heladería', 'un carrito de comida', 'una nave espacial pequeñita',
  'un submarino amarillo', 'un monopatín', 'un camión de mudanza', 'un molino de viento',

  // Cosas y personajes sencillos
  'un robotito', 'un fantasmita', 'un monstruo bonachón', 'un dragón chiquito', 'una sirena',
  'un unicornio', 'un astronauta flotando', 'un muñeco de nieve', 'un espantapájaros',
  'un hada con alitas', 'un pirata', 'un mago con sombrero de estrellas', 'un extraterrestre amistoso',
  'un caballero con escudo', 'un cactus caminando', 'un pastel con vida propia',

  // Para dos
  'nuestro lugar favorito', 'cómo te imaginas nuestra casa', 'lo que haríamos juntos este fin de semana',
  'cómo me ves hoy', 'cómo te sientes ahora mismo', 'el mejor momento de tu día',
  'un lugar donde quisieras viajar con alguien', 'nuestra comida favorita para compartir',
  'una película que quisieras ver hoy', 'tu rincón preferido para descansar', 'el clima de tu ánimo',
  'un regalo para la otra persona', 'una mascota que tendríamos', 'cómo luce un domingo perfecto',
  'dos tazas, una para cada quien', 'un corazón con alitas', 'una carta de amor sin palabras',
  'un picnic', 'una cita en casa', 'un abrazo', 'dos sillas bajo las estrellas',
  'la canción que traes en la cabeza', 'tu superpoder secreto', 'tu animal favorito con un disfraz',

  // Formas y juegos
  'un corazón', 'una estrella', 'un garabato con ojos', 'una espiral', 'un patrón de lunares',
  'un mandala sencillo', 'una cara con una emoción', 'una ciudad con tres edificios',
  'una cara hecha solo con círculos', 'un animal inventado', 'una criatura de una sola línea',
  'un pastel de formas geométricas', 'un paisaje con solo triángulos', 'un monstruo de cuatro ojos',
  'un autorretrato rápido', 'lo primero que ves a tu alrededor', 'tu mano', 'tu desayuno de hoy',
  'una escena con una luna enorme', 'un pájaro con un mensaje', 'tu mascota ideal', 'una isla flotante',
  'una taza con una cara', 'una casa en un árbol', 'una sorpresa dentro de una caja',
];

module.exports = { TEMAS };
