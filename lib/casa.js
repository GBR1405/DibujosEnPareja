// La casa: cada dibujo les da monedas 🪙 (de los dos, una sola alcancía) y con ellas
// compran muebles para su casita en 2.5D, donde caminan sus personajes.
//
// Esta es la única lista de muebles: la app la recibe en /api/casa y dibuja cada uno en
// 3D según su `id` (public/js/casa/muebles3d.js). Se guarda el `id`, así que se pueden
// cambiar nombres y precios sin perder nada.
//
//   cat    muebles | deco (van en el piso) · pared (se cuelgan) · pintura | piso (el cuarto)
//   w, d   cuántas casillas ocupa (ancho y fondo, sin girar). En la pared, solo `w`.
//   uso    qué hacen los personajes con él (sentarse, dormir, mirar…), o nada
//   plano  se puede poner debajo de otros muebles (alfombras)

const LADO = 8; // el cuarto es de 8 x 8 casillas; cada pared tiene 8 lugares

const CATALOGO = [
  // ---- muebles
  { id: 'cama', nombre: 'Cama', cat: 'muebles', precio: 140, w: 2, d: 3, uso: 'dormir', emoji: '🛏️' },
  { id: 'sofa', nombre: 'Sofá', cat: 'muebles', precio: 110, w: 3, d: 1, uso: 'sentarse', emoji: '🛋️' },
  { id: 'sillon', nombre: 'Sillón', cat: 'muebles', precio: 60, w: 1, d: 1, uso: 'sentarse', emoji: '💺' },
  { id: 'silla', nombre: 'Silla', cat: 'muebles', precio: 25, w: 1, d: 1, uso: 'sentarse', emoji: '🪑' },
  { id: 'mesa', nombre: 'Mesa', cat: 'muebles', precio: 70, w: 2, d: 2, uso: 'comer', emoji: '🍽️' },
  { id: 'mesita', nombre: 'Mesita de noche', cat: 'muebles', precio: 30, w: 1, d: 1, emoji: '🗄️' },
  { id: 'librero', nombre: 'Librero', cat: 'muebles', precio: 80, w: 2, d: 1, uso: 'leer', emoji: '📚' },
  { id: 'tele', nombre: 'Tele', cat: 'muebles', precio: 120, w: 2, d: 1, uso: 'mirar', emoji: '📺' },
  { id: 'cocina', nombre: 'Cocinita', cat: 'muebles', precio: 130, w: 2, d: 1, uso: 'cocinar', emoji: '🍳' },
  { id: 'refri', nombre: 'Refri', cat: 'muebles', precio: 90, w: 1, d: 1, uso: 'comer', emoji: '🧃' },
  { id: 'escritorio', nombre: 'Escritorio', cat: 'muebles', precio: 85, w: 2, d: 1, uso: 'dibujar', emoji: '✏️' },
  { id: 'piano', nombre: 'Piano', cat: 'muebles', precio: 160, w: 2, d: 1, uso: 'tocar', emoji: '🎹' },
  { id: 'maquinita', nombre: 'Maquinita de juegos', cat: 'muebles', precio: 140, w: 1, d: 1, uso: 'jugar', emoji: '🕹️' },
  // ---- deco
  { id: 'matita', nombre: 'Matita', cat: 'deco', precio: 25, w: 1, d: 1, uso: 'regar', emoji: '🪴' },
  { id: 'planta', nombre: 'Planta grande', cat: 'deco', precio: 45, w: 1, d: 1, uso: 'regar', emoji: '🌿' },
  { id: 'lampara', nombre: 'Lámpara', cat: 'deco', precio: 40, w: 1, d: 1, emoji: '💡' },
  { id: 'alfombra', nombre: 'Alfombra', cat: 'deco', precio: 45, w: 3, d: 2, plano: true, emoji: '🟪' },
  { id: 'alfombra_redonda', nombre: 'Alfombra redonda', cat: 'deco', precio: 35, w: 2, d: 2, plano: true, emoji: '🟣' },
  { id: 'puf', nombre: 'Puf', cat: 'deco', precio: 25, w: 1, d: 1, uso: 'sentarse', emoji: '🟠' },
  { id: 'tocadiscos', nombre: 'Tocadiscos', cat: 'deco', precio: 75, w: 1, d: 1, uso: 'bailar', emoji: '🎵' },
  { id: 'pecera', nombre: 'Pecera', cat: 'deco', precio: 70, w: 1, d: 1, uso: 'mirar', emoji: '🐠' },
  { id: 'caballete', nombre: 'Caballete', cat: 'deco', precio: 65, w: 1, d: 1, uso: 'pintar', emoji: '🎨' },
  { id: 'peluche', nombre: 'Peluche gigante', cat: 'deco', precio: 55, w: 1, d: 1, uso: 'abrazar', emoji: '🧸' },
  // ☁️ Para Eli (le encanta Cinnamoroll): un perrito nube blanquito que vuela con sus orejas
  // (si lo tocas o lo abrazan, sale volando) y una mesita de rollitos de canela.
  { id: 'perrito_nube', nombre: 'Perrito nube', cat: 'deco', precio: 60, w: 1, d: 1, uso: 'abrazar', emoji: '☁️' },
  { id: 'rollitos', nombre: 'Mesita de rollitos de canela', cat: 'muebles', precio: 70, w: 1, d: 1, uso: 'comer', emoji: '🥐' },
  // ---- pared
  { id: 'cuadro', nombre: 'Cuadro con un dibujo', cat: 'pared', precio: 30, w: 1, uso: 'mirar', emoji: '🖼️' },
  { id: 'ventana', nombre: 'Ventana', cat: 'pared', precio: 60, w: 2, uso: 'mirar', emoji: '🌤️' },
  { id: 'reloj', nombre: 'Reloj', cat: 'pared', precio: 30, w: 1, emoji: '🕰️' },
  { id: 'repisa', nombre: 'Repisa con matitas', cat: 'pared', precio: 35, w: 2, emoji: '🪴' },
  { id: 'luces', nombre: 'Guirnalda de luces', cat: 'pared', precio: 45, w: 3, emoji: '✨' },
  { id: 'espejo', nombre: 'Espejo', cat: 'pared', precio: 40, w: 1, uso: 'mirar', emoji: '🪞' },
  // ---- el cuarto: pintura de las paredes y piso (se compran una vez)
  { id: 'pintura_crema', nombre: 'Crema', cat: 'pintura', precio: 0, color: '#fff1dc', emoji: '🎨' },
  { id: 'pintura_rosa', nombre: 'Rosita', cat: 'pintura', precio: 30, color: '#ffd6e0', emoji: '🎨' },
  { id: 'pintura_celeste', nombre: 'Celeste', cat: 'pintura', precio: 30, color: '#d4e8ff', emoji: '🎨' },
  { id: 'pintura_menta', nombre: 'Menta', cat: 'pintura', precio: 30, color: '#d3f3e6', emoji: '🎨' },
  { id: 'pintura_lavanda', nombre: 'Lavanda', cat: 'pintura', precio: 30, color: '#e4dcff', emoji: '🎨' },
  { id: 'pintura_durazno', nombre: 'Durazno', cat: 'pintura', precio: 30, color: '#ffe0c7', emoji: '🎨' },
  { id: 'pintura_nubes', nombre: 'Cielo con nubes', cat: 'pintura', precio: 45, color: '#cfe8ff', emoji: '☁️' },
  { id: 'piso_madera', nombre: 'Madera', cat: 'piso', precio: 0, color: '#d9a873', emoji: '🪵' },
  { id: 'piso_clara', nombre: 'Madera clarita', cat: 'piso', precio: 40, color: '#f0d3a8', emoji: '🪵' },
  { id: 'piso_baldosas', nombre: 'Baldosas', cat: 'piso', precio: 40, color: '#f4efe6', emoji: '🏁' },
  { id: 'piso_lila', nombre: 'Alfombrado lila', cat: 'piso', precio: 40, color: '#cbbcf2', emoji: '🟪' },
  { id: 'piso_menta', nombre: 'Alfombrado menta', cat: 'piso', precio: 40, color: '#b9e8d4', emoji: '🟩' },
  // ---- la casa misma
  { id: 'segundo_piso', nombre: 'Segundo piso (con escalera)', cat: 'casa', precio: 300, color: '#ffe08a', emoji: '🏠' },
];

const porId = new Map(CATALOGO.map((m) => [m.id, m]));
const POR_DEFECTO = { pintura: 'pintura_crema', piso: 'piso_madera' };
// Lo que se compra una sola vez y cambia la casa (no se pone en un lugar).
const DEL_CUARTO = new Set(['pintura', 'piso', 'casa']);
const esDelCuarto = (m) => Boolean(m) && DEL_CUARTO.has(m.cat);

// El segundo piso: la escalera va pegada a la pared izquierda, en las casillas x = 0,
// z = 3 a 6 del primer piso (se sube desde z = 7 hacia el fondo). Arriba, esas mismas
// casillas son el hueco de la escalera, y se llega a la casilla (0, 2).
const ESCALERA = { x: 0, desde: 3, hasta: 6, abajo: [0, 7], arriba: [0, 2] };
const enEscalera = (x, z) => x === ESCALERA.x && z >= ESCALERA.desde && z <= ESCALERA.hasta;

// Lo que da cada cosa. Se anota en la alcancía con una clave única, así nada se cobra
// dos veces aunque la app pregunte de nuevo.
const GANANCIAS = {
  dibujo: 10,      // cada dibujo terminado (de cada quien)
  pareja: 5,       // extra cuando los dos dibujaron ese día
  reto: 40,        // reto de la semana completado
  pregunta: 3,     // responder la pregunta del día
  carta: 5,        // escribir una cartita (una vez al día)
  semana: 20,      // cada 7 días de racha
};

// Las casillas que ocupa un mueble del piso puesto en (x, z) con giro `rot` (0 a 3).
function casillas(mueble, x, z, rot) {
  const girado = rot % 2 === 1;
  const w = girado ? mueble.d : mueble.w;
  const d = girado ? mueble.w : mueble.d;
  const lista = [];
  for (let i = 0; i < w; i += 1) for (let j = 0; j < d; j += 1) lista.push([x + i, z + j]);
  return lista;
}

// ¿Cabe `nuevo` ({ tipo, x, z, rot, pared, piso }) en la casa, con los `puestos` que ya
// hay? (sin contar el mismo mueble, si se está moviendo). `pisos`: 1, o 2 si compraron el
// segundo piso. Devuelve un error o null.
function revisarLugar(nuevo, puestos, { pisos = 1 } = {}) {
  const m = porId.get(nuevo.tipo);
  if (!m || esDelCuarto(m)) return 'mueble_invalido';
  const entero = (n, min, max) => Number.isInteger(n) && n >= min && n <= max;
  const piso = nuevo.piso == null ? 0 : nuevo.piso;
  if (!entero(piso, 0, pisos - 1)) return 'piso_invalido';
  const pisoDe = (p) => (p.piso == null ? 0 : p.piso);
  if (m.cat === 'pared') {
    if (nuevo.pared !== 'izq' && nuevo.pared !== 'der') return 'lugar_invalido';
    if (!entero(nuevo.x, 0, LADO - m.w)) return 'lugar_invalido';
    const ocupados = new Set();
    for (const p of puestos) {
      const o = porId.get(p.tipo);
      if (!o || o.cat !== 'pared' || p.id === nuevo.id || p.pared !== nuevo.pared || p.x == null || pisoDe(p) !== piso) continue;
      for (let i = 0; i < o.w; i += 1) ocupados.add(p.x + i);
    }
    for (let i = 0; i < m.w; i += 1) if (ocupados.has(nuevo.x + i)) return 'lugar_ocupado';
    return null;
  }
  if (!entero(nuevo.rot, 0, 3) || !entero(nuevo.x, 0, LADO - 1) || !entero(nuevo.z, 0, LADO - 1)) return 'lugar_invalido';
  const mias = casillas(m, nuevo.x, nuevo.z, nuevo.rot);
  if (mias.some(([x, z]) => x >= LADO || z >= LADO)) return 'lugar_invalido';
  // La escalera (abajo) y su hueco (arriba) no se pueden tapar.
  if (pisos >= 2 && mias.some(([x, z]) => enEscalera(x, z))) return 'lugar_ocupado';
  const ocupadas = new Set();
  for (const p of puestos) {
    const o = porId.get(p.tipo);
    if (!o || o.cat === 'pared' || p.id === nuevo.id || p.x == null || pisoDe(p) !== piso) continue;
    if (Boolean(o.plano) !== Boolean(m.plano)) continue; // una alfombra va debajo de lo que sea
    for (const [x, z] of casillas(o, p.x, p.z, p.rot)) ocupadas.add(`${x},${z}`);
  }
  return mias.some(([x, z]) => ocupadas.has(`${x},${z}`)) ? 'lugar_ocupado' : null;
}

// Los muebles del primer piso que quedarían encima de la escalera (al comprar el segundo piso).
function tapanLaEscalera(puestos) {
  return puestos.filter((p) => {
    const o = porId.get(p.tipo);
    if (!o || o.cat === 'pared' || esDelCuarto(o) || p.x == null || (p.piso || 0) !== 0) return false;
    return casillas(o, p.x, p.z, p.rot).some(([x, z]) => enEscalera(x, z));
  });
}

module.exports = {
  LADO, CATALOGO, POR_DEFECTO, GANANCIAS, ESCALERA, muebleDe: (id) => porId.get(id) || null, esDelCuarto, enEscalera, casillas, revisarLugar, tapanLaEscalera,
};
