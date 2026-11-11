// Saltitos estelares: tu animalito (el mapache o la siamesa) da vueltas alrededor de un
// planetita. Tocas la pantalla y sale disparado hacia afuera: si cae en el planeta de
// arriba, se queda ahí (y el planeta, que estaba dormido, se despierta contento). Si no,
// una estrellita lo rescata y lo devuelve (pero se pierde un corazón). Con tres corazones
// perdidos se termina el viaje. Por el camino hay estrellitas para atrapar.

import { api } from '../api.js';
import { h } from '../ui.js';
import { carita } from '../iconos.js';
import { crearPanel, chispitas, caminoEstrella, azar, elegir } from './marco.js';
import { campanita, arpegio, fiu, tin, pop, NOTAS } from './sonido.js';

const COLORES = [['#ffb3d1', '#ff7fae'], ['#a8dcff', '#5f9dff'], ['#a9f0d4', '#3fbf92'], ['#ffe39a', '#f0ac2c'], ['#d6c6ff', '#8f6dff'], ['#ffc8a8', '#ff8f5c']];
const MELODIA = [0, 2, 4, 5, 7, 9, 7, 5, 4, 7, 9, 11];
const VIDAS = 3;

function imagenDe(cuenta) {
  const marca = carita(cuenta.carita, cuenta.color, 'normal').replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" ');
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(marca)}`;
  return img;
}

export function abrir(ctx) {
  const { datos, yo, desde, alCerrar } = ctx;
  let soltar = () => {};
  const panel = crearPanel({ clase: 'gx-panel-saltitos', titulo: 'Saltitos estelares', desde, alCerrar: () => { soltar(); alCerrar(); } });
  const registro = { mejor: 0, estrellas: 0, ...(datos.datos.saltitos || {}) };

  const lienzo = h('canvas', { class: 'gx-saltitos-lienzo', 'aria-label': 'El juego. Toca para saltar.' });
  const marcador = h('div', { class: 'gx-marcador', 'aria-live': 'polite' });
  const capa = h('div', { class: 'gx-saltitos-capa' });
  const zona = h('div', { class: 'gx-saltitos-zona' }, lienzo, marcador, capa);
  panel.cuerpo.append(zona);
  const c = lienzo.getContext('2d');
  const yoImg = imagenDe(yo);

  let ancho = 320;
  let alto = 480;
  let dpr = 1;
  function ajustar() {
    const r = { width: zona.clientWidth, height: zona.clientHeight }; // (sin la escala de la animación de apertura)
    ancho = Math.max(240, r.width);
    alto = Math.max(320, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    lienzo.style.width = `${ancho}px`;
    lienzo.style.height = `${alto}px`;
  }
  const obs = new ResizeObserver(ajustar);
  obs.observe(zona);
  ajustar();

  // ---------------------------------------------------------------- el mundo
  const fondo = [0.15, 0.35, 0.6].map((vel) => ({ vel, estrellas: Array.from({ length: 50 }, () => ({ x: Math.random(), y: Math.random(), r: azar(0.5, 1.6) * (vel + 0.4), f: azar(0, 6) })) }));
  let planetas = [];
  let bits = [];
  let jugador = null;
  let camY = 0;
  let puntos = 0;
  let atrapadas = 0;
  let vidas = VIDAS;
  let estado = 'inicio'; // inicio · jugando · rescate · fin
  let rescate = null;
  let nota = 0;

  function nuevoPlaneta(anterior, n) {
    const dificultad = Math.min(1, n / 30);
    const r = azar(30, 44) - dificultad * 9;
    const margen = 22 + r;
    let x = 0;
    for (let i = 0; i < 12; i += 1) {
      x = azar(margen, ancho - margen);
      if (!anterior || (Math.abs(x - anterior.x) > 50 && Math.abs(x - anterior.x) < ancho * 0.62)) break;
    }
    const y = anterior ? anterior.y - azar(150, 190) - dificultad * 40 : alto * 0.7;
    const [claro, fuerte] = elegir(COLORES);
    const mueve = n > 8 && Math.random() < 0.25 + dificultad * 0.3;
    return {
      x, x0: x, y, r, claro, fuerte, n,
      giro: (Math.random() < 0.5 ? -1 : 1) * Math.min(3.4, Math.max(1.7, (1.9 + dificultad * 1.1) * (38 / r))),
      ang: Math.random() * 6.28, despierto: !anterior, salto: 0,
      mueve: mueve ? { amp: azar(26, 55), vel: azar(0.6, 1.1), fase: Math.random() * 6.28 } : null,
      anillo: Math.random() < 0.3, manchas: Array.from({ length: 3 }, () => ({ a: azar(0, 6.28), d: azar(0.2, 0.6), r: azar(0.12, 0.22) })),
    };
  }
  function asegurarPlanetas() {
    while (planetas.length < 2 || planetas[planetas.length - 1].y > camY - alto) {
      const ant = planetas[planetas.length - 1];
      const p = nuevoPlaneta(ant, planetas.length);
      planetas.push(p);
      if (ant) {
        for (let i = 1; i <= 2; i += 1) {
          const k = i / 3;
          bits.push({ x: ant.x + (p.x - ant.x) * k + azar(-30, 30), y: ant.y + (p.y - ant.y) * k + azar(-12, 12), f: Math.random() * 6, tomada: false });
        }
      }
    }
    // se olvidan los que quedaron muy abajo
    planetas = planetas.filter((p) => p.y < camY + alto * 2.2 || p === jugador.planeta);
    bits = bits.filter((b) => b.y < camY + alto * 1.6);
  }

  function empezar() {
    planetas = [];
    bits = [];
    puntos = 0;
    atrapadas = 0;
    vidas = VIDAS;
    nota = 0;
    camY = 0;
    const primero = nuevoPlaneta(null, 0);
    planetas.push(primero);
    jugador = { planeta: primero, theta: -Math.PI / 2, x: 0, y: 0, vx: 0, vy: 0, vuelo: 0, giro: 0, ultimo: primero };
    asegurarPlanetas();
    estado = 'jugando';
    capa.replaceChildren();
    capa.hidden = true;
    pintarMarcador();
  }

  function pintarMarcador() {
    marcador.replaceChildren(
      h('span', { class: 'gx-marca' }, `🪐 ${puntos}`),
      h('span', { class: 'gx-marca' }, `⭐ ${atrapadas}`),
      h('span', { class: 'gx-marca gx-vidas', 'aria-label': `${vidas} corazones` }, '💗'.repeat(vidas) + '🤍'.repeat(VIDAS - vidas)));
  }

  // ---------------------------------------------------------------- saltar
  function saltar() {
    if (estado === 'inicio' || estado === 'fin') return;
    if (estado !== 'jugando' || !jugador.planeta) return;
    const p = jugador.planeta;
    const dir = { x: Math.cos(jugador.theta), y: Math.sin(jugador.theta) };
    jugador.vx = dir.x * 520;
    jugador.vy = dir.y * 520;
    jugador.ultimo = p;
    jugador.planeta = null;
    jugador.vuelo = 0;
    fiu({ desde: 520, hasta: 1100, duracion: 0.28, volumen: 0.07 });
  }
  lienzo.addEventListener('pointerdown', (e) => { e.preventDefault(); saltar(); });
  const alTeclado = (e) => { if (e.code === 'Space' && estado === 'jugando') { e.preventDefault(); saltar(); } };
  document.addEventListener('keydown', alTeclado);

  function aterrizar(p) {
    jugador.planeta = p;
    jugador.theta = Math.atan2(jugador.y - p.y, jugador.x - p.x);
    p.salto = 1;
    if (!p.despierto) {
      p.despierto = true;
      puntos += 1;
      const n = MELODIA[nota % MELODIA.length];
      campanita(Math.min(NOTAS - 1, n + (Math.floor(nota / MELODIA.length) % 2)), { volumen: 0.2 });
      nota += 1;
      pintarMarcador();
    } else pop({ alto: 0.9, volumen: 0.1 });
    if (navigator.vibrate) navigator.vibrate(8);
  }

  function perder() {
    vidas -= 1;
    pintarMarcador();
    arpegio([7, 5, 4], { separacion: 0.1, volumen: 0.12 });
    estado = 'rescate';
    rescate = { t: 0, desde: { x: jugador.x, y: jugador.y }, hacia: jugador.ultimo, estrella: { x: ancho / 2, y: camY - 40 } };
  }

  async function terminar() {
    estado = 'fin';
    const record = puntos > (registro.mejor || 0);
    registro.mejor = Math.max(registro.mejor || 0, puntos);
    registro.estrellas = (registro.estrellas || 0) + atrapadas;
    datos.datos.saltitos = { mejor: registro.mejor, estrellas: registro.estrellas };
    api.datoGalaxia('saltitos', datos.datos.saltitos).catch(() => {});
    arpegio(record ? [0, 2, 4, 7, 9, 11] : [0, 4, 7], { separacion: 0.1, volumen: 0.18 });
    pantalla({
      titulo: record && puntos > 0 ? '¡Récord nuevo! 🌟' : '¡Qué viaje tan lindo!',
      lineas: [
        `Visitaste ${puntos} ${puntos === 1 ? 'planetita' : 'planetitas'}${atrapadas ? ` y atrapaste ${atrapadas} ${atrapadas === 1 ? 'estrellita' : 'estrellitas'}` : ''}.`,
        `Tu mejor viaje: ${registro.mejor} 🪐 · Estrellitas en total: ${registro.estrellas} ⭐`,
      ],
      boton: 'Otro viaje',
    });
  }

  function pantalla({ titulo, lineas, boton }) {
    capa.hidden = false;
    const b = h('button', { type: 'button', class: 'gx-boton dorado', onclick: () => { pop({ alto: 1.3 }); empezar(); } }, boton);
    capa.replaceChildren(h('div', { class: 'gx-saltitos-cartel' },
      h('p', { class: 'gx-saltitos-titulo' }, titulo),
      lineas.map((l) => h('p', { class: 'gx-saltitos-texto' }, l)),
      b,
      h('button', { type: 'button', class: 'gx-boton blanco chico', onclick: () => panel.cerrar() }, 'Volver al cielo')));
    setTimeout(() => b.focus({ preventScroll: true }), 100);
  }

  // ---------------------------------------------------------------- cada cuadro
  let cuadro = 0;
  let anterior = 0;
  function bucle(ahora) {
    cuadro = requestAnimationFrame(bucle);
    const dt = Math.min(0.033, (ahora - (anterior || ahora)) / 1000);
    anterior = ahora;
    const t = ahora / 1000;
    if (jugador && (estado === 'jugando' || estado === 'rescate')) actualizar(dt, t);
    dibujar(t);
  }

  function actualizar(dt, t) {
    for (const p of planetas) {
      p.ang += dt * p.giro * 0.25;
      if (p.mueve) p.x = p.x0 + Math.sin(t * p.mueve.vel + p.mueve.fase) * p.mueve.amp;
      if (p.salto > 0) p.salto = Math.max(0, p.salto - dt * 2.5);
    }
    const j = jugador;
    if (estado === 'rescate') {
      // una estrellita baja, lo agarra y lo lleva de vuelta
      const r = rescate;
      r.t += dt;
      const k1 = Math.min(1, r.t / 0.6);
      const k2 = Math.max(0, Math.min(1, (r.t - 0.6) / 0.8));
      const e1 = 1 - (1 - k1) ** 2;
      const e2 = k2 * k2 * (3 - 2 * k2);
      const orbita = r.hacia.r + 20;
      const hacia = { x: r.hacia.x, y: r.hacia.y - orbita };
      r.estrella.x = r.estrella.x + (r.desde.x - r.estrella.x) * e1 * 0.3;
      r.estrella.y = r.estrella.y + (r.desde.y - 26 - r.estrella.y) * e1 * 0.3;
      if (k1 >= 1) {
        j.x = r.desde.x + (hacia.x - r.desde.x) * e2;
        j.y = r.desde.y + (hacia.y - r.desde.y) * e2 - Math.sin(e2 * Math.PI) * 60;
        r.estrella.x = j.x;
        r.estrella.y = j.y - 26;
      }
      if (k2 >= 1) {
        j.planeta = r.hacia;
        j.theta = -Math.PI / 2;
        rescate = null;
        if (vidas <= 0) { terminar(); return; }
        estado = 'jugando';
      }
    } else if (j.planeta) {
      const p = j.planeta;
      j.theta += p.giro * dt;
      const orbita = p.r + 20;
      j.x = p.x + Math.cos(j.theta) * orbita;
      j.y = p.y + Math.sin(j.theta) * orbita;
      j.giro = j.theta + Math.PI / 2;
    } else {
      j.vuelo += dt;
      j.x += j.vx * dt;
      j.y += j.vy * dt;
      j.giro += dt * 9;
      for (const b of bits) {
        if (!b.tomada && Math.hypot(b.x - j.x, b.y - j.y) < 24) {
          b.tomada = true;
          atrapadas += 1;
          tin(0.6);
          pintarMarcador();
          const r = lienzo.getBoundingClientRect();
          chispitas(r.left + b.x, r.top + b.y - camY, { cantidad: 6, lejos: 30, tam: 10 });
        }
      }
      for (const p of planetas) {
        if (p === j.ultimo) continue;
        if (Math.hypot(p.x - j.x, p.y - j.y) < p.r + 20 + 12) { aterrizar(p); break; }
      }
      const fuera = j.x < -40 || j.x > ancho + 40 || j.y < camY - 80 || j.y > camY + alto + 80 || j.vuelo > 2.4;
      if (!j.planeta && fuera) perder();
    }
    // la cámara sigue al planeta donde estás
    const foco = j.planeta || j.ultimo;
    const meta = foco.y - alto * 0.68;
    camY += (meta - camY) * (1 - Math.exp(-dt * 3.2));
    asegurarPlanetas();
  }

  function dibujarPlaneta(p, t) {
    const y = p.y - camY;
    if (y < -p.r * 3 || y > alto + p.r * 3) return;
    const s = 1 + Math.sin((1 - p.salto) * Math.PI * 3) * 0.1 * p.salto;
    c.save();
    c.translate(p.x, y);
    c.scale(s, s);
    const halo = c.createRadialGradient(0, 0, p.r * 0.6, 0, 0, p.r * 2.1);
    halo.addColorStop(0, `${p.claro}66`);
    halo.addColorStop(1, `${p.claro}00`);
    c.fillStyle = halo;
    c.beginPath(); c.arc(0, 0, p.r * 2.1, 0, Math.PI * 2); c.fill();
    if (p.anillo) {
      c.strokeStyle = `${p.fuerte}aa`;
      c.lineWidth = 4;
      c.beginPath(); c.ellipse(0, 0, p.r * 1.55, p.r * 0.4, -0.3, Math.PI, Math.PI * 2); c.stroke();
    }
    const g = c.createRadialGradient(-p.r * 0.35, -p.r * 0.4, p.r * 0.1, 0, 0, p.r);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.25, p.claro);
    g.addColorStop(1, p.fuerte);
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, p.r, 0, Math.PI * 2); c.fill();
    c.save();
    c.clip();
    c.fillStyle = 'rgba(255,255,255,.18)';
    for (const m of p.manchas) {
      const a = m.a + p.ang;
      c.beginPath(); c.arc(Math.cos(a) * p.r * m.d, Math.sin(a) * p.r * m.d * 0.8, p.r * m.r, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    if (p.anillo) {
      c.strokeStyle = `${p.fuerte}dd`;
      c.lineWidth = 4;
      c.beginPath(); c.ellipse(0, 0, p.r * 1.55, p.r * 0.4, -0.3, 0, Math.PI); c.stroke();
    }
    // la carita: dormida hasta que llegas
    c.strokeStyle = '#3a2745';
    c.fillStyle = '#3a2745';
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    const ojo = p.r * 0.28;
    if (p.despierto) {
      for (const lado of [-1, 1]) { c.beginPath(); c.ellipse(lado * ojo, -p.r * 0.05, 2.6, 3.6, 0, 0, Math.PI * 2); c.fill(); }
      c.beginPath(); c.arc(0, p.r * 0.12, p.r * 0.14, 0.15, Math.PI - 0.15); c.stroke();
    } else {
      for (const lado of [-1, 1]) { c.beginPath(); c.arc(lado * ojo, -p.r * 0.08, 3.4, 0.2, Math.PI - 0.2); c.stroke(); }
      c.beginPath(); c.arc(0, p.r * 0.16, 2.2, 0, Math.PI * 2); c.stroke();
      // zzz
      c.fillStyle = 'rgba(255,255,255,.7)';
      c.font = '600 12px Mali, sans-serif';
      c.fillText('z', p.r * 0.7, -p.r * 0.8 - Math.sin(t * 2 + p.n) * 4);
    }
    c.fillStyle = 'rgba(255,120,170,.55)';
    for (const lado of [-1, 1]) { c.beginPath(); c.ellipse(lado * p.r * 0.5, p.r * 0.12, 5, 3.2, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }

  function dibujar(t) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cielo = c.createLinearGradient(0, 0, 0, alto);
    cielo.addColorStop(0, '#0a0d2c');
    cielo.addColorStop(1, '#22134a');
    c.fillStyle = cielo;
    c.fillRect(0, 0, ancho, alto);
    // estrellas del fondo, en capas (las de adelante se mueven más)
    for (const capaF of fondo) {
      for (const s of capaF.estrellas) {
        const y = (((s.y * alto - camY * capaF.vel) % alto) + alto) % alto;
        c.globalAlpha = 0.35 + 0.45 * Math.abs(Math.sin(t * 1.3 + s.f));
        c.fillStyle = '#e8eeff';
        c.beginPath(); c.arc(s.x * ancho, y, s.r, 0, Math.PI * 2); c.fill();
      }
    }
    c.globalAlpha = 1;
    if (!jugador) return;
    for (const p of planetas) dibujarPlaneta(p, t);
    // estrellitas para atrapar
    for (const b of bits) {
      if (b.tomada) continue;
      const y = b.y - camY;
      if (y < -20 || y > alto + 20) continue;
      c.save();
      c.translate(b.x, y + Math.sin(t * 3 + b.f) * 3);
      c.rotate(Math.sin(t * 2 + b.f) * 0.3);
      c.shadowColor = '#ffd36b';
      c.shadowBlur = 10;
      c.fillStyle = '#ffe28a';
      c.fill(new Path2D(caminoEstrella(0, 1, 9, 4.6)));
      c.restore();
    }
    // el animalito
    const j = jugador;
    c.save();
    c.translate(j.x, j.y - camY);
    c.rotate(j.giro);
    if (yoImg.complete) c.drawImage(yoImg, -19, -19, 38, 38);
    else { c.fillStyle = yo.color; c.beginPath(); c.arc(0, 0, 16, 0, Math.PI * 2); c.fill(); }
    c.restore();
    // la estrellita que rescata
    if (rescate) {
      const e = rescate.estrella;
      c.save();
      c.translate(e.x, e.y - camY);
      c.rotate(Math.sin(t * 6) * 0.3);
      c.shadowColor = '#ffe27a';
      c.shadowBlur = 16;
      c.fillStyle = '#ffe27a';
      c.fill(new Path2D(caminoEstrella(0, 0, 15, 8)));
      c.shadowBlur = 0;
      c.fillStyle = '#3a2745';
      c.beginPath(); c.arc(-4, -1, 1.8, 0, Math.PI * 2); c.arc(4, -1, 1.8, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  cuadro = requestAnimationFrame(bucle);
  soltar = () => { cancelAnimationFrame(cuadro); obs.disconnect(); document.removeEventListener('keydown', alTeclado); };

  // la pantalla de inicio
  jugador = null;
  pantalla({
    titulo: 'Saltitos estelares 🪐',
    lineas: [
      'Toca la pantalla para saltar. Salta justo cuando mires hacia el planeta de arriba.',
      'Los planetitas están dormidos: ¡despiértalos a todos! Y atrapa las estrellitas del camino ⭐',
      registro.mejor ? `Tu mejor viaje: ${registro.mejor} 🪐` : '',
    ].filter(Boolean),
    boton: '¡A saltar!',
  });
}
