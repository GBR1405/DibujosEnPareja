// Prepara las librerías del navegador en public/vendor/ (npm run vendor).
//
// La app no tiene paso de "build": lo que está en public/ se sirve tal cual. Las librerías
// de afuera se empaquetan una sola vez con esbuild y el resultado se guarda en el
// repositorio, así Vercel no tiene que hacer nada:
//
//   public/vendor/three.js     Three.js, solo las piezas que usan la casa y la galaxia,
//                              más el "bloom" (el brillo de las estrellas)
//   public/vendor/freehand.js  perfect-freehand, para el pincel de tinta
//   public/vendor/gsap.js      GSAP, para las animaciones de la galaxia (la pantalla que se rompe…)
//   public/vendor/voronoi.js   d3-delaunay: las grietas y los pedazos de vidrio
//   public/vendor/confeti.js   canvas-confetti: lluvia de estrellitas al celebrar
//
// Si cambias de versión (package.json) o el código usa otra pieza de Three.js, agrégala a
// PIEZAS y vuelve a correr `npm run vendor`.

const path = require('path');
const esbuild = require('esbuild');

const PIEZAS = [
  'WebGLRenderer', 'WebGLRenderTarget', 'Scene', 'OrthographicCamera', 'PerspectiveCamera', 'Color', 'Fog', 'FogExp2',
  'HemisphereLight', 'DirectionalLight', 'PointLight', 'AmbientLight',
  'Group', 'Mesh', 'Object3D', 'Sprite', 'SpriteMaterial', 'Points', 'PointsMaterial', 'Line', 'LineSegments', 'LineLoop', 'LineBasicMaterial',
  'BoxGeometry', 'CylinderGeometry', 'SphereGeometry', 'ConeGeometry', 'CapsuleGeometry', 'TorusGeometry', 'IcosahedronGeometry', 'RingGeometry',
  'PlaneGeometry', 'CircleGeometry', 'ExtrudeGeometry', 'LatheGeometry', 'Shape', 'BufferGeometry', 'BufferAttribute', 'Float32BufferAttribute',
  'MeshToonMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial', 'MeshStandardMaterial', 'ShaderMaterial',
  'DataTexture', 'CanvasTexture', 'Texture',
  'Raycaster', 'Vector2', 'Vector3', 'Vector4', 'Matrix4', 'Quaternion', 'Euler', 'Plane', 'Box3', 'Spherical', 'MathUtils', 'Timer', 'Clock',
  'BackSide', 'FrontSide', 'DoubleSide', 'RepeatWrapping', 'RedFormat', 'RGBAFormat', 'NearestFilter', 'LinearFilter',
  'AdditiveBlending', 'NormalBlending',
  'SRGBColorSpace', 'PCFShadowMap', 'PCFSoftShadowMap', 'NoToneMapping', 'ACESFilmicToneMapping', 'UnsignedByteType',
];
// Lo que no está en el núcleo de Three.js: el "bloom" (brillo) de la galaxia.
const EXTRAS = {
  EffectComposer: 'three/addons/postprocessing/EffectComposer.js',
  RenderPass: 'three/addons/postprocessing/RenderPass.js',
  UnrealBloomPass: 'three/addons/postprocessing/UnrealBloomPass.js',
  OutputPass: 'three/addons/postprocessing/OutputPass.js',
};

async function main() {
  const fuera = path.join(__dirname, '..', 'public', 'vendor');
  const comun = { bundle: true, format: 'esm', minify: true, target: 'es2020', legalComments: 'none', logLevel: 'info' };
  const empaquetar = (contenido, archivo, banner) => esbuild.build({
    ...comun,
    stdin: { contents: contenido, resolveDir: __dirname, loader: 'js' },
    outfile: path.join(fuera, archivo),
    banner: { js: banner },
  });
  await empaquetar(
    [`export { ${PIEZAS.join(', ')} } from 'three';`, ...Object.entries(EXTRAS).map(([n, r]) => `export { ${n} } from '${r}';`)].join('\n'),
    'three.js',
    '/* three.js (MIT) https://threejs.org — solo las piezas que usa Garabatos (scripts/vendor.js) */',
  );
  await empaquetar("export { getStroke } from 'perfect-freehand';", 'freehand.js', '/* perfect-freehand (MIT) https://github.com/steveruizok/perfect-freehand */');
  await empaquetar("export { gsap } from 'gsap';", 'gsap.js', '/* GSAP (Standard "No Charge" License) https://gsap.com/standard-license */');
  await empaquetar("export { Delaunay } from 'd3-delaunay';", 'voronoi.js', '/* d3-delaunay (ISC) https://github.com/d3/d3-delaunay */');
  await empaquetar("export { default as confeti } from 'canvas-confetti';", 'confeti.js', '/* canvas-confetti (ISC) https://github.com/catdad/canvas-confetti */');
}

main().catch((err) => { console.error(err); process.exit(1); });
