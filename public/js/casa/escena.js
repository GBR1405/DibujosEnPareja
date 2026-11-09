// La escena de la casa: un cuartito en 2.5D (cámara isométrica), con sus muebles y los
// dos personajes que caminan solos por la casa, usan los muebles (se sientan, se acuestan,
// bailan con el tocadiscos, riegan las matitas…) y de vez en cuando se buscan para darse
// un abrazo. Si tocas el piso, tu personaje camina hasta allá.

import * as THREE from '../../vendor/three.js';
import { construir, construirCuarto, animarMueble, ponerFoto, ajustarContorno } from './muebles3d.js';
import { crearPersonaje, ALTURA } from './personaje.js';

const YAW = Math.PI / 4; // la cámara mira desde la esquina (+x, +z)
const ELEVACION = 0.6;   // radianes sobre el horizonte (~34°)

// Qué hace cada personaje con cada uso, y qué dice.
const USOS = {
  sentarse: { pose: 'sentado', emojis: ['😌', '☕', '💭', '📱'], subir: true },
  dormir: { pose: 'dormido', emojis: ['💤'], subir: true },
  mirar: { pose: 'mirar', emojis: ['👀', '✨', '😮'] },
  comer: { pose: 'mirar', emojis: ['🍰', '🧃', '🍪', '😋'] },
  leer: { pose: 'mirar', emojis: ['📖', '🤓'] },
  cocinar: { pose: 'mirar', emojis: ['🍳', '🥞', '👩‍🍳'] },
  dibujar: { pose: 'mirar', emojis: ['✏️', '🎨'] },
  tocar: { pose: 'bailar', emojis: ['🎹', '🎵', '🎶'] },
  jugar: { pose: 'mirar', emojis: ['🕹️', '🎮', '⭐'] },
  bailar: { pose: 'bailar', emojis: ['🎵', '🎶', '💃'] },
  regar: { pose: 'mirar', emojis: ['💧', '🌱'] },
  pintar: { pose: 'mirar', emojis: ['🎨', '🖌️'] },
  abrazar: { pose: 'abrazar', emojis: ['🧸', '🥰'] },
};
const EMOJI_TELE = { tele: '📺', pecera: '🐠', cuadro: '🖼️', ventana: '☀️', espejo: '🪞', perrito_nube: '☁️', rollitos: '😋' };

export function crearEscena(contenedor, { lado, catalogo }) {
  const tipos = new Map(catalogo.map((m) => [m.id, m]));
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  renderer.domElement.className = 'casa-lienzo';
  contenedor.append(renderer.domElement);

  const escena = new THREE.Scene();
  const centro = new THREE.Vector3(lado / 2, 0.9, lado / 2);
  const camara = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  const dir = new THREE.Vector3(Math.sin(YAW) * Math.cos(ELEVACION), Math.sin(ELEVACION), Math.cos(YAW) * Math.cos(ELEVACION));
  camara.position.copy(centro).addScaledVector(dir, 30);
  camara.lookAt(centro);

  escena.add(new THREE.HemisphereLight(0xfff6ea, 0xcfc6f3, 1.35));
  const sol = new THREE.DirectionalLight(0xfff0dc, 1.7);
  sol.position.set(lado / 2 + 6, 12, lado / 2 + 3);
  sol.target.position.set(lado / 2, 0, lado / 2);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 40 });
  sol.shadow.bias = -0.0015;
  sol.shadow.radius = 4;
  escena.add(sol, sol.target);

  // ---- el cuarto
  let cuarto = null;
  function ponerCuarto({ pintura, piso }) {
    if (cuarto) escena.remove(cuarto.grupo);
    cuarto = construirCuarto(lado, { pintura: tipos.get(pintura), piso: tipos.get(piso) });
    escena.add(cuarto.grupo);
  }

  // ---- el tamaño: que el cuarto quepa entero
  function ajustar() {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    ajustarContorno(w * renderer.getPixelRatio(), h * renderer.getPixelRatio(), renderer.getPixelRatio());
    // Las esquinas del cuarto, vistas desde la cámara.
    camara.updateMatrixWorld();
    const vista = camara.matrixWorldInverse;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const x of [-0.3, lado]) for (const y of [-0.55, 4]) for (const z of [-0.3, lado]) {
      const p = new THREE.Vector3(x, y, z).applyMatrix4(vista);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const margen = 0.35;
    let ancho = x1 - x0 + margen * 2;
    let alto = y1 - y0 + margen * 2;
    if (ancho / alto > w / h) alto = ancho * (h / w); else ancho = alto * (w / h);
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    Object.assign(camara, { left: cx - ancho / 2, right: cx + ancho / 2, top: cy + alto / 2, bottom: cy - alto / 2 });
    camara.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(contenedor);

  // ---- los muebles
  const objetos = new Map(); // id -> { dato, obj (lo que devuelve construir), grupo }
  const raizMuebles = new THREE.Group();
  escena.add(raizMuebles);

  // Dónde va un mueble en el mundo.
  function colocar(entrada) {
    const { dato, obj } = entrada;
    const t = tipos.get(dato.tipo);
    const g = obj.grupo;
    if (t.cat === 'pared') {
      const medio = dato.x + t.w / 2;
      if (dato.pared === 'izq') { g.position.set(0, 0, medio); g.rotation.y = Math.PI / 2; } else { g.position.set(medio, 0, 0); g.rotation.y = 0; }
      return;
    }
    const girado = dato.rot % 2 === 1;
    const we = girado ? t.d : t.w;
    const de = girado ? t.w : t.d;
    g.position.set(dato.x + we / 2, 0, dato.z + de / 2);
    g.rotation.y = (dato.rot * Math.PI) / 2;
  }

  function ponerMueble(dato, { imagenCuadro } = {}) {
    quitarMueble(dato.id);
    const obj = construir(dato.tipo, dato.id);
    obj.grupo.traverse((o) => { o.userData.mueble = dato.id; });
    const entrada = { dato: { ...dato }, obj };
    objetos.set(dato.id, entrada);
    if (dato.x == null) return entrada;
    colocar(entrada);
    raizMuebles.add(obj.grupo);
    if (imagenCuadro) ponerFoto(obj, imagenCuadro);
    recalcular();
    return entrada;
  }
  function quitarMueble(id) {
    const e = objetos.get(id);
    if (!e) return;
    raizMuebles.remove(e.obj.grupo);
    objetos.delete(id);
    recalcular();
  }
  function moverMueble(id, cambio) {
    const e = objetos.get(id);
    if (!e) return;
    Object.assign(e.dato, cambio);
    if (e.dato.x == null) { raizMuebles.remove(e.obj.grupo); recalcular(); return; }
    if (!e.obj.grupo.parent) raizMuebles.add(e.obj.grupo);
    colocar(e);
    recalcular();
  }

  // ---- por dónde se puede caminar
  let bloqueadas = new Set();
  const casillasDe = (dato) => {
    const t = tipos.get(dato.tipo);
    if (!t || t.cat === 'pared' || dato.x == null) return [];
    const girado = dato.rot % 2 === 1;
    const we = girado ? t.d : t.w;
    const de = girado ? t.w : t.d;
    const lista = [];
    for (let i = 0; i < we; i += 1) for (let j = 0; j < de; j += 1) lista.push([dato.x + i, dato.z + j]);
    return lista;
  };
  function recalcular() {
    bloqueadas = new Set();
    for (const { dato } of objetos.values()) {
      const t = tipos.get(dato.tipo);
      if (t && !t.plano) for (const [x, z] of casillasDe(dato)) bloqueadas.add(`${x},${z}`);
    }
    for (const p of personajes) if (p.camino && p.camino.some(([x, z]) => bloqueadas.has(`${x},${z}`))) { p.camino = null; p.estado = 'pensando'; p.espera = 0.2; }
  }
  const libre = (x, z) => x >= 0 && z >= 0 && x < lado && z < lado && !bloqueadas.has(`${x},${z}`);
  const casillasLibres = () => {
    const l = [];
    for (let x = 0; x < lado; x += 1) for (let z = 0; z < lado; z += 1) if (libre(x, z)) l.push([x, z]);
    return l;
  };

  // El camino más corto (en casillas, con diagonales) de `a` a `b`.
  function buscarCamino([ax, az], [bx, bz]) {
    if (!libre(bx, bz)) return null;
    const clave = (x, z) => x * 64 + z;
    const previo = new Map([[clave(ax, az), null]]);
    const cola = [[ax, az]];
    while (cola.length) {
      const [x, z] = cola.shift();
      if (x === bx && z === bz) {
        const camino = [];
        let k = clave(x, z);
        while (k != null) { camino.unshift([Math.floor(k / 64), k % 64]); k = previo.get(k); }
        return camino;
      }
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx;
        const nz = z + dz;
        if (!libre(nx, nz) || previo.has(clave(nx, nz))) continue;
        if (dx && dz && (!libre(x + dx, z) || !libre(x, z + dz))) continue; // sin cortar esquinas
        previo.set(clave(nx, nz), clave(x, z));
        cola.push([nx, nz]);
      }
    }
    return null;
  }

  // La casilla desde donde se usa un mueble (enfrente, o cualquiera libre al lado).
  function casillaParaUsar(dato) {
    const t = tipos.get(dato.tipo);
    if (t.cat === 'pared') {
      const p = dato.x + Math.floor(t.w / 2);
      const cand = dato.pared === 'izq' ? [[0, p], [1, p], [0, p - 1], [0, p + 1]] : [[p, 0], [p, 1], [p - 1, 0], [p + 1, 0]];
      return cand.find(([x, z]) => libre(x, z)) || null;
    }
    const celdas = casillasDe(dato);
    const girado = dato.rot % 2 === 1;
    const we = girado ? t.d : t.w;
    const de = girado ? t.w : t.d;
    const frente = [
      [dato.x + Math.floor(we / 2), dato.z + de],
      [dato.x + we, dato.z + Math.floor(de / 2)],
      [dato.x + Math.floor(we / 2), dato.z - 1],
      [dato.x - 1, dato.z + Math.floor(de / 2)],
    ][dato.rot];
    if (libre(...frente)) return frente;
    const ocupado = new Set(celdas.map(([x, z]) => `${x},${z}`));
    for (const [x, z] of celdas) {
      for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        if (!ocupado.has(`${x + dx},${z + dz}`) && libre(x + dx, z + dz)) return [x + dx, z + dz];
      }
    }
    return null;
  }

  // Un punto del mueble (en su espacio) llevado al mundo.
  function alMundo(entrada, [x, y, z]) {
    return new THREE.Vector3(x, y, z).applyMatrix4(entrada.obj.grupo.matrixWorld);
  }

  // ---- los personajes
  const personajes = [];
  const centroDe = ([x, z]) => new THREE.Vector3(x + 0.5, 0, z + 0.5);
  const casillaDe = (v) => [Math.min(lado - 1, Math.max(0, Math.floor(v.x))), Math.min(lado - 1, Math.max(0, Math.floor(v.z)))];
  const derechaPantalla = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
  const haciaCamara = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));
  const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];

  function ponerPersonaje(imagen, cuenta, animo = {}) {
    const viejo = personajes.findIndex((p) => p.id === cuenta.id);
    let lugar = null;
    if (viejo >= 0) { lugar = personajes[viejo].muneco.raiz.position.clone(); escena.remove(personajes[viejo].muneco.raiz); personajes[viejo].muneco.destruir(); personajes.splice(viejo, 1); }
    const muneco = crearPersonaje(imagen, cuenta, { yaw: YAW });
    const libres = casillasLibres();
    const inicio = lugar ? casillaDe(lugar) : azar(libres.length ? libres : [[1, 1]]);
    muneco.raiz.position.copy(lugar || centroDe(inicio));
    muneco.animo.desanimado = Boolean(animo.pospuso);
    escena.add(muneco.raiz);
    const p = { id: cuenta.id, muneco, estado: 'pensando', espera: 0.5 + Math.random() * 2, camino: null, usando: null, animo, quieto: 0 };
    personajes.push(p);
    return p;
  }

  function liberarDe(p) {
    // Si estaba sentado o acostado, se baja de un saltito a la casilla de al lado.
    const u = p.usando;
    p.usando = null;
    p.muneco.ponerPose('quieto');
    if (u && u.entrada && u.entrada.obj.disco) u.entrada.obj.sonando = false;
    if (u && u.subido && u.bajarA) p.muneco.saltarA(u.bajarA, { dur: 0.4, arco: 0.35 });
    else if (u && u.abrazo && u.volverA) p.muneco.saltarA(u.volverA, { dur: 0.3, arco: 0.05 });
    else if (!p.muneco.viajando) p.muneco.raiz.position.y = 0;
  }

  function caminarA(p, destino, alLlegar) {
    // Si está a medio saltito, el camino empieza donde va a caer.
    const desde = casillaDe(p.muneco.posicionFinal());
    if (!libre(...desde)) {
      // quedó encima de un mueble (lo pusieron ahí): sale de un saltito a la casilla libre más cercana
      const libres = casillasLibres();
      if (!libres.length) return false;
      libres.sort((a, b) => Math.hypot(a[0] - desde[0], a[1] - desde[1]) - Math.hypot(b[0] - desde[0], b[1] - desde[1]));
      p.muneco.saltarA(centroDe(libres[0]), { dur: 0.45, arco: 0.4 });
      const camino = buscarCamino(libres[0], destino);
      if (!camino) return false;
      p.camino = camino.slice(1).map(centroDe);
      p.alLlegar = alLlegar;
      p.estado = 'caminando';
      return true;
    }
    const camino = buscarCamino(desde, destino);
    if (!camino) return false;
    p.camino = camino.slice(1).map(centroDe);
    p.alLlegar = alLlegar;
    p.estado = 'caminando';
    return true;
  }

  // Lo que decide hacer cada uno cuando no está haciendo nada.
  function decidir(p) {
    const otro = personajes.find((x) => x !== p);
    const usables = [...objetos.values()].filter((e) => e.obj.grupo.parent && tipos.get(e.dato.tipo).uso && !personajes.some((x) => x.usando && x.usando.entrada === e));
    const r = Math.random();
    if (otro && r < 0.18 && otro.estado !== 'usando') {
      // ir a darle un abrazo
      const [ox, oz] = casillaDe(otro.muneco.raiz.position);
      const al = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => [ox + dx, oz + dz]).filter(([x, z]) => libre(x, z));
      if (al.length && caminarA(p, azar(al), () => abrazo(p, otro))) return;
    }
    if (usables.length && r < 0.7) {
      const e = azar(usables);
      const lugar = casillaParaUsar(e.dato);
      if (lugar && caminarA(p, lugar, () => usar(p, e, lugar))) return;
    }
    const libres = casillasLibres();
    if (libres.length && caminarA(p, azar(libres), () => { p.estado = 'pensando'; p.espera = 1 + Math.random() * 3; })) return;
    p.estado = 'pensando';
    p.espera = 2;
  }

  // Que mire hacia `punto` (de espaldas si está más lejos de la cámara que él).
  function mirarA(p, punto, { siempreDeFrente = false } = {}) {
    const v = punto.clone().sub(p.muneco.raiz.position);
    v.y = 0;
    if (v.lengthSq() < 1e-6) { p.muneco.deFrente(); return; }
    v.normalize();
    p.muneco.mirarHacia(v.dot(derechaPantalla), siempreDeFrente ? 1 : v.dot(haciaCamara));
  }

  function usar(p, entrada, lugar) {
    const t = tipos.get(entrada.dato.tipo);
    const uso = USOS[t.uso] || USOS.mirar;
    const duracion = t.uso === 'dormir' ? 9 + Math.random() * 5 : 5 + Math.random() * 5;
    p.estado = 'usando';
    p.usando = { entrada, hasta: duracion, bajarA: centroDe(lugar), cada: 1.5 };
    mirarA(p, entrada.obj.grupo.position);
    const empezar = () => {
      if (p.usando?.entrada !== entrada) return; // se fue a otra cosa mientras tanto
      if (uso.subir) p.muneco.deFrente(); // sentado o acostado, de frente
      p.muneco.ponerPose(uso.pose);
      if (entrada.obj.disco) entrada.obj.sonando = true;
      if (entrada.obj.planta) { entrada.obj.grupo.scale.setScalar(1.06); setTimeout(() => entrada.obj.grupo.scale.setScalar(1), 400); }
      // Al abrazar al perrito nube, sale volando con sus orejas ☁️
      if (entrada.obj.perritoNube) setTimeout(() => { entrada.obj.volarDesde = t; }, 700);
      p.muneco.decir(EMOJI_TELE[t.id] || azar(uso.emojis));
    };
    if (uso.subir && entrada.obj.asientos) {
      // Se sube de un saltito al asiento (o a la cama).
      const libres = entrada.obj.asientos.filter((_, i) => !personajes.some((x) => x !== p && x.usando && x.usando.entrada === entrada && x.usando.asiento === i));
      const i = entrada.obj.asientos.indexOf(azar(libres.length ? libres : entrada.obj.asientos));
      p.usando.asiento = i;
      p.usando.subido = true;
      entrada.obj.grupo.updateMatrixWorld();
      const punto = alMundo(entrada, entrada.obj.asientos[i]);
      if (t.uso === 'dormir') { punto.addScaledVector(derechaPantalla, ALTURA * 0.45); punto.y -= 0.25; } // los pies a un lado, la cabeza al otro
      p.muneco.ponerPose('quieto');
      p.muneco.saltarA(punto, { dur: 0.45, arco: 0.45, alFin: empezar });
      return;
    }
    empezar();
  }

  function abrazo(p, otro) {
    if (!otro || otro.estado === 'usando' || otro.muneco.viajando) { p.estado = 'pensando'; p.espera = 1; return; }
    if (otro.estado === 'caminando') { otro.camino = null; }
    const a = p.muneco.raiz.position.clone();
    const b = otro.muneco.raiz.position.clone();
    otro.estado = 'usando';
    otro.usando = { abrazo: true, hasta: 3, volverA: b };
    p.estado = 'usando';
    p.usando = { abrazo: true, hasta: 3, volverA: a };
    mirarA(p, b);
    mirarA(otro, a);
    // Se acercan un pasito el uno al otro.
    const medio = a.clone().add(b).multiplyScalar(0.5);
    p.muneco.saltarA(a.clone().lerp(medio, 0.55), { dur: 0.3, arco: 0.06 });
    otro.muneco.saltarA(b.clone().lerp(medio, 0.55), { dur: 0.3, arco: 0.06 });
    p.muneco.ponerPose('abrazar');
    otro.muneco.ponerPose('abrazar');
    p.muneco.decir('❤️', 2.6);
    setTimeout(() => otro.muneco.decir(azar(['🥰', '💕', '💛']), 2.4), 500);
  }

  // Lo que pasa en cada cuadro con cada personaje.
  function pensar(p, dt) {
    const m = p.muneco;
    // Mientras da un saltito, no camina ni decide nada.
    if (m.viajando) { m.animar(dt); return; }
    if (p.estado === 'caminando') {
      const meta = p.camino && p.camino[0];
      if (!meta) {
        p.estado = 'pensando';
        p.espera = 1;
        const listo = p.alLlegar;
        p.alLlegar = null;
        if (listo) listo();
        m.animar(dt);
        return;
      }
      const pos = m.raiz.position;
      const v = new THREE.Vector3(meta.x - pos.x, 0, meta.z - pos.z);
      const dist = v.length();
      // Arranca y frena suavecito (no a toda velocidad de golpe).
      p.rapidez = Math.min(1, (p.rapidez || 0) + dt * 4);
      const quedaCamino = p.camino.length === 1 ? Math.min(1, 0.35 + dist * 1.3) : 1;
      const velocidad = (m.animo.desanimado ? 1.0 : 1.55) * dt * p.rapidez * quedaCamino;
      if (dist > 1e-4) { const d = v.clone().normalize(); m.mirarHacia(d.dot(derechaPantalla), d.dot(haciaCamara)); }
      if (dist <= velocidad) { pos.x = meta.x; pos.z = meta.z; p.camino.shift(); if (!p.camino.length) { p.rapidez = 0; m.deFrente(); } } else { v.multiplyScalar(velocidad / dist); pos.add(v); }
      pos.y = 0;
      m.animar(dt, { moviendose: true });
      return;
    }
    if (p.estado === 'usando') {
      p.usando.hasta -= dt;
      p.usando.cada -= dt;
      const t = p.usando.entrada && tipos.get(p.usando.entrada.dato.tipo);
      if (t && p.usando.cada <= 0) {
        p.usando.cada = 3 + Math.random() * 2;
        const uso = USOS[t.uso] || USOS.mirar;
        if (Math.random() < 0.45) m.decir(azar(uso.emojis));
      }
      if (p.usando.hasta <= 0) {
        liberarDe(p);
        p.estado = 'pensando';
        p.espera = 1 + Math.random() * 2.5;
      }
      m.animar(dt);
      return;
    }
    // pensando
    p.espera -= dt;
    p.quieto += dt;
    if (p.quieto > 9 && p.animo.pospuso) { p.quieto = 0; m.decir(p.animo.pospuso === 'mal' ? '🌧️' : '💼', 2.4); }
    else if (p.quieto > 12 && p.animo.dibujo) { p.quieto = 0; m.decir(azar(['✨', '🎨', '💛']), 2); }
    if (p.espera <= 0) { p.quieto = 0; decidir(p); }
    m.animar(dt);
  }

  // ---- tocar
  const rayo = new THREE.Raycaster();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function rayoDesde(e) {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    rayo.setFromCamera(ndc, camara);
    return rayo;
  }
  // Qué hay debajo del dedo: { personaje, mueble, casilla, pared }.
  function queHay(e) {
    const r = rayoDesde(e);
    const res = {};
    const golpes = r.intersectObjects([...personajes.map((p) => p.muneco.raiz), raizMuebles, ...(cuarto ? cuarto.paredes : [])], true)
      .filter((g) => !g.object.userData.esContorno);
    for (const g of golpes) {
      if (g.object.userData.personaje && !res.personaje && !res.mueble) res.personaje = g.object.userData.personaje;
      if (g.object.userData.mueble != null && !res.mueble && !res.personaje) res.mueble = g.object.userData.mueble;
      if (g.object.userData.pared && !res.pared) {
        const lugar = g.object.userData.pared === 'izq' ? g.point.z : g.point.x;
        res.pared = { pared: g.object.userData.pared, pos: lugar, alto: g.point.y };
      }
    }
    const p = new THREE.Vector3();
    if (r.ray.intersectPlane(plano, p) && p.x >= 0 && p.z >= 0 && p.x < lado && p.z < lado) res.casilla = [Math.floor(p.x), Math.floor(p.z)];
    return res;
  }

  // ---- marcar casillas (al decorar)
  const marcas = new THREE.Group();
  escena.add(marcas);
  const matOk = new THREE.MeshBasicMaterial({ color: 0x7fdcc0, transparent: true, opacity: 0.55, depthWrite: false });
  const matMal = new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.6, depthWrite: false });
  const geoMarca = new THREE.PlaneGeometry(0.94, 0.94);
  function marcar(casillas, ok) {
    marcas.clear();
    for (const [x, z] of casillas) {
      const m = new THREE.Mesh(geoMarca, ok ? matOk : matMal);
      m.rotation.x = -Math.PI / 2;
      m.position.set(x + 0.5, 0.03, z + 0.5);
      marcas.add(m);
    }
  }
  // La cuadrícula del piso (al decorar).
  const rejilla = new THREE.Group();
  for (let i = 0; i <= lado; i += 1) {
    for (const vertical of [true, false]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.025 : lado, vertical ? lado : 0.025), new THREE.MeshBasicMaterial({ color: 0x3a2745, transparent: true, opacity: 0.18, depthWrite: false }));
      l.rotation.x = -Math.PI / 2;
      l.position.set(vertical ? i : lado / 2, 0.025, vertical ? lado / 2 : i);
      rejilla.add(l);
    }
  }
  rejilla.visible = false;
  escena.add(rejilla);

  // Un mueble seleccionado brilla un poquito (se agranda y se le marca la huella).
  let seleccionado = null;
  function seleccionar(id) {
    if (seleccionado && objetos.get(seleccionado)) objetos.get(seleccionado).obj.grupo.scale.setScalar(1);
    seleccionado = id;
    if (id != null && objetos.get(id)) objetos.get(id).obj.grupo.scale.setScalar(1.04);
  }

  // ---- el bucle
  const reloj = new THREE.Timer();
  let t = 0;
  let corriendo = true;
  function cuadro(ahora) {
    if (!corriendo) return;
    reloj.update(ahora);
    const dt = Math.min(0.05, reloj.getDelta());
    t += dt;
    for (const p of personajes) pensar(p, dt);
    for (const e of objetos.values()) {
      if (!e.obj.grupo.parent) continue;
      // De vez en cuando, el perrito nube se da una vueltita volando solo.
      if (e.obj.perritoNube && e.obj.volarDesde == null && Math.random() < dt / 45) e.obj.volarDesde = t;
      animarMueble(e.obj, t);
    }
    renderer.render(escena, camara);
  }
  renderer.setAnimationLoop(cuadro);
  const alOcultar = () => { renderer.setAnimationLoop(document.hidden ? null : cuadro); };
  document.addEventListener('visibilitychange', alOcultar);
  ajustar();

  // ---- fotitos de los muebles (para la tienda)
  const fotos = new Map();
  function foto(tipo) {
    if (fotos.has(tipo)) return fotos.get(tipo);
    const lado2 = 160;
    const destino = new THREE.WebGLRenderTarget(lado2, lado2, { samples: 4 });
    destino.texture.colorSpace = THREE.SRGBColorSpace;
    const mini = new THREE.Scene();
    mini.add(new THREE.HemisphereLight(0xfff6ea, 0xcfc6f3, 1.5));
    const luz = new THREE.DirectionalLight(0xfff0dc, 1.6);
    luz.position.set(4, 8, 6);
    mini.add(luz);
    const { grupo } = construir(tipo, 7);
    const esPared = tipos.get(tipo)?.cat === 'pared';
    mini.add(grupo);
    const caja = new THREE.Box3().setFromObject(grupo);
    const c = caja.getCenter(new THREE.Vector3());
    const tam = caja.getSize(new THREE.Vector3()).length() * 0.58;
    const cam = new THREE.OrthographicCamera(-tam, tam, tam, -tam, 0.1, 100);
    const d = esPared ? new THREE.Vector3(0.5, 0.35, 1).normalize() : dir;
    cam.position.copy(c).addScaledVector(d, 20);
    cam.lookAt(c);
    ajustarContorno(lado2, lado2, 1);
    renderer.setRenderTarget(destino);
    renderer.setClearColor(0x000000, 0);
    renderer.clear();
    renderer.render(mini, cam);
    const pixeles = new Uint8Array(lado2 * lado2 * 4);
    renderer.readRenderTargetPixels(destino, 0, 0, lado2, lado2, pixeles);
    renderer.setRenderTarget(null);
    ajustar();
    destino.dispose();
    const lienzo = document.createElement('canvas');
    lienzo.width = lado2;
    lienzo.height = lado2;
    const x = lienzo.getContext('2d');
    const im = x.createImageData(lado2, lado2);
    for (let y = 0; y < lado2; y += 1) im.data.set(pixeles.subarray((lado2 - 1 - y) * lado2 * 4, (lado2 - y) * lado2 * 4), y * lado2 * 4);
    x.putImageData(im, 0, 0);
    const url = lienzo.toDataURL('image/png');
    fotos.set(tipo, url);
    return url;
  }

  return {
    ponerCuarto,
    ponerMueble,
    quitarMueble,
    moverMueble,
    mueble: (id) => objetos.get(id),
    ponerFotoEn(id, imagen) { const e = objetos.get(id); if (e) ponerFoto(e.obj, imagen); },
    ponerPersonaje,
    personaje: (id) => personajes.find((p) => p.id === id),
    // Mi personaje camina hasta esa casilla y saluda.
    llamar(id, casilla) {
      const p = personajes.find((x) => x.id === id);
      if (!p) return false;
      liberarDe(p);
      const ok = caminarA(p, casilla, () => { p.estado = 'pensando'; p.espera = 4; p.muneco.ponerPose('saludar'); p.muneco.decir('👋', 1.8); setTimeout(() => { if (p.muneco.pose === 'saludar') p.muneco.ponerPose('quieto'); }, 1600); });
      if (!ok) p.muneco.decir('🤔', 1.4);
      return ok;
    },
    // ☁️ El perrito nube sale volando (devuelve true si ese mueble era el perrito).
    volarPerrito(id) {
      const e = objetos.get(id);
      if (!e || !e.obj.perritoNube) return false;
      if (e.obj.volarDesde == null) e.obj.volarDesde = t;
      return true;
    },
    // Mi personaje va a usar ese mueble (si se puede usar).
    mandarAUsar(id, muebleId) {
      const p = personajes.find((x) => x.id === id);
      const e = objetos.get(muebleId);
      if (!p || !e || !e.obj.grupo.parent || !tipos.get(e.dato.tipo).uso) return false;
      if (personajes.some((x) => x !== p && x.usando && x.usando.entrada === e && !e.obj.asientos)) { p.muneco.decir('⏳', 1.4); return true; }
      liberarDe(p);
      const lugar = casillaParaUsar(e.dato);
      if (!lugar) return false;
      return caminarA(p, lugar, () => usar(p, e, lugar));
    },
    tocarPersonaje(id, texto) {
      const p = personajes.find((x) => x.id === id);
      if (!p) return;
      p.muneco.saltar();
      p.muneco.decir(texto || '❤️', 2);
    },
    queHay,
    marcar,
    limpiarMarcas: () => marcas.clear(),
    verRejilla: (si) => { rejilla.visible = si; },
    seleccionar,
    casillasDe,
    libre,
    foto,
    lienzo: renderer.domElement,
    destruir() {
      corriendo = false;
      renderer.setAnimationLoop(null);
      document.removeEventListener('visibilitychange', alOcultar);
      observador.disconnect();
      for (const p of personajes) p.muneco.destruir();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
