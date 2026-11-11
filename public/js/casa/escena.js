// La escena de la casa: un cuartito en 2.5D (cámara isométrica, como un diorama), con sus
// muebles, el segundo piso (si lo compraron) y los dos personajes, que viven solos:
//
//   - caminan por caminos suaves (sin zigzag de casilla en casilla) y frenan al llegar;
//   - se miran de frente o de espaldas según hacia dónde van, y no se atraviesan;
//   - usan los muebles: se sientan mirando hacia donde mira el sofá, se acuestan en la
//     cama tapaditos, cocinan, riegan, leen, bailan con el tocadiscos…;
//   - se buscan para abrazarse (con corazones), a veces se sientan juntos (una cita) y de
//     noche se van a dormir;
//   - estando quietos hacen gestos: se estiran, miran alrededor, bostezan, saltan.
//
// Si tocas el piso, tu personaje camina hasta allá (sube o baja la escalera si hace falta);
// si tocas un mueble, lo usa; si tocas a tu pareja, va a darle un abrazo.

import * as THREE from '../../vendor/three.js';
import { construir, construirCuarto, animarMueble, ponerFoto, ajustarContorno, ALTO_PISO } from './muebles3d.js';
import { crearPersonaje } from './personaje.js';

const YAW = Math.PI / 4; // la cámara mira desde la esquina (+x, +z)
const ELEVACION = 0.6;   // radianes sobre el horizonte (~34°)

// Qué hace cada personaje con cada uso: su pose, qué dice y si se sube al mueble.
const USOS = {
  sentarse: { pose: 'sentado', emojis: ['😌', '☕', '💭', '📱', '🎶'], subir: 'asiento', dura: [8, 14] },
  dormir: { pose: 'dormido', emojis: ['💤'], subir: 'cama', dura: [12, 20] },
  mirar: { pose: 'mirar', emojis: ['👀', '✨', '😮'], dura: [5, 9] },
  comer: { pose: 'cocinar', emojis: ['🍰', '🧃', '🍪', '😋'], dura: [5, 8] },
  leer: { pose: 'leer', emojis: ['📖', '🤓'], dura: [7, 11] },
  cocinar: { pose: 'cocinar', emojis: ['🍳', '🥞', '🧁'], dura: [7, 11] },
  dibujar: { pose: 'leer', emojis: ['✏️', '🎨'], dura: [7, 11] },
  tocar: { pose: 'tocar', emojis: ['🎹', '🎵', '🎶'], dura: [7, 11] },
  jugar: { pose: 'jugar', emojis: ['🕹️', '🎮', '⭐'], dura: [7, 11] },
  bailar: { pose: 'bailar', emojis: ['🎵', '🎶', '💃'], dura: [6, 10] },
  regar: { pose: 'regar', emojis: ['💧', '🌱'], dura: [4, 6] },
  pintar: { pose: 'regar', emojis: ['🎨', '🖌️'], dura: [7, 11] },
  abrazar: { pose: 'abrazar', emojis: ['🧸', '🥰', '☁️'], dura: [4, 6] },
};
const EMOJI_DE = { tele: '📺', pecera: '🐠', cuadro: '🖼️', ventana: '☀️', espejo: '🪞', perrito_nube: '☁️', rollitos: '😋' };

const horaCR = () => Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Costa_Rica', hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
const azar = (lista) => lista[Math.floor(Math.random() * lista.length)];
const entre = ([a, b]) => a + Math.random() * (b - a);
const suave = (actual, meta, rapidez, dt) => actual + (meta - actual) * (1 - Math.exp(-rapidez * dt));

export function crearEscena(contenedor, { lado, catalogo, pisos: pisosIniciales = 1, escalera = null }) {
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
  const camara = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 200);
  const dir = new THREE.Vector3(Math.sin(YAW) * Math.cos(ELEVACION), Math.sin(ELEVACION), Math.cos(YAW) * Math.cos(ELEVACION));
  const derechaPantalla = new THREE.Vector3(Math.cos(YAW), 0, -Math.sin(YAW));
  const haciaCamara = new THREE.Vector3(Math.sin(YAW), 0, Math.cos(YAW));

  escena.add(new THREE.HemisphereLight(0xfff6ea, 0xcfc6f3, 1.35));
  const sol = new THREE.DirectionalLight(0xfff0dc, 1.7);
  sol.castShadow = true;
  sol.shadow.mapSize.set(1024, 1024);
  Object.assign(sol.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8, near: 1, far: 50 });
  sol.shadow.bias = -0.0015;
  escena.add(sol, sol.target);

  let pisos = pisosIniciales;
  const esc = escalera;
  let activo = 0; // el piso que se está mirando
  const capas = [new THREE.Group(), new THREE.Group()]; // los muebles de cada piso
  escena.add(...capas);

  // ---- el cuarto
  let cuarto = null;
  let ajustesCuarto = null;
  function ponerCuarto(ajustes, nuevosPisos = pisos) {
    ajustesCuarto = ajustes;
    pisos = nuevosPisos;
    if (cuarto) escena.remove(cuarto.grupo);
    cuarto = construirCuarto(lado, { pintura: tipos.get(ajustes.pintura), piso: tipos.get(ajustes.piso) }, { pisos, escalera: esc });
    escena.add(cuarto.grupo);
    recalcular();
    verPiso(Math.min(activo, pisos - 1));
  }

  // ---- qué piso se ve (el de arriba se esconde cuando se mira el de abajo)
  function verPiso(p) {
    activo = Math.max(0, Math.min(pisos - 1, p));
    if (cuarto) cuarto.niveles.forEach((n, i) => { n.grupo.visible = i <= activo; });
    capas.forEach((c, i) => { c.visible = i <= activo; });
    rejilla.position.y = activo * ALTO_PISO + 0.025;
    const base = activo * ALTO_PISO;
    sol.position.set(lado / 2 + 6, base + 12, lado / 2 + 3);
    sol.target.position.set(lado / 2, base, lado / 2);
    ajustar();
  }

  // ---- el tamaño: que el piso que se mira quepa entero
  function ajustar() {
    const w = contenedor.clientWidth;
    const h = contenedor.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    ajustarContorno(w * renderer.getPixelRatio(), h * renderer.getPixelRatio(), renderer.getPixelRatio());
    const base = activo * ALTO_PISO;
    const centro = new THREE.Vector3(lado / 2, base + 0.9, lado / 2);
    camara.position.copy(centro).addScaledVector(dir, 40);
    camara.lookAt(centro);
    camara.updateMatrixWorld();
    const vista = camara.matrixWorldInverse;
    let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity; let y1 = -Infinity;
    for (const x of [-0.3, lado]) for (const y of [base - 0.55, base + 4]) for (const z of [-0.3, lado]) {
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

  // ================================================================ los muebles
  const objetos = new Map(); // id -> { dato, obj }
  const pisoDe = (dato) => dato.piso || 0;

  function medidas(dato) {
    const t = tipos.get(dato.tipo);
    const girado = dato.rot % 2 === 1;
    return { t, we: girado ? t.d : t.w, de: girado ? t.w : t.d };
  }

  // Dónde va un mueble en el mundo.
  function colocar(entrada) {
    const { dato, obj } = entrada;
    const g = obj.grupo;
    const base = pisoDe(dato) * ALTO_PISO;
    const { t, we, de } = medidas(dato);
    if (t.cat === 'pared') {
      const medio = dato.x + t.w / 2;
      if (dato.pared === 'izq') { g.position.set(0, base, medio); g.rotation.y = Math.PI / 2; } else { g.position.set(medio, base, 0); g.rotation.y = 0; }
    } else {
      g.position.set(dato.x + we / 2, base, dato.z + de / 2);
      g.rotation.y = (dato.rot * Math.PI) / 2;
    }
    g.updateMatrixWorld(true);
    const capa = capas[pisoDe(dato)];
    if (g.parent !== capa) capa.add(g);
  }

  function ponerMueble(dato) {
    quitarMueble(dato.id);
    const obj = construir(dato.tipo, dato.id);
    obj.grupo.traverse((o) => { o.userData.mueble = dato.id; });
    const entrada = { dato: { piso: 0, ...dato }, obj };
    objetos.set(dato.id, entrada);
    if (dato.x != null) colocar(entrada);
    recalcular();
    return entrada;
  }
  function quitarMueble(id) {
    const e = objetos.get(id);
    if (!e) return;
    e.obj.grupo.removeFromParent();
    objetos.delete(id);
    recalcular();
  }
  function moverMueble(id, cambio) {
    const e = objetos.get(id);
    if (!e) return;
    Object.assign(e.dato, cambio);
    if (e.dato.x == null) e.obj.grupo.removeFromParent(); else colocar(e);
    recalcular();
  }

  // ================================================================ por dónde se camina
  // Cada piso tiene su cuadrícula. La escalera ocupa unas casillas abajo (y su hueco
  // arriba), y une la casilla de abajo de la escalera con la de arriba.
  let bloqueadas = [new Set(), new Set()];
  const casillasDe = (dato) => {
    const t = tipos.get(dato.tipo);
    if (!t || t.cat === 'pared' || dato.x == null) return [];
    const { we, de } = medidas(dato);
    const lista = [];
    for (let i = 0; i < we; i += 1) for (let j = 0; j < de; j += 1) lista.push([dato.x + i, dato.z + j]);
    return lista;
  };
  const enEscalera = (x, z) => pisos >= 2 && esc && x === esc.x && z >= esc.desde && z <= esc.hasta;
  function recalcular() {
    bloqueadas = [new Set(), new Set()];
    for (const { dato } of objetos.values()) {
      const t = tipos.get(dato.tipo);
      if (t && !t.plano) for (const [x, z] of casillasDe(dato)) bloqueadas[pisoDe(dato)].add(`${x},${z}`);
    }
    // Si a alguien le pusieron un mueble en el camino, vuelve a pensar por dónde ir.
    for (const p of personajes) {
      if (p.estado === 'caminando' && p.camino && p.camino.some((n) => !libre(n.p, n.x, n.z))) { p.estado = 'pensando'; p.espera = 0.2; }
    }
  }
  const libre = (p, x, z) => p >= 0 && p < pisos && x >= 0 && z >= 0 && x < lado && z < lado && !enEscalera(x, z) && !bloqueadas[p].has(`${x},${z}`);
  const casillasLibres = (p) => {
    const l = [];
    for (let x = 0; x < lado; x += 1) for (let z = 0; z < lado; z += 1) if (libre(p, x, z)) l.push({ p, x, z });
    return l;
  };

  // El camino más corto (por casillas, con diagonales y la escalera) de `a` a `b`.
  function buscarCamino(a, b) {
    if (!libre(b.p, b.x, b.z)) return null;
    const clave = (n) => n.p * 1000 + n.x * 32 + n.z;
    const previo = new Map([[clave(a), null]]);
    const nodos = new Map([[clave(a), a]]);
    const cola = [a];
    while (cola.length) {
      const n = cola.shift();
      if (n.p === b.p && n.x === b.x && n.z === b.z) {
        const camino = [];
        let k = clave(n);
        while (k != null) { camino.unshift(nodos.get(k)); k = previo.get(k); }
        return camino;
      }
      const vecinos = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const v = { p: n.p, x: n.x + dx, z: n.z + dz };
        if (!libre(v.p, v.x, v.z)) continue;
        if (dx && dz && (!libre(n.p, n.x + dx, n.z) || !libre(n.p, n.x, n.z + dz))) continue; // sin cortar esquinas
        vecinos.push(v);
      }
      if (pisos >= 2 && esc) {
        if (n.p === 0 && n.x === esc.abajo[0] && n.z === esc.abajo[1]) vecinos.push({ p: 1, x: esc.arriba[0], z: esc.arriba[1] });
        if (n.p === 1 && n.x === esc.arriba[0] && n.z === esc.arriba[1]) vecinos.push({ p: 0, x: esc.abajo[0], z: esc.abajo[1] });
      }
      for (const v of vecinos) {
        const k = clave(v);
        if (previo.has(k)) continue;
        previo.set(k, clave(n));
        nodos.set(k, v);
        cola.push(v);
      }
    }
    return null;
  }

  // ¿Se puede ir en línea recta de `a` a `b` (en el piso p) sin rozar nada?
  function despejado(p, a, b) {
    const dist = Math.hypot(b.x - a.x, b.z - a.z);
    const pasos = Math.max(1, Math.ceil(dist / 0.12));
    for (let i = 0; i <= pasos; i += 1) {
      const x = a.x + ((b.x - a.x) * i) / pasos;
      const z = a.z + ((b.z - a.z) * i) / pasos;
      for (const [ox, oz] of [[0, 0], [0.22, 0], [-0.22, 0], [0, 0.22], [0, -0.22]]) {
        if (!libre(p, Math.floor(x + ox), Math.floor(z + oz))) return false;
      }
    }
    return true;
  }

  // Las casillas del camino se vuelven puntos por donde pasar: se quitan los que sobran
  // (si se puede ir derecho) y se agregan los de la escalera.
  function puntosDel(camino, desde) {
    const puntos = [];
    camino.forEach((n, i) => {
      const anterior = camino[i - 1];
      if (anterior && anterior.p !== n.p) {
        const abajo = { x: esc.x + 0.5, y: 0, z: esc.hasta + 1 - 0.02, p: 0, escalera: true };
        const arriba = { x: esc.x + 0.5, y: ALTO_PISO, z: esc.desde + 0.02, p: 1, escalera: true };
        puntos.push(...(n.p > anterior.p ? [abajo, arriba] : [arriba, abajo]));
      }
      puntos.push({ x: n.x + 0.5, y: n.p * ALTO_PISO, z: n.z + 0.5, p: n.p });
    });
    if (desde && puntos.length && !puntos[0].escalera) Object.assign(puntos[0], { x: desde.x, z: desde.z });
    const res = [];
    let i = 0;
    while (i < puntos.length) {
      res.push(puntos[i]);
      let mejor = i + 1;
      if (!puntos[i].escalera) {
        for (let k = i + 2; k < puntos.length && !puntos[k].escalera && puntos[k].p === puntos[i].p; k += 1) {
          if (despejado(puntos[i].p, puntos[i], puntos[k])) mejor = k;
        }
      }
      i = mejor;
    }
    return res.slice(1); // el primero es donde ya está
  }

  // ¿Desde qué casilla se usa un mueble? (enfrente, o la libre más cercana al lado)
  function casillaParaUsar(dato) {
    const t = tipos.get(dato.tipo);
    const p = pisoDe(dato);
    if (t.cat === 'pared') {
      const c = dato.x + Math.floor(t.w / 2);
      const cand = dato.pared === 'izq' ? [[0, c], [1, c], [0, c - 1], [0, c + 1], [1, c - 1]] : [[c, 0], [c, 1], [c - 1, 0], [c + 1, 0], [c - 1, 1]];
      const ok = cand.find(([x, z]) => libre(p, x, z));
      return ok ? { p, x: ok[0], z: ok[1] } : null;
    }
    const { we, de } = medidas(dato);
    const frente = [
      [dato.x + Math.floor(we / 2), dato.z + de],
      [dato.x + we, dato.z + Math.floor(de / 2)],
      [dato.x + Math.floor(we / 2), dato.z - 1],
      [dato.x - 1, dato.z + Math.floor(de / 2)],
    ][dato.rot];
    if (libre(p, ...frente)) return { p, x: frente[0], z: frente[1] };
    const celdas = casillasDe(dato);
    const ocupado = new Set(celdas.map(([x, z]) => `${x},${z}`));
    for (const [x, z] of celdas) {
      for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
        if (!ocupado.has(`${x + dx},${z + dz}`) && libre(p, x + dx, z + dz)) return { p, x: x + dx, z: z + dz };
      }
    }
    return null;
  }

  const alMundo = (entrada, [x, y, z]) => new THREE.Vector3(x, y, z).applyMatrix4(entrada.obj.grupo.matrixWorld);
  // Hacia dónde "mira" un mueble (su frente), en el mundo.
  const frenteDe = (entrada) => {
    const r = entrada.obj.grupo.rotation.y;
    return new THREE.Vector3(Math.sin(r), 0, Math.cos(r));
  };

  // ================================================================ los personajes
  const personajes = [];
  const pisoDePos = (v) => (v.y > ALTO_PISO * 0.5 ? 1 : 0);
  const casillaDe = (v) => ({ p: pisoDePos(v), x: Math.min(lado - 1, Math.max(0, Math.floor(v.x))), z: Math.min(lado - 1, Math.max(0, Math.floor(v.z))) });
  const centroDe = (n) => new THREE.Vector3(n.x + 0.5, n.p * ALTO_PISO, n.z + 0.5);

  function ponerPersonaje(imagen, cuenta, animo = {}) {
    const viejo = personajes.findIndex((p) => p.id === cuenta.id);
    let lugar = null;
    if (viejo >= 0) { lugar = personajes[viejo].muneco.raiz.position.clone(); escena.remove(personajes[viejo].muneco.raiz); personajes[viejo].muneco.destruir(); personajes.splice(viejo, 1); }
    const muneco = crearPersonaje(imagen, cuenta, { yaw: YAW });
    const libres = casillasLibres(0).filter((c) => !personajes.some((o) => Math.hypot(o.muneco.raiz.position.x - c.x - 0.5, o.muneco.raiz.position.z - c.z - 0.5) < 1.5));
    muneco.raiz.position.copy(lugar || centroDe(azar(libres.length ? libres : casillasLibres(0)) || { p: 0, x: 1, z: 1 }));
    muneco.animo.desanimado = Boolean(animo.pospuso);
    escena.add(muneco.raiz);
    const p = { id: cuenta.id, muneco, estado: 'pensando', espera: 0.8 + Math.random() * 2, puntos: null, usando: null, animo, quieto: 0, vel: 0 };
    personajes.push(p);
    return p;
  }
  const otroDe = (p) => personajes.find((x) => x !== p);
  const ocupado = (p) => p.estado === 'usando' || p.estado === 'abrazo' || p.estado === 'bajando' || p.muneco.viajando;

  // ---- caminar
  function caminarA(p, destino, alLlegar) {
    if (p.muneco.viajando) {
      // termina el saltito primero
      p.pendiente = () => caminarA(p, destino, alLlegar);
      return true;
    }
    const pos = p.muneco.raiz.position;
    let desde = casillaDe(pos);
    // En medio de la escalera: primero termina de subir (o de bajar) y de ahí sigue. Antes
    // saltaba a la casilla libre más cercana, y parecía que se teletransportaba.
    if (esc && pisos >= 2 && (enEscalera(desde.x, desde.z) || (pos.y > 0.05 && pos.y < ALTO_PISO - 0.05))) {
      const sube = pos.y >= ALTO_PISO / 2;
      const punta = sube
        ? { x: esc.x + 0.5, y: ALTO_PISO, z: esc.desde + 0.02, p: 1, escalera: true }
        : { x: esc.x + 0.5, y: 0, z: esc.hasta + 1 - 0.02, p: 0, escalera: true };
      const rellano = sube ? { p: 1, x: esc.arriba[0], z: esc.arriba[1] } : { p: 0, x: esc.abajo[0], z: esc.abajo[1] };
      const resto = buscarCamino(rellano, destino);
      if (!resto) return false;
      p.camino = resto;
      p.puntos = [punta, ...puntosDel([rellano, ...resto], null)];
      p.alLlegar = alLlegar;
      p.estado = 'caminando';
      p.desde = { x: pos.x, y: pos.y, z: pos.z, escalera: true };
      return true;
    }
    if (!libre(desde.p, desde.x, desde.z)) {
      // quedó encima de un mueble: sale de un saltito a la casilla libre más cercana
      const libres = casillasLibres(desde.p).sort((a, b) => Math.hypot(a.x - desde.x, a.z - desde.z) - Math.hypot(b.x - desde.x, b.z - desde.z));
      if (!libres.length) return false;
      p.muneco.saltarA(centroDe(libres[0]), { dur: 0.42, arco: 0.4 });
      p.pendiente = () => caminarA(p, destino, alLlegar);
      return true;
    }
    if (desde.p === destino.p && desde.x === destino.x && desde.z === destino.z) {
      // ya está ahí: un pasito al centro (y se olvida el camino de antes)
      p.camino = [destino];
      p.puntos = [{ ...centroDe(destino), p: destino.p }];
    } else {
      const camino = buscarCamino(desde, destino);
      if (!camino) return false;
      p.camino = camino;
      p.puntos = puntosDel(camino, pos);
    }
    p.alLlegar = alLlegar;
    p.estado = 'caminando';
    p.desde = { x: pos.x, y: pos.y, z: pos.z };
    return true;
  }

  // Sigue los puntos del camino: acelera, dobla las esquinas redondito, sube la
  // escalera, se hace a un lado si se topa con el otro y frena al llegar.
  function avanzar(p, dt) {
    const m = p.muneco;
    const pos = m.raiz.position;
    const meta = p.puntos[0];
    if (!meta) {
      p.estado = 'pensando';
      p.espera = 0.6 + Math.random() * 1.5;
      p.vel = 0;
      m.deFrente();
      const listo = p.alLlegar;
      p.alLlegar = null;
      if (listo) listo();
      m.animar(dt);
      return;
    }
    const enEscalera = meta.escalera && p.desde && p.desde.escalera;
    const dx = meta.x - pos.x;
    const dz = meta.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const final = p.puntos.length === 1;
    // Al acercarse a una esquina ya apunta al siguiente punto: así dobla en curva.
    const sig = p.puntos[1];
    if (!final && !meta.escalera && sig && !sig.escalera && dist < 0.28) {
      p.desde = meta;
      p.puntos.shift();
      avanzar(p, dt);
      return;
    }
    let rapidez = (m.animo.desanimado ? 1.0 : 1.5) * (enEscalera ? 0.75 : 1);
    if (final) rapidez *= Math.min(1, 0.25 + dist * 1.6); // frena al llegar
    let ux = dist > 1e-5 ? dx / dist : 0;
    let uz = dist > 1e-5 ? dz / dist : 0;
    // no atravesar al otro: si está justo adelante, se hace a un ladito y va más despacio
    const otro = otroDe(p);
    if (otro && !enEscalera && !final && Math.abs(otro.muneco.raiz.position.y - pos.y) < 1) {
      const ox = otro.muneco.raiz.position.x - pos.x;
      const oz = otro.muneco.raiz.position.z - pos.z;
      const od = Math.hypot(ox, oz);
      if (od < 0.6 && od > 1e-4 && (ox * ux + oz * uz) / od > 0.5) {
        const lado = (ox * uz - oz * ux) > 0 ? -1 : 1;
        const nx = ux - uz * lado * 0.6;
        const nz = uz + ux * lado * 0.6;
        const nl = Math.hypot(nx, nz) || 1;
        ux = nx / nl; uz = nz / nl;
        rapidez *= 0.5;
      }
    }
    // Se vuelve a acercar la velocidad suave a la que toca (arranca y frena sin golpes).
    p.vel = suave(p.vel, rapidez, 6, dt);
    const paso = Math.min(dist, p.vel * dt);
    pos.x += ux * paso;
    pos.z += uz * paso;
    // ¿Se trabó? (no avanza en un buen rato): busca el camino otra vez desde donde está.
    p.trabado = paso < 0.002 && rapidez > 0.3 ? (p.trabado || 0) + dt : 0;
    if (p.trabado > 1.2 && p.camino) {
      p.trabado = 0;
      const destino = p.camino[p.camino.length - 1];
      const listo = p.alLlegar;
      if (!caminarA(p, destino, listo)) { p.estado = 'pensando'; p.espera = 0.5; }
      m.animar(dt);
      return;
    }
    // la altura: en la escalera sube con la rampa; si no, la del piso
    if (enEscalera) {
      const total = Math.abs(meta.z - p.desde.z) || 1;
      const k = Math.min(1, Math.abs(pos.z - p.desde.z) / total);
      pos.y = p.desde.y + (meta.y - p.desde.y) * k;
    } else {
      pos.y = meta.y;
    }
    if (paso > 1e-4) m.mirarHacia(ux * derechaPantalla.x + uz * derechaPantalla.z, ux * haciaCamara.x + uz * haciaCamara.z);
    const llegue = Math.hypot(meta.x - pos.x, meta.z - pos.z) < (final ? 0.03 : 0.14);
    if (llegue) {
      if (final || meta.escalera) { pos.x = meta.x; pos.z = meta.z; pos.y = meta.y; }
      p.desde = meta;
      p.puntos.shift();
    }
    m.animar(dt, { avance: paso });
  }

  function mirarA(p, punto) {
    const v = punto.clone().sub(p.muneco.raiz.position);
    v.y = 0;
    if (v.lengthSq() < 1e-6) { p.muneco.deFrente(); return; }
    v.normalize();
    p.muneco.mirarHacia(v.dot(derechaPantalla), v.dot(haciaCamara));
  }
  const mirarHaciaDir = (p, v) => p.muneco.mirarHacia(v.dot(derechaPantalla), v.dot(haciaCamara));

  // ---- usar un mueble
  function usar(p, entrada, lugar, { asiento = null, dura = null } = {}) {
    const t = tipos.get(entrada.dato.tipo);
    const uso = USOS[t.uso] || USOS.mirar;
    const m = p.muneco;
    p.estado = 'usando';
    p.usando = { entrada, lugar, hasta: dura || entre(uso.dura), cada: 2.5, uso };
    const empezar = (pose) => {
      if (p.usando?.entrada !== entrada) return;
      m.ponerPose(pose);
      m.decir(EMOJI_DE[t.id] || azar(uso.emojis));
      if (entrada.obj.disco) entrada.obj.sonando = true;
      if (entrada.obj.planta) { entrada.obj.grupo.scale.setScalar(1.06); setTimeout(() => entrada.obj.grupo.scale.setScalar(1), 400); }
      if (entrada.obj.perritoNube) setTimeout(() => { entrada.obj.volarDesde = t0; }, 900);
    };
    if (uso.subir === 'cama' && entrada.obj.camas) {
      // Se sube a la cama, se acuesta boca arriba y la cobija lo tapa.
      const usados = personajes.filter((x) => x !== p && x.usando?.entrada === entrada).map((x) => x.usando.lado);
      const i = entrada.obj.camas.findIndex((_, k) => !usados.includes(k));
      p.usando.lado = i < 0 ? 0 : i;
      const pies = alMundo(entrada, entrada.obj.camas[p.usando.lado]);
      m.ponerPose('quieto');
      m.saltarA(pies, {
        dur: 0.5,
        arco: 0.5,
        alFin: () => {
          if (p.usando?.entrada !== entrada) return;
          m.acostar(entrada.obj.grupo.rotation.y);
          entrada.obj.durmiendo = (entrada.obj.durmiendo || 0) + 1;
          p.usando.acostado = true;
          empezar('dormido');
        },
      });
      return;
    }
    if (uso.subir === 'asiento' && entrada.obj.asientos) {
      // Se sienta de un saltito, mirando hacia donde mira el mueble.
      const usados = personajes.filter((x) => x !== p && x.usando?.entrada === entrada).map((x) => x.usando.asiento);
      const libres = entrada.obj.asientos.map((_, k) => k).filter((k) => !usados.includes(k));
      const i = asiento != null && libres.includes(asiento) ? asiento : (libres.length ? azar(libres) : 0);
      p.usando.asiento = i;
      const punto = alMundo(entrada, entrada.obj.asientos[i]);
      m.ponerPose('quieto');
      mirarA(p, punto);
      m.saltarA(punto, {
        dur: 0.45,
        arco: 0.42,
        alFin: () => {
          if (p.usando?.entrada !== entrada) return;
          mirarHaciaDir(p, frenteDe(entrada));
          empezar('sentado');
        },
      });
      return;
    }
    // Los demás: se queda enfrente, mirando el mueble (de espaldas si está más al fondo).
    entrada.obj.grupo.updateMatrixWorld();
    const centro = new THREE.Box3().setFromObject(entrada.obj.grupo).getCenter(new THREE.Vector3());
    mirarA(p, centro);
    empezar(uso.pose);
  }

  // Termina lo que estaba haciendo (se levanta o se baja del mueble).
  function soltar(p, { despues } = {}) {
    const u = p.usando;
    const m = p.muneco;
    p.usando = null;
    if (!u) { if (despues) despues(); return; }
    if (u.entrada && u.entrada.obj.disco && !personajes.some((x) => x !== p && x.usando?.entrada === u.entrada)) u.entrada.obj.sonando = false;
    const bajar = () => {
      m.ponerPose('quieto');
      const destino = centroDe(u.lugar);
      if (m.raiz.position.distanceTo(destino) > 0.05) m.saltarA(destino, { dur: 0.42, arco: 0.38, alFin: () => { m.deFrente(); if (despues) despues(); } });
      else if (despues) despues();
    };
    if (u.acostado) {
      // se destapa, se sienta y se baja
      m.acostar(null);
      u.entrada.obj.durmiendo = Math.max(0, (u.entrada.obj.durmiendo || 1) - 1);
      p.estado = 'bajando';
      p.espera = 0.9;
      p.alBajar = () => { m.hacerGesto('estirarse'); bajar(); };
      return;
    }
    if (u.asiento != null) { bajar(); return; }
    if (u.abrazo && u.volverA) { m.ponerPose('quieto'); m.saltarA(u.volverA, { dur: 0.32, arco: 0.04, alFin: despues }); return; }
    m.ponerPose('quieto');
    if (despues) despues();
  }

  // ---- abrazarse
  // ¿Está en la escalera (o a media altura entre los pisos)?
  const enLaEscalera = (p) => {
    const pos = p.muneco.raiz.position;
    const c = casillaDe(pos);
    return enEscalera(c.x, c.z) || (pos.y > 0.05 && Math.abs(pos.y - ALTO_PISO) > 0.05);
  };

  function abrazar(a, b) {
    const nada = () => { a.estado = 'pensando'; a.espera = 1; };
    if (!b || ocupado(b) || ocupado(a)) { nada(); return; }
    const pa = a.muneco.raiz.position.clone();
    const pb = b.muneco.raiz.position.clone();
    // Solo si están en el mismo piso y cerquita: si el otro ya se fue lejos (o está en la
    // escalera), no hay abrazo (antes se "teletransportaban" para juntarse).
    if (Math.abs(pa.y - pb.y) > 0.3 || enLaEscalera(a) || enLaEscalera(b) || Math.hypot(pa.x - pb.x, pa.z - pb.z) > 1.7) { nada(); return; }
    if (b.estado === 'caminando') { b.puntos = []; b.alLlegar = null; b.camino = null; }
    const medio = pa.clone().add(pb).multiplyScalar(0.5);
    for (const [x, desde, otro] of [[a, pa, pb], [b, pb, pa]]) {
      x.estado = 'abrazo';
      x.usando = { abrazo: true, volverA: desde, hasta: 3.2 };
      x.vel = 0;
      mirarA(x, otro);
      x.muneco.ponerPose('abrazar');
      // se acercan hasta quedar pegaditos (a 0.34 del centro)
      const hacia = medio.clone().sub(desde);
      const largo = hacia.length();
      const meta = largo > 0.17 ? desde.clone().add(hacia.multiplyScalar((largo - 0.17) / largo)) : desde.clone();
      x.muneco.saltarA(meta, { dur: 0.3, arco: 0.06 });
    }
    a.muneco.decir('❤️', 2.6);
    setTimeout(() => b.muneco.decir(azar(['🥰', '💕', '💛']), 2.4), 450);
    setTimeout(() => corazones(medio.clone().add(new THREE.Vector3(0, 1.9, 0)), 7), 300);
  }

  // ---- una cita: los dos sentados juntos en el mismo sofá
  function cita(a, b, entrada) {
    const lugar = casillaParaUsar(entrada.dato);
    if (!lugar) return false;
    const [i, j] = [0, 1].map((k) => k % entrada.obj.asientos.length);
    const ok = caminarA(a, lugar, () => usar(a, entrada, lugar, { asiento: i, dura: 14 })) && caminarA(b, lugar, () => {
      usar(b, entrada, lugar, { asiento: j, dura: 14 });
      setTimeout(() => { corazones(alMundo(entrada, [0, 1.9, 0]), 6); b.muneco.decir('💕', 2.4); }, 900);
    });
    return ok;
  }

  // ---- lo que decide cada uno cuando no está haciendo nada
  function usablesPara(p) {
    return [...objetos.values()].filter((e) => {
      if (!e.obj.grupo.parent) return false;
      const t = tipos.get(e.dato.tipo);
      if (!t || !t.uso) return false;
      const cupo = e.obj.asientos ? e.obj.asientos.length : e.obj.camas ? e.obj.camas.length : 1;
      const usando = personajes.filter((x) => x !== p && x.usando?.entrada === e).length;
      return usando < cupo;
    });
  }

  function decidir(p) {
    const otro = otroDe(p);
    const m = p.muneco;
    const usables = usablesPara(p);
    const cama = usables.find((e) => e.obj.camas);
    const noche = horaCR() >= 22 || horaCR() < 6;
    const r = Math.random();

    // de noche, a dormir (juntitos si se puede)
    if (noche && cama && r < 0.6) {
      const lugar = casillaParaUsar(cama.dato);
      if (lugar && caminarA(p, lugar, () => usar(p, cama, lugar, { dura: entre([40, 80]) }))) return;
    }
    // ir a darle un abrazo (si el otro está tranquilo, lo espera)
    if (otro && !ocupado(otro) && !enLaEscalera(otro) && otro.estado !== 'caminando' && r < 0.14) {
      const c = casillaDe(otro.muneco.raiz.position);
      const al = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dz]) => ({ p: c.p, x: c.x + dx, z: c.z + dz })).filter((n) => libre(n.p, n.x, n.z));
      if (al.length && caminarA(p, azar(al), () => abrazar(p, otro))) {
        otro.espera = Math.max(otro.espera || 0, 6);
        return;
      }
    }
    // una cita en el sofá
    if (otro && !ocupado(otro) && otro.estado !== 'caminando' && r < 0.22) {
      const sofa = usables.find((e) => e.obj.asientos && e.obj.asientos.length >= 2 && !personajes.some((x) => x.usando?.entrada === e));
      if (sofa && cita(p, otro, sofa)) return;
    }
    // un gesto ahí mismo
    if (r < 0.38) {
      const gesto = azar(m.animo.desanimado ? ['bostezo', 'mirarAlrededor'] : ['estirarse', 'mirarAlrededor', 'saltito', 'bostezo', 'aplaudir']);
      m.hacerGesto(gesto);
      if (gesto === 'bostezo') m.decir('🥱', 1.6);
      p.espera = 2 + Math.random() * 2;
      return;
    }
    // usar algo
    if (usables.length && r < 0.82) {
      const sinCama = usables.filter((e) => !e.obj.camas || Math.random() < 0.15);
      const e = azar(sinCama.length ? sinCama : usables);
      const lugar = casillaParaUsar(e.dato);
      if (lugar && caminarA(p, lugar, () => usar(p, e, lugar))) return;
    }
    // pasear (a veces al otro piso)
    const piso = pisos >= 2 && Math.random() < 0.3 ? 1 - casillaDe(m.raiz.position).p : casillaDe(m.raiz.position).p;
    const libres = casillasLibres(piso);
    if (libres.length && caminarA(p, azar(libres), null)) return;
    p.espera = 2;
  }

  // Lo que pasa en cada cuadro con cada personaje.
  function pensar(p, dt) {
    const m = p.muneco;
    if (m.viajando) { m.animar(dt); return; }
    if (p.pendiente) { const f = p.pendiente; p.pendiente = null; f(); }
    switch (p.estado) {
      case 'caminando':
        avanzar(p, dt);
        return;
      case 'bajando':
        p.espera -= dt;
        if (p.espera <= 0) { p.estado = 'pensando'; p.espera = 1; const f = p.alBajar; p.alBajar = null; if (f) f(); }
        m.animar(dt);
        return;
      case 'usando':
      case 'abrazo': {
        const u = p.usando;
        u.hasta -= dt;
        u.cada -= dt;
        if (u.uso && u.cada <= 0) {
          u.cada = 3 + Math.random() * 2.5;
          if (Math.random() < 0.5) m.decir(u.uso.subir === 'cama' ? '💤' : azar(u.uso.emojis));
        }
        if (u.hasta <= 0) {
          const eraAbrazo = p.estado === 'abrazo';
          p.estado = 'pensando';
          p.espera = 1 + Math.random() * 2;
          soltar(p, { despues: eraAbrazo ? () => m.hacerGesto('saltito') : null });
        }
        m.animar(dt);
        return;
      }
      default: {
        p.espera -= dt;
        p.quieto += dt;
        if (p.quieto > 9 && p.animo.pospuso) { p.quieto = 0; m.decir(p.animo.pospuso === 'mal' ? '🌧️' : '💼', 2.4); }
        else if (p.quieto > 12 && p.animo.dibujo) { p.quieto = 0; m.decir(azar(['✨', '🎨', '💛']), 2); }
        if (p.espera <= 0) { p.quieto = 0; decidir(p); }
        m.animar(dt);
      }
    }
  }

  // ================================================================ corazones que flotan
  const particulas = [];
  const texturas = new Map();
  function texturaEmoji(e) {
    if (!texturas.has(e)) {
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 64;
      const x = c.getContext('2d');
      x.font = "52px 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(e, 32, 36);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      texturas.set(e, t);
    }
    return texturas.get(e);
  }
  function corazones(donde, n = 5, emojis = ['❤️', '💕', '💗', '💖']) {
    for (let i = 0; i < n; i += 1) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaEmoji(azar(emojis)), transparent: true, depthWrite: false }));
      s.position.copy(donde).add(new THREE.Vector3((Math.random() - 0.5) * 0.7, Math.random() * 0.3, (Math.random() - 0.5) * 0.7));
      s.scale.setScalar(0.001);
      s.renderOrder = 9;
      escena.add(s);
      particulas.push({ s, vida: 0, dura: 1.6 + Math.random() * 0.8, demora: i * 0.12, sube: 0.6 + Math.random() * 0.5, tam: 0.25 + Math.random() * 0.15, deriva: (Math.random() - 0.5) * 0.4 });
    }
  }
  function moverParticulas(dt) {
    for (let i = particulas.length - 1; i >= 0; i -= 1) {
      const q = particulas[i];
      if (q.demora > 0) { q.demora -= dt; continue; }
      q.vida += dt;
      const k = q.vida / q.dura;
      q.s.position.y += (q.sube / q.dura) * dt;
      q.s.position.x += q.deriva * dt;
      q.s.scale.setScalar(q.tam * Math.min(1, k * 6));
      q.s.material.opacity = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
      if (k >= 1) { escena.remove(q.s); q.s.material.dispose(); particulas.splice(i, 1); }
    }
  }

  // ================================================================ tocar
  const rayo = new THREE.Raycaster();
  function rayoDesde(e) {
    const r = renderer.domElement.getBoundingClientRect();
    rayo.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camara);
    return rayo;
  }
  // Qué hay debajo del dedo: { personaje, mueble, casilla {p, x, z}, pared {pared, pos, piso} }.
  function queHay(e, { soloPiso = false } = {}) {
    const r = rayoDesde(e);
    const res = {};
    if (!soloPiso) {
      const visibles = personajes.filter((p) => p.muneco.raiz.visible).map((p) => p.muneco.raiz);
      const paredes = cuarto ? cuarto.niveles[activo].paredes : [];
      const golpes = r.intersectObjects([...visibles, capas[activo], ...paredes], true).filter((g) => !g.object.userData.esContorno && g.object.visible);
      for (const g of golpes) {
        if (g.object.userData.personaje && !res.personaje && res.mueble == null) res.personaje = g.object.userData.personaje;
        if (g.object.userData.mueble != null && res.mueble == null && !res.personaje) res.mueble = g.object.userData.mueble;
        if (g.object.userData.pared && !res.pared) res.pared = { pared: g.object.userData.pared, pos: g.object.userData.pared === 'izq' ? g.point.z : g.point.x, piso: activo };
      }
    }
    const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -activo * ALTO_PISO);
    const p = new THREE.Vector3();
    if (r.ray.intersectPlane(plano, p) && p.x >= 0 && p.z >= 0 && p.x < lado && p.z < lado) res.casilla = { p: activo, x: Math.floor(p.x), z: Math.floor(p.z), fx: p.x, fz: p.z };
    // Para mover cosas de pared: el punto de la pared más cercano al dedo.
    if (soloPiso && cuarto) {
      const golpes = r.intersectObjects(cuarto.niveles[activo].paredes, false);
      if (golpes[0]) res.pared = { pared: golpes[0].object.userData.pared, pos: golpes[0].object.userData.pared === 'izq' ? golpes[0].point.z : golpes[0].point.x, piso: activo };
    }
    return res;
  }

  // ================================================================ decorar
  const marcas = new THREE.Group();
  escena.add(marcas);
  const matOk = new THREE.MeshBasicMaterial({ color: 0x7fdcc0, transparent: true, opacity: 0.55, depthWrite: false });
  const matMal = new THREE.MeshBasicMaterial({ color: 0xff6f91, transparent: true, opacity: 0.6, depthWrite: false });
  const geoMarca = new THREE.PlaneGeometry(0.94, 0.94);
  function marcar(casillas, ok, piso = activo) {
    marcas.clear();
    for (const [x, z] of casillas) {
      const q = new THREE.Mesh(geoMarca, ok ? matOk : matMal);
      q.rotation.x = -Math.PI / 2;
      q.position.set(x + 0.5, piso * ALTO_PISO + 0.035, z + 0.5);
      marcas.add(q);
    }
  }
  const rejilla = new THREE.Group();
  for (let i = 0; i <= lado; i += 1) {
    for (const vertical of [true, false]) {
      const l = new THREE.Mesh(new THREE.PlaneGeometry(vertical ? 0.025 : lado, vertical ? lado : 0.025), new THREE.MeshBasicMaterial({ color: 0x3a2745, transparent: true, opacity: 0.16, depthWrite: false }));
      l.rotation.x = -Math.PI / 2;
      l.position.set(vertical ? i : lado / 2, 0, vertical ? lado / 2 : i);
      rejilla.add(l);
    }
  }
  rejilla.visible = false;
  escena.add(rejilla);

  // El mueble seleccionado "respira" un poquito para que se note.
  let seleccionado = null;
  function seleccionar(id) {
    if (seleccionado != null && objetos.get(seleccionado)) objetos.get(seleccionado).obj.grupo.scale.setScalar(1);
    seleccionado = id;
  }

  // Dónde está un mueble en la pantalla (para poner sus botoncitos encima).
  function pantallaDe(id) {
    const e = objetos.get(id);
    if (!e || !e.obj.grupo.parent) return null;
    const caja = new THREE.Box3().setFromObject(e.obj.grupo);
    const punto = new THREE.Vector3((caja.min.x + caja.max.x) / 2, caja.max.y, (caja.min.z + caja.max.z) / 2).project(camara);
    return { x: ((punto.x + 1) / 2) * contenedor.clientWidth, y: ((1 - punto.y) / 2) * contenedor.clientHeight };
  }

  // ================================================================ el bucle
  const reloj = new THREE.Timer();
  let t0 = 0;
  let corriendo = true;
  let alCuadro = null;
  function cuadro(ahora) {
    if (!corriendo) return;
    reloj.update(ahora);
    const dt = Math.min(0.05, reloj.getDelta());
    t0 += dt;
    for (const p of personajes) {
      pensar(p, dt);
      // los de arriba no se ven cuando se mira el primer piso
      p.muneco.raiz.visible = activo >= 1 || p.muneco.raiz.position.y < ALTO_PISO * 0.6;
    }
    for (const e of objetos.values()) {
      if (!e.obj.grupo.parent) continue;
      if (e.obj.perritoNube && e.obj.volarDesde == null && Math.random() < dt / 45) e.obj.volarDesde = t0;
      animarMueble(e.obj, t0);
    }
    if (seleccionado != null && objetos.get(seleccionado)) objetos.get(seleccionado).obj.grupo.scale.setScalar(1.03 + Math.sin(t0 * 6) * 0.015);
    // Si los dos dibujaron hoy, de vez en cuando les salen corazoncitos.
    if (personajes.length === 2 && personajes.every((p) => p.animo.dibujo) && Math.random() < dt / 25) {
      const p = azar(personajes);
      if (p.muneco.raiz.visible) corazones(p.muneco.raiz.position.clone().add(new THREE.Vector3(0, 2, 0)), 3, ['✨', '💛']);
    }
    moverParticulas(dt);
    renderer.render(escena, camara);
    if (alCuadro) alCuadro();
  }
  renderer.setAnimationLoop(cuadro);
  const alOcultar = () => { renderer.setAnimationLoop(document.hidden ? null : cuadro); };
  document.addEventListener('visibilitychange', alOcultar);
  ajustar();

  // ================================================================ fotitos (tienda)
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

  const personaje = (id) => personajes.find((p) => p.id === id);

  // Para revisar cómo van (solo con ?depurar en la dirección).
  if (location.search.includes('depurar')) {
    window.casaDepurar = () => personajes.map((p) => ({
      id: p.id, estado: p.estado, pos: p.muneco.raiz.position.toArray().map((v) => Math.round(v * 100) / 100), puntos: p.puntos && p.puntos.length, pose: p.muneco.pose,
    }));
    window.casaLlamar = (id, casilla) => api.llamar(id, casilla);
  }
  const api = {
    ponerCuarto,
    verPiso,
    get piso() { return activo; },
    get pisos() { return pisos; },
    ponerMueble,
    quitarMueble,
    moverMueble,
    mueble: (id) => objetos.get(id),
    ponerFotoEn(id, imagen) { const e = objetos.get(id); if (e) ponerFoto(e.obj, imagen); },
    ponerPersonaje,
    // Mi personaje camina hasta esa casilla y saluda.
    llamar(id, casilla) {
      const p = personaje(id);
      if (!p) return false;
      const ir = () => caminarA(p, casilla, () => { p.muneco.hacerGesto('saludar'); p.muneco.decir('👋', 1.6); p.espera = 4; });
      let ok = true;
      if (p.usando) soltar(p, { despues: () => { if (!ir()) p.muneco.decir('🤔', 1.4); } });
      else ok = ir();
      if (!ok) p.muneco.decir('🤔', 1.4);
      return ok;
    },
    // Mi personaje va a usar ese mueble (si se puede usar).
    mandarAUsar(id, muebleId) {
      const p = personaje(id);
      const e = objetos.get(muebleId);
      if (!p || !e || !e.obj.grupo.parent || !tipos.get(e.dato.tipo).uso) return false;
      if (!usablesPara(p).includes(e)) { p.muneco.decir('⏳', 1.4); return true; }
      const lugar = casillaParaUsar(e.dato);
      if (!lugar) return false;
      const ir = () => { if (!caminarA(p, lugar, () => usar(p, e, lugar))) p.muneco.decir('🤔', 1.4); };
      if (p.usando) soltar(p, { despues: ir }); else ir();
      return true;
    },
    // Mi personaje va a darle un abrazo al otro.
    irAbrazar(id, aQuien) {
      const p = personaje(id);
      const otro = personaje(aQuien);
      if (!p || !otro || p === otro) return false;
      const ir = () => {
        const c = casillaDe(otro.muneco.raiz.position);
        const al = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].map(([dx, dz]) => ({ p: c.p, x: c.x + dx, z: c.z + dz })).filter((n) => libre(n.p, n.x, n.z));
        const desde = casillaDe(p.muneco.raiz.position);
        al.sort((a, b) => Math.hypot(a.x - desde.x, a.z - desde.z) - Math.hypot(b.x - desde.x, b.z - desde.z));
        if (!al.length || !caminarA(p, al[0], () => { if (otro.usando && !otro.usando.abrazo) soltar(otro, { despues: () => abrazar(p, otro) }); else abrazar(p, otro); })) p.muneco.decir('🤔', 1.4);
      };
      if (p.usando) soltar(p, { despues: ir }); else ir();
      return true;
    },
    tocarPersonaje(id, texto) {
      const p = personaje(id);
      if (!p) return;
      if (!p.usando) p.muneco.saltar();
      p.muneco.decir(texto || '❤️', 2);
    },
    // ☁️ El perrito nube sale volando (devuelve true si ese mueble era el perrito).
    volarPerrito(id) {
      const e = objetos.get(id);
      if (!e || !e.obj.perritoNube) return false;
      if (e.obj.volarDesde == null) e.obj.volarDesde = t0;
      return true;
    },
    queHay,
    marcar,
    limpiarMarcas: () => marcas.clear(),
    verRejilla: (si) => { rejilla.visible = si; },
    seleccionar,
    pantallaDe,
    alCuadro: (f) => { alCuadro = f; },
    casillasDe,
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
    get ajustes() { return ajustesCuarto; },
  };
  return api;
}
