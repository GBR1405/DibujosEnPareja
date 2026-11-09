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

// `imagen`: el dibujo del personaje (canvas o <img>, 3:4). `cuenta`: { id, nombre }.
export function crearPersonaje(imagen, cuenta, { yaw = Math.PI / 4 } = {}) {
  const { partes, escala } = partir(imagen, 0.6);
  const s = ALTURA / (PIES * escala); // unidades del mundo por píxel de la pieza
  const piesY = PIES * escala;
  const aMundo = (px, py) => [(px - 300 * escala) * s, (piesY - py) * s];

  const raiz = new THREE.Group();
  raiz.userData.personaje = cuenta.id;
  const giro = new THREE.Group(); // mira a la cámara
  giro.rotation.y = yaw;
  raiz.add(giro);
  const inclinado = new THREE.Group(); // un poquito hacia atrás, para que no se vea aplastado
  inclinado.rotation.x = -0.3;
  giro.add(inclinado);
  const cuerpo = new THREE.Group();
  inclinado.add(cuerpo);

  const mallas = [];
  // Un "hueso": un grupo en la articulación, con su pieza adentro.
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

  // ---- hacia dónde mira (como en los juegos isométricos: de frente o de espaldas, y en
  // espejo para la izquierda o la derecha). Al cambiar, se voltea con un giro rapidito.
  let lado = 1;              // 1 derecha, -1 izquierda (en la pantalla)
  let deEspaldas = false;    // lo que se quiere
  let espaldaPuesta = false; // lo que se ve
  let volteo = 0;            // el giro (de 1 a 0)
  let escalaX = 1;
  function ponerEspalda(si) {
    espaldaPuesta = si;
    for (const x of mallas) x.material.map = si ? x.userData.espalda : x.userData.frente;
    // De espaldas, los bracitos quedan detrás del cuerpo.
    brazoI.position.z = si ? -0.006 : brazoI.userData.base.z;
    brazoD.position.z = si ? -0.006 : brazoD.userData.base.z;
  }

  // ---- poses
  let pose = 'quieto';
  let fase = 0;        // el paso al caminar
  let andar = 0;       // 0 = quieto, 1 = caminando (se mezcla suave)
  let salto = 0;       // el saltito de cuando lo tocas
  let mirando = 0;     // para ladearse hacia donde va (en su propio espacio: + = adelante)
  let mirandoSuave = 0;
  const animo = { desanimado: false };
  const m = { pI: 0, pD: 0, bI: 0, bD: 0, cab: 0, ladeo: 0, liftI: 0, liftD: 0, piernas: 1, bajar: 0, acostado: 0 };

  function animar(dt, { moviendose = false } = {}) {
    reloj += dt;
    const t = reloj;
    const lento = animo.desanimado ? 0.7 : 1;

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

    andar = suave(andar, moviendose ? 1 : 0, 10, dt);
    mirandoSuave = suave(mirandoSuave, mirando, 6, dt);

    // Metas de cada pose (ángulos en radianes).
    const meta = { pI: 0, pD: 0, bI: 0, bD: 0, cab: 0, ladeo: 0, liftI: 0, liftD: 0, piernas: 1, bajar: 0, acostado: 0 };
    let rebote = 0;
    let estira = 0; // + estira, - aplasta
    if (pose === 'sentado') {
      meta.piernas = 0.45;
      meta.bajar = largoPierna * 0.5;
      meta.pI = -0.32; meta.pD = 0.32;
      meta.bI = 0.18 + Math.sin(t * 1.4) * 0.04; meta.bD = -0.18 - Math.sin(t * 1.4) * 0.04;
      meta.cab = Math.sin(t * 0.7) * 0.06;
      // a veces mueve los piecitos
      meta.liftI = Math.max(0, Math.sin(t * 2.2)) * 0.03; meta.liftD = Math.max(0, -Math.sin(t * 2.2)) * 0.03;
    } else if (pose === 'dormido') {
      meta.acostado = Math.PI / 2;
      meta.cab = 0.12;
      meta.bI = 0.1; meta.bD = -0.1;
      estira = Math.sin(t * 1.3) * 0.015; // respira
    } else if (pose === 'bailar') {
      const b = t * 7;
      meta.ladeo = Math.sin(b) * 0.16;
      meta.bI = -2.1 + Math.sin(b * 2) * 0.35; meta.bD = 2.1 - Math.sin(b * 2 + 0.6) * 0.35;
      meta.liftI = Math.max(0, Math.sin(b)) * 0.09; meta.liftD = Math.max(0, -Math.sin(b)) * 0.09;
      meta.cab = Math.sin(b + 1) * 0.12;
      rebote = Math.abs(Math.sin(b)) * 0.1;
      estira = -Math.abs(Math.cos(b)) * 0.05;
    } else if (pose === 'saludar') {
      meta.bD = 2.4 + Math.sin(t * 13) * 0.3;
      meta.bI = -0.12;
      meta.cab = 0.1;
      meta.ladeo = -0.05;
    } else if (pose === 'abrazar') {
      meta.bI = -0.75; meta.bD = 0.75;
      meta.ladeo = -0.2; // se inclina hacia adelante (hacia el otro)
      meta.cab = -0.14;
      estira = Math.sin(t * 5) * 0.02;
    } else if (pose === 'mirar') {
      meta.bI = 0.08; meta.bD = -0.08;
      meta.cab = Math.sin(t * 0.9) * 0.08 - mirando * 0.08;
      meta.ladeo = -mirando * 0.04;
      rebote = Math.sin(t * 2) * 0.008;
    } else {
      // quieto: respira y se balancea un poquito
      meta.bI = Math.sin(t * 1.6) * 0.05; meta.bD = -Math.sin(t * 1.6) * 0.05;
      meta.cab = Math.sin(t * 0.7) * 0.05;
      meta.ladeo = Math.sin(t * 0.9) * 0.015;
      estira = Math.sin(t * 2.2) * 0.012;
    }

    // Caminar se mezcla encima de la pose (y gana mientras se mueve).
    if (andar > 0.01) {
      fase += dt * 10.5 * lento * andar;
      const paso = Math.sin(fase);
      const w = andar;
      const mezcla = (k, v) => { meta[k] = meta[k] * (1 - w) + v * w; };
      mezcla('liftI', Math.max(0, paso) * 0.085);           // se levanta una pierna…
      mezcla('liftD', Math.max(0, -paso) * 0.085);          // …y luego la otra
      mezcla('pI', -Math.max(0, paso) * 0.16);
      mezcla('pD', Math.max(0, -paso) * 0.16);
      const brazos = 0.22 + mirandoSuave * 0.2;             // de lado se mecen más (adelante y atrás)
      mezcla('bI', -0.12 - paso * brazos);
      mezcla('bD', 0.12 - paso * brazos);
      mezcla('ladeo', -paso * 0.07 - mirandoSuave * 0.08);  // se carga hacia el pie que apoya y hacia adelante
      mezcla('cab', paso * 0.05 - mirandoSuave * 0.04);
      rebote = rebote * (1 - w) + Math.abs(Math.cos(fase)) * 0.055 * w;
      estira = estira * (1 - w) + (Math.abs(Math.cos(fase)) - 0.5) * 0.06 * w;
    }
    if (animo.desanimado) { meta.cab += 0.2; meta.bI *= 0.6; meta.bD *= 0.6; rebote *= 0.6; }

    // El saltito de cuando lo tocas: se agacha, salta y cae.
    if (salto > 0) {
      salto = Math.max(0, salto - dt);
      const k = 1 - salto / 0.55;
      const arriba = Math.max(0, Math.sin(((k - 0.15) / 0.85) * Math.PI));
      rebote += arriba * 0.4;
      estira += k < 0.15 ? -0.08 : arriba * 0.06;
      meta.bI = -0.9 * arriba; meta.bD = 0.9 * arriba;
    }

    // Voltearse: hacia la izquierda o la derecha se pasa por "de canto" (escala 0); de
    // frente a de espaldas, un giro rapidito que cambia el dibujo a la mitad.
    if (deEspaldas !== espaldaPuesta && volteo <= 0) volteo = 1;
    let aplastarX = 1;
    if (volteo > 0) {
      volteo = Math.max(0, volteo - dt / 0.2);
      if (volteo <= 0.5 && deEspaldas !== espaldaPuesta) ponerEspalda(deEspaldas);
      aplastarX = Math.abs(volteo * 2 - 1) * 0.85 + 0.15;
    }
    escalaX = suave(escalaX, lado * (0.93 + 0.07 * (1 - mirandoSuave)), 18, dt);
    giro.scale.x = escalaX * aplastarX;
    // Tres cuartos: la cabeza un poquito hacia adelante cuando va de lado.
    cabeza.position.x = cabeza.userData.base.x + mirandoSuave * 0.05;

    for (const k of Object.keys(m)) m[k] = suave(m[k], meta[k], k === 'acostado' ? 6 : 14, dt);
    piernaI.rotation.z = m.pI;
    piernaD.rotation.z = m.pD;
    piernaI.position.y = piernaI.userData.base.y + m.liftI;
    piernaD.position.y = piernaD.userData.base.y + m.liftD;
    piernaI.scale.y = m.piernas;
    piernaD.scale.y = m.piernas;
    brazoI.rotation.z = m.bI;
    brazoD.rotation.z = m.bD;
    cabeza.rotation.z = m.cab;
    torso.position.y = torso.userData.base.y - m.bajar;
    cuerpo.rotation.z = m.ladeo + m.acostado;
    cuerpo.position.y = rebote + (m.acostado / (Math.PI / 2)) * 0.25;
    cuerpo.scale.set(1 - estira * 0.5, 1 + estira, 1);
    // La sombra se achica cuando está en el aire.
    const aire = rebote + altoViaje;
    laSombra.scale.setScalar(Math.max(0.55, 1 - aire * 0.8));
    laSombra.position.y = 0.015 - altoViaje;

    if (globo) {
      const vida = globoHasta - reloj;
      const k = suave(globo.scale.y, vida > 0 ? 0.62 : 0, 14, dt);
      globo.scale.set(k * globo.userData.ancho, k, 1);
      globo.position.y = ALTURA + 0.5 + Math.sin(reloj * 3) * 0.03 - m.bajar - (m.acostado / (Math.PI / 2)) * 1.0;
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
    // Hacia dónde mira: `dx` es cuánto va hacia la derecha de la pantalla (-1 a 1) y
    // `dFrente` cuánto viene hacia la cámara (-1 = se aleja: se ve de espaldas).
    mirarHacia(dx, dFrente = 1) {
      if (Math.abs(dx) > 0.2) lado = Math.sign(dx);
      mirando = Math.abs(dx) > 0.35 ? 1 : 0;
      deEspaldas = dFrente < -0.25;
    },
    // De frente a la cámara (sin cambiar de lado).
    deFrente() { deEspaldas = false; mirando = 0; },
    saltar() { salto = 0.55; },
    destruir() {
      for (const x of mallas) { x.userData.frente.dispose(); x.userData.espalda.dispose(); x.material.dispose(); x.geometry.dispose(); }
      if (globo) { globo.material.map.dispose(); globo.material.dispose(); }
    },
  };
}
