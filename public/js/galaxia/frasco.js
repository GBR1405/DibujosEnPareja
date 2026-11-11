// El frasco de estrellitas: un frasco de vidrio lleno de estrellitas de papel (con física:
// caen, se acomodan, se sacuden). Lo tocas y sale una estrellita que se desdobla en una
// notita con una frase bonita: primero las que te escribió tu pareja (las nuevas), y si
// no, las que ya trae el frasco (textos.js: para cuando Eli dude de su arte).
//
// Las frases se pueden guardar en "favoritas" ♥, y desde aquí también se le escriben
// estrellitas al frasco de la otra persona.

import { api } from '../api.js';
import { h, aviso, confirmar } from '../ui.js';
import { fechaCorta } from '../comun.js';
import { crearPanel, crearEncima, chispitas, caminoEstrella, azar, elegir, quieto } from './marco.js';
import { FRASES } from './textos.js';
import { campanita, arpegio, pop, fiu, tin } from './sonido.js';

const COLORES = ['#ffd36b', '#ff9fc6', '#9fd8ff', '#c9b0ff', '#8fe6c6', '#ffb38a', '#fff0a8', '#ffc4e1'];
const claveVistas = (yo) => `garabatos-frasco-vistas-${yo}`;

function leerVistas(yo) {
  try { return new Set(JSON.parse(localStorage.getItem(claveVistas(yo)) || '[]')); } catch { return new Set(); }
}
function guardarVistas(yo, vistas) {
  try { localStorage.setItem(claveVistas(yo), JSON.stringify([...vistas].slice(-300))); } catch { /* nada */ }
}

export function abrir(ctx) {
  const { datos, yo, pareja, duena, regala, desde, alCerrar } = ctx;
  const favoritas = new Set(datos.datos.favoritas || []);
  const botonFavoritas = h('button', { type: 'button', class: 'gx-redondo gx-corazon', 'aria-label': 'Mis frases favoritas', onclick: () => verFavoritas() }, '♥');
  let corriendo = true;
  const panel = crearPanel({
    clase: 'gx-panel-frasco', titulo: 'Frasco de estrellitas', extra: botonFavoritas, desde,
    alCerrar: () => { corriendo = false; observador.disconnect(); if (cuadro) cancelAnimationFrame(cuadro); alCerrar(); },
  });

  // ---- las frases
  const propias = () => datos.frases.paraMi.map((f) => ({ id: `p${f.id}`, texto: f.texto, de: pareja, fecha: f.creado })).reverse();
  const deFabrica = FRASES.map((texto, i) => ({ id: `f${i}`, texto, de: regala }));
  const todas = () => [...propias(), ...deFabrica];
  const vistas = leerVistas(yo.id);
  const recientes = [];
  function sacarFrase() {
    const nueva = propias().find((f) => !vistas.has(f.id));
    let f = nueva;
    if (!f) {
      const lista = todas().filter((x) => !recientes.includes(x.id));
      f = elegir(lista.length ? lista : todas());
    }
    vistas.add(f.id);
    guardarVistas(yo.id, vistas);
    recientes.push(f.id);
    if (recientes.length > 8) recientes.shift();
    return { ...f, nueva: Boolean(nueva) };
  }

  // ---- el frasco (canvas)
  const lienzo = h('canvas', { class: 'gx-frasco-lienzo', 'aria-label': 'El frasco. Tócalo para sacar una estrellita.', role: 'button', tabindex: '0' });
  const lugar = h('div', { class: 'gx-frasco-lugar' }, lienzo);
  const cuantasNuevas = () => propias().filter((f) => !vistas.has(f.id)).length;
  const ayuda = h('p', { class: 'gx-frasco-ayuda' });
  const pintarAyuda = () => {
    const n = cuantasNuevas();
    ayuda.textContent = n
      ? `💌 Hay ${n === 1 ? 'una estrellita nueva' : `${n} estrellitas nuevas`} de ${pareja.nombre}. ¡Toca el frasco!`
      : 'Toca el frasco y saca una estrellita ✨';
  };
  pintarAyuda();
  const listaMias = h('ul', { class: 'gx-mias' });
  panel.cuerpo.append(lugar, ayuda,
    h('button', { type: 'button', class: 'gx-boton', onclick: () => escribir() }, `✍️ Escribirle una estrellita a ${pareja.nombre}`),
    h('details', { class: 'gx-mias-caja' }, h('summary', null, `Las que le escribiste a ${pareja.nombre}`), listaMias));

  const c = lienzo.getContext('2d');
  let ancho = 300;
  let alto = 400;
  let dpr = 1;
  let g = null;
  const estrellas = [];
  const total = Math.min(72, 40 + datos.frases.paraMi.length);

  function geometria() {
    const bw = Math.min(ancho * 0.7, 280);
    const bh = Math.min(alto * 0.7, 330);
    const cx = ancho / 2;
    const yb = alto - 16;
    const yt = yb - bh;
    return { bw, bh, cx, yb, yt, nw: bw * 0.56, nh: Math.min(44, bh * 0.13), pared: 7, rc: bw * 0.2, techo: yt + bh * 0.2 };
  }
  function ajustar() {
    const r = { width: lugar.clientWidth, height: lugar.clientHeight }; // (sin la escala de la animación de apertura)
    const antes = g;
    ancho = Math.max(200, r.width);
    alto = Math.max(260, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    lienzo.width = Math.round(ancho * dpr);
    lienzo.height = Math.round(alto * dpr);
    lienzo.style.width = `${ancho}px`;
    lienzo.style.height = `${alto}px`;
    g = geometria();
    if (!estrellas.length) {
      for (let i = 0; i < total; i += 1) {
        const r0 = azar(11, 15);
        estrellas.push({
          x: g.cx + azar(-g.bw / 2 + 24, g.bw / 2 - 24), y: g.techo + azar(0, g.bh * 0.5) - i * 4,
          vx: azar(-30, 30), vy: 0, r: r0, color: COLORES[i % COLORES.length], ang: azar(0, 6.28), va: 0, fuera: false,
        });
      }
    } else if (antes) {
      for (const s of estrellas) { s.x = g.cx + (s.x - antes.cx) * (g.bw / antes.bw); s.y = g.yb - (antes.yb - s.y) * (g.bh / antes.bh); }
    }
    despertar();
  }
  const observador = new ResizeObserver(ajustar);
  observador.observe(lugar);

  // ---- física (sencillita): gravedad, choques entre estrellas y contra el vidrio
  let quietas = 0;
  function paso(dt) {
    const { cx, bw, yb, pared, rc, techo } = g;
    const izq = cx - bw / 2 + pared;
    const der = cx + bw / 2 - pared;
    const fondo = yb - pared;
    for (const s of estrellas) {
      if (s.fuera) continue;
      s.vy += 980 * dt;
      s.vx *= 0.995;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.ang += s.va * dt;
      s.va = s.va * 0.97 + s.vx * 0.0009;
    }
    for (let k = 0; k < 3; k += 1) {
      for (let i = 0; i < estrellas.length; i += 1) {
        const a = estrellas[i];
        if (a.fuera) continue;
        for (let j = i + 1; j < estrellas.length; j += 1) {
          const b = estrellas[j];
          if (b.fuera) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = (a.r + b.r) * 0.92;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min || d2 === 0) continue;
          const d = Math.sqrt(d2);
          const nx = dx / d;
          const ny = dy / d;
          const meter = (min - d) / 2;
          a.x -= nx * meter; a.y -= ny * meter;
          b.x += nx * meter; b.y += ny * meter;
          const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (rel < 0) {
            const imp = -rel * 0.6;
            a.vx -= nx * imp; a.vy -= ny * imp;
            b.vx += nx * imp; b.vy += ny * imp;
          }
        }
      }
      for (const s of estrellas) {
        if (s.fuera) continue;
        if (s.x < izq + s.r) { s.x = izq + s.r; s.vx = Math.abs(s.vx) * 0.3; }
        if (s.x > der - s.r) { s.x = der - s.r; s.vx = -Math.abs(s.vx) * 0.3; }
        if (s.y > fondo - s.r) { s.y = fondo - s.r; s.vy = -Math.abs(s.vy) * 0.25; s.vx *= 0.9; }
        if (s.y < techo + s.r) { s.y = techo + s.r; s.vy = Math.abs(s.vy) * 0.2; }
        // las esquinas redondas del fondo
        for (const lado of [-1, 1]) {
          const ex = lado < 0 ? izq + rc : der - rc;
          const ey = fondo - rc;
          if ((lado < 0 ? s.x < ex : s.x > ex) && s.y > ey) {
            const dx = s.x - ex;
            const dy = s.y - ey;
            const d = Math.hypot(dx, dy);
            if (d > rc - s.r) {
              const k2 = (rc - s.r) / d;
              s.x = ex + dx * k2;
              s.y = ey + dy * k2;
              const nx = dx / d;
              const ny = dy / d;
              const vn = s.vx * nx + s.vy * ny;
              if (vn > 0) { s.vx -= nx * vn * 1.25; s.vy -= ny * vn * 1.25; }
            }
          }
        }
      }
    }
    const energia = estrellas.reduce((m, s) => m + (s.fuera ? 0 : s.vx * s.vx + s.vy * s.vy), 0) / estrellas.length;
    quietas = energia < 60 ? quietas + 1 : 0;
  }

  // ---- dibujar
  function estrellaPapel(s, escala = 1, brillo = 0) {
    c.save();
    c.translate(s.x, s.y);
    c.rotate(s.ang);
    c.scale(escala, escala);
    const r = s.r;
    if (brillo > 0) {
      c.shadowColor = s.color;
      c.shadowBlur = 18 * brillo;
    }
    c.fillStyle = s.color;
    c.fill(new Path2D(caminoEstrella(0, r * 0.08, r * 1.08, r * 0.66, { redondeo: 0.34 })));
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.fill(new Path2D(caminoEstrella(-r * 0.12, -r * 0.08, r * 0.6, r * 0.36, { redondeo: 0.4 })));
    c.strokeStyle = 'rgba(60,40,90,.22)';
    c.lineWidth = 1.2;
    c.stroke(new Path2D(caminoEstrella(0, r * 0.08, r * 1.08, r * 0.66, { redondeo: 0.34 })));
    c.restore();
  }
  function contorno() {
    const { cx, bw, bh, yb, yt, nw, nh, rc } = g;
    const p = new Path2D();
    const hombro = yt + bh * 0.16;
    p.moveTo(cx - nw / 2, yt - nh);
    p.lineTo(cx - nw / 2, yt);
    p.bezierCurveTo(cx - nw / 2, yt + bh * 0.06, cx - bw / 2, yt + bh * 0.04, cx - bw / 2, hombro);
    p.lineTo(cx - bw / 2, yb - rc);
    p.quadraticCurveTo(cx - bw / 2, yb, cx - bw / 2 + rc, yb);
    p.lineTo(cx + bw / 2 - rc, yb);
    p.quadraticCurveTo(cx + bw / 2, yb, cx + bw / 2, yb - rc);
    p.lineTo(cx + bw / 2, hombro);
    p.bezierCurveTo(cx + bw / 2, yt + bh * 0.04, cx + nw / 2, yt + bh * 0.06, cx + nw / 2, yt);
    p.lineTo(cx + nw / 2, yt - nh);
    return p;
  }
  let t = 0;
  const destellos = [];
  function dibujar(ahora) {
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, ancho, alto);
    const { cx, bw, bh, yb, yt, nw, nh } = g;
    const forma = contorno();
    // adentro: un brillo calientito, como si las estrellas tuvieran luz
    c.save();
    c.clip(forma);
    const luz = c.createRadialGradient(cx, yb - bh * 0.25, 10, cx, yb - bh * 0.3, bw * 0.8);
    luz.addColorStop(0, 'rgba(255,214,140,.38)');
    luz.addColorStop(0.6, 'rgba(255,170,210,.12)');
    luz.addColorStop(1, 'rgba(160,190,255,.05)');
    c.fillStyle = luz;
    c.fillRect(0, 0, ancho, alto);
    c.restore();
    // las estrellitas
    for (const s of estrellas) if (!s.fuera) estrellaPapel(s);
    // destellos que titilan adentro
    if (Math.random() < 0.05 && destellos.length < 6) {
      const s = elegir(estrellas.filter((x) => !x.fuera));
      if (s) destellos.push({ x: s.x + azar(-6, 6), y: s.y + azar(-6, 6), vida: 0 });
    }
    for (let i = destellos.length - 1; i >= 0; i -= 1) {
      const d = destellos[i];
      d.vida += 0.03;
      const k = Math.sin(Math.min(1, d.vida) * Math.PI);
      c.fillStyle = `rgba(255,255,255,${0.9 * k})`;
      const r = 6 * k;
      c.beginPath();
      c.moveTo(d.x, d.y - r);
      c.quadraticCurveTo(d.x, d.y, d.x + r, d.y);
      c.quadraticCurveTo(d.x, d.y, d.x, d.y + r);
      c.quadraticCurveTo(d.x, d.y, d.x - r, d.y);
      c.quadraticCurveTo(d.x, d.y, d.x, d.y - r);
      c.fill();
      if (d.vida >= 1) destellos.splice(i, 1);
    }
    // el vidrio
    c.fillStyle = 'rgba(210,230,255,.07)';
    c.fill(forma);
    c.lineWidth = 3;
    c.strokeStyle = 'rgba(235,244,255,.75)';
    c.stroke(forma);
    const reflejo = c.createLinearGradient(cx - bw / 2, 0, cx - bw / 2 + bw * 0.22, 0);
    reflejo.addColorStop(0, 'rgba(255,255,255,0)');
    reflejo.addColorStop(0.45, 'rgba(255,255,255,.32)');
    reflejo.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = reflejo;
    c.beginPath();
    c.roundRect ? c.roundRect(cx - bw / 2 + 10, yt + bh * 0.2, bw * 0.16, bh * 0.66, 20) : c.rect(cx - bw / 2 + 10, yt + bh * 0.2, bw * 0.16, bh * 0.66);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,.28)';
    c.beginPath();
    c.ellipse(cx + bw * 0.36, yt + bh * 0.34, 5, bh * 0.12, 0, 0, Math.PI * 2);
    c.fill();
    // el borde de la boca y el corcho
    c.fillStyle = 'rgba(235,244,255,.55)';
    c.beginPath();
    c.ellipse(cx, yt - nh, nw / 2 + 7, 7, 0, 0, Math.PI * 2);
    c.fill();
    const corchoAlto = 30;
    const corcho = c.createLinearGradient(0, yt - nh - corchoAlto, 0, yt - nh + 6);
    corcho.addColorStop(0, '#e8b27c');
    corcho.addColorStop(1, '#b97c45');
    c.fillStyle = corcho;
    c.beginPath();
    c.moveTo(cx - nw / 2 - 2, yt - nh + 4);
    c.lineTo(cx - nw / 2 + 3, yt - nh - corchoAlto);
    c.quadraticCurveTo(cx, yt - nh - corchoAlto - 7, cx + nw / 2 - 3, yt - nh - corchoAlto);
    c.lineTo(cx + nw / 2 + 2, yt - nh + 4);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(120,70,30,.35)';
    c.lineWidth = 1.5;
    for (let i = 1; i < 4; i += 1) {
      const y = yt - nh - corchoAlto + (i * corchoAlto) / 4;
      c.beginPath();
      c.moveTo(cx - nw / 2 + 4, y);
      c.lineTo(cx + nw / 2 - 4, y);
      c.stroke();
    }
    // el lacito y la etiqueta
    const ly = yt - 4;
    c.fillStyle = '#ff8fb8';
    c.fillRect(cx - nw / 2 - 2, ly - 6, nw + 4, 10);
    c.beginPath();
    c.ellipse(cx + nw / 2 - 6, ly - 1, 12, 7, -0.5, 0, Math.PI * 2);
    c.ellipse(cx + nw / 2 + 12, ly + 1, 12, 7, 0.5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#ff8fb8';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(cx + nw / 2 + 4, ly);
    c.quadraticCurveTo(cx + nw / 2 + 26, ly + 22, cx + bw / 2 - 6, yt + 40);
    c.stroke();
    c.save();
    c.translate(cx + bw / 2 - 6, yt + 40);
    c.rotate(0.18 + Math.sin(t * 1.3) * 0.04);
    c.fillStyle = '#fff6e6';
    c.strokeStyle = 'rgba(120,80,60,.3)';
    c.beginPath();
    c.moveTo(-6, 0);
    c.lineTo(52, 0);
    c.lineTo(58, 14);
    c.lineTo(52, 28);
    c.lineTo(-6, 28);
    c.closePath();
    c.fill();
    c.stroke();
    c.fillStyle = '#7a4f6d';
    c.font = '700 17px Caveat, cursive';
    c.textBaseline = 'middle';
    c.fillText(`para ${duena.nombre}`, -1, 15);
    c.restore();
    // la estrellita que va saliendo
    if (saliendo) {
      const k = Math.min(1, (ahora - saliendo.t0) / 900);
      const e = 1 - (1 - k) ** 3;
      const s = saliendo.s;
      const p0 = saliendo.desde;
      const p1 = { x: cx, y: yt - nh - 10 };
      const p2 = { x: cx, y: Math.max(30, yt - nh - 90) };
      const u = 1 - e;
      s.x = u * u * p0.x + 2 * u * e * p1.x + e * e * p2.x;
      s.y = u * u * p0.y + 2 * u * e * p1.y + e * e * p2.y;
      s.ang += 0.25;
      estrellaPapel(s, 1 + e * 1.4, e);
      if (k >= 1) { const fin = saliendo.fin; saliendo = null; fin(); }
    }
  }

  let cuadro = 0;
  let anterior = 0;
  function bucle(ahora) {
    cuadro = 0;
    if (!corriendo) return;
    const dt = Math.min(0.033, (ahora - (anterior || ahora)) / 1000);
    anterior = ahora;
    t += dt;
    paso(dt / 2);
    paso(dt / 2);
    dibujar(ahora);
    // si todo quedó quieto (y no sale ninguna), se duerme hasta que lo toquen
    if (quietas > 90 && !saliendo && !destellos.length) { quietas = 0; dormido = true; setTimeout(() => { if (dormido) despertar(); }, 2600); return; }
    cuadro = requestAnimationFrame(bucle);
  }
  let dormido = false;
  function despertar() {
    dormido = false;
    if (!cuadro && corriendo && g) { anterior = 0; cuadro = requestAnimationFrame(bucle); }
  }

  // ---- sacar una estrellita
  let saliendo = null;
  let ocupado = false;
  function sacudir(fuerza = 1) {
    for (const s of estrellas) {
      if (s.fuera) continue;
      s.vx += azar(-240, 240) * fuerza;
      s.vy -= azar(140, 420) * fuerza;
      s.va += azar(-6, 6);
    }
    despertar();
  }
  function sacar() {
    if (ocupado || !g) return;
    ocupado = true;
    sacudir();
    tin(0.5);
    setTimeout(() => tin(0.4), 90);
    const libres = estrellas.filter((s) => !s.fuera);
    const s = libres.reduce((m, x) => (x.y < m.y ? x : m), libres[0]);
    s.fuera = true;
    fiu({ desde: 480, hasta: 1500, duracion: 0.7, volumen: 0.08 });
    const frase = sacarFrase();
    saliendo = {
      s, t0: performance.now(), desde: { x: s.x, y: s.y },
      fin: () => {
        const r = lienzo.getBoundingClientRect();
        mostrarNota(frase, { x: r.left + s.x, y: r.top + s.y, color: s.color }, () => {
          // la estrellita vuelve al frasco
          s.x = g.cx + azar(-10, 10);
          s.y = g.techo + s.r;
          s.vx = azar(-40, 40);
          s.vy = 60;
          s.fuera = false;
          ocupado = false;
          despertar();
          pintarAyuda();
        });
      },
    };
    despertar();
  }
  lienzo.addEventListener('click', sacar);
  lienzo.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sacar(); } });

  // ---- la notita
  function mostrarNota(frase, punto, alCerrarNota) {
    const capa = crearEncima({ clase: 'gx-nota-capa', etiqueta: 'Una estrellita', alCerrar: alCerrarNota });
    const corazon = h('button', { type: 'button', class: 'gx-nota-fav', 'aria-pressed': String(favoritas.has(frase.id)) });
    const pintarCorazon = () => {
      const es = favoritas.has(frase.id);
      corazon.textContent = es ? '♥ Favorita' : '♡ Guardar';
      corazon.setAttribute('aria-pressed', String(es));
      corazon.classList.toggle('activa', es);
    };
    pintarCorazon();
    corazon.addEventListener('click', () => {
      if (favoritas.has(frase.id)) favoritas.delete(frase.id); else { favoritas.add(frase.id); arpegio([4, 7], { volumen: 0.14 }); }
      pintarCorazon();
      guardarFavoritas();
    });
    const nota = h('div', { class: 'gx-nota', style: { '--color': punto.color } },
      frase.nueva && h('p', { class: 'gx-nota-nueva' }, '💌 ¡Nueva!'),
      h('p', { class: 'gx-nota-texto' }, frase.texto),
      h('p', { class: 'gx-nota-firma' }, `— ${frase.de.nombre} 💛`, frase.fecha && h('span', null, ` · ${fechaCorta(frase.fecha.slice(0, 10))}`)),
      h('div', { class: 'gx-nota-acciones' },
        corazon,
        h('button', { type: 'button', class: 'gx-boton chico', onclick: () => { capa.cerrar(); setTimeout(sacar, 450); } }, 'Otra ✨')));
    const r = capa.el.getBoundingClientRect();
    nota.style.setProperty('--desde-x', `${punto.x - r.width / 2}px`);
    nota.style.setProperty('--desde-y', `${punto.y - r.height / 2}px`);
    capa.el.append(nota);
    chispitas(punto.x, punto.y, { cantidad: 10, lejos: 60 });
    arpegio([2, 4, 7, 9], { separacion: 0.06, volumen: 0.15 });
  }

  let reloj = null;
  function guardarFavoritas() {
    datos.datos.favoritas = [...favoritas];
    clearTimeout(reloj);
    reloj = setTimeout(() => api.datoGalaxia('favoritas', datos.datos.favoritas.slice(-200)).catch(() => aviso('No se pudo guardar la favorita 😿')), 500);
  }

  function verFavoritas() {
    const capa = crearEncima({ clase: 'gx-favoritas', etiqueta: 'Mis frases favoritas' });
    const porId = new Map(todas().map((f) => [f.id, f]));
    const lista = [...favoritas].map((id) => porId.get(id)).filter(Boolean).reverse();
    capa.el.append(h('div', { class: 'gx-hoja-oscura' },
      h('h3', { class: 'gx-hoja-titulo' }, '♥ Mis favoritas'),
      lista.length
        ? h('ul', { class: 'gx-favoritas-lista' }, lista.map((f, i) => h('li', { class: 'gx-favorita', style: { '--color': COLORES[i % COLORES.length] } },
          h('p', null, f.texto), h('span', null, `— ${f.de.nombre}`))))
        : h('p', { class: 'gx-vacio' }, 'Cuando una frase te guste mucho, toca ♡ Guardar y va a quedar aquí, para releerla cuando quieras.'),
      h('button', { type: 'button', class: 'gx-boton', onclick: () => capa.cerrar() }, 'Listo')));
  }

  // ---- escribirle a la pareja
  function pintarMias() {
    const mias = datos.frases.mias;
    listaMias.replaceChildren(...(mias.length ? mias.map((f) => h('li', null,
      h('p', null, f.texto),
      h('button', {
        type: 'button', class: 'gx-mia-borrar', 'aria-label': 'Borrar esta frase',
        onclick: async () => {
          const si = await confirmar({ titulo: '¿Borrar esta estrellita?', texto: `Ya no va a estar en el frasco de ${pareja.nombre}.`, si: 'Borrar', no: 'Dejarla' });
          if (!si) return;
          try {
            await api.borrarFrase(f.id);
            datos.frases.mias = datos.frases.mias.filter((x) => x.id !== f.id);
            pintarMias();
          } catch { aviso('No se pudo borrar 😿'); }
        },
      }, '×'))) : [h('li', { class: 'gx-vacio' }, 'Todavía no le escribiste ninguna.')]));
  }
  pintarMias();

  function escribir() {
    const largo = datos.largos.frase;
    const capa = crearEncima({ clase: 'gx-escribir', etiqueta: `Escribirle a ${pareja.nombre}` });
    const area = h('textarea', { class: 'gx-campo', maxlength: String(largo), rows: '4', placeholder: `Algo bonito para ${pareja.nombre}… (va a salir en su frasco)` });
    const cuenta = h('span', { class: 'gx-cuenta' }, `0/${largo}`);
    area.addEventListener('input', () => { cuenta.textContent = `${area.value.length}/${largo}`; });
    const mandar = h('button', { type: 'button', class: 'gx-boton dorado' }, 'Meterla al frasco ✨');
    const hoja = h('div', { class: 'gx-hoja-oscura gx-papelito' },
      h('h3', { class: 'gx-hoja-titulo' }, `Una estrellita para ${pareja.nombre}`),
      area, cuenta,
      h('div', { class: 'gx-fila' }, h('button', { type: 'button', class: 'gx-boton blanco', onclick: () => capa.cerrar() }, 'Cancelar'), mandar));
    capa.el.append(hoja);
    setTimeout(() => area.focus(), 300);
    mandar.addEventListener('click', async () => {
      const texto = area.value.trim();
      if (!texto) { area.focus(); return; }
      mandar.disabled = true;
      try {
        const { frase } = await api.guardarFrase(texto);
        datos.frases.mias.unshift({ id: frase.id, texto: frase.texto, creado: new Date().toISOString() });
        pintarMias();
        if (!quieto()) {
          hoja.classList.add('doblandose');
          await new Promise((ok) => { setTimeout(ok, 700); });
        }
        const r = hoja.getBoundingClientRect();
        chispitas(r.left + r.width / 2, r.top + r.height / 2, { cantidad: 14, lejos: 90 });
        fiu({ desde: 500, hasta: 1800, duracion: 0.8, volumen: 0.09 });
        capa.cerrar();
        aviso(`💫 Tu estrellita ya está en el frasco de ${pareja.nombre}`);
      } catch (e) {
        mandar.disabled = false;
        aviso(e.message === 'texto_invalido' ? 'Escribe algo cortito (y bonito) 💛' : 'No se pudo mandar 😿 Revisa tu conexión.');
      }
    });
  }

  // fuentes listas para la etiqueta del frasco
  if (document.fonts && document.fonts.load) document.fonts.load('700 17px Caveat').then(despertar).catch(() => {});
  pop({ alto: 0.9, volumen: 0.1 });
}
