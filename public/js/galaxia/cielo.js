// El cielo de la galaxia, en 3D (Three.js + "bloom", el brillo suave de las luces).
//
//   - Al fondo: miles de estrellas que titilan, una galaxia espiral que gira despacito,
//     nebulosas de colores y, de vez en cuando, una estrella fugaz.
//   - Los planetas son el menú: Nuestra historia (rosado, con anillo y fotitos), el
//     frasco de estrellitas (de vidrio, con estrellas adentro), Constelaciones (un
//     cristal azul), Saltitos (menta, dormilón, con lunitas) y el Álbum (amarillo, con
//     stickers pegados).
//   - Estrellitas amigas que flotan por ahí: si las tocas, dan una vuelta y te dicen algo.
//   - La estrella dorada del día: cruza el cielo cada ratito hasta que la atrapes.
//   - Los recuerdos con foto flotan como burbujas, y las constelaciones que ya completaste
//     se quedan brillando en el cielo.
//
// Los nombres de los planetas son botones de HTML (galaxia.js): aquí solo se dice dónde
// quedan en la pantalla, cuadro a cuadro.

import * as THREE from '../../vendor/three.js';
import { gsap } from '../../vendor/gsap.js';
import { CONSTELACIONES } from './textos.js';

const azar = (a, b) => a + Math.random() * (b - a);
const suave = (actual, meta, rapidez, dt) => actual + (meta - actual) * (1 - Math.exp(-rapidez * dt));

export const PLANETAS = ['recuerdos', 'frasco', 'constelaciones', 'saltitos', 'album'];
// Dónde va cada cosa, en coordenadas de pantalla (-1 a 1), con el teléfono parado o acostado.
const LUGARES = {
  vertical: {
    recuerdos: [-0.42, 0.5], frasco: [0.44, 0.3], constelaciones: [-0.42, 0.02], saltitos: [0.42, -0.25], album: [-0.08, -0.56],
  },
  horizontal: {
    recuerdos: [-0.66, 0.2], frasco: [-0.33, -0.3], constelaciones: [0, 0.22], saltitos: [0.33, -0.3], album: [0.66, 0.2],
  },
};
const AMIGUITOS = [
  { color: '#ffe27a', vertical: [0.56, 0.64], horizontal: [-0.86, -0.5] },
  { color: '#ffb8d9', vertical: [-0.7, -0.3], horizontal: [-0.17, 0.62] },
  { color: '#b9ecff', vertical: [0.7, -0.52], horizontal: [0.17, -0.66] },
  { color: '#d8c4ff', vertical: [-0.64, 0.8], horizontal: [0.86, -0.46] },
];
// Dónde aparece cada constelación completada (en el fondo del cielo).
const RINCONES = [[-0.62, 0.8], [0.58, 0.86], [-0.74, 0.2], [0.76, 0.06], [-0.66, -0.74], [0.62, -0.82], [0.06, 0.66], [-0.16, -0.9], [0.26, -0.64], [-0.3, 0.36], [0.36, 0.46], [0.02, -0.26]];

// ------------------------------------------------------------------ texturas hechas a mano
function lienzo(ancho, alto = ancho) {
  const c = document.createElement('canvas');
  c.width = ancho;
  c.height = alto;
  return c;
}
function textura(c) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function texturaBrillo() {
  const c = lienzo(128);
  const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.22, 'rgba(255,255,255,.55)');
  g.addColorStop(0.55, 'rgba(255,255,255,.12)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  return textura(c);
}
function texturaNube() {
  const c = lienzo(256);
  const x = c.getContext('2d');
  for (let i = 0; i < 11; i += 1) {
    const cx = 128 + azar(-55, 55);
    const cy = 128 + azar(-55, 55);
    const r = azar(40, 112);
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, 'rgba(255,255,255,.28)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 256, 256);
  }
  return textura(c);
}
function texturaFugaz() {
  const c = lienzo(256, 16);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.85, 'rgba(220,235,255,.85)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, 8);
  x.lineTo(250, 4);
  x.arc(250, 8, 4, -Math.PI / 2, Math.PI / 2);
  x.closePath();
  x.fill();
  return textura(c);
}
function texturaFondo() {
  const c = lienzo(4, 512);
  const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#050816');
  g.addColorStop(0.45, '#0b0f2e');
  g.addColorStop(0.8, '#1a1040');
  g.addColorStop(1, '#2a1446');
  x.fillStyle = g;
  x.fillRect(0, 0, 4, 512);
  return textura(c);
}
function texturaPolaroid() {
  const c = lienzo(64, 76);
  const x = c.getContext('2d');
  x.fillStyle = '#fffdf7';
  x.fillRect(2, 2, 60, 72);
  const g = x.createLinearGradient(8, 8, 56, 56);
  g.addColorStop(0, '#ffb3d1');
  g.addColorStop(1, '#a9b8ff');
  x.fillStyle = g;
  x.fillRect(8, 8, 48, 46);
  x.fillStyle = '#fff';
  x.font = '22px sans-serif';
  x.textAlign = 'center';
  x.fillText('♥', 32, 40);
  return textura(c);
}

// Una estrella redondita (para las amigas, la dorada, las del frasco y los stickers).
function formaEstrella(R, r, redondeo = 0.2) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) {
    const a = Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? R : r;
    pts.push([Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const mezcla = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i += 1) {
    const ant = pts[(i + 9) % 10];
    const act = pts[i];
    const sig = pts[(i + 1) % 10];
    const t = i % 2 === 0 ? redondeo : redondeo * 0.7;
    const a = mezcla(act, ant, t);
    const b = mezcla(act, sig, t);
    if (i === 0) s.moveTo(a[0], a[1]); else s.lineTo(a[0], a[1]);
    s.quadraticCurveTo(act[0], act[1], b[0], b[1]);
  }
  s.closePath();
  return s;
}
function geometriaEstrella(R, { r = R * 0.52, fondo = R * 0.3, bisel = R * 0.22 } = {}) {
  const geo = new THREE.ExtrudeGeometry(formaEstrella(R, r), {
    depth: fondo, bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel * 0.75, bevelSegments: 4, curveSegments: 6,
  });
  geo.translate(0, 0, -fondo / 2);
  return { geo, frente: fondo / 2 + bisel };
}

// ------------------------------------------------------------------ estrellas que titilan
const VERTICE_ESTRELLAS = `
  attribute float tam;
  attribute float fase;
  attribute vec3 tono;
  uniform float tiempo;
  uniform float escala;
  varying vec3 vTono;
  varying float vBrillo;
  void main() {
    vTono = tono;
    vBrillo = 0.62 + 0.38 * sin(tiempo * (0.7 + fract(fase * 7.31) * 2.1) + fase * 6.2831);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = clamp(tam * escala * (0.82 + 0.3 * vBrillo) / -mv.z, 1.0, 64.0);
    gl_Position = projectionMatrix * mv;
  }`;
const FRAGMENTO_ESTRELLAS = `
  varying vec3 vTono;
  varying float vBrillo;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float nucleo = smoothstep(0.5, 0.0, d);
    nucleo *= nucleo;
    float cruz = (1.0 - smoothstep(0.0, 0.05, abs(c.x))) * (1.0 - smoothstep(0.0, 0.5, abs(c.y)))
               + (1.0 - smoothstep(0.0, 0.05, abs(c.y))) * (1.0 - smoothstep(0.0, 0.5, abs(c.x)));
    float a = clamp(nucleo + cruz * 0.35, 0.0, 1.0) * vBrillo;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vTono, a);
    #include <colorspace_fragment>
  }`;

function materialEstrellas(uniformes) {
  return new THREE.ShaderMaterial({
    uniforms: uniformes,
    vertexShader: VERTICE_ESTRELLAS,
    fragmentShader: FRAGMENTO_ESTRELLAS,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
}

function nubeDePuntos(cantidad, colocar, uniformes) {
  const pos = new Float32Array(cantidad * 3);
  const tam = new Float32Array(cantidad);
  const fase = new Float32Array(cantidad);
  const tono = new Float32Array(cantidad * 3);
  const color = new THREE.Color();
  for (let i = 0; i < cantidad; i += 1) {
    const p = colocar(i, color);
    pos.set([p.x, p.y, p.z], i * 3);
    tam[i] = p.tam;
    fase[i] = Math.random();
    tono.set([color.r, color.g, color.b], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('tam', new THREE.BufferAttribute(tam, 1));
  geo.setAttribute('fase', new THREE.BufferAttribute(fase, 1));
  geo.setAttribute('tono', new THREE.BufferAttribute(tono, 3));
  const puntos = new THREE.Points(geo, materialEstrellas(uniformes));
  puntos.frustumCulled = false;
  return puntos;
}

// ================================================================== el cielo
export function crearCielo(contenedor, opciones = {}) {
  const {
    alTocarPlaneta = () => {}, alAtrapar = () => {}, alTocarAmiguito = () => {}, alTocarRecuerdo = () => {}, alTocarVacio = () => {},
    alCuadro = () => {},
  } = opciones;

  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' });
  let dpr = Math.min(1.5, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x050816, 1);
  renderer.domElement.className = 'gx-lienzo';
  contenedor.append(renderer.domElement);

  const escena = new THREE.Scene();
  const fondo = texturaFondo();
  escena.background = fondo;
  const camara = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
  camara.position.set(0, 0, 10);
  const mira = new THREE.Vector3(0, 0, 0);
  const camaraBase = new THREE.Vector3(0, 0, 10);

  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(escena, camara));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.48, 0.38, 0.72);
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());
  let conBrillo = true;

  escena.add(new THREE.HemisphereLight(0xdfe4ff, 0x4a3266, 1.15));
  const sol = new THREE.DirectionalLight(0xfff1de, 1.7);
  sol.position.set(-4, 6, 8);
  escena.add(sol);
  const contraluz = new THREE.DirectionalLight(0x9db8ff, 0.9);
  contraluz.position.set(5, -3, -4);
  escena.add(contraluz);

  const tiempo = { value: 0 };
  const escala = { value: 400 };
  const uniformes = { tiempo, escala };
  const brillo = texturaBrillo();
  const desechables = [fondo, brillo];

  // ---------------------------------------------------------------- el universo de fondo
  const universo = new THREE.Group();
  escena.add(universo);
  const COLORES_ESTRELLA = ['#ffffff', '#ffffff', '#dfe8ff', '#ffe9f6', '#fff4d6', '#cfe0ff'];
  universo.add(nubeDePuntos(1700, (i, color) => {
    color.set(COLORES_ESTRELLA[i % COLORES_ESTRELLA.length]);
    return { x: azar(-80, 80), y: azar(-80, 80), z: azar(-95, -14), tam: azar(0.16, 0.5) * (Math.random() < 0.06 ? 2.2 : 1) };
  }, uniformes));

  // la galaxia espiral
  const espiral = new THREE.Group();
  espiral.position.set(2.6, 3.2, -30);
  espiral.rotation.set(1.08, 0.2, -0.45);
  universo.add(espiral);
  const centro = new THREE.Color('#ffe6c2');
  const brazos = [new THREE.Color('#a98cff'), new THREE.Color('#7fb6ff'), new THREE.Color('#ff9fd6')];
  espiral.add(nubeDePuntos(7000, (i, color) => {
    const brazo = i % 3;
    const t = Math.random() ** 0.65;
    const r = t * 11;
    const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
    const ang = (brazo / 3) * Math.PI * 2 + r * 0.62 + gauss() * (0.45 - t * 0.25);
    const disperso = (0.25 + (1 - t) * 0.5) * gauss();
    color.copy(centro).lerp(brazos[(brazo + (Math.random() < 0.2 ? 1 : 0)) % 3], Math.min(1, t * 1.5));
    return {
      x: Math.cos(ang) * r + disperso, y: gauss() * 0.35 * (1 - t * 0.8), z: Math.sin(ang) * r + disperso,
      tam: azar(0.1, 0.28) * (1.5 - t),
    };
  }, uniformes));
  const nucleo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, color: '#ffd9b5', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
  nucleo.scale.set(7, 7, 1);
  espiral.add(nucleo);

  // nebulosas
  const nube = texturaNube();
  desechables.push(nube);
  const nebulosas = [
    ['#ff6fc0', -9, 6, -42, 30], ['#7d64ff', 8, -4, -48, 36], ['#40b8ff', -6, -12, -40, 28],
    ['#ff9a6b', 11, 13, -55, 30], ['#5df2d0', -14, -2, -60, 34], ['#c37bff', 3, -18, -46, 32], ['#ff80b0', 2, 16, -50, 26],
  ].map(([color, x, y, z, tam]) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: nube, color, transparent: true, opacity: azar(0.18, 0.3), blending: THREE.AdditiveBlending, depthWrite: false }));
    s.position.set(x, y, z);
    s.scale.set(tam, tam, 1);
    s.material.rotation = Math.random() * Math.PI * 2;
    s.userData.giro = azar(-0.02, 0.02);
    universo.add(s);
    return s;
  });

  // estrellas fugaces (de adorno)
  const fugazTex = texturaFugaz();
  desechables.push(fugazTex);
  const fugaces = [];
  let proximaFugaz = 3;
  function lanzarFugaz() {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: fugazTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    const ang = azar(-0.9, -0.35) + (Math.random() < 0.5 ? 0 : Math.PI);
    const dir = new THREE.Vector3(Math.cos(ang), Math.sin(ang), 0);
    s.material.rotation = ang;
    s.scale.set(4.5, 0.09, 1);
    s.position.set(azar(-14, 14), azar(2, 16), azar(-34, -24));
    universo.add(s);
    fugaces.push({ s, dir, vida: 0, dura: azar(0.7, 1.1), vel: azar(16, 24) });
  }

  // ---------------------------------------------------------------- materiales
  const tonos = new THREE.DataTexture(new Uint8Array([90, 150, 215, 255]), 4, 1, THREE.RedFormat);
  tonos.minFilter = THREE.NearestFilter;
  tonos.magFilter = THREE.NearestFilter;
  tonos.needsUpdate = true;
  desechables.push(tonos);
  const toon = (color, extra = {}) => new THREE.MeshToonMaterial({ color, gradientMap: tonos, ...extra });
  const halo = (color, tam, opacidad = 0.5) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: brillo, color, transparent: true, opacity: opacidad, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.scale.set(tam, tam, 1);
    return s;
  };
  const oscuro = new THREE.MeshBasicMaterial({ color: '#2b1d3d' });
  const blanco = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  const rubor = new THREE.MeshBasicMaterial({ color: '#ff8fb8', transparent: true, opacity: 0.8, depthWrite: false });

  // Una carita (ojos, cachetes y sonrisa) mirando hacia +z, a `z` del centro.
  function carita(R, z, { dormida = false } = {}) {
    const g = new THREE.Group();
    if (dormida) {
      for (const lado of [-1, 1]) {
        const ojo = new THREE.Mesh(new THREE.TorusGeometry(R * 0.1, R * 0.025, 6, 14, Math.PI), oscuro);
        ojo.rotation.z = Math.PI;
        ojo.position.set(lado * R * 0.3, R * 0.06, z);
        g.add(ojo);
      }
    } else {
      for (const lado of [-1, 1]) {
        const ojo = new THREE.Mesh(new THREE.SphereGeometry(R * 0.085, 12, 10), oscuro);
        ojo.scale.set(1, 1.35, 0.55);
        ojo.position.set(lado * R * 0.25, R * 0.05, z);
        const luz = new THREE.Mesh(new THREE.SphereGeometry(R * 0.03, 8, 6), blanco);
        luz.position.set(lado * R * 0.25 + R * 0.03, R * 0.1, z + R * 0.04);
        g.add(ojo, luz);
        g.userData.ojos = [...(g.userData.ojos || []), ojo];
      }
    }
    for (const lado of [-1, 1]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(R * 0.1, 16), rubor);
      c.scale.set(1, 0.62, 1);
      c.position.set(lado * R * 0.46, -R * 0.12, z + 0.004);
      g.add(c);
    }
    const boca = new THREE.Mesh(new THREE.TorusGeometry(R * 0.08, R * 0.022, 6, 14, Math.PI), oscuro);
    boca.rotation.z = Math.PI;
    boca.position.set(0, -R * 0.08, z + 0.002);
    g.add(boca);
    return g;
  }

  // ---------------------------------------------------------------- los planetas
  const planetas = new THREE.Group();
  escena.add(planetas);
  const golpeGeo = new THREE.SphereGeometry(1, 12, 10);
  const golpeMat = new THREE.MeshBasicMaterial({ visible: false });
  const porId = new Map();

  function planeta(id, radio, armar) {
    const g = new THREE.Group();
    g.userData = { id, radio, fase: Math.random() * 6.28, salto: 0 };
    const cuerpo = new THREE.Group();
    g.add(cuerpo);
    armar(cuerpo, g);
    const golpe = new THREE.Mesh(golpeGeo, golpeMat);
    golpe.scale.setScalar(radio * 1.55);
    golpe.userData.planeta = id;
    g.add(golpe);
    g.scale.setScalar(0.001);
    planetas.add(g);
    porId.set(id, { g, cuerpo, golpe, radio });
    return g;
  }

  // Nuestra historia: rosado, con anillo y fotitos que dan vueltas.
  const polaroidTex = texturaPolaroid();
  desechables.push(polaroidTex);
  planeta('recuerdos', 0.58, (c) => {
    c.add(new THREE.Mesh(new THREE.SphereGeometry(0.58, 40, 28), toon('#ff9fc6')));
    const franja = new THREE.Mesh(new THREE.SphereGeometry(0.585, 40, 8, 0, Math.PI * 2, 1.2, 0.35), toon('#ffc2db'));
    c.add(franja);
    const plano = new THREE.Group();
    plano.rotation.set(1.2, 0.3, 0);
    plano.add(new THREE.Mesh(new THREE.RingGeometry(0.8, 1.06, 72), new THREE.MeshBasicMaterial({ color: '#ffe3f0', transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false })));
    const orbita = new THREE.Group();
    for (let i = 0; i < 3; i += 1) {
      const foto = new THREE.Sprite(new THREE.SpriteMaterial({ map: polaroidTex }));
      const a = (i / 3) * Math.PI * 2;
      foto.position.set(Math.cos(a) * 0.93, Math.sin(a) * 0.93, 0.02);
      foto.scale.set(0.22, 0.26, 1);
      orbita.add(foto);
    }
    plano.add(orbita);
    c.add(plano, halo('#ff9fc6', 2.1, 0.2));
    c.userData.animar = (t) => { orbita.rotation.z = t * 0.35; c.rotation.y = Math.sin(t * 0.3) * 0.25; };
  });

  // El frasco de estrellitas: de vidrio, con corcho, lacito y estrellas que brillan adentro.
  planeta('frasco', 0.6, (c) => {
    const perfil = [[0.001, -0.62], [0.36, -0.62], [0.49, -0.56], [0.55, -0.42], [0.56, 0.16], [0.52, 0.31], [0.4, 0.41], [0.3, 0.45], [0.3, 0.55], [0.34, 0.58]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    const vidrio = new THREE.Mesh(new THREE.LatheGeometry(perfil, 48), new THREE.MeshStandardMaterial({
      color: '#dcefff', transparent: true, opacity: 0.2, roughness: 0.06, metalness: 0, emissive: '#7aa0e0', emissiveIntensity: 0.08,
      side: THREE.DoubleSide, depthWrite: false,
    }));
    const corcho = new THREE.Mesh(new THREE.CylinderGeometry(0.33, 0.3, 0.2, 24), toon('#d9a066'));
    corcho.position.y = 0.66;
    const lazo = new THREE.Mesh(new THREE.TorusGeometry(0.315, 0.035, 8, 32), toon('#ff8fb8'));
    lazo.rotation.x = Math.PI / 2;
    lazo.position.y = 0.47;
    const adentro = new THREE.Group();
    const colores = ['#ffe27a', '#ffb3d6', '#b5e8ff', '#c9b6ff', '#a8f0d0'];
    for (let i = 0; i < 11; i += 1) {
      const { geo } = geometriaEstrella(0.1);
      const color = colores[i % colores.length];
      const e = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, roughness: 0.6 }));
      const a = Math.random() * Math.PI * 2;
      const r = azar(0, 0.34);
      e.position.set(Math.cos(a) * r, azar(-0.5, -0.05) + (i > 7 ? 0.2 : 0), Math.sin(a) * r);
      e.rotation.set(azar(0, 6), azar(0, 6), azar(0, 6));
      e.userData = { fase: Math.random() * 6.28, base: e.position.y };
      adentro.add(e);
    }
    const luz = halo('#ffd98a', 1.3, 0.32);
    luz.position.y = -0.2;
    c.add(adentro, luz, vidrio, corcho, lazo, halo('#bfe0ff', 2.2, 0.14));
    c.userData.animar = (t) => {
      c.rotation.y = Math.sin(t * 0.4) * 0.4;
      c.rotation.z = Math.sin(t * 0.7) * 0.06;
      for (const e of adentro.children) {
        e.position.y = e.userData.base + Math.sin(t * 1.3 + e.userData.fase) * 0.04;
        e.rotation.y += 0.01;
      }
      luz.material.opacity = 0.28 + Math.sin(t * 1.7) * 0.07;
    };
  });

  // Constelaciones: un cristal azul con una constelación chiquita alrededor.
  planeta('constelaciones', 0.52, (c) => {
    const cristal = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5, 1), new THREE.MeshStandardMaterial({
      color: '#9cc2ff', flatShading: true, roughness: 0.28, metalness: 0.15, emissive: '#3452b8', emissiveIntensity: 0.28,
    }));
    const anillo = new THREE.Group();
    anillo.rotation.set(1.1, 0, 0.4);
    const pts = Array.from({ length: 7 }, (_, i) => {
      const a = (i / 7) * Math.PI * 2 + azar(-0.25, 0.25);
      const r = azar(0.78, 0.98);
      return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, azar(-0.08, 0.08));
    });
    anillo.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#d5e4ff', transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false })));
    for (const p of pts) {
      const s = halo('#ffffff', 0.18, 0.75);
      s.position.copy(p);
      anillo.add(s);
    }
    c.add(cristal, anillo, halo('#7fb2ff', 2, 0.2));
    c.userData.animar = (t) => { cristal.rotation.y = t * 0.3; cristal.rotation.x = t * 0.17; anillo.rotation.z = t * 0.25; };
  });

  // Saltitos: un planeta menta dormilón, con dos lunitas.
  planeta('saltitos', 0.5, (c) => {
    c.add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 40, 28), toon('#86e3c8')));
    const cara = carita(0.5, 0.5, { dormida: true });
    c.add(cara);
    const lunas = [[0.11, '#fff3b0', 0.86, 1.2, 0.45], [0.08, '#ffc4dc', 1.02, -0.8, -0.35]].map(([r, color, d, vel, incl]) => {
      const orbita = new THREE.Group();
      orbita.rotation.x = incl;
      const luna = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), toon(color));
      luna.position.x = d;
      orbita.add(luna);
      orbita.userData.vel = vel;
      c.add(orbita);
      return orbita;
    });
    c.add(halo('#86e3c8', 1.9, 0.18));
    c.userData.animar = (t) => {
      for (const o of lunas) o.rotation.y = t * o.userData.vel;
      cara.position.y = Math.sin(t * 0.9) * 0.015;
      c.rotation.z = Math.sin(t * 0.5) * 0.08;
    };
  });

  // El álbum: amarillo, con stickers de estrellitas pegados y una cinta lila.
  planeta('album', 0.55, (c) => {
    const bola = new THREE.Group();
    bola.add(new THREE.Mesh(new THREE.SphereGeometry(0.55, 40, 28), toon('#ffd66e')));
    const colores = ['#ffffff', '#ffb3d6', '#9fd8ff', '#a8f0d0', '#d6c4ff', '#ffffff', '#ff9fb8'];
    const forma = formaEstrella(0.1, 0.05, 0.22);
    colores.forEach((color, i) => {
      const s = new THREE.Mesh(new THREE.ExtrudeGeometry(forma, { depth: 0.02, bevelEnabled: false, curveSegments: 4 }), toon(color));
      const phi = Math.acos(azar(-0.7, 0.9));
      const theta = (i / colores.length) * Math.PI * 2 + azar(-0.3, 0.3);
      const dir = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta));
      s.position.copy(dir).multiplyScalar(0.545);
      s.lookAt(dir.clone().multiplyScalar(2));
      s.rotateZ(azar(0, 6.28));
      bola.add(s);
    });
    const cinta = new THREE.Mesh(new THREE.TorusGeometry(0.74, 0.028, 8, 72), toon('#c9b0ff'));
    cinta.rotation.set(1.3, 0.2, 0);
    c.add(bola, cinta, halo('#ffd66e', 2.1, 0.2));
    c.userData.animar = (t) => { bola.rotation.y = t * 0.35; cinta.rotation.z = t * 0.2; };
  });

  // ---------------------------------------------------------------- estrellitas amigas
  const amiguitos = new THREE.Group();
  escena.add(amiguitos);
  const listaAmigos = AMIGUITOS.map((a) => {
    const R = 0.27;
    const g = new THREE.Group();
    const { geo, frente } = geometriaEstrella(R);
    const cuerpo = new THREE.Mesh(geo, toon(a.color, { emissive: a.color, emissiveIntensity: 0.08 }));
    cuerpo.userData.amiguito = g;
    const cara = carita(R, frente + 0.005);
    g.add(cuerpo, cara, halo(a.color, 1.2, 0.16));
    g.userData = { ...a, fase: Math.random() * 6.28, giro: 0, parpadeo: azar(2, 5), salto: 0, cara };
    g.scale.setScalar(0.001);
    amiguitos.add(g);
    return g;
  });

  // ---------------------------------------------------------------- la estrella dorada
  let dorada = null;
  const RASTRO = 46;
  function crearDorada() {
    const g = new THREE.Group();
    const R = 0.36;
    const { geo, frente } = geometriaEstrella(R);
    const cuerpo = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#ffd54a', emissive: '#ffae00', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.15 }));
    g.add(cuerpo, carita(R, frente + 0.005), halo('#ffd36b', 2, 0.5));
    escena.add(g);
    // el rastro de chispitas
    const rastro = nubeDePuntos(RASTRO, (i, color) => {
      color.set(['#fff3c4', '#ffd36b', '#ffc4ec', '#ffffff'][i % 4]);
      return { x: 0, y: 0, z: 0, tam: 0 };
    }, uniformes);
    escena.add(rastro);
    const historia = [];
    return { g, cuerpo, rastro, historia, t: 0, dura: 6.2, desde: null, hasta: null, control: null, atrapada: false };
  }
  function rutaDorada(d) {
    const { halfW, halfH } = medidasMundo(camaraBase.z - 1);
    const izq = Math.random() < 0.5;
    d.desde = new THREE.Vector3((izq ? -1 : 1) * (halfW + 1.5), halfH * azar(0.5, 1.1), 1);
    d.hasta = new THREE.Vector3((izq ? 1 : -1) * (halfW + 1.5), -halfH * azar(0.2, 0.9), 1);
    d.control = new THREE.Vector3(azar(-0.4, 0.4) * halfW, azar(-0.2, 0.5) * halfH, 1.6);
    d.t = 0;
    d.historia.length = 0;
  }
  let doradaActiva = false;
  let proximaDorada = 0;
  const puntoBezier = (d, t, v) => {
    const u = 1 - t;
    return v.set(0, 0, 0).addScaledVector(d.desde, u * u).addScaledVector(d.control, 2 * u * t).addScaledVector(d.hasta, t * t);
  };

  // ---------------------------------------------------------------- burbujas de recuerdos
  const burbujas = new THREE.Group();
  escena.add(burbujas);
  function texturaBurbuja(img) {
    const c = lienzo(256);
    const x = c.getContext('2d');
    x.save();
    x.beginPath();
    x.arc(128, 128, 104, 0, Math.PI * 2);
    x.clip();
    const lado = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    x.drawImage(img, ((img.naturalWidth || img.width) - lado) / 2, ((img.naturalHeight || img.height) - lado) / 2, lado, lado, 24, 24, 208, 208);
    // un velo cálido de recuerdo
    x.fillStyle = 'rgba(255,214,170,.12)';
    x.fillRect(0, 0, 256, 256);
    x.restore();
    const borde = x.createLinearGradient(20, 20, 236, 236);
    borde.addColorStop(0, '#ffd1ec');
    borde.addColorStop(0.5, '#c9d8ff');
    borde.addColorStop(1, '#bff5e6');
    x.strokeStyle = borde;
    x.lineWidth = 9;
    x.beginPath();
    x.arc(128, 128, 108, 0, Math.PI * 2);
    x.stroke();
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath();
    x.ellipse(88, 76, 26, 13, -0.6, 0, Math.PI * 2);
    x.fill();
    return textura(c);
  }
  function ponerRecuerdos(lista) {
    for (const b of [...burbujas.children]) { b.material.map.dispose(); b.material.dispose(); burbujas.remove(b); }
    lista.slice(-8).forEach(({ id, img }, i) => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBurbuja(img), transparent: true, opacity: 0, depthWrite: false }));
      s.userData = { recuerdo: id, fase: Math.random() * 6.28, i, velX: azar(0.05, 0.12) * (Math.random() < 0.5 ? -1 : 1), base: new THREE.Vector3() };
      s.scale.setScalar(0.001);
      burbujas.add(s);
    });
    acomodar();
  }

  // ---------------------------------------------------------------- constelaciones del cielo
  const cielo = new THREE.Group();
  universo.add(cielo);
  const constelaciones = new Map();
  function ponerConstelaciones(ids, { nueva = null } = {}) {
    for (const id of ids) {
      if (constelaciones.has(id)) continue;
      const i = CONSTELACIONES.findIndex((c) => c.id === id);
      if (i < 0) continue;
      const def = CONSTELACIONES[i];
      const g = new THREE.Group();
      const pts = def.puntos.map(([x, y]) => new THREE.Vector3(x - 0.5, 0.5 - y, 0));
      const lineas = [];
      for (const trazo of def.trazos) for (let k = 1; k < trazo.length; k += 1) lineas.push(pts[trazo[k - 1]], pts[trazo[k]]);
      g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lineas), new THREE.LineBasicMaterial({ color: '#c9dbff', transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false })));
      g.add(nubeDePuntos(pts.length, (j, color) => {
        color.set(j % 3 === 0 ? '#fff4d6' : '#ffffff');
        return { x: pts[j].x, y: pts[j].y, z: 0, tam: j % 3 === 0 ? 0.27 : 0.2 };
      }, uniformes));
      g.userData = { rincon: RINCONES[i % RINCONES.length], aparece: id === nueva ? 0 : 1 };
      g.scale.setScalar(3);
      cielo.add(g);
      constelaciones.set(id, g);
    }
    acomodar();
  }

  // ---------------------------------------------------------------- acomodar según la pantalla
  let ancho = 1;
  let alto = 1;
  let orientacion = 'vertical';
  function medidasMundo(distancia) {
    const halfH = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * distancia;
    return { halfH, halfW: halfH * camara.aspect };
  }
  function acomodar() {
    orientacion = ancho / alto > 1.15 ? 'horizontal' : 'vertical';
    const { halfW, halfH } = medidasMundo(camaraBase.z);
    // En pantallas muy angostas, los planetas se achican un poquito para que quepan.
    const ajuste = Math.min(1, Math.max(0.78, halfW / 2.25));
    for (const id of PLANETAS) {
      const { g } = porId.get(id);
      const [nx, ny] = LUGARES[orientacion][id];
      g.userData.base = new THREE.Vector3(nx * halfW, ny * halfH, 0);
      g.userData.ajuste = ajuste;
      g.position.copy(g.userData.base);
    }
    for (const a of listaAmigos) {
      const [nx, ny] = a.userData[orientacion];
      a.userData.base = new THREE.Vector3(nx * halfW, ny * halfH, 0.6);
      a.position.copy(a.userData.base);
    }
    burbujas.children.forEach((b) => {
      const k = b.userData.i;
      const nx = [-0.62, 0.66, -0.12, 0.7, -0.7, 0.18, 0.4, -0.38][k % 8];
      const ny = [0.75, 0.6, 0.38, 0.0, -0.12, -0.4, -0.75, -0.82][k % 8];
      b.userData.base.set(nx * halfW * 1.2, ny * halfH * 1.2, -2.5);
    });
    const lejos = medidasMundo(camaraBase.z + 16);
    for (const g of constelaciones.values()) {
      const [nx, ny] = g.userData.rincon;
      g.position.set(nx * lejos.halfW, ny * lejos.halfH, -16);
    }
  }
  function ajustar() {
    const r = { width: contenedor.clientWidth, height: contenedor.clientHeight }; // (sin la escala de la animación de apertura)
    ancho = Math.max(1, r.width);
    alto = Math.max(1, r.height);
    renderer.setSize(ancho, alto, false);
    composer.setSize(ancho, alto);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    escala.value = (alto * renderer.getPixelRatio()) / 2;
    acomodar();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);
  ajustar();

  // ---------------------------------------------------------------- tocar
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let toque = null;
  let arrastre = { x: 0, y: 0 };
  let giro = { x: 0, y: 0 };
  let enfocado = null;

  function aPantalla(v) {
    tmp.copy(v).project(camara);
    return { x: (tmp.x * 0.5 + 0.5) * ancho, y: (-tmp.y * 0.5 + 0.5) * alto, delante: tmp.z < 1 };
  }
  function puntoDe(e) {
    const r = renderer.domElement.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function alBajar(e) {
    if (enfocado) return;
    const p = puntoDe(e);
    toque = { ...p, x0: p.x, y0: p.y, t: performance.now(), movio: false, id: e.pointerId };
    try { lienzoEl.setPointerCapture(e.pointerId); } catch { /* nada */ }
    // ¡la estrella dorada se atrapa al primer toque!
    if (dorada && doradaActiva && !dorada.atrapada) {
      const s = aPantalla(dorada.g.position);
      if (Math.hypot(s.x - p.x, s.y - p.y) < Math.max(58, ancho * 0.12)) { atrapar(); toque = null; }
    }
  }
  function alMover(e) {
    if (!toque || e.pointerId !== toque.id) return;
    const p = puntoDe(e);
    if (Math.hypot(p.x - toque.x0, p.y - toque.y0) > 9) toque.movio = true;
    if (toque.movio) {
      arrastre.x += (p.x - toque.x) * 0.0022;
      arrastre.y += (p.y - toque.y) * 0.0016;
      arrastre.x = Math.max(-0.5, Math.min(0.5, arrastre.x));
      arrastre.y = Math.max(-0.28, Math.min(0.28, arrastre.y));
    }
    toque.x = p.x;
    toque.y = p.y;
  }
  function alSubir(e) {
    if (!toque || e.pointerId !== toque.id) return;
    const t = toque;
    toque = null;
    if (t.movio || performance.now() - t.t > 700 || enfocado) return;
    ndc.set((t.x / ancho) * 2 - 1, -(t.y / alto) * 2 + 1);
    raycaster.setFromCamera(ndc, camara);
    const objetivos = [...listaAmigos.map((a) => a.children[0]), ...[...porId.values()].map((p) => p.golpe), ...burbujas.children];
    const golpe = raycaster.intersectObjects(objetivos, false)[0];
    const pantalla = { x: e.clientX, y: e.clientY };
    if (!golpe) { alTocarVacio(pantalla); return; }
    const o = golpe.object;
    if (o.userData.amiguito) { saludar(o.userData.amiguito); return; }
    if (o.userData.planeta) { saltar(o.userData.planeta); alTocarPlaneta(o.userData.planeta); return; }
    if (o.userData.recuerdo) alTocarRecuerdo(o.userData.recuerdo);
  }
  const lienzoEl = renderer.domElement;
  lienzoEl.addEventListener('pointerdown', alBajar);
  lienzoEl.addEventListener('pointermove', alMover);
  lienzoEl.addEventListener('pointerup', alSubir);
  lienzoEl.addEventListener('pointercancel', () => { toque = null; });

  function saltar(id) {
    const p = porId.get(id);
    if (p) p.g.userData.salto = 1;
  }
  function saludar(g) {
    g.userData.giro = 1;
    g.userData.salto = 1;
    const s = aPantalla(g.position);
    alTocarAmiguito({ x: s.x + renderer.domElement.getBoundingClientRect().left, y: s.y + renderer.domElement.getBoundingClientRect().top - 24, color: g.userData.color });
  }

  function atrapar() {
    const d = dorada;
    d.atrapada = true;
    doradaActiva = false;
    const s = aPantalla(d.g.position);
    const r = renderer.domElement.getBoundingClientRect();
    const album = porId.get('album').g;
    const meta = album.position.clone().add(new THREE.Vector3(0, 0, 0.8));
    gsap.timeline({
      onComplete: () => {
        escena.remove(d.g, d.rastro);
        d.rastro.geometry.dispose();
        saltar('album');
        dorada = null;
      },
    })
      .to(d.g.scale, { x: 1.9, y: 1.9, z: 1.9, duration: 0.35, ease: 'back.out(3)' })
      .to(d.g.rotation, { z: `+=${Math.PI * 4}`, duration: 0.9, ease: 'power2.inOut' }, 0)
      .to(d.g.position, { x: meta.x, y: meta.y, z: meta.z, duration: 0.75, ease: 'power2.in' }, 0.55)
      .to(d.g.scale, { x: 0.2, y: 0.2, z: 0.2, duration: 0.75, ease: 'power2.in' }, 0.55);
    alAtrapar({ x: s.x + r.left, y: s.y + r.top });
  }

  // ---------------------------------------------------------------- la cámara
  // Un solo viaje de cámara a la vez: si empieza otro (cerrar un planeta y abrir otro
  // rapidito), el anterior se corta ahí mismo.
  let viaje = [];
  function viajar(pos, punto, duracion, alTerminar) {
    for (const t of viaje) t.kill();
    viaje = [
      gsap.to(camara.position, { ...pos, duration: duracion, ease: 'power2.inOut', onComplete: alTerminar }),
      gsap.to(mira, { ...punto, duration: duracion, ease: 'power2.inOut' }),
    ];
  }
  function enfocar(id) {
    const p = porId.get(id);
    if (!p) return Promise.resolve();
    enfocado = id;
    const destino = p.g.position.clone();
    return new Promise((ok) => {
      viajar({ x: destino.x * 0.9, y: destino.y * 0.9, z: 3.6 }, { x: destino.x, y: destino.y, z: 0 }, 0.8, ok);
    });
  }
  function volver() {
    return new Promise((ok) => {
      viajar({ x: camaraBase.x, y: camaraBase.y, z: camaraBase.z }, { x: 0, y: 0, z: 0 }, 0.9, () => { enfocado = null; ok(); });
    });
  }

  // La entrada: la cámara viene volando desde lejos, entre estrellas que pasan rapidito.
  let tunel = null;
  function entrada({ rapida = false } = {}) {
    tunel = nubeDePuntos(500, (i, color) => {
      color.set(['#ffffff', '#cfe0ff', '#ffd6f2', '#d9ccff'][i % 4]);
      const a = Math.random() * Math.PI * 2;
      const r = azar(1.6, 7);
      return { x: Math.cos(a) * r, y: Math.sin(a) * r, z: azar(12, 78), tam: azar(0.18, 0.4) };
    }, uniformes);
    escena.add(tunel);
    const dura = rapida ? 1.9 : 2.9;
    camara.position.set(0, 0, rapida ? 46 : 80);
    universo.rotation.z = -0.5;
    const tl = gsap.timeline();
    tl.to(camara.position, { z: camaraBase.z, duration: dura, ease: 'power3.out' }, 0);
    tl.to(universo.rotation, { z: 0, duration: dura + 0.6, ease: 'power2.out' }, 0);
    PLANETAS.forEach((id, i) => {
      const { g } = porId.get(id);
      tl.to(g.scale, { x: 1, y: 1, z: 1, duration: 0.9, ease: 'back.out(2.2)' }, dura * 0.55 + i * 0.12);
    });
    listaAmigos.forEach((a, i) => tl.to(a.scale, { x: 1, y: 1, z: 1, duration: 0.8, ease: 'back.out(2.6)' }, dura * 0.75 + i * 0.15));
    tl.call(() => { if (tunel) { escena.remove(tunel); tunel.geometry.dispose(); tunel.material.dispose(); tunel = null; } }, null, dura + 0.2);
    return new Promise((ok) => { tl.call(ok, null, dura * 0.8); });
  }

  // ---------------------------------------------------------------- cada cuadro
  let anterior = performance.now();
  let t = 0;
  let lento = 0;
  let cuadros = 0;
  const v = new THREE.Vector3();
  const etiquetas = {};
  function cuadro() {
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - anterior) / 1000);
    anterior = ahora;
    t += dt;
    tiempo.value = t;

    // Si el teléfono va lento, se baja la calidad (primero la resolución, luego el brillo).
    cuadros += 1;
    lento = lento * 0.97 + (dt > 0.03 ? 1 : 0) * 0.03;
    if (cuadros > 120 && lento > 0.5) {
      cuadros = 0;
      lento = 0;
      if (dpr > 1) { dpr = 1; renderer.setPixelRatio(1); composer.setPixelRatio(1); ajustar(); } else if (conBrillo) conBrillo = false;
    }

    // el universo gira despacito (y se mueve un poco si arrastras)
    giro.x = suave(giro.x, arrastre.x, 3, dt);
    giro.y = suave(giro.y, arrastre.y, 3, dt);
    universo.rotation.y = giro.x * 0.8;
    universo.rotation.x = giro.y * 0.6;
    espiral.rotation.y += dt * 0.035;
    for (const n of nebulosas) n.material.rotation += n.userData.giro * dt;
    if (!enfocado) {
      camara.position.x = suave(camara.position.x, camaraBase.x + Math.sin(t * 0.13) * 0.18 - giro.x * 0.6, 2, dt);
      camara.position.y = suave(camara.position.y, camaraBase.y + Math.cos(t * 0.11) * 0.12 + giro.y * 0.5, 2, dt);
    }
    camara.lookAt(mira);

    // estrellas fugaces de adorno
    proximaFugaz -= dt;
    if (proximaFugaz <= 0) { lanzarFugaz(); proximaFugaz = azar(4, 9); }
    for (let i = fugaces.length - 1; i >= 0; i -= 1) {
      const f = fugaces[i];
      f.vida += dt;
      const k = f.vida / f.dura;
      f.s.position.addScaledVector(f.dir, f.vel * dt);
      f.s.material.opacity = Math.sin(Math.min(1, k) * Math.PI) * 0.9;
      if (k >= 1) { universo.remove(f.s); f.s.material.dispose(); fugaces.splice(i, 1); }
    }

    // planetas: flotan, giran y saltan cuando los tocas
    for (const id of PLANETAS) {
      const { g, cuerpo, radio } = porId.get(id);
      const u = g.userData;
      if (u.base) g.position.y = u.base.y + Math.sin(t * 0.8 + u.fase) * 0.07;
      if (u.salto > 0) {
        u.salto = Math.max(0, u.salto - dt * 2.2);
        const k = 1 - u.salto;
        cuerpo.scale.setScalar((1 + Math.sin(k * Math.PI * 3) * 0.12 * u.salto) * (u.ajuste || 1));
      } else cuerpo.scale.setScalar(u.ajuste || 1);
      if (cuerpo.userData.animar) cuerpo.userData.animar(t);
      const centro = aPantalla(v.copy(g.position));
      const pie = aPantalla(v.copy(g.position).add(tmp.set(0, -(radio * (u.ajuste || 1) + 0.16), 0)));
      etiquetas[id] = { x: centro.x, y: pie.y, centro, escala: g.scale.x, visible: centro.delante };
    }

    // amiguitos
    for (const a of listaAmigos) {
      const u = a.userData;
      if (!u.base) continue;
      u.parpadeo -= dt;
      const ojos = u.cara.userData.ojos || [];
      if (u.parpadeo < 0) {
        const k = Math.min(1, -u.parpadeo / 0.14);
        for (const o of ojos) o.scale.y = 1.35 * (k < 0.5 ? 1 - k * 1.8 : (k - 0.5) * 2);
        if (k >= 1) { u.parpadeo = azar(2.5, 6); for (const o of ojos) o.scale.y = 1.35; }
      }
      if (u.salto > 0) u.salto = Math.max(0, u.salto - dt * 1.6);
      if (u.giro > 0) u.giro = Math.max(0, u.giro - dt * 1.25);
      const brinco = Math.sin((1 - u.salto) * Math.PI) * 0.35 * (u.salto > 0 ? 1 : 0);
      a.position.set(u.base.x + Math.sin(t * 0.6 + u.fase) * 0.12, u.base.y + Math.sin(t * 1.1 + u.fase) * 0.1 + brinco, u.base.z);
      a.rotation.y = Math.sin(t * 0.7 + u.fase) * 0.35 + (1 - u.giro) * (u.giro > 0 ? Math.PI * 2 : 0);
      a.rotation.z = Math.sin(t * 0.9 + u.fase) * 0.12;
    }

    // burbujas de recuerdos
    for (const b of burbujas.children) {
      const u = b.userData;
      const op = Math.min(0.92, b.material.opacity + dt * 0.4);
      b.material.opacity = op;
      const tamBase = Math.min(0.95, 0.7 + (u.i % 3) * 0.1);
      b.scale.setScalar(suave(b.scale.x, tamBase, 2, dt));
      b.position.set(u.base.x + Math.sin(t * u.velX * 3 + u.fase) * 0.4, u.base.y + Math.sin(t * 0.5 + u.fase) * 0.25, u.base.z);
    }

    // constelaciones que aparecen
    for (const g of constelaciones.values()) {
      if (g.userData.aparece < 1) g.userData.aparece = Math.min(1, g.userData.aparece + dt * 0.35);
      const k = g.userData.aparece;
      g.children[0].material.opacity = 0.4 * k;
      g.visible = k > 0.01;
      g.scale.setScalar(3 * (0.7 + 0.3 * k));
    }

    // la estrella dorada
    if (!dorada && proximaDorada > 0) {
      proximaDorada -= dt;
      if (proximaDorada <= 0) { dorada = crearDorada(); rutaDorada(dorada); doradaActiva = true; }
    }
    if (dorada && doradaActiva && !dorada.atrapada) {
      const d = dorada;
      d.t += dt / d.dura;
      puntoBezier(d, Math.min(1, d.t), d.g.position);
      d.g.rotation.z = Math.sin(t * 3) * 0.25;
      d.g.rotation.y = Math.sin(t * 2) * 0.3;
      if (d.t >= 1) {
        // se fue sin que la atraparan: vuelve en un ratito
        doradaActiva = false;
        escena.remove(d.g, d.rastro);
        d.rastro.geometry.dispose();
        dorada = null;
        proximaDorada = azar(9, 16);
      }
    }
    if (dorada) {
      const d = dorada;
      d.historia.unshift(d.g.position.clone());
      if (d.historia.length > RASTRO) d.historia.length = RASTRO;
      const pos = d.rastro.geometry.attributes.position;
      const tam = d.rastro.geometry.attributes.tam;
      for (let i = 0; i < RASTRO; i += 1) {
        const p = d.historia[Math.min(i, d.historia.length - 1)];
        pos.setXYZ(i, p.x + azar(-0.04, 0.04), p.y + azar(-0.04, 0.04), p.z);
        tam.setX(i, d.atrapada ? 0 : 0.32 * (1 - i / RASTRO) ** 1.4);
      }
      pos.needsUpdate = true;
      tam.needsUpdate = true;
    }

    alCuadro({ etiquetas, enfocado, dorada: dorada && doradaActiva ? aPantalla(dorada.g.position) : null });
    if (conBrillo) composer.render(dt); else renderer.render(escena, camara);
  }

  let corriendo = false;
  let pausado = false;
  const arrancar = () => {
    const debe = !pausado && !document.hidden;
    if (debe === corriendo) return;
    corriendo = debe;
    anterior = performance.now();
    renderer.setAnimationLoop(debe ? cuadro : null);
  };
  const alOcultar = () => arrancar();
  document.addEventListener('visibilitychange', alOcultar);
  arrancar();

  return {
    entrada,
    enfocar,
    volver,
    saltar,
    // La estrella dorada empieza a cruzar el cielo en `segundos`.
    lanzarDorada(segundos = 4) { if (!dorada) proximaDorada = segundos; },
    quitarDorada() { proximaDorada = 0; if (dorada && !dorada.atrapada) { doradaActiva = false; escena.remove(dorada.g, dorada.rastro); dorada = null; } },
    ponerConstelaciones,
    ponerRecuerdos,
    pausar(si) { pausado = si; arrancar(); },
    pantallaDe(id) {
      const p = porId.get(id);
      if (!p) return { x: ancho / 2, y: alto / 2 };
      const s = aPantalla(p.g.position);
      const r = renderer.domElement.getBoundingClientRect();
      return { x: s.x + r.left, y: s.y + r.top };
    },
    destruir() {
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', alOcultar);
      observador.disconnect();
      gsap.killTweensOf([camara.position, mira, universo.rotation]);
      escena.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of mats) { if (m.map && !desechables.includes(m.map)) m.map.dispose(); m.dispose(); }
      });
      for (const tx of desechables) tx.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
