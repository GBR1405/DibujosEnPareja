
const TEMAS = [
  // Animalitos
  'un gato dormilón', 'un perro con orejas largas', 'un pez globo', 'una rana con sombrero',
  'un pollito recién nacido', 'una tortuga en monopatin', 'un conejo comiendo zanahoria',
  'un pingüino con bufanda', 'un osito con globo', 'una mariposa', 'un caracol', 'una abejita',
  'un búho de noche', 'un perezoso colgado de una rama', 'una mariquita', 'un pulpo sonriente',
  'un elefante chiquito', 'una jirafa con cuello corto', 'LO SIENTO WILSON', 'una oveja nube',
  'un zorro curioso', 'un panda comiendo bambú', 'un tucán', 'una ballena con su chorrito',
  'un cangrejo de playa bailando', 'una lagartija al sol', 'un cerdito rosado', 'un koala abrazado a un árbol',
  'una vaca con manchas', 'un erizo con manzanas en la espalda', 'Cane',

  // Comida y bebida
  'una taza de café', 'un helado derritiéndose', 'una pizza', 'unas gorditas de nata',
  'unas fresas', 'un sándwich', 'una dona con chispitas', 'un pastel de cumpleaños',
  'una sandía en rodajas', 'unas palomitas de maíz', 'un vaso de jugo con sombrillita',
  'un plato de arroz con frijoles', 'un taco', 'un huevo frito', 'una piña', 'un aguacate partido',
  'un cono de papas fritas', 'unos churros', 'una galleta mordida', 'un sushi',
  'una hamburguesa', 'una taza de chocolate caliente', 'una banana', 'unas cerezas',
  'un cupcake', 'una paleta de hielo', 'una tetera', 'un queso con agujeros', 'unas uvas',
  'tu postre favorito', 'lo que cenaste anoche',

  //Videojuegos
  'un personaje de Mario', 'un personaje de Zelda', 'un personaje de Pokémon', 'un personaje de Animal Crossing',
  'un personaje de Splatoon', 'un personaje de Kirby', 'un personaje de Brawl Stars', 'un personaje de Minecraft',
  'un personaje de Cookie Kingdom', 'un personaje de con capucha', 'El telefono de cada uno',
  'un personaje de Super Smash Bros.', 'un personaje de The Legend of Zelda: Breath of the Wild',
  'un personaje de Pokémon', 'un personaje de Animal Crossing: New Horizons',
  'un personaje de Splatoon 2', 'un personaje de Earth Bound', 'una caricatirua de la infancia',
  'un personaje de Minecraft ', 'un personaje del manga de splatoon',
  'Coito', 'Que hacias cuando me conociste',
  'padrinos magicos',

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
  'un robotito', 'un fantasmita', 'Pieza De Lego', 'una espada', 'una caja ?',
  'un inkling', 'un among us', 'un muñeco de nieve', 'un espantaviejas',
  'Rey Dedede', 'un buffon verde', 'un flork', 'un creper',
  'Cookie Run', 'un cactus (spike)', 'un pastel de bodas',

  // Para dos
  'nuestro juego favorito', 'cómo te imaginas nuestra casa', 'lo que haríamos juntos en un semana',
  'cómo te ves hoy', 'cómo te sientes ahora mismo', 'el mejor momento de tu día',
  'un lugar donde quisieras viajar con alguien', 'nuestra comida favorita',
  'Jugando Juntos', 'tu rincón preferido para descansar', 'el clima de tu ánimo',
  'un regalo para la otra persona', 'una mascota que tendríamos', 'cómo luce un domingo perfecto',
  'dos tazas personalizadas', 'un corazón con alitas', 'una carta de amor sin palabras',
  'un picnic', 'una cita en casa', 'un abrazo', 'dos sillas bajo las estrellas',
  'la canción que traes en la cabeza', 'tu superpoder secreto', 'tu animal favorito con un disfraz',

  // Disfrazes

  'Dibujarnos en forma de frijol', 'Dibujarnos en forma de conejo', 'Como se ve la otra persona vestina de maid',
  'Como se ve la otra persona si fuera un gato', 'Dibujarnos en traje de playa', 'Dibujarnos como un among us', 
  'Dibujarnos en pijama', 'Dibujarnos en minecraft', 'Dibujarnos en forma de inkling', 'Chica Lesbiana del espacio', 
  'Nuestro hijo/hija',

  // Formas y juegos
  'un corazón', 'una estrella', 'un garabato con ojos', 'una espiral', 'un patrón de lunares',
  'un mandala sencillo', 'una cara con una emoción', 'Terreneitor',
  'Unos Pinguinitos', 'un animal inventado', 'Tacos al pastor',
  'Flor que mas te guste', 'Bills Chichon', 'Gatito en un trono gigante',
  'un autorretrato rápido', 'lo primero que ves a tu alrededor', 'tu mano', 'tu desayuno de hoy',
  'El capy', 'Salmon Run', 'Mario Bross', 'una isla flotante',
  'The Amazing Digital Circus', 'Snoppy', 'una sorpresa dentro de una caja',
];

module.exports = { TEMAS };
