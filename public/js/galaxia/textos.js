// Los textos de la galaxia secreta. Todo esto se puede cambiar a gusto: son las palabras
// que lee Eli (o quien entre). `yo` y `pareja` son las cuentas ({ nombre }); `esSuya`
// dice si la galaxia es de quien está mirando (config.galaxia.para).

// ------------------------------------------------------------------ la animación de inicio
// Lo primero que se ve la primera vez que se entra (después de romper la pantalla): un
// mensaje en el cielo oscuro, frase por frase. Al terminar aparece la galaxia y empieza
// la música. Lo firma quien le regaló la galaxia (`regala`) a su dueña (`duena`).
export const INICIO = {
  frases: ({ duena }) => [
    `${duena.nombre}…`,
    'sé que a veces dudas de lo que dibujas, y que te frustras cuando algo no sale como lo imaginaste.',
    'Sé que te cuesta ver lo que yo veo todos los días: que eres una artista increíble.',
    'Cada trazo tuyo vale. Cada intento, también. Y cada día que sigues, aunque dudes, te hace más grande.',
    'Por eso te creé este lugar. ✨',
  ],
  firma: ({ regala }) => `— ${regala.nombre} 💛`,
};

// ------------------------------------------------------------------ la bienvenida
// Después de la animación de inicio, Estelita cuenta qué hay en la galaxia.
export function bienvenida({ yo, pareja, esSuya }) {
  if (esSuya) {
    return [
      `¡Hola, ${yo.nombre}! Yo soy Estelita ✨`,
      'Rompiste la pantalla… y encontraste un rincón secreto del universo.',
      'Aquí siempre es de noche, pero nunca está oscuro. 🌙',
      'Hay recuerdos guardados entre las estrellas, un frasco lleno de cosas lindas para ti, y juegos para cuando quieras descansar.',
      'Y cada día va a caer una estrella dorada. Si la atrapas, se vuelve un sticker para tu álbum. ⭐',
      'Bienvenida a tu rincón de las estrellas. 💫',
    ];
  }
  return [
    `¡Hola, ${yo.nombre}! 🌌`,
    `Este es el rincón secreto de ${pareja.nombre}. Tú también puedes jugar y coleccionar tus stickers.`,
    `Y aquí puedes guardar recuerdos y meter frases bonitas en el frasco de ${pareja.nombre}. 💛`,
  ];
}

// Lo que dicen las estrellitas cuando las tocas.
export function dichos({ yo, pareja, esSuya }) {
  const comunes = [
    '¡Hola! ✨', 'Shhh… este lugar es secreto 🤫', 'Respira hondo… 🌙', '¿Ya atrapaste la estrella de hoy? 🌠',
    'Las estrellas también se equivocan… y siguen brillando', 'Me haces cosquillas ✨', '¡Wiii! 💫',
    'Aquí el tiempo va despacito', 'Una estrella fugaz me contó un secreto: eres increíble',
  ];
  if (!esSuya) return [...comunes, `¡${pareja.nombre} va a amar este lugar!`, `Gracias por hacerle esto a ${pareja.nombre} 💛`];
  return [
    ...comunes,
    `${yo.nombre}, hoy brillas más que yo`, '¿Me dibujas algún día? 🥺', 'Tus colores me gustan mucho',
    `${pareja.nombre} te quiere muchísimo (me lo dijo)`, 'Cada día dibujas más bonito, lo juro ⭐',
    'Eres artista. No es pregunta 💛', 'Tus dibujos tienen algo que nadie más tiene: a ti',
  ];
}

// ------------------------------------------------------------------ el frasco de estrellas
// Las frases que ya trae el frasco (además de las que escriba la pareja). Están pensadas
// para cuando Eli dude de su arte: que se acuerde de que sí es artista.
export const FRASES = [
  'Tus dibujos no tienen que gustarle a todo el mundo. Ya le encantan a quien más importa.',
  'Que dudes de tu arte no significa que no seas artista. Significa que te importa.',
  'No compares tu comienzo con el final de alguien más.',
  'Cada trazo que haces es tuyo, y eso ya lo hace especial.',
  'Los "errores" en el papel también son parte del dibujo.',
  'Me encanta verte dibujar: pones una carita de concentración preciosa.',
  'Dibujar es una forma de abrazar las cosas que te gustan.',
  'No necesitas permiso de nadie para llamarte artista.',
  'Hoy no tiene que salir perfecto. Solo tiene que salir.',
  'Mira tus dibujos de hace un mes. ¿Ves cuánto has crecido?',
  'Tu estilo es tuyo y de nadie más. Eso es un superpoder.',
  'Los grandes artistas también tienen días en que nada les sale.',
  'Cuando dibujas, el mundo se vuelve un poquito más bonito.',
  'Eres más talentosa de lo que tu cabeza te deja creer.',
  'Si hoy te frustras, descansa. Mañana el lápiz te va a estar esperando.',
  'Cada dibujo que haces es una carta de amor al mundo.',
  'No dibujas mal: dibujas a tu manera, y tu manera es bonita.',
  'La práctica no se nota de un día para otro, pero siempre está sumando.',
  'Tu arte me hace sonreír, aunque tú no lo veas.',
  'Equivocarse es dibujar con valentía.',
  'Ningún dibujo es una pérdida de tiempo: todos te enseñan algo.',
  'Tienes una forma de ver los colores que me encanta.',
  'Lo importante no es que quede perfecto, sino que lo hiciste tú.',
  'Si una estrella se apagara cada vez que dudas, el cielo seguiría lleno de ti.',
  'Algún día vas a mirar atrás y vas a estar orgullosa de cada garabato.',
  'No hay artistas "de verdad" y "de mentira". Hay personas que crean. Y tú creas.',
  'Tus manos hacen magia, aunque a veces se tropiecen.',
  'Me guardo cada uno de tus dibujos como un tesoro.',
  'Está bien tomarse un descanso. El talento no se va a ningún lado.',
  'El arte no es una competencia: es un lugar donde puedes ser tú.',
  'Lo que a ti te parece "normalito", a mí me parece precioso.',
  'Eres artista desde el primer día que agarraste un lápiz con ganas.',
  'Respira. Suelta el "debería". Dibuja por diversión.',
  'Tus personajes tienen alma. Eso es lo más difícil de dibujar.',
  'Dibujar juntos es mi parte favorita del día.',
  'Ser dura contigo misma no te hace mejor artista; ser amable sí.',
  'Hoy el universo quiere recordarte que eres increíble. ✨',
  'Tu creatividad es como una galaxia: infinita y llena de luz.',
  'No importa si a alguien más le gusta: importa cuánto lo disfrutaste.',
  'Te admiro mucho, ¿sabías? Por cómo sigues intentando.',
  'Un dibujo chiquito también es un dibujo. Y cuenta.',
  'Lo que dibujas hoy es el "antes" de algo muy bonito.',
];

// ------------------------------------------------------------------ las constelaciones
// El juego de unir estrellas. Cada constelación es una lista de puntos (en un cuadro de
// 0 a 1, con y hacia abajo) y de trazos (el orden en que se unen). Al terminarla aparece
// su frase, y se queda brillando en el cielo de la galaxia.
const arco = (cx, cy, r, desde, hasta, pasos) => Array.from({ length: pasos + 1 }, (_, i) => {
  const a = ((desde + ((hasta - desde) * i) / pasos) * Math.PI) / 180;
  return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
});
const elipse = (cx, cy, rx, ry, giro, pasos) => Array.from({ length: pasos }, (_, i) => {
  const a = (i / pasos) * Math.PI * 2;
  const x = Math.cos(a) * rx;
  const y = Math.sin(a) * ry;
  const g = (giro * Math.PI) / 180;
  return [cx + x * Math.cos(g) - y * Math.sin(g), cy + x * Math.sin(g) + y * Math.cos(g)];
});
const rotar = (puntos, grados, cx = 0.5, cy = 0.5) => {
  const g = (grados * Math.PI) / 180;
  return puntos.map(([x, y]) => [cx + (x - cx) * Math.cos(g) - (y - cy) * Math.sin(g), cy + (x - cx) * Math.sin(g) + (y - cy) * Math.cos(g)]);
};
// Un trazo de puntos seguidos (cerrado si `cerrar`): devuelve { puntos, trazos }.
function figura(...partes) {
  const puntos = [];
  const trazos = [];
  for (const { pts, cerrar } of partes) {
    const inicio = puntos.length;
    const indices = [];
    for (const p of pts) {
      // si el punto ya existe (otro trazo pasa por ahí), se reutiliza
      const ya = puntos.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.012);
      if (ya >= 0 && ya < inicio) indices.push(ya);
      else { puntos.push(p); indices.push(puntos.length - 1); }
    }
    if (cerrar) indices.push(indices[0]);
    trazos.push(indices);
  }
  return { puntos, trazos };
}
const estrella5 = (cx, cy, R, r) => Array.from({ length: 10 }, (_, i) => {
  const a = ((-90 + i * 36) * Math.PI) / 180;
  const rr = i % 2 === 0 ? R : r;
  return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
});
const flor = () => {
  const pts = [];
  for (let k = 0; k < 5; k += 1) {
    const a = -90 + k * 72;
    for (const [d, r] of [[-36, 0.11], [-20, 0.27], [0, 0.32], [20, 0.27]]) {
      const g = ((a + d) * Math.PI) / 180;
      pts.push([0.5 + Math.cos(g) * r, 0.4 + Math.sin(g) * r]);
    }
  }
  return pts;
};

export const CONSTELACIONES = [
  {
    id: 'corazon', nombre: 'El corazón', emoji: '💗',
    frase: 'Todo lo que dibujas lleva un pedacito de tu corazón. Por eso brilla.',
    ...figura({ pts: [[0.5, 0.88], [0.24, 0.62], [0.12, 0.4], [0.2, 0.2], [0.36, 0.16], [0.5, 0.3], [0.64, 0.16], [0.8, 0.2], [0.88, 0.4], [0.76, 0.62]], cerrar: true }),
  },
  {
    id: 'estrella', nombre: 'La estrellita', emoji: '⭐',
    frase: 'No tienes que ser perfecta para brillar. Ya brillas.',
    ...figura({ pts: estrella5(0.5, 0.53, 0.43, 0.18), cerrar: true }),
  },
  {
    id: 'luna', nombre: 'La luna dormilona', emoji: '🌙',
    frase: 'Hasta la luna tiene fases. En las noches en que dudas, sigues siendo luz.',
    ...figura({ pts: [...arco(0.5, 0.5, 0.4, -60, -300, 8), ...arco(0.78, 0.5, 0.355, 103, 257, 5).slice(1, -1)], cerrar: true }),
  },
  {
    id: 'gatito', nombre: 'La gatita curiosa', emoji: '🐱',
    frase: 'Dibujas como miras el mundo: con ternura. Eso no se aprende, se tiene.',
    ...figura(
      { pts: [[0.5, 0.82], [0.26, 0.72], [0.16, 0.52], [0.2, 0.32], [0.24, 0.1], [0.4, 0.26], [0.6, 0.26], [0.76, 0.1], [0.8, 0.32], [0.84, 0.52], [0.74, 0.72]], cerrar: true },
      { pts: [[0.42, 0.6], [0.5, 0.65], [0.58, 0.6]] },
      { pts: [[0.3, 0.56], [0.06, 0.5]] },
      { pts: [[0.7, 0.56], [0.94, 0.5]] },
    ),
  },
  {
    id: 'mapache', nombre: 'El mapache bandido', emoji: '🦝',
    frase: 'Un mapache bandido acaba de robarse tus dudas. Ahora solo queda tu talento.',
    ...figura(
      { pts: [[0.5, 0.84], [0.3, 0.76], [0.14, 0.58], [0.12, 0.4], [0.16, 0.2], [0.32, 0.16], [0.38, 0.28], [0.5, 0.26], [0.62, 0.28], [0.68, 0.16], [0.84, 0.2], [0.88, 0.4], [0.86, 0.58], [0.7, 0.76]], cerrar: true },
      { pts: [[0.18, 0.5], [0.34, 0.42], [0.5, 0.5], [0.66, 0.42], [0.82, 0.5]] },
    ),
  },
  {
    id: 'conejito', nombre: 'El conejito saltarín', emoji: '🐰',
    frase: 'Paso a pasito también se llega lejos. Cada dibujo cuenta.',
    ...figura({
      pts: [[0.5, 0.9], [0.32, 0.84], [0.24, 0.7], [0.27, 0.56], [0.35, 0.48], [0.28, 0.28], [0.3, 0.1], [0.38, 0.06], [0.44, 0.2], [0.45, 0.46],
        [0.55, 0.46], [0.56, 0.2], [0.62, 0.06], [0.7, 0.1], [0.72, 0.28], [0.65, 0.48], [0.73, 0.56], [0.76, 0.7], [0.68, 0.84]],
      cerrar: true,
    }),
  },
  {
    id: 'flor', nombre: 'La flor de los colores', emoji: '🌸',
    frase: 'Tu arte florece aunque tú no lo notes. Yo lo veo crecer cada día.',
    ...figura(
      { pts: flor(), cerrar: true },
      { pts: [[0.5, 0.51], [0.5, 0.72], [0.5, 0.94]] },
      { pts: [[0.5, 0.8], [0.68, 0.7], [0.64, 0.84], [0.5, 0.86]] },
    ),
  },
  {
    id: 'pincel', nombre: 'El pincel mágico', emoji: '🖌️',
    frase: 'El pincel no sabe de dibujos "buenos" o "malos". Solo sabe que lo usas con amor.',
    ...figura(
      { pts: rotar([[0.5, 0.06], [0.6, 0.2], [0.62, 0.32], [0.6, 0.36], [0.58, 0.46], [0.55, 0.9], [0.5, 0.95], [0.45, 0.9], [0.42, 0.46], [0.4, 0.36], [0.38, 0.32], [0.4, 0.2]], 28), cerrar: true },
      { pts: rotar([[0.4, 0.36], [0.6, 0.36]], 28) },
    ),
  },
  {
    id: 'taza', nombre: 'La tacita de calma', emoji: '☕',
    frase: 'Respira, toma un sorbito de calma. El arte también es descansar.',
    ...figura(
      { pts: [[0.2, 0.38], [0.24, 0.78], [0.3, 0.84], [0.62, 0.84], [0.68, 0.78], [0.72, 0.38]], cerrar: true },
      { pts: [[0.71, 0.46], [0.86, 0.47], [0.88, 0.59], [0.8, 0.69], [0.69, 0.7]] },
      { pts: [[0.4, 0.3], [0.36, 0.2], [0.42, 0.11], [0.38, 0.03]] },
      { pts: [[0.55, 0.3], [0.51, 0.2], [0.57, 0.11]] },
      { pts: [[0.12, 0.91], [0.8, 0.91]] },
    ),
  },
  {
    id: 'casita', nombre: 'La casita de los dos', emoji: '🏠',
    frase: 'Tus dibujos son mi lugar favorito para quedarme.',
    ...figura(
      { pts: [[0.24, 0.9], [0.24, 0.5], [0.5, 0.22], [0.76, 0.5], [0.76, 0.9]], cerrar: true },
      { pts: [[0.42, 0.9], [0.42, 0.68], [0.58, 0.68], [0.58, 0.9]] },
      { pts: [[0.63, 0.36], [0.63, 0.22], [0.7, 0.22], [0.7, 0.43]] },
    ),
  },
  {
    id: 'ballena', nombre: 'La ballena soñadora', emoji: '🐳',
    frase: 'Las cosas grandes y bonitas a veces van despacio. Como tú, aprendiendo.',
    ...figura(
      { pts: [[0.12, 0.54], [0.22, 0.38], [0.42, 0.32], [0.6, 0.38], [0.74, 0.5], [0.82, 0.48], [0.92, 0.34], [0.88, 0.5], [0.94, 0.62], [0.8, 0.58], [0.62, 0.68], [0.36, 0.72], [0.18, 0.66]], cerrar: true },
      { pts: [[0.3, 0.32], [0.28, 0.2], [0.22, 0.11]] },
      { pts: [[0.28, 0.2], [0.36, 0.11]] },
    ),
  },
  {
    id: 'planeta', nombre: 'El planeta de los sueños', emoji: '🪐',
    frase: 'Tienes un universo entero adentro. Cada dibujo es una ventanita a él.',
    ...figura(
      { pts: elipse(0.5, 0.5, 0.25, 0.25, 0, 10), cerrar: true },
      { pts: elipse(0.5, 0.5, 0.46, 0.13, -14, 12), cerrar: true },
    ),
  },
];

// ------------------------------------------------------------------ el álbum
export const ALBUM = {
  titulo: ({ yo }) => `El álbum de estrellas de ${yo.nombre}`,
  vacio: 'Cada día cae una estrella dorada. Atrápala y aquí aparece su sticker ⭐',
  completo: '¡Completaste el álbum! Eres oficialmente coleccionista de estrellas 🌟',
};
