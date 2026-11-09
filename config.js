// Configuración de Garabatos.
// Las dos cuentas son fijas: no existe ninguna ruta para crear ni borrar cuentas.

const enVercel = Boolean(process.env.VERCEL);

// En Vercel no hay disco donde guardar nada: la base de datos tiene que ser Turso.
if (enVercel && !process.env.TURSO_DATABASE_URL) {
  throw new Error('Falta la variable TURSO_DATABASE_URL (y TURSO_AUTH_TOKEN). Mira el README, paso 2.');
}

module.exports = {
  nombreApp: 'Garabatos',

  // El "día" de la app cambia a medianoche en esta zona horaria.
  zonaHoraria: 'America/Costa_Rica',

  puerto: Number(process.env.PORT) || 3000,

  // Base de datos. Con Turso: TURSO_DATABASE_URL=libsql://tu-base.turso.io y TURSO_AUTH_TOKEN.
  // Sin esas variables (en tu computadora) se usa un archivo SQLite local en data/.
  turso: {
    url: process.env.TURSO_DATABASE_URL || 'file:data/garabatos.db',
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  },

  // Clave para firmar las sesiones. En Vercel es obligatoria (variable SECRETO):
  // cualquier texto largo y secreto, por ejemplo el resultado de `openssl rand -hex 32`.
  secreto: process.env.SECRETO || '',

  // Avisos al teléfono (notificaciones push). Sin estas tres variables la app funciona
  // igual, solo que sin avisos. Se generan con `npx web-push generate-vapid-keys`.
  // `contacto` es un correo con el formato mailto:tu@correo.com (lo piden Apple y Google).
  avisos: {
    clavePublica: process.env.VAPID_PUBLIC_KEY || '',
    clavePrivada: process.env.VAPID_PRIVATE_KEY || '',
    contacto: process.env.VAPID_SUBJECT || '',
  },

  // Contraseña que manda cron-job.org para disparar el recordatorio del mediodía
  // (cabecera Authorization: Bearer <CRON_SECRET>). Sin ella, el recordatorio no funciona.
  cronSecreto: process.env.CRON_SECRET || '',

  // Comodines, por si a alguien se le pasa un día: cada quien tiene hasta `maximo`, se
  // recarga `porMes` el día 1 de cada mes, y sirven para dibujar un día de los últimos
  // `diasAtras` días (así no se pierde la racha).
  comodines: { maximo: 2, porMes: 1, diasAtras: 7 },

  // El dibujo de ayer se puede terminar gratis hasta esta hora de hoy (por si la
  // medianoche te agarró dibujando). Después, recuperarlo cuesta un comodín.
  horasDeGracia: 3,

  // Posponer: si un día no puedes dibujar, lo pospones ese mismo día (y explicas por qué).
  // La racha se congela y al día siguiente tienes que hacer los dos dibujos. No se puede
  // posponer dos días seguidos, y el día pospuesto no se recupera con comodín.
  // (Las reglas están en lib/racha.js.)
  posponer: { largoTexto: 140 },

  // La cartita de "¡Hola amor! Estuve actualizando la app…" con las novedades: le sale una
  // sola vez a las cuentas de `para` (la primera vez que entran después de publicar). La
  // firma la cuenta de `de`. Para una tanda nueva de novedades, cambia `id` y la lista en
  // public/js/novedades.js.
  novedades: { id: '2026-11', para: ['dos'], de: 'uno' },

  // Al empezar un año nuevo se borran todos los dibujos del año anterior.
  // Ponlo en false si prefieren que se queden guardados en la base de datos.
  borrarAlEmpezarAnio: true,

  // Cada dibujo se comprime al terminar: 720 x 960 px en WebP, y se busca que pese
  // menos de `objetivoKB` (baja la calidad poco a poco hasta lograrlo).
  imagen: { ancho: 720, alto: 960, miniAncho: 150, miniAlto: 200, objetivoKB: 40 },

  // CAMBIEN ESTOS PIN antes de publicar (o usen PIN_UNO y PIN_DOS como variables de
  // entorno). Pueden tener de 4 a 8 números; mientras más largos, mejor: 6 es buen punto.
  // `carita` es el animalito de cada quien: 'mapache' o 'siames' (también quedan 'gato'
  // y 'conejo', los de antes). Para intercambiarlos, cambia aquí y vuelve a publicar.
  cuentas: [
    { id: 'uno', nombre: 'Gabri',   pin: process.env.PIN_UNO || '123456', color: '#ff6f91', carita: 'mapache' },
    { id: 'dos', nombre: 'Eli', pin: process.env.PIN_DOS || '654321', color: '#8fc4ff', carita: 'siames' },
  ],

  pinesDeEjemplo: ['123456', '654321'],
};
