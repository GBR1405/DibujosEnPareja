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

  // Al empezar un año nuevo se borran todos los dibujos del año anterior.
  // Ponlo en false si prefieren que se queden guardados en la base de datos.
  borrarAlEmpezarAnio: true,

  // Cada dibujo se comprime al terminar: 720 x 960 px en WebP, y se busca que pese
  // menos de `objetivoKB` (baja la calidad poco a poco hasta lograrlo).
  imagen: { ancho: 720, alto: 960, miniAncho: 150, miniAlto: 200, objetivoKB: 40 },

  // CAMBIEN ESTOS PIN antes de publicar (o usen PIN_UNO y PIN_DOS como variables de
  // entorno). Pueden tener de 4 a 8 números; mientras más largos, mejor: 6 es buen punto.
  cuentas: [
    { id: 'uno', nombre: 'Gabri',   pin: process.env.PIN_UNO || '123456', color: '#ff6f91', carita: 'gato' },
    { id: 'dos', nombre: 'Eli', pin: process.env.PIN_DOS || '654321', color: '#8fc4ff', carita: 'conejo' },
  ],

  pinesDeEjemplo: ['123456', '654321'],
};
