// La puerta secreta a la galaxia. En la pantalla de Hoy, bajando hasta el final (más
// abajo del dibujo del día), si sigues jalando hacia arriba la pantalla se estira (con
// mucha resistencia) y se va agrietando desde abajo: grietas de luz azul de galaxia, con
// estrellitas adentro, que van subiendo mientras jalas. Si sueltas, el vidrio se cura
// solito. Si jalas hasta el máximo… las grietas suben de golpe hasta arriba y la pantalla
// se desmorona desde abajo (con todo: la barra de abajo también). Detrás, la galaxia.
//
// Cómo está hecho: las grietas son un diagrama de Voronoi (d3-delaunay) con semillas en
// anillos alrededor del punto de abajo, así salen como un vidrio de verdad: rayos que
// salen del golpe y anillos que los unen. Se dibujan en un <canvas> encima de todo, y se
// van revelando según cuánto jalas. Al romperse, cada celda del Voronoi se vuelve un
// pedazo: una copia de la pantalla recortada con `clip-path`, que GSAP hace volar en 3D.
//
// No hay ninguna pista en la app: es un secreto (Gabri se lo cuenta, o se descubre).

import { sonar, precargar, tin, crujido, desbloquear } from './sonido.js';

const INICIO = 80; // lo que hay que jalar (px) antes de que salga la primera grieta
const umbral = () => Math.min(480, Math.max(320, window.innerHeight * 0.55)); // y para que se rompa
const azar = (a, b) => a + Math.random() * (b - a);
const quieto = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

let piezas = null;
function cargarPiezas() {
  if (!piezas) {
    piezas = Promise.all([import('../../vendor/voronoi.js'), import('../../vendor/gsap.js'), import('../../vendor/confeti.js')])
      .then(([v, g, c]) => ({ Delaunay: v.Delaunay, gsap: g.gsap, confeti: c.confeti }));
    piezas.catch(() => { piezas = null; });
  }
  return piezas;
}

// canvas-confetti, por defecto, dibuja en un "worker" creado desde blob:, y la CSP de la
// app no lo permite: se usa un <canvas> propio, sin worker.
export function confetiSeguro(confeti, zIndex = 95) {
  const lienzo = document.createElement('canvas');
  lienzo.className = 'confeti-lienzo';
  lienzo.style.zIndex = String(zIndex);
  lienzo.setAttribute('aria-hidden', 'true');
  document.body.append(lienzo);
  const disparar = confeti.create(lienzo, { resize: true, useWorker: false, disableForReducedMotion: true });
  return { disparar: (o) => disparar(o) || Promise.resolve(), quitar: () => lienzo.remove() };
}

// La galaxia sabe si se entró rompiendo la pantalla (para seguir la animación).
let rotaEn = -1e9;
export const vieneDeRomper = () => performance.now() - rotaEn < 4000;

// ------------------------------------------------------------------ la red de grietas
function crearRed(Delaunay, W, H, ox, oy) {
  const esquinas = [[0, 0], [W, 0], [0, H], [W, H]];
  const lejos = Math.max(...esquinas.map(([x, y]) => Math.hypot(x - ox, y - oy)));
  const semillas = [[ox + azar(-2, 2), oy + azar(-2, 2)]];
  const anillos = [];
  for (let r = 30, k = 0; r < lejos * 1.3; r *= 1.7, k += 1) {
    anillos.push(r);
    const n = Math.min(4 + k * 2, 11);
    const giro = Math.random() * Math.PI * 2;
    for (let i = 0; i < n; i += 1) {
      const a = giro + ((i + azar(-0.3, 0.3)) / n) * Math.PI * 2;
      const rr = r * azar(0.82, 1.18);
      const x = ox + Math.cos(a) * rr;
      const y = oy + Math.sin(a) * rr;
      if (x > -W * 0.35 && x < W * 1.35 && y > -H * 0.35 && y < H * 1.35) semillas.push([x, y]);
    }
  }
  const voronoi = Delaunay.from(semillas).voronoi([0, 0, W, H]);
  const dist = ([x, y]) => Math.hypot(x - ox, y - oy);
  const clave = ([x, y]) => `${Math.round(x * 4)},${Math.round(y * 4)}`;
  const sobreElBorde = (a, b) => [[0, 0], [W, 0], [0, 1], [H, 1]].some(([v, eje]) => Math.abs(a[eje] - v) < 0.6 && Math.abs(b[eje] - v) < 0.6);

  // Cada borde entre dos celdas se quiebra un poquito (zigzag), igual para las dos.
  const bordes = new Map();
  function borde(a, b) {
    const ka = clave(a);
    const kb = clave(b);
    const derecho = ka < kb;
    const k = derecho ? `${ka}|${kb}` : `${kb}|${ka}`;
    let e = bordes.get(k);
    if (!e) {
      const [p1, p2] = derecho ? [a, b] : [b, a];
      const L = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const medio = [];
      const enBorde = sobreElBorde(p1, p2);
      if (!enBorde && L > 18) {
        const m = Math.min(6, Math.floor(L / 20));
        const nx = -(p2[1] - p1[1]) / L;
        const ny = (p2[0] - p1[0]) / L;
        for (let i = 1; i <= m; i += 1) {
          const t = (i + azar(-0.25, 0.25)) / (m + 1);
          const off = azar(-1, 1) * Math.min(5, L * 0.05);
          medio.push([p1[0] + (p2[0] - p1[0]) * t + nx * off, p1[1] + (p2[1] - p1[1]) * t + ny * off]);
        }
      }
      e = { p1, p2, medio, enBorde };
      bordes.set(k, e);
    }
    return derecho ? e.medio : [...e.medio].reverse();
  }

  const celdas = [];
  for (let i = 0; i < semillas.length; i += 1) {
    const poli = voronoi.cellPolygon(i);
    if (!poli || poli.length < 4) continue;
    const puntos = [];
    for (let j = 0; j < poli.length - 1; j += 1) {
      puntos.push(poli[j], ...borde(poli[j], poli[j + 1]));
    }
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let j = 0; j < puntos.length; j += 1) {
      const [x1, y1] = puntos[j];
      const [x2, y2] = puntos[(j + 1) % puntos.length];
      const cruz = x1 * y2 - x2 * y1;
      area += cruz;
      cx += (x1 + x2) * cruz;
      cy += (y1 + y2) * cruz;
    }
    area /= 2;
    if (Math.abs(area) < 4) continue;
    cx /= 6 * area;
    cy /= 6 * area;
    const camino = new Path2D();
    puntos.forEach(([x, y], j) => (j ? camino.lineTo(x, y) : camino.moveTo(x, y)));
    camino.closePath();
    celdas.push({
      puntos, area: Math.abs(area), cx, cy, camino,
      lejos: Math.max(...puntos.map(dist)) * azar(0.92, 1.1),
      tinte: ['rgba(255,255,255,.10)', 'rgba(170,200,255,.13)', 'rgba(36,46,120,.09)', 'rgba(255,255,255,.05)', 'rgba(160,130,255,.09)'][Math.floor(Math.random() * 5)],
    });
  }

  // Las grietas que se dibujan: cada borde, de la punta más cercana al golpe a la más lejana.
  const grietas = [];
  const agregar = (linea, ruido = azar(0.9, 1.12)) => {
    if (dist(linea[0]) > dist(linea[linea.length - 1])) linea.reverse();
    const acum = [0];
    for (let j = 1; j < linea.length; j += 1) acum.push(acum[j - 1] + Math.hypot(linea[j][0] - linea[j - 1][0], linea[j][1] - linea[j - 1][1]));
    const d0 = dist(linea[0]) * ruido;
    grietas.push({ linea, acum, largo: acum[acum.length - 1], d0, d1: Math.max(d0 + 1, dist(linea[linea.length - 1]) * ruido) });
  };
  for (const e of bordes.values()) {
    if (e.enBorde) continue;
    const linea = [e.p1, ...e.medio, e.p2];
    agregar(linea);
    // a veces, una grietita que se ramifica
    const L = Math.hypot(e.p2[0] - e.p1[0], e.p2[1] - e.p1[1]);
    if (L > 40 && Math.random() < 0.35) {
      const t = azar(0.25, 0.75);
      const base = [e.p1[0] + (e.p2[0] - e.p1[0]) * t, e.p1[1] + (e.p2[1] - e.p1[1]) * t];
      const ang = Math.atan2(e.p2[1] - e.p1[1], e.p2[0] - e.p1[0]) + (Math.random() < 0.5 ? 1 : -1) * azar(0.6, 1.2);
      const largo = azar(10, 30);
      const medio = [base[0] + Math.cos(ang) * largo * 0.5 + azar(-2, 2), base[1] + Math.sin(ang) * largo * 0.5 + azar(-2, 2)];
      const punta = [base[0] + Math.cos(ang + azar(-0.4, 0.4)) * largo, base[1] + Math.sin(ang + azar(-0.4, 0.4)) * largo];
      const acum = [0, Math.hypot(medio[0] - base[0], medio[1] - base[1])];
      acum.push(acum[1] + Math.hypot(punta[0] - medio[0], punta[1] - medio[1]));
      const d0 = dist(base) * 1.04;
      grietas.push({ rama: true, linea: [base, medio, punta], acum, largo: acum[2], d0, d1: d0 + acum[2] });
    }
  }
  // Estrellitas que brillan adentro de las grietas.
  const brillos = [];
  const largas = grietas.filter((g) => !g.rama && g.largo > 20);
  for (let i = 0; i < Math.min(40, largas.length); i += 1) {
    const g = largas[Math.floor(Math.random() * largas.length)];
    const s = Math.random() * g.largo;
    let j = 1;
    while (j < g.acum.length - 1 && g.acum[j] < s) j += 1;
    const k = (s - g.acum[j - 1]) / Math.max(1e-6, g.acum[j] - g.acum[j - 1]);
    const a = g.linea[j - 1];
    const b = g.linea[j];
    brillos.push({
      x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, d: g.d0 + (s / g.largo) * (g.d1 - g.d0),
      tam: azar(1.6, 4.2), fase: Math.random() * 6.3, vel: azar(2, 5),
      color: ['#ffffff', '#d9e6ff', '#ffd6f5', '#cbbcff'][Math.floor(Math.random() * 4)],
    });
  }
  return { ox, oy, W, H, lejos, anillos, celdas, grietas, brillos };
}

// El radio hasta donde llegan las grietas cuando vas en `p` (0 a 1): mientras jalas suben
// hasta poco más de la mitad de la pantalla (y al final tiembla, de pura tensión). Al
// romperse, suben de golpe hasta arriba (RADIO_TOTAL).
const radio = (red, p) => red.lejos * (0.05 + 0.55 * p ** 1.15);
const RADIO_TOTAL = 1.16;

function trazar(path, g, R) {
  if (R <= g.d0) return;
  const hasta = R >= g.d1 ? g.largo : g.largo * ((R - g.d0) / (g.d1 - g.d0));
  path.moveTo(g.linea[0][0], g.linea[0][1]);
  for (let j = 1; j < g.linea.length; j += 1) {
    if (g.acum[j] <= hasta) { path.lineTo(g.linea[j][0], g.linea[j][1]); continue; }
    const k = (hasta - g.acum[j - 1]) / (g.acum[j] - g.acum[j - 1]);
    const a = g.linea[j - 1];
    const b = g.linea[j];
    path.lineTo(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k);
    return;
  }
}

function pintarGrietas(c, red, p, t, alfa = 1, R = radio(red, p)) {
  const { W, H, ox, oy } = red;
  c.clearRect(0, 0, W, H);
  if (p <= 0 || alfa <= 0) return;
  c.globalAlpha = alfa;
  // La noche que se asoma: la pantalla se oscurece de azul desde las orillas.
  const sombra = c.createRadialGradient(ox, oy, 0, ox, oy, red.lejos);
  sombra.addColorStop(0, 'rgba(14,18,52,0)');
  sombra.addColorStop(0.5, `rgba(14,18,52,${0.16 * p})`);
  sombra.addColorStop(1, `rgba(10,12,40,${0.5 * p})`);
  c.fillStyle = sombra;
  c.fillRect(0, 0, W, H);
  // Facetas: los pedazos que ya quedaron sueltos reflejan la luz distinto.
  for (const celda of red.celdas) {
    if (celda.lejos < R) { c.fillStyle = celda.tinte; c.fill(celda.camino); }
  }
  // Las grietas, de más gruesas (cerca del golpe) a más finitas.
  const grupos = [new Path2D(), new Path2D(), new Path2D()];
  for (const g of red.grietas) trazar(grupos[g.rama ? 2 : g.d0 < 110 ? 0 : g.d0 < 290 ? 1 : 2], g, R);
  const galaxia = c.createRadialGradient(ox, oy, 0, ox, oy, red.lejos);
  galaxia.addColorStop(0, '#b98cff');
  galaxia.addColorStop(0.35, '#6c7dff');
  galaxia.addColorStop(0.7, '#4f9bff');
  galaxia.addColorStop(1, '#58d0ff');
  c.lineCap = 'round';
  c.lineJoin = 'round';
  const tension = Math.max(0, (p - 0.86) / 0.14);
  const anchos = [[11, 6, 3.2, 1.9], [8, 4.5, 2.4, 1.4], [6, 3.4, 1.8, 1]];
  grupos.forEach((path, i) => {
    const [a1, a2, a3, a4] = anchos[i].map((w) => w * (1 + tension * 0.35));
    c.strokeStyle = 'rgba(40,60,190,.10)';
    c.lineWidth = a1;
    c.stroke(path);
    c.strokeStyle = galaxia;
    c.globalAlpha = alfa * 0.35;
    c.lineWidth = a2;
    c.stroke(path);
    c.globalAlpha = alfa * 0.9;
    c.lineWidth = a3;
    c.stroke(path);
    c.globalAlpha = alfa;
    c.strokeStyle = 'rgba(244,248,255,.96)';
    c.lineWidth = a4;
    c.stroke(path);
  });
  // Estrellitas adentro de las grietas.
  for (const b of red.brillos) {
    if (b.d > R) continue;
    const brillo = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.001 * b.vel + b.fase));
    const s = b.tam * (0.7 + brillo * 0.5);
    c.globalAlpha = alfa * brillo;
    c.fillStyle = b.color;
    c.beginPath();
    c.moveTo(b.x, b.y - s);
    c.quadraticCurveTo(b.x, b.y, b.x + s, b.y);
    c.quadraticCurveTo(b.x, b.y, b.x, b.y + s);
    c.quadraticCurveTo(b.x, b.y, b.x - s, b.y);
    c.quadraticCurveTo(b.x, b.y, b.x, b.y - s);
    c.fill();
  }
  // El golpe: una lucecita que crece y late.
  const latido = 1 + Math.sin(t * 0.012) * 0.08 * (0.3 + tension);
  const rl = (10 + 34 * p + tension * 30) * latido;
  const luz = c.createRadialGradient(ox, oy, 0, ox, oy, rl);
  luz.addColorStop(0, 'rgba(255,255,255,.95)');
  luz.addColorStop(0.3, 'rgba(190,210,255,.7)');
  luz.addColorStop(1, 'rgba(110,130,255,0)');
  c.globalAlpha = alfa * Math.min(1, p * 2);
  c.fillStyle = luz;
  c.beginPath();
  c.arc(ox, oy, rl, 0, Math.PI * 2);
  c.fill();
  c.globalAlpha = 1;
}

// ------------------------------------------------------------------ los pedazos
function polygonCss(puntos, bx, by) {
  return `polygon(${puntos.map(([x, y]) => `${(x - bx).toFixed(1)}px ${(y - by).toFixed(1)}px`).join(', ')})`;
}

function bordeSvg(puntos, bx, by, bw, bh) {
  const pts = puntos.map(([x, y]) => `${(x - bx).toFixed(1)},${(y - by).toFixed(1)}`).join(' ');
  const t = document.createElement('template');
  t.innerHTML = `<svg class="esquirla-borde" viewBox="0 0 ${bw} ${bh}" width="${bw}" height="${bh}" aria-hidden="true">`
    + `<polygon points="${pts}" fill="none" stroke="rgba(108,125,255,.55)" stroke-width="8" stroke-linejoin="round"/>`
    + `<polygon points="${pts}" fill="none" stroke="rgba(244,248,255,.95)" stroke-width="2.6" stroke-linejoin="round"/></svg>`;
  return t.content.firstElementChild;
}

function armarEsquirlas(red, raiz, p) {
  const { W, H, ox, oy } = red;
  const estiloFondo = getComputedStyle(document.body);
  const capa = document.createElement('div');
  capa.className = 'esquirlas';
  capa.setAttribute('aria-hidden', 'true');
  capa.style.perspectiveOrigin = `${ox}px ${oy}px`;
  const molde = raiz.cloneNode(true);
  molde.removeAttribute('id');
  molde.querySelectorAll('[id]').forEach((el) => el.removeAttribute('id'));
  molde.classList.add('esquirla-app');
  const sombra = `radial-gradient(circle at ${ox}px ${oy}px, rgba(14,18,52,0) 0, rgba(14,18,52,${0.16 * p}) ${red.lejos * 0.5}px, rgba(10,12,40,${0.5 * p}) ${red.lejos}px)`;

  // Las celdas más grandes llevan una copia de la pantalla; las chiquitas (cerca del
  // golpe, pulverizadas) son solo vidrio. Máximo 34 copias, para que no pese.
  const ordenadas = [...red.celdas].sort((a, b) => b.area - a.area);
  const esquirlas = [];
  let copias = 0;
  for (const celda of ordenadas) {
    const xs = celda.puntos.map((q) => q[0]);
    const ys = celda.puntos.map((q) => q[1]);
    const bx = Math.floor(Math.max(0, Math.min(...xs)));
    const by = Math.floor(Math.max(0, Math.min(...ys)));
    const bw = Math.ceil(Math.min(W, Math.max(...xs))) - bx;
    const bh = Math.ceil(Math.min(H, Math.max(...ys))) - by;
    if (bw < 2 || bh < 2) continue;
    const el = document.createElement('div');
    const conCopia = celda.area > 1700 && copias < 34;
    el.className = `esquirla ${conCopia ? '' : 'polvo'}`;
    Object.assign(el.style, {
      left: `${bx}px`, top: `${by}px`, width: `${bw}px`, height: `${bh}px`,
      clipPath: polygonCss(celda.puntos, bx, by), webkitClipPath: polygonCss(celda.puntos, bx, by),
    });
    if (conCopia) {
      copias += 1;
      const pagina = document.createElement('div');
      pagina.className = 'esquirla-pagina';
      Object.assign(pagina.style, {
        left: `${-bx}px`, top: `${-by}px`, width: `${W}px`, height: `${H}px`,
        backgroundColor: estiloFondo.backgroundColor, backgroundImage: estiloFondo.backgroundImage, backgroundSize: estiloFondo.backgroundSize,
      });
      const tinte = document.createElement('div');
      tinte.className = 'esquirla-tinte';
      tinte.style.backgroundImage = sombra;
      pagina.append(molde.cloneNode(true), tinte);
      el.append(pagina);
    }
    const brillo = document.createElement('div');
    brillo.className = 'esquirla-brillo';
    brillo.style.setProperty('--ang', `${Math.round(azar(0, 360))}deg`);
    el.append(brillo, bordeSvg(celda.puntos, bx, by, bw, bh));
    el.style.transformOrigin = `${(celda.cx - bx).toFixed(1)}px ${(celda.cy - by).toFixed(1)}px`;
    capa.append(el);
    esquirlas.push({ el, brillo, celda, dist: Math.hypot(celda.cx - ox, celda.cy - oy) });
  }
  return { capa, esquirlas };
}

// ------------------------------------------------------------------ instalar
// `pantalla`: lo que baja un poquito al jalar (el <main> de Hoy). `alRomper`: se llama
// cuando la pantalla se rompe (ahí se va a la galaxia).
export function instalarGrieta({ pantalla, alRomper }) {
  const raiz = document.getElementById('app');
  let estado = 'libre'; // libre · mirando · jalando · curando · roto
  let x0 = 0;
  let y0 = 0;
  let dy = 0;
  let p = 0;
  let red = null;
  let lienzo = null;
  let ctx = null;
  let cuadro = 0;
  let anilloVisto = -1;
  let curacion = null;
  let ultimoCrujido = 0;
  let precargado = false;
  let conRaton = false;
  let creandoRed = false;

  // ¿Está al final de la página? (o la página es tan corta que no se mueve)
  const alFinal = () => {
    const el = document.scrollingElement || document.documentElement;
    return el.scrollTop + window.innerHeight >= el.scrollHeight - 2;
  };
  const hayVentana = () => Boolean(document.querySelector('.fondo-hoja, .visor, .novedades, .esquirlas'));
  const puedeEmpezar = (destino) => alFinal() && !hayVentana() && !document.body.classList.contains('modo-dibujo')
    && !(destino instanceof Element && destino.closest('input, textarea, select, [contenteditable], .no-jalar'));

  function crearLienzo() {
    const W = document.documentElement.clientWidth;
    const H = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo = document.createElement('canvas');
    lienzo.className = 'grieta-lienzo';
    lienzo.setAttribute('aria-hidden', 'true');
    lienzo.width = Math.round(W * dpr);
    lienzo.height = Math.round(H * dpr);
    ctx = lienzo.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    document.body.append(lienzo);
    return { W, H };
  }
  function quitarLienzo() {
    if (lienzo) lienzo.remove();
    lienzo = null;
    ctx = null;
    red = null;
  }

  function moverPantalla(off, temblor = 0) {
    const tx = temblor ? azar(-temblor, temblor) : 0;
    const ty = temblor ? azar(-temblor, temblor) : 0;
    pantalla.style.transform = Math.abs(off) > 0.5 || temblor ? `translate3d(${tx.toFixed(1)}px, ${(off + ty).toFixed(1)}px, 0)` : '';
    if (lienzo) lienzo.style.transform = temblor ? `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)` : '';
  }

  function pedirCuadro() { if (!cuadro) cuadro = requestAnimationFrame(dibujar); }
  function dibujar(t) {
    cuadro = 0;
    if (estado === 'roto') return;
    let alfa = 1;
    if (estado === 'curando' && curacion) {
      const k = Math.min(1, (t - curacion.t0) / curacion.dur);
      const suave = 1 - (1 - k) ** 3;
      p = curacion.desde * (1 - suave);
      alfa = 1 - suave * 0.85;
      if (k >= 1) { curacion = null; estado = 'libre'; p = 0; quitarLienzo(); document.documentElement.classList.remove('grieta-activa'); return; }
    }
    if (ctx && red) pintarGrietas(ctx, red, p, t, alfa);
    const tension = estado === 'jalando' ? Math.max(0, (p - 0.86) / 0.14) : 0;
    if (estado === 'jalando') moverPantalla(desplazamiento(), tension * 3.2);
    if (tension > 0 && t - ultimoCrujido > azar(90, 220)) { ultimoCrujido = t; crujido(0.4 + tension * 0.5); }
    if (estado === 'jalando' || estado === 'curando') pedirCuadro();
  }

  // la página sube un poquito, cada vez más dura (resistencia)
  const desplazamiento = () => -70 * (1 - Math.exp(-dy / 260));

  function empezar(x, y) {
    if (estado === 'curando') { curacion = null; quitarLienzo(); moverPantalla(0); }
    estado = 'mirando';
    x0 = x;
    y0 = y;
    dy = 0;
    p = 0;
    anilloVisto = -1;
  }

  function actualizar() {
    const fin = umbral();
    p = Math.max(0, Math.min(1, (dy - INICIO) / (fin - INICIO)));
    if (p > 0 && !red && !creandoRed) {
      creandoRed = true;
      cargarPiezas().then((pz) => {
        creandoRed = false;
        if (red || estado !== 'jalando' || !pz) return;
        const { W, H } = crearLienzo();
        // la grieta nace abajo (donde la pantalla se aprieta), bajo el dedo
        const ox = Math.min(W - 40, Math.max(40, x0));
        const oy = H - 24;
        red = crearRed(pz.Delaunay, W, H, ox, oy);
        actualizar();
      }).catch(() => { creandoRed = false; });
    }
    if (p > 0.3 && !precargado) {
      precargado = true;
      precargar('ruptura');
      // que la galaxia (sus estilos y el 3D) ya esté lista al romperse
      import('./galaxia.js').then((m) => { m.cargarEstilos(); return import('./cielo.js'); }).catch(() => {});
    }
    if (red) {
      const R = radio(red, p);
      let anillo = -1;
      red.anillos.forEach((r, i) => { if (R > r) anillo = i; });
      if (anillo > anilloVisto) {
        if (anilloVisto >= 0 || anillo > 0) { tin(0.45 + p * 0.6); crujido(0.5 + p * 0.5); }
        if (navigator.vibrate && anillo > 0) navigator.vibrate(6 + Math.round(p * 10));
      }
      anilloVisto = Math.max(anilloVisto, anillo);
    }
    if (p >= 1 && red) { romper(); return; }
    moverPantalla(desplazamiento());
    pedirCuadro();
  }

  // Devuelve true si este movimiento es nuestro (y hay que evitar que la página se mueva).
  function mover(x, y) {
    const dx = x - x0;
    const ddy = y - y0;
    if (estado === 'mirando') {
      if (Math.abs(ddy) < 4 && Math.abs(dx) < 4) return false;
      if (ddy < 0 && -ddy > Math.abs(dx) * 1.1 && alFinal()) {
        estado = 'jalando';
        document.documentElement.classList.add('grieta-activa');
        cargarPiezas().catch(() => {});
        if (conRaton) document.body.classList.add('jalando-grieta');
      } else {
        estado = 'libre';
        return false;
      }
    }
    dy = Math.max(0, -ddy);
    actualizar();
    return true;
  }

  function soltar() {
    document.body.classList.remove('jalando-grieta');
    if (estado === 'mirando') { estado = 'libre'; return; }
    if (estado !== 'jalando') return;
    // Si ya se vieron grietas, se despierta el audio (así la próxima vez suenan).
    if (p > 0.15) desbloquear();
    pantalla.style.transition = 'transform .55s cubic-bezier(.2,1.5,.4,1)';
    moverPantalla(0);
    setTimeout(() => { pantalla.style.transition = ''; }, 600);
    if (!red || p <= 0) { estado = 'libre'; quitarLienzo(); document.documentElement.classList.remove('grieta-activa'); return; }
    estado = 'curando';
    curacion = { desde: p, t0: performance.now(), dur: 380 + p * 320 };
    if (lienzo) lienzo.style.transform = '';
    pedirCuadro();
  }

  // ---------------------------------------------------------------- ¡crack!
  async function romper() {
    estado = 'roto';
    rotaEn = performance.now();
    document.body.classList.remove('jalando-grieta');
    sonar('ruptura');
    if (navigator.vibrate) navigator.vibrate([18, 30, 18, 30, 90]);
    let pz = null;
    try { pz = await cargarPiezas(); } catch { /* sin animación */ }
    const r = red;
    // ¡crack! las grietas suben de golpe hasta arriba
    if (!quieto()) await subirGrietas(r);
    pintarGrietas(ctx, r, 1, performance.now(), 1, r.lejos * RADIO_TOTAL);

    if (!pz || quieto()) {
      // Sin tanto movimiento: la pantalla agrietada se desvanece hacia la galaxia.
      document.body.classList.add('en-galaxia');
      lienzo.style.transition = 'opacity .8s ease';
      raiz.style.transition = 'opacity .5s ease';
      raiz.style.opacity = '0';
      setTimeout(() => {
        lienzo.style.opacity = '0';
        raiz.style.opacity = '';
        raiz.style.transition = '';
        document.documentElement.classList.remove('grieta-activa');
        alRomper();
        setTimeout(quitarLienzo, 900);
      }, 450);
      return;
    }

    const { gsap, confeti } = pz;
    const { capa, esquirlas } = armarEsquirlas(r, raiz, 1); // (antes de oscurecer el fondo: lo copia)
    document.body.classList.add('en-galaxia');
    const destello = document.createElement('div');
    destello.className = 'grieta-destello';
    destello.style.left = `${r.ox}px`;
    destello.style.top = `${r.oy}px`;
    document.body.append(capa, destello);
    raiz.style.visibility = 'hidden';
    quitarLienzo();
    const estirado = desplazamiento();
    pantalla.style.transform = '';

    const { W, H, ox, oy, lejos } = r;
    const tl = gsap.timeline({ onComplete: () => { capa.remove(); document.documentElement.classList.remove('grieta-activa'); } });
    tl.fromTo(destello, { scale: 0.2, opacity: 1 }, { scale: 10, opacity: 0, duration: 0.8, ease: 'power2.out', onComplete: () => destello.remove() }, 0);
    // Se desmorona desde abajo: primero se sueltan y caen los pedazos de abajo, y la
    // ruptura va subiendo como una ola hasta los de arriba.
    for (const e of esquirlas) {
      const cerca = 1 - Math.min(1, e.dist / lejos);
      const altura = Math.min(1, Math.max(0, (H - e.celda.cy) / H)); // 0 abajo, 1 arriba
      const demora = 0.04 + altura * 0.75 + azar(0, 0.06);
      const ang = Math.atan2(e.celda.cy - oy, e.celda.cx - ox);
      const vx = Math.cos(ang);
      const polvo = e.el.classList.contains('polvo');
      const vuelo = azar(0.95, 1.35) * (polvo ? 0.8 : 1);
      // un temblorcito al soltarse…
      tl.to(e.el, { x: vx * 6, y: 4, rotation: azar(-5, 5), duration: 0.12, ease: 'power2.out', force3D: true }, demora);
      // …y cae, girando en 3D
      tl.to(e.el, {
        x: vx * azar(30, 120) * (0.6 + cerca) * (polvo ? 1.6 : 1),
        z: azar(-220, 320),
        rotationX: azar(-200, 200), rotationY: azar(-200, 200), rotation: `+=${azar(-90, 90)}`,
        duration: vuelo, ease: 'power1.out',
      }, demora + 0.12);
      tl.to(e.el, { y: H * azar(1.05, 1.4) + Math.abs(estirado), duration: vuelo, ease: 'power2.in' }, demora + 0.12);
      tl.to(e.el, { opacity: 0, duration: 0.4, ease: 'power1.in' }, demora + 0.12 + vuelo * 0.7);
      tl.to(e.brillo, { opacity: 0.85, duration: 0.18, yoyo: true, repeat: 3, ease: 'sine.inOut' }, demora + azar(0, 0.3));
    }
    // vidrio y estrellitas que salen volando hacia arriba desde el golpe
    if (!quieto()) {
      const { disparar, quitar } = confetiSeguro(confeti);
      const origen = { x: ox / W, y: oy / H };
      const vidrio = disparar({
        particleCount: 110, angle: 90, spread: 120, startVelocity: 34, gravity: 1.1, ticks: 240, origin: origen, scalar: 0.85,
        colors: ['#ffffff', '#dfe9ff', '#9ec5ff', '#b9a6ff', '#7c9dff'], shapes: ['square', 'circle'],
      });
      setTimeout(() => {
        const estrellas = disparar({
          particleCount: 30, angle: 90, spread: 80, startVelocity: 30, gravity: 0.7, ticks: 280, origin: origen, scalar: 1.15,
          colors: ['#ffe28a', '#fff3c4', '#ffd1f0'], shapes: ['star'],
        });
        Promise.all([vidrio, estrellas]).then(quitar, quitar);
      }, 200);
    }
    alRomper();
  }

  // Las grietas suben de golpe hasta arriba (un cuarto de segundo), crujiendo.
  function subirGrietas(r, dura = 280) {
    return new Promise((ok) => {
      const desde = radio(r, 1);
      const hasta = r.lejos * RADIO_TOTAL;
      const t0 = performance.now();
      let ultimo = 0;
      const paso = (t) => {
        const k = Math.min(1, (t - t0) / dura);
        if (ctx) pintarGrietas(ctx, r, 1, t, 1, desde + (hasta - desde) * k * k);
        moverPantalla(desplazamiento(), 2.5 + k * 5);
        if (t - ultimo > 45) { ultimo = t; crujido(0.9); tin(0.5 + k * 0.5); }
        if (k < 1) requestAnimationFrame(paso); else ok();
      };
      requestAnimationFrame(paso);
    });
  }

  // ---------------------------------------------------------------- eventos
  const alTocar = (e) => {
    if (estado === 'roto' || (estado !== 'libre' && estado !== 'curando')) return;
    if (e.touches.length !== 1 || !puedeEmpezar(e.target)) return;
    conRaton = false;
    empezar(e.touches[0].clientX, e.touches[0].clientY);
  };
  const alMover = (e) => {
    if (estado === 'roto') { if (e.cancelable) e.preventDefault(); return; }
    if (estado !== 'mirando' && estado !== 'jalando') return;
    if (e.touches.length !== 1) { soltar(); return; }
    if (mover(e.touches[0].clientX, e.touches[0].clientY) && e.cancelable) e.preventDefault();
  };
  const alSoltar = () => { if (estado === 'mirando' || estado === 'jalando') soltar(); };

  // Con el mouse también (para probar en la computadora).
  let arrastro = false;
  const alBajarRaton = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    if (estado === 'roto' || (estado !== 'libre' && estado !== 'curando') || !puedeEmpezar(e.target)) return;
    conRaton = true;
    arrastro = false;
    empezar(e.clientX, e.clientY);
  };
  const alMoverRaton = (e) => {
    if (e.pointerType !== 'mouse' || (estado !== 'mirando' && estado !== 'jalando')) return;
    // sin el botón apretado (lo soltaron fuera de la ventana): es como soltar
    if (!(e.buttons & 1)) { alSoltar(); return; }
    if (mover(e.clientX, e.clientY)) {
      if (dy > 8) arrastro = true;
      if (window.getSelection) window.getSelection().removeAllRanges();
    }
  };
  const alSubirRaton = (e) => {
    if (e.pointerType !== 'mouse') return;
    alSoltar();
    if (arrastro) {
      // que el clic de después del arrastre no toque ningún botón
      const bloquear = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', bloquear, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', bloquear, { capture: true }), 50);
    }
    arrastro = false;
  };
  const alOcultar = () => { if (document.hidden) alSoltar(); };

  window.addEventListener('touchstart', alTocar, { passive: true });
  window.addEventListener('touchmove', alMover, { passive: false });
  window.addEventListener('touchend', alSoltar, { passive: true });
  window.addEventListener('touchcancel', alSoltar, { passive: true });
  window.addEventListener('pointerdown', alBajarRaton);
  window.addEventListener('pointermove', alMoverRaton);
  window.addEventListener('pointerup', alSubirRaton);
  window.addEventListener('pointercancel', alSubirRaton);
  window.addEventListener('blur', alSoltar);
  document.addEventListener('visibilitychange', alOcultar);

  return () => {
    window.removeEventListener('touchstart', alTocar);
    window.removeEventListener('touchmove', alMover);
    window.removeEventListener('touchend', alSoltar);
    window.removeEventListener('touchcancel', alSoltar);
    window.removeEventListener('pointerdown', alBajarRaton);
    window.removeEventListener('pointermove', alMoverRaton);
    window.removeEventListener('pointerup', alSubirRaton);
    window.removeEventListener('pointercancel', alSubirRaton);
    window.removeEventListener('blur', alSoltar);
    document.removeEventListener('visibilitychange', alOcultar);
    document.body.classList.remove('jalando-grieta');
    if (cuadro) cancelAnimationFrame(cuadro);
    cuadro = 0;
    if (estado !== 'roto') { quitarLienzo(); moverPantalla(0); document.documentElement.classList.remove('grieta-activa'); }
  };
}
