// Los muebles de la casa en 3D, hechos con piezas simples (cajitas redondeadas, cilindros,
// esferas). Se ven como de caricatura: sombreado de 3 tonos y un contorno de tinta ciruela
// (el mismo de la app), con el truco del "casco invertido": una copia un poquito más grande
// de cada pieza, pintada solo por dentro.
//
// Cada mueble se arma mirando hacia +z (hacia la cámara), con su base en y = 0 y centrado
// en su huella de casillas (1 casilla = 1 unidad). Los de pared se arman de frente, con la
// espalda en z = 0.

import * as THREE from '../../vendor/three.js';

export const TINTA = 0x3a2745;
const GROSOR_CONTORNO = 2.2; // en píxeles de pantalla (siempre igual de grueso, con cualquier zoom)

// ------------------------------------------------------------------ materiales
let tonos = null;
function gradiente() {
  if (!tonos) {
    tonos = new THREE.DataTexture(new Uint8Array([110, 190, 255]), 3, 1, THREE.RedFormat);
    tonos.minFilter = THREE.NearestFilter;
    tonos.magFilter = THREE.NearestFilter;
    tonos.needsUpdate = true;
  }
  return tonos;
}
const materiales = new Map();
export function mat(color, extra = {}) {
  const clave = `${color}|${JSON.stringify(extra)}`;
  if (!materiales.has(clave)) materiales.set(clave, new THREE.MeshToonMaterial({ color, gradientMap: gradiente(), ...extra }));
  return materiales.get(clave);
}
const brillo = (color, intensidad = 1) => new THREE.MeshBasicMaterial({ color, toneMapped: false, ...(intensidad < 1 ? { transparent: true, opacity: intensidad } : {}) });

let materialContorno = null;
function contorno() {
  if (!materialContorno) {
    // El casco se agranda en la pantalla (no en el mundo): se empuja cada vértice hacia
    // afuera según su normal, unos píxeles. Así el trazo mide lo mismo de cerca y de lejos.
    materialContorno = new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color(TINTA) }, grosor: { value: GROSOR_CONTORNO }, resolucion: { value: new THREE.Vector2(800, 800) } },
      vertexShader: `attribute vec3 normalSuave; uniform float grosor; uniform vec2 resolucion;
        void main() {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec3 n = normalize(normalMatrix * normalSuave);
          clip.xy += n.xy * grosor * 2.0 / resolucion * clip.w;
          gl_Position = clip;
        }`,
      fragmentShader: 'uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }',
      side: THREE.BackSide,
    });
  }
  return materialContorno;
}

// El tamaño del dibujo en píxeles de verdad (para que el contorno mida siempre lo mismo).
export function ajustarContorno(ancho, alto, dpr = 1) {
  const m = contorno();
  m.uniforms.resolucion.value.set(ancho, alto);
  m.uniforms.grosor.value = GROSOR_CONTORNO * dpr;
}

// Normales "promediadas" por posición: así el contorno no se abre en las esquinas.
function conNormalesSuaves(geo) {
  if (geo.getAttribute('normalSuave')) return geo;
  if (!geo.getAttribute('normal')) geo.computeVertexNormals();
  const pos = geo.getAttribute('position');
  const nor = geo.getAttribute('normal');
  const suma = new Map();
  const clave = (i) => `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
  for (let i = 0; i < pos.count; i += 1) {
    const k = clave(i);
    const v = suma.get(k) || [0, 0, 0];
    v[0] += nor.getX(i); v[1] += nor.getY(i); v[2] += nor.getZ(i);
    suma.set(k, v);
  }
  const suaves = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 1) {
    const [x, y, z] = suma.get(clave(i));
    const l = Math.hypot(x, y, z) || 1;
    suaves[i * 3] = x / l; suaves[i * 3 + 1] = y / l; suaves[i * 3 + 2] = z / l;
  }
  geo.setAttribute('normalSuave', new THREE.Float32BufferAttribute(suaves, 3));
  return geo;
}

// Una pieza: la malla con su material, su contorno y sus sombras.
export function pieza(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sinContorno = false, sombra = true } = {}) {
  const m = new THREE.Mesh(geo, typeof material === 'number' || typeof material === 'string' ? mat(material) : material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = sombra;
  m.receiveShadow = true;
  if (!sinContorno) {
    const borde = new THREE.Mesh(conNormalesSuaves(geo), contorno());
    borde.userData.esContorno = true;
    m.add(borde);
  }
  return m;
}

// Geometrías de base (las cajitas tienen las esquinas redondeadas).
function cajaRedonda(w, h, d, r = Math.min(w, h, d) * 0.18) {
  const forma = new THREE.Shape();
  const rr = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  forma.moveTo(-w / 2 + rr, -h / 2);
  forma.lineTo(w / 2 - rr, -h / 2);
  forma.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  forma.lineTo(w / 2, h / 2 - rr);
  forma.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
  forma.lineTo(-w / 2 + rr, h / 2);
  forma.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
  forma.lineTo(-w / 2, -h / 2 + rr);
  forma.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const bisel = Math.min(rr * 0.8, d * 0.3);
  const geo = new THREE.ExtrudeGeometry(forma, { depth: Math.max(0.001, d - bisel * 2), bevelEnabled: true, bevelThickness: bisel, bevelSize: bisel * 0.6, bevelSegments: 3, curveSegments: 4 });
  geo.center();
  return geo;
}
const geos = new Map();
const memo = (clave, crear) => { if (!geos.has(clave)) geos.set(clave, crear()); return geos.get(clave); };
export const G = {
  caja: (w, h, d, r) => memo(`c${w},${h},${d},${r}`, () => cajaRedonda(w, h, d, r)),
  cubo: (w, h, d) => memo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  cil: (rt, rb, h, seg = 18) => memo(`y${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  esf: (r, sx = 1, sy = 1, sz = 1) => memo(`s${r},${sx},${sy},${sz}`, () => { const g = new THREE.SphereGeometry(r, 18, 12); g.scale(sx, sy, sz); return g; }),
  cono: (r, h) => memo(`k${r},${h}`, () => new THREE.ConeGeometry(r, h, 16)),
  toro: (r, t) => memo(`t${r},${t}`, () => new THREE.TorusGeometry(r, t, 10, 24)),
  plano: (w, h) => memo(`p${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
};

// Colores de la casa (de la paleta de la app, en pastel).
export const C = {
  madera: 0xc98e5c, maderaClara: 0xe6bd8a, maderaOscura: 0x8a5a3c, blanco: 0xfffdf7, crema: 0xfff1dc,
  rosa: 0xffb3c7, fresa: 0xff6f91, celeste: 0x9fcfff, azul: 0x6aa8ff, lavanda: 0xcbb8ff, menta: 0x8fe0c4,
  sol: 0xffcf4a, durazno: 0xffc79e, gris: 0x9d97a8, grisOscuro: 0x4b4458, negro: 0x2f2638, verde: 0x6cc77e,
  verdeOscuro: 0x3f9a5a, terracota: 0xd9825f, rojo: 0xf06a6a,
};

// ------------------------------------------------------------------ texturas pintadas
function textura(w, h, pintar) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  pintar(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const texturaTele = () => textura(128, 80, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#8fc4ff');
  g.addColorStop(1, '#d5c5ff');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#ffcf4a';
  x.beginPath(); x.arc(96, 22, 12, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#7fdcc0';
  x.beginPath(); x.moveTo(0, h); x.quadraticCurveTo(40, 30, 80, h); x.fill();
  x.fillStyle = '#ff9db5';
  x.beginPath(); x.moveTo(50, h); x.quadraticCurveTo(95, 40, 128, h); x.fill();
});
const texturaCielo = () => textura(128, 96, (x, w, h) => {
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#9fd0ff');
  g.addColorStop(1, '#e6f3ff');
  x.fillStyle = g;
  x.fillRect(0, 0, w, h);
  x.fillStyle = '#fff';
  for (const [cx, cy, r] of [[30, 30, 12], [44, 26, 15], [58, 32, 11], [92, 60, 10], [104, 56, 13]]) { x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
});
const texturaArcade = () => textura(64, 64, (x) => {
  x.fillStyle = '#2f2638'; x.fillRect(0, 0, 64, 64);
  x.fillStyle = '#ffcf4a'; x.beginPath(); x.arc(22, 32, 10, 0.5, Math.PI * 2 - 0.5); x.lineTo(22, 32); x.fill();
  x.fillStyle = '#ff6f91'; for (let i = 0; i < 3; i += 1) { x.beginPath(); x.arc(38 + i * 9, 32, 3, 0, Math.PI * 2); x.fill(); }
  x.fillStyle = '#7fdcc0'; x.fillRect(4, 4, 56, 4);
});
const texturaLienzo = () => textura(64, 80, (x) => {
  x.fillStyle = '#fffdf7'; x.fillRect(0, 0, 64, 80);
  for (const [c, cx, cy, r] of [['#ff9db5', 22, 30, 14], ['#8fc4ff', 42, 46, 12], ['#ffcf4a', 30, 58, 9], ['#7fdcc0', 46, 22, 8]]) { x.fillStyle = c; x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fill(); }
});
function texturaAlfombra(redonda) {
  return textura(128, 128, (x, w, h) => {
    x.fillStyle = '#d5c5ff'; x.fillRect(0, 0, w, h);
    if (redonda) {
      for (const [r, c] of [[60, '#ffc2d1'], [44, '#fffdf7'], [30, '#bfe2ff'], [14, '#ffcf4a']]) { x.fillStyle = c; x.beginPath(); x.arc(64, 64, r, 0, Math.PI * 2); x.fill(); }
    } else {
      x.fillStyle = '#fffdf7'; x.fillRect(8, 8, w - 16, h - 16);
      x.fillStyle = '#ffb3c7'; x.fillRect(16, 16, w - 32, h - 32);
      x.fillStyle = '#fffdf7';
      for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) { x.beginPath(); x.arc(30 + i * 23, 30 + j * 23, 4, 0, Math.PI * 2); x.fill(); }
    }
  });
}

// ------------------------------------------------------------------ los muebles
// Cada uno devuelve { grupo, asientos: [[x, y, z]…] (dónde se sientan o acuestan, en su
// espacio), animar(t) (opcional), luz: true (si alumbra) }.
const P = pieza;

function patas(grupo, w, d, alto, color, grueso = 0.06) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    grupo.add(P(G.cil(grueso, grueso * 0.8, alto, 10), color, { x: sx * (w / 2 - grueso * 1.6), y: alto / 2, z: sz * (d / 2 - grueso * 1.6) }));
  }
}

const CONSTRUCTORES = {
  cama() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.9, 0.32, 2.85, 0.06), C.madera, { y: 0.26 }));
    patas(g, 1.85, 2.8, 0.12, C.maderaOscura, 0.07);
    g.add(P(G.caja(1.78, 0.26, 2.6, 0.1), C.blanco, { y: 0.54, z: 0.05 }));
    g.add(P(G.caja(1.84, 0.14, 1.75, 0.06), C.rosa, { y: 0.66, z: 0.45 }));
    g.add(P(G.caja(1.86, 0.06, 0.3, 0.03), C.fresa, { y: 0.74, z: -0.32 }));
    for (const x of [-0.45, 0.45]) g.add(P(G.caja(0.72, 0.18, 0.42, 0.08), C.crema, { x, y: 0.74, z: -1.0 }));
    g.add(P(G.caja(1.98, 1.15, 0.16, 0.06), C.madera, { y: 0.7, z: -1.38 }));
    g.add(P(G.esf(0.16, 1, 0.9, 0.35), C.fresa, { y: 1.0, z: -1.29 }));
    return { grupo: g, asientos: [[-0.42, 0.78, -0.25], [0.42, 0.78, -0.25]], cama: true };
  },
  sofa() {
    const g = new THREE.Group();
    const color = C.celeste;
    g.add(P(G.caja(2.9, 0.4, 0.92, 0.1), color, { y: 0.3 }));
    for (const x of [-0.95, 0, 0.95]) g.add(P(G.caja(0.9, 0.18, 0.72, 0.08), C.blanco, { x, y: 0.58, z: 0.06 }));
    g.add(P(G.caja(2.9, 0.72, 0.26, 0.1), color, { y: 0.78, z: -0.34 }));
    for (const x of [-1.33, 1.33]) g.add(P(G.caja(0.26, 0.56, 0.92, 0.1), color, { x, y: 0.56 }));
    g.add(P(G.caja(0.42, 0.42, 0.14, 0.08), C.rosa, { x: -0.95, y: 0.86, z: -0.15, rz: 0.15 }));
    patas(g, 2.8, 0.85, 0.12, C.maderaOscura, 0.05);
    return { grupo: g, asientos: [[-0.95, 0.66, 0.05], [0, 0.66, 0.05], [0.95, 0.66, 0.05]] };
  },
  sillon() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.92, 0.38, 0.88, 0.12), C.durazno, { y: 0.3 }));
    g.add(P(G.caja(0.66, 0.16, 0.66, 0.08), C.crema, { y: 0.56, z: 0.06 }));
    g.add(P(G.caja(0.92, 0.66, 0.24, 0.1), C.durazno, { y: 0.74, z: -0.32 }));
    for (const x of [-0.38, 0.38]) g.add(P(G.caja(0.2, 0.5, 0.88, 0.08), C.durazno, { x, y: 0.55 }));
    patas(g, 0.85, 0.8, 0.12, C.maderaOscura, 0.04);
    return { grupo: g, asientos: [[0, 0.64, 0.06]] };
  },
  silla() {
    const g = new THREE.Group();
    patas(g, 0.6, 0.6, 0.46, C.madera, 0.04);
    g.add(P(G.caja(0.66, 0.08, 0.64, 0.03), C.maderaClara, { y: 0.5 }));
    g.add(P(G.caja(0.62, 0.5, 0.07, 0.03), C.maderaClara, { y: 0.82, z: -0.29 }));
    g.add(P(G.caja(0.5, 0.06, 0.5, 0.03), C.rosa, { y: 0.56 }));
    return { grupo: g, asientos: [[0, 0.58, 0.02]] };
  },
  mesa() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.8, 0.1, 1.8, 0.05), C.maderaClara, { y: 0.78 }));
    patas(g, 1.6, 1.6, 0.74, C.madera, 0.06);
    g.add(P(G.cil(0.62, 0.62, 0.02, 24), C.blanco, { y: 0.84 }));
    // un pastelito con su fresa
    g.add(P(G.cil(0.2, 0.2, 0.18), C.rosa, { y: 0.94, x: 0.15 }));
    g.add(P(G.cil(0.21, 0.21, 0.05), C.blanco, { y: 1.05, x: 0.15 }));
    g.add(P(G.esf(0.05), C.rojo, { y: 1.11, x: 0.15 }));
    g.add(P(G.cil(0.07, 0.09, 0.2), C.celeste, { x: -0.35, y: 0.93, z: -0.2 }));
    g.add(P(G.esf(0.1), C.sol, { x: -0.35, y: 1.1, z: -0.2 }));
    return { grupo: g };
  },
  mesita() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.78, 0.62, 0.7, 0.06), C.maderaClara, { y: 0.32 }));
    g.add(P(G.caja(0.62, 0.22, 0.04, 0.02), C.madera, { y: 0.4, z: 0.35 }));
    g.add(P(G.esf(0.04), C.sol, { y: 0.4, z: 0.39 }));
    g.add(P(G.cil(0.07, 0.1, 0.12), C.blanco, { y: 0.69, x: 0.18 }));
    g.add(P(G.cil(0.14, 0.2, 0.18, 16), C.sol, { y: 0.88, x: 0.18 }));
    return { grupo: g };
  },
  librero(id = 1) {
    const g = new THREE.Group();
    g.add(P(G.caja(1.85, 1.9, 0.6, 0.05), C.madera, { y: 0.95, z: -0.1 }));
    g.add(P(G.cubo(1.65, 1.7, 0.05), C.maderaOscura, { y: 0.95, z: -0.37, sinContorno: true }));
    const colores = [C.fresa, C.celeste, C.sol, C.menta, C.lavanda, C.durazno, C.rosa, C.azul];
    let semilla = id * 97;
    const r = () => { semilla = (semilla * 9301 + 49297) % 233280; return semilla / 233280; };
    for (const [i, y] of [0.12, 0.72, 1.32].entries()) {
      g.add(P(G.cubo(1.7, 0.05, 0.5), C.maderaClara, { y: y - 0.03, z: -0.08 }));
      let x = -0.75;
      while (x < 0.7) {
        const ancho = 0.08 + r() * 0.07;
        const alto = 0.32 + r() * 0.18;
        g.add(P(G.caja(ancho, alto, 0.36, 0.015), colores[Math.floor(r() * colores.length)], { x: x + ancho / 2, y: y + alto / 2, z: -0.05, rz: r() < 0.12 ? 0.2 : 0 }));
        x += ancho + 0.02;
        if (i === 1 && x > 0.2 && x < 0.3) x += 0.25; // un hueco con una matita
      }
    }
    g.add(P(G.cil(0.08, 0.06, 0.12), C.terracota, { x: 0.42, y: 0.78, z: -0.05 }));
    g.add(P(G.esf(0.1), C.verde, { x: 0.42, y: 0.9, z: -0.05 }));
    return { grupo: g };
  },
  tele() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.8, 0.5, 0.62, 0.06), C.maderaClara, { y: 0.25 }));
    for (const x of [-0.45, 0.45]) g.add(P(G.caja(0.78, 0.36, 0.04, 0.02), C.madera, { x, y: 0.25, z: 0.31 }));
    g.add(P(G.caja(1.55, 0.92, 0.09, 0.04), C.negro, { y: 1.02, z: -0.1 }));
    const pantalla = new THREE.Mesh(G.plano(1.4, 0.78), new THREE.MeshBasicMaterial({ map: texturaTele(), toneMapped: false }));
    pantalla.position.set(0, 1.02, -0.05);
    g.add(pantalla);
    g.add(P(G.cil(0.05, 0.08, 0.06), C.negro, { y: 0.53, z: -0.1 }));
    return { grupo: g, pantalla };
  },
  cocina() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.9, 0.86, 0.86, 0.05), C.blanco, { y: 0.43 }));
    g.add(P(G.caja(1.96, 0.08, 0.92, 0.03), C.menta, { y: 0.9 }));
    g.add(P(G.caja(0.8, 0.5, 0.04, 0.03), C.grisOscuro, { x: -0.45, y: 0.4, z: 0.43 }));
    g.add(P(G.cil(0.03, 0.03, 0.6, 8), C.gris, { x: -0.45, y: 0.72, z: 0.47, rz: Math.PI / 2 }));
    for (const x of [0.2, 0.7]) g.add(P(G.caja(0.42, 0.6, 0.04, 0.03), C.menta, { x, y: 0.4, z: 0.43 }));
    for (const [x, z] of [[-0.6, -0.15], [-0.25, 0.15]]) g.add(P(G.cil(0.15, 0.15, 0.02), C.negro, { x, y: 0.95, z }));
    g.add(P(G.cil(0.17, 0.15, 0.2), C.fresa, { x: -0.6, y: 1.06, z: -0.15 }));
    g.add(P(G.toro(0.15, 0.02), C.fresa, { x: -0.6, y: 1.16, z: -0.15, rx: Math.PI / 2 }));
    g.add(P(G.cil(0.08, 0.08, 0.25), C.sol, { x: 0.6, y: 1.06, z: -0.2 }));
    return { grupo: g };
  },
  refri() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.84, 1.8, 0.78, 0.14), C.menta, { y: 0.9 }));
    g.add(P(G.cubo(0.8, 0.02, 0.02), C.grisOscuro, { y: 1.2, z: 0.39, sinContorno: true }));
    for (const y of [0.7, 1.45]) g.add(P(G.caja(0.06, 0.32, 0.06, 0.02), C.blanco, { x: 0.3, y, z: 0.42 }));
    g.add(P(G.esf(0.05, 1, 1, 0.4), C.fresa, { x: -0.15, y: 1.5, z: 0.4 }));
    g.add(P(G.esf(0.05, 1, 1, 0.4), C.sol, { x: -0.05, y: 1.35, z: 0.4 }));
    return { grupo: g };
  },
  escritorio() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.85, 0.08, 0.8, 0.03), C.maderaClara, { y: 0.76 }));
    patas(g, 1.75, 0.7, 0.72, C.madera, 0.045);
    g.add(P(G.caja(0.55, 0.4, 0.62, 0.04), C.blanco, { x: 0.55, y: 0.52 }));
    g.add(P(G.cubo(0.6, 0.01, 0.42), C.blanco, { x: -0.25, y: 0.81, rz: 0, ry: 0.15 }));
    g.add(P(G.cil(0.08, 0.07, 0.18), C.celeste, { x: -0.72, y: 0.89, z: -0.18 }));
    for (const [i, c] of [C.fresa, C.sol, C.verde].entries()) g.add(P(G.cil(0.012, 0.012, 0.26, 6), c, { x: -0.74 + i * 0.025, y: 1.0, z: -0.18, rz: (i - 1) * 0.15 }));
    g.add(P(G.cil(0.02, 0.02, 0.5, 8), C.grisOscuro, { x: 0.6, y: 1.05, z: -0.22 }));
    g.add(P(G.cono(0.14, 0.18), C.sol, { x: 0.6, y: 1.32, z: -0.15, rx: 0.6 }));
    return { grupo: g };
  },
  piano() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.75, 1.2, 0.6, 0.05), C.negro, { y: 0.6, z: -0.12 }));
    g.add(P(G.caja(1.75, 0.08, 0.36, 0.02), C.negro, { y: 0.74, z: 0.3 }));
    g.add(P(G.cubo(1.6, 0.04, 0.26), C.blanco, { y: 0.8, z: 0.32 }));
    for (let i = 0; i < 11; i += 1) if (i % 7 !== 2 && i % 7 !== 6) g.add(P(G.cubo(0.06, 0.04, 0.15), C.negro, { x: -0.72 + i * 0.145, y: 0.83, z: 0.27, sinContorno: true }));
    g.add(P(G.cubo(0.55, 0.36, 0.02), C.blanco, { y: 1.05, z: 0.19, rx: -0.2 }));
    patas(g, 1.6, 0.5, 0.12, C.negro, 0.05);
    return { grupo: g };
  },
  maquinita() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.8, 1.75, 0.72, 0.06), C.lavanda, { y: 0.88 }));
    g.add(P(G.caja(0.84, 0.3, 0.2, 0.05), C.fresa, { y: 1.66, z: 0.22 }));
    const pantalla = new THREE.Mesh(G.plano(0.58, 0.5), new THREE.MeshBasicMaterial({ map: texturaArcade(), toneMapped: false }));
    pantalla.position.set(0, 1.25, 0.37);
    pantalla.rotation.x = -0.25;
    g.add(pantalla);
    g.add(P(G.caja(0.8, 0.12, 0.32, 0.04), C.grisOscuro, { y: 0.92, z: 0.42 }));
    g.add(P(G.cil(0.018, 0.018, 0.12, 6), C.negro, { x: -0.18, y: 1.03, z: 0.44 }));
    g.add(P(G.esf(0.05), C.rojo, { x: -0.18, y: 1.1, z: 0.44 }));
    for (const [i, c] of [C.sol, C.celeste].entries()) g.add(P(G.cil(0.04, 0.04, 0.03), c, { x: 0.08 + i * 0.13, y: 0.99, z: 0.44 }));
    return { grupo: g, pantalla };
  },
  matita() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.2, 0.15, 0.32), C.terracota, { y: 0.16 }));
    g.add(P(G.cil(0.22, 0.22, 0.06), C.terracota, { y: 0.32 }));
    for (const [x, y, z, r] of [[0, 0.52, 0, 0.18], [-0.13, 0.45, 0.06, 0.13], [0.13, 0.47, -0.04, 0.14], [0.02, 0.66, 0.02, 0.12]]) g.add(P(G.esf(r), C.verde, { x, y, z }));
    return { grupo: g, planta: true };
  },
  planta() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.28, 0.22, 0.45), C.blanco, { y: 0.23 }));
    g.add(P(G.cil(0.29, 0.29, 0.05), C.celeste, { y: 0.4 }));
    const hojas = new THREE.Group();
    for (let i = 0; i < 7; i += 1) {
      const a = (i / 7) * Math.PI * 2;
      const alto = 0.85 + (i % 3) * 0.22;
      hojas.add(P(G.cil(0.015, 0.015, alto, 6), C.verdeOscuro, { x: Math.cos(a) * 0.08, y: 0.42 + alto / 2, z: Math.sin(a) * 0.08, rz: Math.cos(a) * 0.25, rx: -Math.sin(a) * 0.25 }));
      hojas.add(P(G.esf(0.2, 1, 0.25, 1.3), C.verde, { x: Math.cos(a) * 0.3, y: 0.4 + alto, z: Math.sin(a) * 0.3, ry: -a, rz: 0.5 }));
    }
    g.add(hojas);
    return { grupo: g, planta: true };
  },
  lampara() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.22, 0.25, 0.06), C.grisOscuro, { y: 0.03 }));
    g.add(P(G.cil(0.025, 0.025, 1.4, 8), C.grisOscuro, { y: 0.73 }));
    g.add(P(G.cil(0.2, 0.34, 0.36, 20), mat(C.sol, { emissive: 0xffb84a, emissiveIntensity: 0.55 }), { y: 1.5 }));
    const luz = new THREE.PointLight(0xffd59a, 1.6, 4.5, 1.6);
    luz.position.set(0, 1.4, 0);
    g.add(luz);
    return { grupo: g, luz };
  },
  alfombra() {
    const g = new THREE.Group();
    g.add(P(G.caja(2.8, 0.04, 1.8, 0.02), new THREE.MeshToonMaterial({ map: texturaAlfombra(false), gradientMap: gradiente() }), { y: 0.02, sombra: false }));
    return { grupo: g };
  },
  alfombra_redonda() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.92, 0.92, 0.04, 32), new THREE.MeshToonMaterial({ map: texturaAlfombra(true), gradientMap: gradiente() }), { y: 0.02, sombra: false }));
    return { grupo: g };
  },
  puf() {
    const g = new THREE.Group();
    g.add(P(G.esf(0.4, 1, 0.62, 1), C.sol, { y: 0.25 }));
    g.add(P(G.esf(0.08, 1, 0.5, 1), C.fresa, { y: 0.5 }));
    return { grupo: g, asientos: [[0, 0.48, 0]] };
  },
  tocadiscos() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.8, 0.6, 0.7, 0.05), C.maderaClara, { y: 0.3 }));
    g.add(P(G.caja(0.78, 0.14, 0.68, 0.04), C.fresa, { y: 0.67 }));
    const disco = P(G.cil(0.26, 0.26, 0.02, 28), C.negro, { y: 0.75, x: -0.05 });
    disco.add(P(G.cil(0.08, 0.08, 0.025, 16), C.sol, { sinContorno: true }));
    g.add(disco);
    g.add(P(G.caja(0.04, 0.03, 0.34, 0.01), C.gris, { x: 0.27, y: 0.78, z: -0.02, ry: 0.4 }));
    return { grupo: g, disco };
  },
  pecera() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.8, 0.55, 0.7, 0.05), C.maderaClara, { y: 0.28 }));
    const vidrio = new THREE.Mesh(G.cubo(0.72, 0.5, 0.56), new THREE.MeshBasicMaterial({ color: 0xbfe2ff, transparent: true, opacity: 0.38, depthWrite: false }));
    vidrio.position.y = 0.82;
    g.add(vidrio);
    g.add(P(G.cubo(0.7, 0.06, 0.54), C.durazno, { y: 0.6, sinContorno: true }));
    g.add(P(G.esf(0.06), C.verde, { x: -0.2, y: 0.68, z: -0.1 }));
    const peces = [];
    for (const [c, y] of [[C.sol, 0.8], [C.fresa, 0.92]]) {
      const pez = new THREE.Group();
      pez.add(P(G.esf(0.06, 1.4, 1, 0.7), c));
      pez.add(P(G.cono(0.04, 0.07), c, { x: -0.1, rz: Math.PI / 2 }));
      pez.position.y = y;
      g.add(pez);
      peces.push(pez);
    }
    return { grupo: g, peces };
  },
  caballete() {
    const g = new THREE.Group();
    for (const x of [-0.22, 0.22]) g.add(P(G.cubo(0.05, 1.5, 0.05), C.madera, { x, y: 0.72, rz: x > 0 ? -0.12 : 0.12 }));
    g.add(P(G.cubo(0.05, 1.4, 0.05), C.madera, { y: 0.68, z: -0.3, rx: -0.25 }));
    g.add(P(G.cubo(0.6, 0.05, 0.12), C.madera, { y: 0.62, z: 0.05 }));
    const lienzo = P(G.caja(0.62, 0.74, 0.05, 0.02), new THREE.MeshToonMaterial({ map: texturaLienzo(), gradientMap: gradiente() }), { y: 1.05, z: 0.02, rx: -0.08 });
    g.add(lienzo);
    return { grupo: g, lienzo };
  },
  peluche() {
    const g = new THREE.Group();
    const cafe = 0xc9945f;
    g.add(P(G.esf(0.3, 1, 1.1, 0.9), cafe, { y: 0.32 }));
    g.add(P(G.esf(0.18, 1, 0.9, 0.9), 0xf1d3ad, { y: 0.32, z: 0.18 }));
    g.add(P(G.esf(0.25), cafe, { y: 0.82 }));
    for (const x of [-0.19, 0.19]) g.add(P(G.esf(0.09), cafe, { x, y: 1.03 }));
    g.add(P(G.esf(0.1, 1, 0.8, 0.7), 0xf1d3ad, { y: 0.77, z: 0.2 }));
    g.add(P(G.esf(0.035), C.negro, { y: 0.8, z: 0.28, sinContorno: true }));
    for (const x of [-0.09, 0.09]) g.add(P(G.esf(0.03), C.negro, { x, y: 0.89, z: 0.21, sinContorno: true }));
    for (const x of [-0.3, 0.3]) g.add(P(G.esf(0.11, 1, 1.3, 1), cafe, { x, y: 0.42, z: 0.05 }));
    for (const x of [-0.16, 0.16]) g.add(P(G.esf(0.12, 1, 0.8, 1.2), cafe, { x, y: 0.1, z: 0.18 }));
    g.add(P(G.esf(0.08, 1, 0.6, 0.6), C.fresa, { y: 0.6, z: 0.18 }));
    return { grupo: g };
  },

  // ☁️ El perrito nube: blanquito, de ojos azules y orejas largas (vuela con ellas), con
  // su colita enrollada como un rollito de canela, sentado en su cojín de nube.
  perrito_nube() {
    const g = new THREE.Group();
    const blanco = 0xffffff;
    const nube = 0xb8dcff;
    g.add(P(G.esf(0.42, 1, 0.3, 1), nube, { y: 0.11 }));
    for (const [x, z] of [[-0.26, 0.16], [0.27, 0.12], [0.02, -0.24], [-0.2, -0.18]]) g.add(P(G.esf(0.19, 1, 0.62, 1), nube, { x, y: 0.15, z }));
    const perrito = new THREE.Group();
    perrito.position.y = 0.18;
    g.add(perrito);
    perrito.add(P(G.esf(0.24, 1, 0.92, 0.9), blanco, { y: 0.24 }));
    for (const x of [-0.12, 0.12]) perrito.add(P(G.esf(0.07, 1, 0.75, 1.25), blanco, { x, y: 0.07, z: 0.15 }));
    perrito.add(P(G.toro(0.075, 0.036), blanco, { x: 0.2, y: 0.3, z: -0.16, ry: 0.9 }));
    perrito.add(P(G.esf(0.035), blanco, { x: 0.2, y: 0.3, z: -0.16, sinContorno: true }));
    const cabeza = new THREE.Group();
    cabeza.position.y = 0.64;
    perrito.add(cabeza);
    cabeza.add(P(G.esf(0.31, 1.14, 0.9, 0.95), blanco));
    for (const x of [-0.11, 0.11]) cabeza.add(P(G.esf(0.046, 0.85, 1.15, 0.5), 0x4f8fe0, { x, y: 0.02, z: 0.27, sinContorno: true }));
    for (const x of [-0.095, 0.125]) cabeza.add(P(G.esf(0.015), 0xffffff, { x, y: 0.05, z: 0.29, sinContorno: true }));
    for (const x of [-0.2, 0.2]) cabeza.add(P(G.esf(0.052, 1, 0.55, 0.3), C.rosa, { x, y: -0.07, z: 0.24, sinContorno: true }));
    cabeza.add(P(G.esf(0.022, 1.5, 0.8, 0.5), TINTA, { y: -0.075, z: 0.29, sinContorno: true }));
    const orejas = [];
    for (const sx of [-1, 1]) {
      const pivote = new THREE.Group();
      pivote.position.set(sx * 0.24, 0.13, 0);
      cabeza.add(pivote);
      pivote.add(P(G.esf(0.12, 0.85, 2.7, 0.42), blanco, { x: sx * 0.13, y: -0.2, rz: sx * 0.55 }));
      orejas.push({ pivote, sx });
    }
    return { grupo: g, perrito, orejas, perritoNube: true };
  },
  // Una mesita redonda con rollitos de canela y un cafecito.
  rollitos() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.26, 0.3, 0.05, 20), C.maderaClara, { y: 0.025 }));
    g.add(P(G.cil(0.05, 0.07, 0.58, 10), C.maderaClara, { y: 0.32 }));
    g.add(P(G.cil(0.43, 0.43, 0.06, 28), C.blanco, { y: 0.63 }));
    g.add(P(G.cil(0.3, 0.25, 0.03, 24), 0xd4ecff, { y: 0.68 }));
    for (const [x, z, y] of [[-0.11, 0.07, 0.73], [0.12, 0.05, 0.73], [0, -0.1, 0.8]]) {
      g.add(P(G.cil(0.1, 0.1, 0.06, 18), 0xd2955a, { x, y, z }));
      g.add(P(G.toro(0.058, 0.022), 0xfff3e2, { x, y: y + 0.034, z, rx: Math.PI / 2, sinContorno: true }));
      g.add(P(G.cil(0.02, 0.02, 0.012, 8), 0xfff3e2, { x, y: y + 0.034, z, sinContorno: true }));
    }
    g.add(P(G.cil(0.07, 0.06, 0.12, 14), C.blanco, { x: 0.28, y: 0.72, z: 0.2 }));
    g.add(P(G.toro(0.035, 0.012), C.blanco, { x: 0.36, y: 0.72, z: 0.2, sinContorno: true }));
    g.add(P(G.cil(0.058, 0.058, 0.01, 14), C.maderaOscura, { x: 0.28, y: 0.775, z: 0.2, sinContorno: true }));
    return { grupo: g };
  },

  // ---- de pared (la espalda en z = 0, mirando a +z)
  cuadro() {
    const g = new THREE.Group();
    g.add(P(G.caja(0.8, 0.98, 0.08, 0.03), C.madera, { y: 1.75, z: 0.04 }));
    const foto = new THREE.Mesh(G.plano(0.64, 0.82), new THREE.MeshBasicMaterial({ color: 0xfffdf7, toneMapped: false }));
    foto.position.set(0, 1.75, 0.086);
    g.add(foto);
    return { grupo: g, foto };
  },
  ventana() {
    const g = new THREE.Group();
    const cielo = new THREE.Mesh(G.plano(1.5, 1.15), new THREE.MeshBasicMaterial({ map: texturaCielo(), toneMapped: false }));
    cielo.position.set(0, 1.85, 0.02);
    g.add(cielo);
    for (const [w, h, x, y] of [[1.68, 0.1, 0, 2.47], [1.68, 0.1, 0, 1.23], [0.1, 1.34, -0.8, 1.85], [0.1, 1.34, 0.8, 1.85], [0.06, 1.2, 0, 1.85], [1.5, 0.06, 0, 1.85]]) {
      g.add(P(G.caja(w, h, 0.08, 0.02), C.blanco, { x, y, z: 0.05 }));
    }
    g.add(P(G.caja(1.8, 0.08, 0.22, 0.03), C.blanco, { y: 1.18, z: 0.11 }));
    for (const x of [-0.92, 0.92]) g.add(P(G.caja(0.26, 1.5, 0.06, 0.05), C.rosa, { x, y: 1.85, z: 0.12 }));
    g.add(P(G.cil(0.03, 0.03, 2.1, 8), C.madera, { y: 2.6, z: 0.14, rz: Math.PI / 2 }));
    return { grupo: g };
  },
  reloj() {
    const g = new THREE.Group();
    g.add(P(G.cil(0.32, 0.32, 0.08, 28), C.sol, { y: 2.1, z: 0.04, rx: Math.PI / 2 }));
    g.add(P(G.cil(0.27, 0.27, 0.02, 28), C.blanco, { y: 2.1, z: 0.09, rx: Math.PI / 2, sinContorno: true }));
    const aguja = (largo, ancho, color) => {
      const pivote = new THREE.Group();
      pivote.position.set(0, 2.1, 0.11);
      pivote.add(P(G.cubo(ancho, largo, 0.01), color, { y: largo / 2 - 0.02, sinContorno: true }));
      g.add(pivote);
      return pivote;
    };
    const horas = aguja(0.15, 0.03, C.negro);
    const minutos = aguja(0.22, 0.02, C.fresa);
    g.add(P(G.esf(0.025), C.negro, { y: 2.1, z: 0.12, sinContorno: true }));
    return { grupo: g, agujas: { horas, minutos } };
  },
  repisa() {
    const g = new THREE.Group();
    g.add(P(G.caja(1.7, 0.07, 0.32, 0.02), C.maderaClara, { y: 1.65, z: 0.16 }));
    for (const x of [-0.6, 0.6]) g.add(P(G.cubo(0.05, 0.14, 0.2), C.madera, { x, y: 1.56, z: 0.1 }));
    for (const [x, c] of [[-0.5, C.terracota], [0, C.blanco], [0.48, C.celeste]]) {
      g.add(P(G.cil(0.1, 0.08, 0.16), c, { x, y: 1.77, z: 0.16 }));
      g.add(P(G.esf(0.12), C.verde, { x, y: 1.93, z: 0.16 }));
    }
    return { grupo: g, planta: true };
  },
  luces() {
    const g = new THREE.Group();
    const focos = [];
    const colores = [0xff9db5, 0xffcf4a, 0x8fe0c4, 0x9fcfff, 0xcbb8ff];
    for (let i = 0; i <= 12; i += 1) {
      const t = i / 12;
      const x = -1.35 + t * 2.7;
      const y = 3.0 - Math.sin(t * Math.PI) * 0.35;
      g.add(P(G.esf(0.012), C.grisOscuro, { x, y: y + 0.03, z: 0.06, sinContorno: true }));
      if (i % 2 === 0) {
        const foco = new THREE.Mesh(G.esf(0.06, 1, 1.3, 1), brillo(colores[(i / 2) % colores.length]));
        foco.position.set(x, y - 0.05, 0.07);
        g.add(foco);
        focos.push(foco);
      }
    }
    for (let i = 0; i < 40; i += 1) {
      const t = i / 40;
      g.add(P(G.cil(0.008, 0.008, 0.08, 4), C.grisOscuro, { x: -1.35 + t * 2.7 + 0.034, y: 3.03 - Math.sin((t + 0.0125) * Math.PI) * 0.35, z: 0.06, rz: Math.PI / 2 - Math.cos(t * Math.PI) * 0.4, sinContorno: true, sombra: false }));
    }
    return { grupo: g, focos };
  },
  espejo() {
    const g = new THREE.Group();
    g.add(P(G.esf(0.38, 1, 1.35, 0.12), C.sol, { y: 1.75, z: 0.04 }));
    const vidrio = new THREE.Mesh(G.esf(0.32, 1, 1.35, 0.05), new THREE.MeshBasicMaterial({ color: 0xd9ecff, toneMapped: false }));
    vidrio.position.set(0, 1.75, 0.07);
    g.add(vidrio);
    g.add(P(G.cubo(0.06, 0.3, 0.01), C.blanco, { x: -0.1, y: 1.85, z: 0.1, rz: 0.5, sinContorno: true, sombra: false }));
    return { grupo: g };
  },
};

// Arma el mueble `tipo` (con `id` para que, por ejemplo, los libros salgan siempre iguales).
export function construir(tipo, id = 1) {
  const hacer = CONSTRUCTORES[tipo];
  if (!hacer) {
    const g = new THREE.Group();
    g.add(P(G.caja(0.8, 0.8, 0.8, 0.1), C.rosa, { y: 0.4 }));
    return { grupo: g };
  }
  const r = hacer(id);
  r.grupo.userData.tipo = tipo;
  return r;
}

// Cada cuadro de la casa puede mostrar uno de sus dibujos.
export function ponerFoto(mueble, imagen) {
  if (!mueble.foto) return;
  const t = new THREE.Texture(imagen);
  t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  mueble.foto.material = new THREE.MeshBasicMaterial({ map: t, toneMapped: false });
}

const entrarSalir = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);

// Lo que se mueve solo en cada mueble (relojes, peces, el disco, las luces…).
export function animarMueble(m, t) {
  if (m.agujas) {
    const ahora = new Date();
    const min = ahora.getMinutes() + ahora.getSeconds() / 60;
    m.agujas.minutos.rotation.z = -(min / 60) * Math.PI * 2;
    m.agujas.horas.rotation.z = -(((ahora.getHours() % 12) + min / 60) / 12) * Math.PI * 2;
  }
  if (m.peces) m.peces.forEach((pez, i) => { const a = t * (0.7 + i * 0.3) + i * 2; pez.position.x = Math.cos(a) * 0.2; pez.position.z = Math.sin(a) * 0.14; pez.rotation.y = -a - Math.PI / 2; });
  if (m.disco && m.sonando) m.disco.rotation.y = t * 3;
  if (m.focos) m.focos.forEach((f, i) => { f.material.opacity = 0.65 + Math.sin(t * 2.4 + i) * 0.35; f.material.transparent = true; });
  if (m.luz) m.luz.intensity = 1.5 + Math.sin(t * 1.3) * 0.08;
  if (m.orejas) {
    // El perrito nube: las orejas se mecen; si está volando, aletea, sube y da una vuelta.
    const k = m.volarDesde != null ? (t - m.volarDesde) / 3.2 : 1;
    const vuela = k >= 0 && k < 1;
    const aleteo = vuela ? Math.sin(t * 24) * 0.6 : Math.sin(t * 1.7) * 0.09;
    for (const { pivote, sx } of m.orejas) pivote.rotation.z = sx * (0.12 + aleteo);
    m.perrito.position.y = 0.18 + (vuela ? Math.sin(k * Math.PI) * 1.1 : Math.abs(Math.sin(t * 1.1)) * 0.015);
    m.perrito.rotation.y = vuela ? entrarSalir(k) * Math.PI * 2 : 0;
    if (!vuela) m.volarDesde = null;
  }
}

// ------------------------------------------------------------------ el cuarto
function texturaPiso(tipo, color) {
  return textura(256, 256, (x, w, h) => {
    x.fillStyle = color;
    x.fillRect(0, 0, w, h);
    if (tipo === 'piso_madera' || tipo === 'piso_clara') {
      // tablas
      x.strokeStyle = 'rgba(58, 39, 69, .22)';
      x.lineWidth = 2;
      for (let i = 0; i <= 8; i += 1) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(w, i * 32); x.stroke(); }
      for (let i = 0; i < 8; i += 1) {
        const off = (i % 2) * 64;
        for (let j = -1; j < 3; j += 1) { x.beginPath(); x.moveTo(off + j * 128, i * 32); x.lineTo(off + j * 128, i * 32 + 32); x.stroke(); }
      }
      x.fillStyle = 'rgba(255, 255, 255, .12)';
      for (let i = 0; i < 8; i += 1) x.fillRect(0, i * 32 + 4, w, 4);
    } else if (tipo === 'piso_baldosas') {
      x.fillStyle = '#f9c8d4';
      for (let i = 0; i < 4; i += 1) for (let j = 0; j < 4; j += 1) if ((i + j) % 2) x.fillRect(i * 64, j * 64, 64, 64);
      x.strokeStyle = 'rgba(58, 39, 69, .15)';
      for (let i = 0; i <= 4; i += 1) { x.beginPath(); x.moveTo(i * 64, 0); x.lineTo(i * 64, h); x.moveTo(0, i * 64); x.lineTo(w, i * 64); x.stroke(); }
    } else {
      // alfombrado: puntitos suaves
      x.fillStyle = 'rgba(255, 255, 255, .22)';
      for (let i = 0; i < 8; i += 1) for (let j = 0; j < 8; j += 1) { x.beginPath(); x.arc(16 + i * 32 + (j % 2) * 16, 16 + j * 32, 3, 0, Math.PI * 2); x.fill(); }
    }
  });
}

function texturaPared(color, id) {
  return textura(128, 128, (x, w, h) => {
    x.fillStyle = color;
    x.fillRect(0, 0, w, h);
    if (id === 'pintura_nubes') {
      // cielito con nubes esponjosas
      x.fillStyle = 'rgba(255, 255, 255, .9)';
      for (const [cx, cy, s] of [[30, 34, 1], [96, 92, 0.85]]) {
        for (const [dx, dy, r] of [[-12, 4, 9], [0, -2, 12], [13, 3, 9], [24, 6, 6], [-22, 7, 6]]) { x.beginPath(); x.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2); x.fill(); }
        x.fillRect(cx - 22 * s, cy + 4 * s, 46 * s, 8 * s);
      }
      x.fillStyle = 'rgba(255, 207, 74, .55)';
      for (const [cx, cy] of [[90, 26], [24, 100]]) { x.beginPath(); x.arc(cx, cy, 3, 0, Math.PI * 2); x.fill(); }
      return;
    }
    // papel tapiz con florcitas y rayitas suaves
    x.fillStyle = 'rgba(255, 255, 255, .45)';
    for (let i = 0; i < 4; i += 1) x.fillRect(i * 32 + 14, 0, 4, h);
    x.fillStyle = 'rgba(255, 143, 177, .18)';
    for (const [cx, cy] of [[30, 30], [94, 94]]) {
      for (let k = 0; k < 5; k += 1) { const a = (k / 5) * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4.5, 0, Math.PI * 2); x.fill(); }
    }
  });
}

// El cuarto: piso de `lado` x `lado`, dos paredes atrás (izquierda: x = 0; derecha: z = 0).
export function construirCuarto(lado, { pintura, piso }) {
  const g = new THREE.Group();
  const alto = 4.2;
  const tPiso = texturaPiso(piso.id, piso.color);
  tPiso.wrapS = THREE.RepeatWrapping;
  tPiso.wrapT = THREE.RepeatWrapping;
  tPiso.repeat.set(lado / 4, lado / 4);
  const suelo = pieza(G.cubo(lado, 0.3, lado), new THREE.MeshToonMaterial({ map: tPiso, gradientMap: gradiente() }), { x: lado / 2, y: -0.15, z: lado / 2, sombra: false });
  suelo.receiveShadow = true;
  suelo.userData.esPiso = true;
  g.add(suelo);
  g.add(pieza(G.caja(lado + 0.5, 0.25, lado + 0.5, 0.08), C.maderaOscura, { x: lado / 2 - 0.1, y: -0.42, z: lado / 2 - 0.1, sombra: false }));

  const tPared = texturaPared(pintura.color, pintura.id);
  tPared.wrapS = THREE.RepeatWrapping;
  tPared.wrapT = THREE.RepeatWrapping;
  tPared.repeat.set(lado / 2, alto / 2);
  const matPared = new THREE.MeshToonMaterial({ map: tPared, gradientMap: gradiente() });
  const izq = pieza(G.cubo(0.3, alto, lado + 0.3), matPared, { x: -0.15, y: alto / 2 - 0.3, z: lado / 2 - 0.15 });
  izq.userData.pared = 'izq';
  const der = pieza(G.cubo(lado, alto, 0.3), matPared, { x: lado / 2, y: alto / 2 - 0.3, z: -0.15 });
  der.userData.pared = 'der';
  g.add(izq, der);
  // zócalos y molduras
  g.add(pieza(G.cubo(0.06, 0.18, lado), C.blanco, { x: 0.03, y: 0.09, z: lado / 2, sombra: false }));
  g.add(pieza(G.cubo(lado, 0.18, 0.06), C.blanco, { x: lado / 2, y: 0.09, z: 0.03, sombra: false }));
  g.add(pieza(G.cubo(0.34, 0.12, lado + 0.34), C.blanco, { x: -0.15, y: alto - 0.3, z: lado / 2 - 0.17, sombra: false }));
  g.add(pieza(G.cubo(lado + 0.04, 0.12, 0.34), C.blanco, { x: lado / 2, y: alto - 0.3, z: -0.15, sombra: false }));
  return { grupo: g, paredes: [izq, der], suelo, alto: alto - 0.3 };
}
