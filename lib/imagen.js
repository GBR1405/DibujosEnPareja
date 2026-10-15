// Compresión de dibujos. Se hace en el servidor, una sola vez, al terminar el dibujo
// (como ya no se puede editar, se puede comprimir fuerte).
//
// Entrada: la imagen que manda el teléfono (PNG, WebP o JPEG, proporción 3:4).
// Salida:  { imagen, mini }, dos WebP: el dibujo (15-40 KB; un dibujo muy cargado hasta ~65 KB)
//          y una miniatura (2-10 KB).

const sharp = require('sharp');

const FORMATOS = new Set(['png', 'webp', 'jpeg']);
const PAPEL = '#fffdf7';
const CALIDADES = [82, 70, 58, 46, 36];

async function comprimir(buffer, { ancho, alto, miniAncho, miniAlto, objetivoKB }) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 5_000_000 }).metadata();
  } catch {
    return null; // no es una imagen
  }
  if (!FORMATOS.has(meta.format) || !meta.width || !meta.height) return null;
  if (meta.width < 240 || meta.height < 320) return null;
  if (Math.abs(meta.width / meta.height - ancho / alto) > 0.03) return null; // debe ser 3:4

  const base = sharp(buffer, { limitInputPixels: 5_000_000 })
    .flatten({ background: PAPEL })
    .resize(ancho, alto, { fit: 'fill', kernel: 'lanczos3' });

  const tope = objetivoKB * 1024;
  let imagen;
  for (const quality of CALIDADES) {
    // eslint-disable-next-line no-await-in-loop
    imagen = await base.clone().webp({ quality, effort: 4, smartSubsample: true }).toBuffer();
    if (imagen.length <= tope) break;
  }

  const mini = await base.clone()
    .resize(miniAncho, miniAlto, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 70, effort: 5 })
    .toBuffer();

  return { imagen, mini };
}

module.exports = { comprimir };
