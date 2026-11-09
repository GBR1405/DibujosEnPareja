// Un personaje de la casa: el dibujo de cada quien, cortado en 6 piezas (plantilla.js),
// armado como un muñeco de papel que se mueve sobre sus articulaciones.
//
//   raiz ─ (en el piso, siempre de frente a la cámara)
//   ├── cuerpo   (se balancea, rebota, se acuesta)
//   │   ├── piernaI, piernaD
//   │   └── torso
//   │       ├── cabeza
//   │       └── brazoI, brazoD
//   ├── sombra   (un circulito en el piso, que se achica cuando salta)
//   └── globo    (el emoji que dice: 💤 ❤️ 🎵…)
//
// Poses: quieto, sentado, dormido, bailar, saludar, abrazar, mirar (y caminar, mientras
// se mueve). Como el dibujo es de frente, caminar es "a pasitos": una pierna se levanta
// mientras la otra apoya, el cuerpo se carga hacia el pie que apoya y rebota en cada
// paso (con un poquito de "aplastado y estirado", como en los dibujos animados).
// Para subirse o bajarse de un mueble da un saltito (saltarA).

import * as THREE from '../../vendor/three.js';
import { PIVOTES, PIES, partir } from './plantilla.js';

export const ALTURA = 1.8; // lo que mide el personaje en el mundo (1 casilla = 1)

let texturaSombra = null;
function sombra() {
  if (!texturaSombra) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(58, 39, 69, .45)');
    g.addColorStop(1, 'rgba(58, 39, 69, 0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    texturaSombra = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.95), new THREE.MeshBasicMaterial({ map: texturaSombra, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.015;
  return m;
}

// El globito con un emoji (o un textito) encima de la cabeza.
function texturaGlobo(texto) {
  const c = document.createElement('canvas');
  const emoji = [...texto].length <= 2;
  c.width = emoji ? 128 : 320;
  c.height = 128;
  const x = c.getContext('2d');
  const w = c.width;
  x.fillStyle = '#fffdf7';
  x.strokeStyle = '#3a2745';
  x.lineWidth = 7;
  x.beginPath();
  x.moveTo(24, 10);
  x.lineTo(w - 24, 10);
  x.quadraticCurveTo(w - 8, 10, w - 8, 26);
  x.lineTo(w - 8, 84);
  x.quadraticCurveTo(w - 8, 100, w - 24, 100);
  x.lineTo(w / 2 + 14, 100);
  x.lineTo(w / 2, 120);
  x.lineTo(w / 2 - 14, 100);
  x.lineTo(24, 100);
  x.quadraticCurveTo(8, 100, 8, 84);
  x.lineTo(8, 26);
  x.quadraticCurveTo(8, 10, 24, 10);
  x.closePath();
  x.fill();
  x.stroke();
  x.fillStyle = '#3a2745';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = emoji ? "64px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif" : "600 44px Mali, 'Comic Sans MS', sans-serif";
  x.fillText(texto, w / 2, 58);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return { textura: t, ancho: c.width / 128 };
}

// La vista de espaldas de una pieza (el dibujo es solo de frente): la misma silueta, con
// sus colores difuminados (así se pierde la cara pero quedan las zonas de color, como
// orejas o ropa), un borde de tinta por dentro, y en espejo.
function vistaDeEspalda(origen) {
  const w = origen.width;
  const h = origen.height;
  const lienzo = (ww, hh) => { const c = document.createElement('canvas'); c.width = ww; c.height = hh; return c; };
  // 1. los colores, difuminados (o el color de en medio, si el navegador no sabe difuminar)
  const colores = lienzo(w, h);
  const cx = colores.getContext('2d');
  if ('filter' in cx) {
    cx.filter = `blur(${Math.max(3, Math.round(Math.min(w, h) * 0.09))}px)`;
    for (let i = 0; i < 3; i += 1) cx.drawImage(origen, 0, 0);
    cx.filter = 'none';
  } else {
    const d = origen.getContext('2d').getImageData(0, 0, w, h).data;
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] > 200 && d[i] + d[i + 1] + d[i + 2] > 180) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
    }
    cx.fillStyle = n ? `rgb(${r / n | 0}, ${g / n | 0}, ${b / n | 0})` : '#f6ead6';
    cx.fillRect(0, 0, w, h);
  }
  // 2. la silueta "comida" unos píxeles hacia adentro, rellena con esos colores
  const adentro = lienzo(w, h);
  const ax = adentro.getContext('2d');
  ax.drawImage(origen, 0, 0);
  ax.globalCompositeOperation = 'destination-in';
  const borde = Math.max(2, Math.round(Math.min(w, h) * 0.035));
  for (const [dx, dy] of [[borde, 0], [-borde, 0], [0, borde], [0, -borde]]) ax.drawImage(origen, dx, dy);
  ax.globalCompositeOperation = 'source-in';
  ax.drawImage(colores, 0, 0);
  // 3. la silueta entera en tinta, con lo de adentro encima; todo en espejo
  const final = lienzo(w, h);
  const fx = final.getContext('2d');
  fx.translate(w, 0);
  fx.scale(-1, 1);
  fx.drawImage(origen, 0, 0);
  fx.globalCompositeOperation = 'source-in';
  fx.fillStyle = '#3a2745';
  fx.fillRect(0, 0, w, h);
  fx.globalCompositeOperation = 'source-over';
  fx.drawImage(adentro, 0, 0);
  return final;
}

// Acerca `actual` a `meta` suavecito (sin saltos, sin importar los cuadros por segundo).
const suave = (actual, meta, rapidez, dt) => actual + (meta - actual) * (1 - Math.exp(-rapidez * dt));
const entrarSalir = (k) => (k < 0.5 ? 2 * k * k : 1 - ((-2 * k + 2) ** 2) / 2);

// Diferencia de ángulos, entre -π y π.
const difAngulo = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

// Gestos que hace estando quieto (o al usar algo). Cada uno dura `dur` segundos y cambia
// la pose según qué tan avanzado va (k de 0 a 1; `e` sube y baja suavecito).
const GESTOS = {
  estirarse: { dur: 1.8, f: (g, k, e) => { g.bI = -2.6 * e; g.bD = 2.6 * e; g.cab = -0.12 * e; g.estira += 0.07 * e; } },
  mirarAlrededor: { dur: 2.4, f: (g, k) => { g.cab = Math.sin(k * Math.PI * 2) * 0.28; g.ladeo += Math.sin(k * Math.PI * 2) * 0.05; } },
  saltito: { dur: 0.7, f: (g, k, e) => { const a = Math.max(0, Math.sin(((k - 0.15) / 0.85) * Math.PI)); g.rebote += a * 0.32; g.estira += k < 0.15 ? -0.08 : a * 0.06; g.bI = -1.1 * a; g.bD = 1.1 * a; } },
  saludar: { dur: 1.6, f: (g, k, e, t) => { g.bD = (2.4 + Math.sin(t * 13) * 0.32) * e; g.cab = 0.08 * e; g.ladeo -= 0.05 * e; } },
  bostezo: { dur: 2, f: (g, k, e) => { g.bI = -1.6 * e; g.bD = 1.6 * e; g.cab = -0.2 * e; g.estira += 0.05 * e; } },
  aplaudir: { dur: 1.4, f: (g, k, e, t) => { g.bI = (0.9 + Math.sin(t * 20) * 0.35) * e; g.bD = -(0.9 + Math.sin(t * 20) * 0.35) * e; g.rebote += Math.abs(Math.sin(t * 10)) * 0.04 * e; } },
};

// `imagen`: el dibujo del personaje (canvas o <img>, 3:4). `cuenta`: { id, nombre }.
export function crearPersonaje(imagen, cuenta, { yaw = Math.PI / 4 } = {}) {
  const { partes, escala } = partir(imagen, 0.6);
  const s = ALTURA / (PIES * escala); // unidades del mundo por píxel de la pieza
  const piesY = PIES * escala;
  const aMundo = (px, py) => [(px - 300 * escala) * s, (piesY - py) * s];

  const raiz = new THREE.Group();
  raiz.userData.personaje = cuenta.id;
  const giro = new THREE.Group(); // mira a la cámara (o, acostado, hacia la cabecera)
  giro.rotation.order = 'YXZ';
  giro.rotation.y = yaw;
  raiz.add(giro);
  const inclinado = new THREE.Group(); // un poquito hacia atrás, para que no se vea aplastado
  inclinado.rotation.x = -0.3;
  giro.add(inclinado);
  const cuerpo = new THREE.Group();
  inclinado.add(cuerpo);

  const mallas = [];
  // Un "hueso": un grupo en la articulación, con su pieza adentro (de frente y de espaldas).
  function hueso(nombre, padre, z) {
    const g = new THREE.Group();
    const [pvx, pvy] = PIVOTES[nombre].map((v) => v * escala);
    const [mx, my] = aMundo(pvx, pvy);
    const [px, py] = padre.userData.pivoteMundo || [0, 0];
    g.position.set(mx - px, my - py, z);
    g.userData.pivoteMundo = [mx, my];
    g.userData.base = g.position.clone();
    padre.add(g);
    const p = partes[nombre];
    if (p) {
      const tex = new THREE.CanvasTexture(p.canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      const texEspalda = new THREE.CanvasTexture(vistaDeEspalda(p.canvas));
      texEspalda.colorSpace = THREE.SRGBColorSpace;
      const malla = new THREE.Mesh(
        new THREE.PlaneGeometry(p.w * s, p.h * s),
        new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.35, side: THREE.DoubleSide }),
      );
      const [cx, cy] = aMundo(p.x + p.w / 2, p.y + p.h / 2);
      malla.position.set(cx - mx, cy - my, 0);
      malla.userData.personaje = cuenta.id;
      malla.userData.frente = tex;
      malla.userData.espalda = texEspalda;
      g.add(malla);
      mallas.push(malla);
    }
    return g;
  }
  cuerpo.userData.pivoteMundo = [0, 0];
  const piernaI = hueso('piernaI', cuerpo, -0.004);
  const piernaD = hueso('piernaD', cuerpo, -0.004);
  const torso = hueso('torso', cuerpo, 0);
  const cabeza = hueso('cabeza', torso, 0.008);
  const brazoI = hueso('brazoI', torso, 0.004);
  const brazoD = hueso('brazoD', torso, 0.004);
  const largoPierna = (PIES - PIVOTES.piernaI[1]) * escala * s;

  const laSombra = sombra();
  raiz.add(laSombra);

  // ---- el globito
  let globo = null;
  let globoHasta = 0;
  let reloj = 0;
  function decir(texto, segundos = 2.6) {
    if (globo) { globo.material.map.dispose(); globo.material.dispose(); raiz.remove(globo); }
    const { textura, ancho } = texturaGlobo(texto);
    globo = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false, transparent: true }));
    globo.renderOrder = 10;
    globo.position.set(0, ALTURA + 0.55, 0);
    globo.userData.ancho = ancho;
    globo.scale.set(0.001, 0.001, 1);
    raiz.add(globo);
    globoHasta = reloj + segundos;
  }

  // ---- saltitos (para subirse y bajarse de los muebles, o acercarse)
  let viaje = null;
  function saltarA(hasta, { dur = 0.42, arco = 0.32, alFin } = {}) {
    viaje = { desde: raiz.position.clone(), hasta: hasta.clone(), t: 0, dur, arco, alFin };
  }

  // ---- hacia dónde mira: de frente o de espaldas, y en espejo a la izquierda o la
  // derecha (como en los juegos isométricos). Cambiar de lado espera un instante (así no
  // titila) y se voltea pasando "de canto"; de frente a espaldas, con un giro rapidito.
  let lado = 1;
  let ladoQuerido = 1;
  let ladoEspera = 0;
  let deEspaldas = false;
  let espaldaPuesta = false;
  let volteo = 0;
  let escalaX = 1;
  let deLado = 0;
  let deLadoSuave = 0;
  function ponerEspalda(si) {
    espaldaPuesta = si;
    for (const x of mallas) x.material.map = si ? x.userData.espalda : x.userData.frente;
    // De espaldas, los bracitos quedan detrás del cuerpo.
    brazoI.position.z = si ? -0.006 : brazoI.userData.base.z;
    brazoD.position.z = si ? -0.006 : brazoD.userData.base.z;
  }

  // ---- acostarse (boca arriba, con la cabeza hacia `yawCama`)
  let acostarse = false;
  let tumbado = 0;
  let yawCama = yaw;

  // ---- poses y gestos
  let pose = 'quieto';
  let fase = 0;   // el paso al caminar (avanza con la distancia: así no "patina")
  let andar = 0;  // 0 = quieto, 1 = caminando (se mezcla suave)
  let gesto = null;
  const animo = { desanimado: false };
  const m = { pI: 0, pD: 0, bI: 0, bD: 0, cab: 0, ladeo: 0, liftI: 0, liftD: 0, piernas: 1, bajar: 0 };

  function animar(dt, { avance = 0 } = {}) {
    reloj += dt;
    const t = reloj;

    // El saltito de un lugar a otro.
    let altoViaje = 0;
    if (viaje) {
      viaje.t += dt;
      const k = Math.min(1, viaje.t / viaje.dur);
      raiz.position.lerpVectors(viaje.desde, viaje.hasta, entrarSalir(k));
      altoViaje = Math.sin(k * Math.PI) * viaje.arco;
      raiz.position.y += altoViaje;
      if (k >= 1) { const fin = viaje.alFin; viaje = null; if (fin) fin(); }
    }

    const moviendose = avance > 0.0004;
    andar = suave(andar, moviendose ? 1 : 0, 9, dt);
    if (moviendose) fase += (avance / 0.95) * Math.PI * 2; // dos pasitos cada 0.95 casillas
    else fase = suave(fase, Math.round(fase / Math.PI) * Math.PI, 5, dt); // junta los pies

    if (ladoQuerido !== lado) { ladoEspera += dt; if (ladoEspera > 0.12) { lado = ladoQuerido; ladoEspera = 0; } } else ladoEspera = 0;
    deLadoSuave = suave(deLadoSuave, deLado, 6, dt);

    // Metas de cada pose (ángulos en radianes; brazoI positivo = hacia adentro/adelante,
    // brazoD negativo = hacia adentro/adelante).
    const g = { pI: 0, pD: 0, bI: 0, bD: 0, cab: 0, ladeo: 0, liftI: 0, liftD: 0, piernas: 1, bajar: 0, rebote: 0, estira: 0 };
    switch (pose) {
      case 'sentado':
        g.piernas = 0.5;
        g.bajar = largoPierna * 0.46;
        g.pI = Math.sin(t * 2.1) * 0.06; g.pD = -Math.sin(t * 2.1 + 1) * 0.06; // mueve los piecitos
        g.bI = 0.32 + Math.sin(t * 1.3) * 0.03; g.bD = -0.32 - Math.sin(t * 1.3) * 0.03; // las manitos en las piernas
        g.cab = Math.sin(t * 0.7) * 0.06;
        g.estira = Math.sin(t * 1.8) * 0.01;
        break;
      case 'dormido':
        g.bI = 0.15; g.bD = -0.15;
        g.cab = Math.sin(t * 0.5) * 0.05;
        g.estira = Math.sin(t * 1.3) * 0.02; // respira
        break;
      case 'bailar': {
        const b = t * 7;
        g.ladeo = Math.sin(b) * 0.16;
        g.bI = -2.1 + Math.sin(b * 2) * 0.35; g.bD = 2.1 - Math.sin(b * 2 + 0.6) * 0.35;
        g.liftI = Math.max(0, Math.sin(b)) * 0.09; g.liftD = Math.max(0, -Math.sin(b)) * 0.09;
        g.cab = Math.sin(b + 1) * 0.12;
        g.rebote = Math.abs(Math.sin(b)) * 0.1;
        g.estira = -Math.abs(Math.cos(b)) * 0.05;
        break;
      }
      case 'abrazar':
        g.bI = 1.05 + Math.sin(t * 3) * 0.05; g.bD = 1.25; // los dos bracitos hacia adelante
        g.ladeo = -0.18;
        g.cab = -0.16;
        g.estira = Math.sin(t * 5) * 0.015;
        g.rebote = Math.abs(Math.sin(t * 2.5)) * 0.02;
        break;
      case 'cocinar':
        g.bI = 0.7 + Math.sin(t * 7) * 0.18; g.bD = -0.55 - Math.cos(t * 7) * 0.18; // revuelve
        g.cab = 0.1 + Math.sin(t * 1.2) * 0.05;
        break;
      case 'regar':
        g.bD = 1.3 + Math.sin(t * 2.5) * 0.12; g.bI = 0.2;
        g.ladeo = -0.06;
        g.cab = -0.08;
        break;
      case 'leer':
        g.bI = 0.95; g.bD = -0.95;
        g.cab = 0.14 + Math.sin(t * 0.6) * 0.04;
        break;
      case 'jugar':
        g.bI = 0.8 + Math.sin(t * 16) * 0.07; g.bD = -0.8 - Math.cos(t * 13) * 0.07;
        g.ladeo = Math.sin(t * 1.7) * 0.06;
        g.rebote = Math.abs(Math.sin(t * 4)) * 0.02;
        break;
      case 'tocar':
        g.bI = 0.65 + Math.max(0, Math.sin(t * 9)) * 0.25; g.bD = -0.65 - Math.max(0, Math.sin(t * 9 + 2)) * 0.25;
        g.ladeo = Math.sin(t * 2.2) * 0.08;
        g.cab = Math.sin(t * 2.2 + 1) * 0.1;
        break;
      case 'mirar':
        g.bI = 0.12; g.bD = -0.12;
        g.cab = Math.sin(t * 0.9) * 0.07;
        g.rebote = Math.sin(t * 2) * 0.006;
        break;
      default: // quieto: respira y se mece un poquito
        g.bI = Math.sin(t * 1.6) * 0.05; g.bD = -Math.sin(t * 1.6) * 0.05;
        g.cab = Math.sin(t * 0.7) * 0.05;
        g.ladeo = Math.sin(t * 0.9) * 0.015;
        g.estira = Math.sin(t * 2.2) * 0.012;
    }

    // Caminar se mezcla encima (y gana mientras se mueve).
    if (andar > 0.01) {
      const paso = Math.sin(fase);
      const w = andar;
      const mezcla = (k, v) => { g[k] = g[k] * (1 - w) + v * w; };
      const brazos = 0.16 + deLadoSuave * 0.26; // de frente casi no se ven, de lado se mecen
      mezcla('liftI', Math.max(0, paso) * 0.08);
      mezcla('liftD', Math.max(0, -paso) * 0.08);
      mezcla('pI', -Math.max(0, paso) * 0.12 * (1 - deLadoSuave) + paso * 0.3 * deLadoSuave);
      mezcla('pD', Math.max(0, -paso) * 0.12 * (1 - deLadoSuave) + paso * 0.3 * deLadoSuave);
      mezcla('bI', -0.1 - paso * brazos);
      mezcla('bD', 0.1 - paso * brazos);
      mezcla('ladeo', -paso * 0.05 * (1 - deLadoSuave) - deLadoSuave * 0.07);
      mezcla('cab', paso * 0.04);
      g.rebote = g.rebote * (1 - w) + Math.abs(Math.cos(fase)) * 0.05 * w;
      g.estira = g.estira * (1 - w) + (Math.abs(Math.cos(fase)) - 0.5) * 0.05 * w;
    }

    // Un gesto (estirarse, saludar…), encima de todo.
    if (gesto) {
      gesto.t += dt;
      const k = Math.min(1, gesto.t / gesto.dur);
      const e = Math.sin(k * Math.PI);
      GESTOS[gesto.nombre].f(g, k, e, t);
      if (k >= 1) gesto = null;
    }
    if (animo.desanimado && pose !== 'dormido') { g.cab += 0.2; g.bI *= 0.6; g.bD *= 0.6; g.rebote *= 0.6; }

    for (const k of Object.keys(m)) m[k] = suave(m[k], g[k], 14, dt);
    // Voltearse.
    if (deEspaldas !== espaldaPuesta && volteo <= 0) volteo = 1;
    let aplastarX = 1;
    if (volteo > 0) {
      volteo = Math.max(0, volteo - dt / 0.22);
      if (volteo <= 0.5 && deEspaldas !== espaldaPuesta) ponerEspalda(deEspaldas);
      aplastarX = Math.abs(volteo * 2 - 1) * 0.8 + 0.2;
    }
    // Acostarse: se recuesta hacia atrás, girando hacia la cabecera.
    tumbado = suave(tumbado, acostarse ? 1 : 0, 4.5, dt);
    const k = entrarSalir(Math.min(1, Math.max(0, tumbado)));
    giro.rotation.y = yaw + difAngulo(yaw, yawCama) * k;
    giro.rotation.x = -(Math.PI / 2 - 0.16) * k;
    inclinado.rotation.x = -0.3 * (1 - k);
    escalaX = suave(escalaX, (k > 0.02 ? 1 : lado) * (0.94 + 0.06 * (1 - deLadoSuave)), 16, dt);
    giro.scale.x = escalaX * aplastarX;

    piernaI.rotation.z = m.pI;
    piernaD.rotation.z = m.pD;
    piernaI.position.y = piernaI.userData.base.y + m.liftI;
    piernaD.position.y = piernaD.userData.base.y + m.liftD;
    piernaI.scale.y = m.piernas;
    piernaD.scale.y = m.piernas;
    brazoI.rotation.z = m.bI;
    brazoD.rotation.z = m.bD;
    cabeza.rotation.z = m.cab;
    cabeza.position.x = cabeza.userData.base.x + deLadoSuave * 0.045; // tres cuartos: la cabeza un poquito adelante
    torso.position.y = torso.userData.base.y - m.bajar;
    cuerpo.rotation.z = m.ladeo;
    cuerpo.position.y = g.rebote;
    cuerpo.scale.set(1 - g.estira * 0.5, 1 + g.estira, 1);
    // La sombra se achica cuando está en el aire (y no se ve si está acostado).
    const aire = g.rebote + altoViaje;
    laSombra.visible = k < 0.4;
    laSombra.scale.setScalar(Math.max(0.55, 1 - aire * 0.8));
    laSombra.position.y = 0.015 - altoViaje;

    if (globo) {
      const vida = globoHasta - reloj;
      const kg = suave(globo.scale.y, vida > 0 ? 0.62 : 0, 14, dt);
      globo.scale.set(kg * globo.userData.ancho, kg, 1);
      globo.position.y = ALTURA + 0.5 + Math.sin(reloj * 3) * 0.03 - m.bajar - k * (ALTURA - 0.2);
      if (vida < -0.5) { globo.material.map.dispose(); globo.material.dispose(); raiz.remove(globo); globo = null; }
    }
  }

  return {
    raiz,
    mallas,
    id: cuenta.id,
    nombre: cuenta.nombre,
    animar,
    decir,
    animo,
    saltarA,
    get viajando() { return Boolean(viaje); },
    // Dónde va a quedar (si está saltando, el final del salto).
    posicionFinal: () => (viaje ? viaje.hasta : raiz.position),
    get pose() { return pose; },
    ponerPose(p) { pose = p; },
    get gesticulando() { return Boolean(gesto); },
    hacerGesto(nombre) { if (GESTOS[nombre]) gesto = { nombre, t: 0, dur: GESTOS[nombre].dur }; },
    // Hacia dónde mira: `dx` es cuánto va hacia la derecha de la pantalla (-1 a 1) y
    // `dFrente` cuánto viene hacia la cámara (negativo = se aleja: se ve de espaldas).
    mirarHacia(dx, dFrente = 1) {
      if (Math.abs(dx) > 0.25) ladoQuerido = Math.sign(dx);
      deLado = Math.abs(dx) > 0.5 ? 1 : 0;
      // con un poquito de margen, para que no cambie a cada rato en las diagonales
      if (dFrente < -0.3) deEspaldas = true;
      else if (dFrente > -0.05) deEspaldas = false;
    },
    // De frente a la cámara (sin cambiar de lado).
    deFrente() { deEspaldas = false; deLado = 0; },
    // Acostarse boca arriba con la cabeza hacia `yawCabecera` (o levantarse, con null).
    acostar(yawCabecera) {
      acostarse = yawCabecera != null;
      if (acostarse) { yawCama = yawCabecera; deEspaldas = false; deLado = 0; }
    },
    get acostado() { return tumbado > 0.5; },
    saltar() { gesto = { nombre: 'saltito', t: 0, dur: GESTOS.saltito.dur }; },
    destruir() {
      for (const x of mallas) { x.userData.frente.dispose(); x.userData.espalda.dispose(); x.material.dispose(); x.geometry.dispose(); }
      if (globo) { globo.material.map.dispose(); globo.material.dispose(); }
    },
  };
}
