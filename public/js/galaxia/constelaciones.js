// Constelaciones: un juego tranquilo de unir estrellas. Eliges una figura de puntitos (no
// se sabe qué es hasta terminarla), y vas uniendo las estrellas en orden: la que sigue
// late. Se puede arrastrar el dedo de estrella en estrella o tocarlas una por una. Cada
// estrella suena como una cajita de música. Al terminar se revela qué era y su frase, y
// la constelación se queda brillando en el cielo de la galaxia.

import { api } from '../api.js';
import { h, aviso, svg } from '../ui.js';
import { crearPanel, chispitas, escribir, azar, quieto } from './marco.js';
import { CONSTELACIONES } from './textos.js';
import { campanita, arpegio, fiu, NOTAS } from './sonido.js';

const MELODIA = [0, 2, 4, 7, 4, 2, 4, 7, 9, 7, 4, 7, 9, 11, 9, 7, 4, 2];

function miniatura(def, completa) {
  const lineas = completa
    ? def.trazos.map((t) => `<polyline points="${t.map((i) => `${(def.puntos[i][0] * 100).toFixed(1)},${(def.puntos[i][1] * 100).toFixed(1)}`).join(' ')}" fill="none" stroke="#ffe39a" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round" opacity=".85"/>`).join('')
    : '';
  const puntos = def.puntos.map(([x, y]) => `<circle cx="${(x * 100).toFixed(1)}" cy="${(y * 100).toFixed(1)}" r="${completa ? 2.6 : 2.2}" fill="#fff"/>`).join('');
  return svg(`<svg class="gx-mini-constelacion" viewBox="-8 -8 116 116" aria-hidden="true">${lineas}${puntos}</svg>`);
}

export function abrir(ctx) {
  const { datos, desde, alCambiar, alCerrar } = ctx;
  let soltarJuego = null;
  const panel = crearPanel({
    clase: 'gx-panel-constelaciones', titulo: 'Constelaciones', desde,
    alCerrar: () => { if (soltarJuego) soltarJuego(); alCerrar(); },
  });
  const hechas = () => new Set(datos.datos.constelaciones || []);

  // ---------------------------------------------------------------- la lista
  function lista() {
    if (soltarJuego) { soltarJuego(); soltarJuego = null; }
    const listas = hechas();
    panel.cuerpo.replaceChildren(
      h('p', { class: 'gx-intro' }, 'Une las estrellas y descubre qué dibujo esconde cada constelación ✨'),
      h('p', { class: 'gx-progreso' }, `${listas.size} de ${CONSTELACIONES.length} descubiertas`),
      h('ul', { class: 'gx-constelaciones' }, CONSTELACIONES.map((def) => {
        const ya = listas.has(def.id);
        return h('li', null, h('button', {
          type: 'button', class: `gx-constelacion ${ya ? 'hecha' : ''}`,
          'aria-label': ya ? `${def.nombre} (ya la descubriste)` : 'Una constelación por descubrir',
          onclick: () => jugar(def),
        }, miniatura(def, ya), h('span', { class: 'gx-constelacion-nombre' }, ya ? `${def.emoji} ${def.nombre}` : '¿ ? ?')));
      })));
  }

  // ---------------------------------------------------------------- el juego
  function jugar(def) {
    campanita(4, { volumen: 0.12 });
    const lienzo = h('canvas', { class: 'gx-cielo-juego', 'aria-label': 'El cielo. Une las estrellas en orden, empezando por la que late.' });
    const pista = h('p', { class: 'gx-pista', 'aria-live': 'polite' }, 'Empieza por la estrella que late ✨');
    const revelado = h('div', { class: 'gx-revelado', hidden: true });
    const zona = h('div', { class: 'gx-juego-zona' }, lienzo, pista, revelado);
    panel.cuerpo.replaceChildren(
      h('div', { class: 'gx-juego-barra' },
        h('button', { type: 'button', class: 'gx-boton blanco chico', onclick: lista }, '‹ Otras constelaciones')),
      zona);

    // los segmentos en orden; `salto` = el trazo empieza en otra estrella (sin línea)
    const plan = [];
    def.trazos.forEach((t, k) => {
      for (let i = 1; i < t.length; i += 1) plan.push({ a: t[i - 1], b: t[i], salto: i === 1 && k > 0 });
    });
    let paso = 0;
    let actual = plan[0].a;
    const unidas = [];
    let terminado = false;
    let nota = 0;

    const c = lienzo.getContext('2d');
    let ancho = 300;
    let alto = 300;
    let dpr = 1;
    let caja = { x: 0, y: 0, lado: 1 };
    const fondo = Array.from({ length: 110 }, () => ({ x: Math.random(), y: Math.random(), r: azar(0.4, 1.4), f: azar(0, 6.3), v: azar(0.6, 2) }));
    const destellos = [];
    function ajustar() {
      const r = { width: zona.clientWidth, height: zona.clientHeight }; // (sin la escala de la animación de apertura)
      ancho = Math.max(200, r.width);
      alto = Math.max(240, r.height);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
      lienzo.style.width = `${ancho}px`;
      lienzo.style.height = `${alto}px`;
      const lado = Math.min(ancho, alto - 70) * 0.84;
      caja = { x: (ancho - lado) / 2, y: (alto - lado) / 2 - 10, lado };
    }
    const obs = new ResizeObserver(ajustar);
    obs.observe(zona);
    ajustar();
    const P = (i) => ({ x: caja.x + def.puntos[i][0] * caja.lado, y: caja.y + def.puntos[i][1] * caja.lado });

    // ---- tocar y arrastrar
    let dedo = null;
    const cerca = (p, q, r) => Math.hypot(p.x - q.x, p.y - q.y) < r;
    function punto(e) {
      const r = lienzo.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    function intentar(p, radio) {
      if (terminado) return;
      const seg = plan[paso];
      if (!cerca(p, P(seg.b), radio)) return;
      unir();
    }
    function unir() {
      const seg = plan[paso];
      unidas.push({ a: seg.a, b: seg.b, t: performance.now() });
      actual = seg.b;
      const q = P(seg.b);
      destellos.push({ x: q.x, y: q.y, t: performance.now() });
      const n = MELODIA[nota % MELODIA.length] + (Math.floor(nota / MELODIA.length) % 2 ? 2 : 0);
      campanita(Math.min(NOTAS - 1, n), { volumen: 0.2, duracion: 2.4 });
      nota += 1;
      if (navigator.vibrate) navigator.vibrate(5);
      pista.classList.add('fuera');
      paso += 1;
      if (paso >= plan.length) { terminar(); return; }
      if (plan[paso].salto) {
        // el trazo siguiente empieza en otra estrella: la luz salta hasta allá
        actual = plan[paso].a;
        const s = P(actual);
        setTimeout(() => { destellos.push({ x: s.x, y: s.y, t: performance.now() }); fiu({ desde: 700, hasta: 1300, duracion: 0.25, volumen: 0.05 }); }, 120);
      }
    }
    lienzo.addEventListener('pointerdown', (e) => {
      if (terminado) return;
      const p = punto(e);
      try { lienzo.setPointerCapture(e.pointerId); } catch { /* nada */ }
      // tocar la estrella que sigue también vale
      intentar(p, 34);
      dedo = cerca(p, P(actual), 44) ? p : { ...p, suelto: true };
    });
    lienzo.addEventListener('pointermove', (e) => {
      if (!dedo || terminado) return;
      const p = punto(e);
      dedo = { ...p, suelto: dedo.suelto };
      if (!dedo.suelto) intentar(p, 28);
      else if (cerca(p, P(actual), 30)) dedo.suelto = false;
    });
    const soltar = () => { dedo = null; };
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);

    // ---- terminar
    async function terminar() {
      terminado = true;
      dedo = null;
      const t0 = performance.now();
      fin = t0;
      arpegio([0, 2, 4, 7, 9, 11], { separacion: 0.1, volumen: 0.18 });
      const nueva = !hechas().has(def.id);
      if (nueva) {
        datos.datos.constelaciones = [...(datos.datos.constelaciones || []), def.id];
        api.datoGalaxia('constelaciones', datos.datos.constelaciones).catch(() => aviso('No se pudo guardar la constelación 😿'));
        alCambiar({ constelacion: def.id });
      }
      await new Promise((ok) => { setTimeout(ok, quieto() ? 200 : 1500); });
      const r = zona.getBoundingClientRect();
      chispitas(r.left + r.width / 2, r.top + r.height * 0.42, { cantidad: 18, lejos: 130, tam: 16 });
      const frase = h('p', { class: 'gx-revelado-frase' });
      revelado.replaceChildren(
        h('p', { class: 'gx-revelado-emoji', 'aria-hidden': 'true' }, def.emoji),
        h('h3', { class: 'gx-revelado-nombre' }, def.nombre),
        frase,
        h('div', { class: 'gx-fila' },
          h('button', { type: 'button', class: 'gx-boton blanco', onclick: lista }, 'Otra constelación'),
          h('button', { type: 'button', class: 'gx-boton dorado', onclick: () => panel.cerrar() }, 'Volver al cielo')),
        nueva && h('p', { class: 'gx-revelado-nota' }, '✨ Ahora brilla en tu cielo'));
      revelado.hidden = false;
      requestAnimationFrame(() => revelado.classList.add('visible'));
      escribir(frase, def.frase, { velocidad: 34 });
    }

    // ---- dibujar
    let fin = 0;
    let cuadro = 0;
    function dibujar(ahora) {
      cuadro = requestAnimationFrame(dibujar);
      const t = ahora / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, ancho, alto);
      for (const s of fondo) {
        c.globalAlpha = 0.25 + 0.35 * Math.abs(Math.sin(t * s.v + s.f));
        c.fillStyle = '#dfe8ff';
        c.beginPath();
        c.arc(s.x * ancho, s.y * alto, s.r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
      // la figura completa brilla al final
      const kFin = fin ? Math.min(1, (ahora - fin) / 1400) : 0;
      if (kFin > 0) {
        c.save();
        c.globalAlpha = 0.18 * kFin;
        c.fillStyle = '#9fb8ff';
        c.filter = 'blur(18px)';
        c.beginPath();
        for (const u of unidas) { const a = P(u.a); const b = P(u.b); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); }
        c.lineWidth = 26;
        c.strokeStyle = '#a9c1ff';
        c.stroke();
        c.restore();
      }
      // las líneas unidas
      c.lineCap = 'round';
      for (const u of unidas) {
        const a = P(u.a);
        const b = P(u.b);
        const k = Math.min(1, (ahora - u.t) / 220);
        const x = a.x + (b.x - a.x) * k;
        const y = a.y + (b.y - a.y) * k;
        c.strokeStyle = `rgba(150,180,255,${0.22 + kFin * 0.2})`;
        c.lineWidth = 9;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(x, y); c.stroke();
        c.strokeStyle = kFin > 0 ? `rgba(255,236,170,${0.85 + 0.15 * Math.sin(t * 4)})` : 'rgba(236,243,255,.92)';
        c.lineWidth = 2.6;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(x, y); c.stroke();
      }
      // la línea que sigue al dedo
      if (dedo && !dedo.suelto && !terminado) {
        const a = P(actual);
        c.setLineDash([5, 7]);
        c.strokeStyle = 'rgba(220,232,255,.55)';
        c.lineWidth = 2;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(dedo.x, dedo.y); c.stroke();
        c.setLineDash([]);
      }
      // las estrellas de la constelación
      const siguiente = !terminado ? plan[paso].b : -1;
      def.puntos.forEach((_, i) => {
        const p = P(i);
        const tocada = unidas.some((u) => u.a === i || u.b === i) || i === actual;
        const late = i === siguiente;
        const base = tocada ? 4.2 : 3.2;
        const r = base + (late ? 1.4 + Math.sin(t * 5) * 1.1 : 0) + (kFin ? Math.sin(t * 3 + i) * 0.8 : 0);
        const g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 4.5);
        g.addColorStop(0, tocada || kFin ? 'rgba(255,240,200,.9)' : 'rgba(220,230,255,.7)');
        g.addColorStop(1, 'rgba(160,180,255,0)');
        c.fillStyle = g;
        c.beginPath(); c.arc(p.x, p.y, r * 4.5, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#ffffff';
        c.beginPath(); c.arc(p.x, p.y, r, 0, Math.PI * 2); c.fill();
        if (late) {
          c.strokeStyle = `rgba(255,226,140,${0.5 + 0.4 * Math.sin(t * 5)})`;
          c.lineWidth = 2;
          c.beginPath(); c.arc(p.x, p.y, 15 + Math.sin(t * 5) * 4, 0, Math.PI * 2); c.stroke();
        }
      });
      // destellos al unir
      for (let i = destellos.length - 1; i >= 0; i -= 1) {
        const d = destellos[i];
        const k = (ahora - d.t) / 600;
        if (k >= 1) { destellos.splice(i, 1); continue; }
        c.strokeStyle = `rgba(255,240,190,${1 - k})`;
        c.lineWidth = 2;
        c.beginPath(); c.arc(d.x, d.y, 6 + k * 26, 0, Math.PI * 2); c.stroke();
      }
    }
    cuadro = requestAnimationFrame(dibujar);
    soltarJuego = () => { cancelAnimationFrame(cuadro); obs.disconnect(); };
  }

  lista();
}
