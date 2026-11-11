// La animación de inicio de la galaxia (solo la primera vez que se entra): el cielo
// oscuro se va llenando de estrellitas y aparece un mensaje, frase por frase, palabra
// por palabra (los textos están en textos.js, INICIO). La última frase queda en dorado
// con la firma; después las estrellas salen volando, como si entraras al cielo, y
// aparece la galaxia (ahí empieza la música). Tocar la pantalla adelanta; "Saltar" la
// termina.

import { h } from '../ui.js';
import { campanita, arpegio } from './sonido.js';
import { chispitas, quieto, azar } from './marco.js';

const POR_PALABRA = 90; // ms entre palabra y palabra

export function animacionDeInicio(raiz, { frases, firma, nota = null }) {
  return new Promise((listo) => {
    const lienzo = h('canvas', { class: 'gx-inicio-cielo', 'aria-hidden': 'true' });
    const texto = h('p', { class: 'gx-inicio-texto' });
    const pieFirma = h('p', { class: 'gx-inicio-firma' }, firma);
    const saltar = h('button', { type: 'button', class: 'gx-inicio-saltar' }, 'Saltar');
    const el = h('div', { class: 'gx-inicio', role: 'dialog', 'aria-label': 'Un mensaje para ti' },
      lienzo,
      nota && h('p', { class: 'gx-inicio-nota' }, nota),
      h('div', { class: 'gx-inicio-centro', 'aria-live': 'polite' }, texto, pieFirma),
      h('p', { class: 'gx-inicio-pista', 'aria-hidden': 'true' }, 'toca para seguir'),
      saltar);
    raiz.append(el);

    // ---- el cielo: estrellas que van apareciendo y, al final, salen volando
    const c = lienzo.getContext('2d');
    let ancho = 1;
    let alto = 1;
    let dpr = 1;
    const estrellas = Array.from({ length: 180 }, () => ({
      x: azar(-1, 1), y: azar(-1, 1), z: azar(0.35, 1), f: azar(0, 6.3), aparece: azar(0, 3.2), tam: azar(0.5, 1.6),
      color: ['#eef3ff', '#ffffff', '#ffe9f6', '#dfe7ff', '#fff4d6'][Math.floor(Math.random() * 5)],
    }));
    function ajustar() {
      ancho = Math.max(1, el.clientWidth);
      alto = Math.max(1, el.clientHeight);
      dpr = Math.min(2, window.devicePixelRatio || 1);
      lienzo.width = Math.round(ancho * dpr);
      lienzo.height = Math.round(alto * dpr);
    }
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(el);
    const t0 = performance.now();
    let vuelo = 0;
    let cuadro = 0;
    function dibujar(ahora) {
      cuadro = requestAnimationFrame(dibujar);
      const t = (ahora - t0) / 1000;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, ancho, alto);
      const cx = ancho / 2;
      const cy = alto * 0.46;
      const escala = Math.max(ancho, alto) * 0.42;
      for (const s of estrellas) {
        if (vuelo > 0) {
          s.z -= vuelo * 0.016;
          if (s.z < 0.04) { s.z = 1; s.x = azar(-1, 1); s.y = azar(-1, 1); s.aparece = -9; }
        }
        const k = Math.min(1, Math.max(0, (t - s.aparece) / 1.6));
        const px = cx + (s.x / s.z) * escala;
        const py = cy + (s.y / s.z) * escala;
        const r = s.tam * (1.25 - s.z) * 1.7 + 0.25;
        c.globalAlpha = k * (0.4 + 0.6 * Math.abs(Math.sin(t * 1.1 + s.f)));
        if (vuelo > 0) {
          const z2 = s.z + vuelo * 0.06;
          c.strokeStyle = s.color;
          c.lineWidth = r;
          c.beginPath();
          c.moveTo(cx + (s.x / z2) * escala, cy + (s.y / z2) * escala);
          c.lineTo(px, py);
          c.stroke();
        }
        c.fillStyle = s.color;
        c.beginPath();
        c.arc(px, py, r, 0, Math.PI * 2);
        c.fill();
      }
      c.globalAlpha = 1;
    }
    cuadro = requestAnimationFrame(dibujar);

    // ---- las frases
    let i = -1;
    let reloj = null;
    let fin = false;
    let empezo = 0;
    function ponerPalabras(frase) {
      texto.replaceChildren(...frase.split(' ').map((p, k) => h('span', { class: 'gx-palabra', style: { '--k': String(k) } }, `${p} `)));
    }
    function siguiente() {
      clearTimeout(reloj);
      if (fin) return;
      i += 1;
      if (i >= frases.length) { terminar(); return; }
      const frase = frases[i];
      const ultima = i === frases.length - 1;
      const palabras = frase.split(' ').length;
      empezo = performance.now();
      texto.classList.remove('sale');
      texto.classList.toggle('ultima', ultima);
      texto.classList.toggle('nombre', i === 0 && Array.from(frase).length <= 16);
      ponerPalabras(frase);
      campanita([0, 2, 4, 5, 7][i % 5] + (ultima ? 4 : 0), { volumen: 0.09, duracion: 3.2 });
      const aparecer = palabras * POR_PALABRA + 900;
      if (ultima) {
        reloj = setTimeout(() => {
          pieFirma.classList.add('visible');
          arpegio([4, 7, 9, 11], { separacion: 0.16, volumen: 0.08, duracion: 2.6 });
          reloj = setTimeout(terminar, 3800);
        }, aparecer + 500);
      } else {
        // se queda lo suficiente para leerla con calma
        reloj = setTimeout(salir, aparecer + 1500 + Array.from(frase).length * 38);
      }
    }
    function salir() {
      clearTimeout(reloj);
      texto.classList.add('sale');
      reloj = setTimeout(siguiente, 650);
    }
    function terminar() {
      if (fin) return;
      fin = true;
      clearTimeout(reloj);
      const r = texto.getBoundingClientRect();
      chispitas(r.left + r.width / 2, r.top + r.height / 2, { cantidad: 22, lejos: 170, tam: 16 });
      el.classList.add('termina');
      if (!quieto()) {
        const tv = performance.now();
        const acelerar = () => {
          const k = Math.min(1, (performance.now() - tv) / 1700);
          vuelo = k * k * 3.2;
          if (k < 1 && cuadro) requestAnimationFrame(acelerar);
        };
        acelerar();
      }
      setTimeout(() => el.classList.add('fuera'), 850);
      setTimeout(listo, 1000);
      setTimeout(() => { cancelAnimationFrame(cuadro); cuadro = 0; obs.disconnect(); el.remove(); }, 2200);
    }

    // tocar adelanta (pero no justo cuando una frase acaba de empezar a salir)
    el.addEventListener('click', (e) => {
      if (e.target === saltar || fin) return;
      if (performance.now() - empezo < 700) return;
      if (i === frases.length - 1) terminar(); else salir();
    });
    saltar.addEventListener('click', (e) => { e.stopPropagation(); terminar(); });
    setTimeout(siguiente, 900);
  });
}
