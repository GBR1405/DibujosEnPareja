// El rincón de las estrellas (la galaxia secreta): se entra jalando la pantalla de Hoy
// hacia abajo hasta que se rompe. Aquí viven las reglas del servidor:
//
//   - La estrella del día: cada quien puede atrapar UNA por día. Cada estrella atrapada
//     pega el siguiente sticker del álbum (del 1 al 30, en orden). Con el álbum lleno, las
//     estrellas se siguen pudiendo atrapar, pero ya no dan sticker.
//   - Recuerdos: los dos pueden guardar recuerdos (título, fecha, texto y una foto);
//     solo quien lo escribió lo puede borrar.
//   - Frases: cada quien le escribe frases bonitas a la otra persona (salen en el frasco
//     de estrellas, junto con las que trae la app).
//   - Datos: lo que se recuerda de los juegos (constelaciones hechas, récord…).

const TOTAL_STICKERS = 30;
const LARGO = { titulo: 80, texto: 1500, frase: 240 };

// Lo que cada quien puede guardar de la galaxia, y cómo se revisa.
const DATOS = {
  // ya vio la bienvenida
  intro: (v) => v === true,
  // ids de las constelaciones que completó (del juego)
  constelaciones: (v) => Array.isArray(v) && v.length <= 60 && v.every((x) => typeof x === 'string' && /^[a-z0-9_-]{1,24}$/.test(x)),
  // récords del juego de saltar planetas
  saltitos: (v) => v && typeof v === 'object' && Number.isInteger(v.mejor) && v.mejor >= 0 && v.mejor < 100000
    && Number.isInteger(v.estrellas || 0) && (v.estrellas || 0) >= 0 && (v.estrellas || 0) < 10000000,
  // frases del frasco que marcó como favoritas
  favoritas: (v) => Array.isArray(v) && v.length <= 200 && v.every((x) => typeof x === 'string' && x.length <= 40),
};

const valido = (clave, valor) => Boolean(DATOS[clave]) && DATOS[clave](valor) && JSON.stringify(valor).length <= 4000;

module.exports = { TOTAL_STICKERS, LARGO, DATOS, datoValido: valido };
