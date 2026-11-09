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

// El personaje de la casa: como un dibujo, pero con fondo transparente (no se aplana
// sobre el papel). Entrada 3:4 en PNG o WebP; salida WebP de 480 x 640 con transparencia.
async function comprimirAvatar(buffer) {
  let meta;
  try {
    meta = await sharp(buffer, { limitInputPixels: 5_000_000 }).metadata();
  } catch {
    return null;
  }
  if (!['png', 'webp'].includes(meta.format) || !meta.width || !meta.height) return null;
  if (meta.width < 150 || meta.height < 200 || Math.abs(meta.width / meta.height - 0.75) > 0.03) return null;
  return sharp(buffer, { limitInputPixels: 5_000_000 })
    .ensureAlpha()
    .resize(480, 640, { fit: 'fill', kernel: 'lanczos3' })
    .webp({ quality: 85, alphaQuality: 90, effort: 4 })
    .toBuffer();
}

module.exports = { comprimir, comprimirAvatar };
