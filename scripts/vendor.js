// Prepara las librerías del navegador en public/vendor/ (npm run vendor).
//
// La app no tiene paso de "build": lo que está en public/ se sirve tal cual. Las dos
// librerías de afuera se empaquetan una sola vez con esbuild y el resultado se guarda en
// el repositorio, así Vercel no tiene que hacer nada:
//
//   public/vendor/three.js     Three.js, solo las piezas que usa la casa (≈ 1/3 del total)
//   public/vendor/freehand.js  perfect-freehand, para el pincel de tinta
//
// Si cambias de versión (package.json) o la casa usa otra pieza de Three.js, agrégala a
// PIEZAS y vuelve a correr `npm run vendor`.

const path = require('path');
const esbuild = require('esbuild');

const PIEZAS = [
  'WebGLRenderer', 'WebGLRenderTarget', 'Scene', 'OrthographicCamera', 'PerspectiveCamera', 'Color', 'Fog',
  'HemisphereLight', 'DirectionalLight', 'PointLight', 'AmbientLight',
  'Group', 'Mesh', 'Object3D', 'Sprite', 'SpriteMaterial',
  'BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'CapsuleGeometry', 'TorusGeometry',
  'PlaneGeometry', 'CircleGeometry', 'ExtrudeGeometry', 'LatheGeometry', 'Shape', 'BufferGeometry', 'Float32BufferAttribute',
  'MeshToonMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'ShaderMaterial',
  'DataTexture', 'CanvasTexture', 'Texture',
  'Raycaster', 'Vector2', 'Vector3', 'Quaternion', 'Euler', 'Plane', 'Box3', 'MathUtils', 'Timer',
  'BackSide', 'FrontSide', 'DoubleSide', 'RepeatWrapping', 'RedFormat', 'RGBAFormat', 'NearestFilter', 'LinearFilter',
  'SRGBColorSpace', 'PCFShadowMap', 'PCFSoftShadowMap', 'NoToneMapping', 'UnsignedByteType',
];

async function main() {
  const fuera = path.join(__dirname, '..', 'public', 'vendor');
  const comun = { bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none', logLevel: 'info' };
  await esbuild.build({
    ...comun,
    stdin: { contents: `export { ${PIEZAS.join(', ')} } from 'three';`, resolveDir: __dirname, loader: 'js' },
    outfile: path.join(fuera, 'three.js'),
    banner: { js: '/* three.js (MIT) https://threejs.org — solo las piezas que usa Garabatos (scripts/vendor.js) */' },
  });
  await esbuild.build({
    ...comun,
    stdin: { contents: "export { getStroke } from 'perfect-freehand';", resolveDir: __dirname, loader: 'js' },
    outfile: path.join(fuera, 'freehand.js'),
    banner: { js: '/* perfect-freehand (MIT) https://github.com/steveruizok/perfect-freehand */' },
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
