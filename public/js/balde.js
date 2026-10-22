// El balde: rellena la zona que tocaste, sin salirse de las líneas.
//
// Trabaja sobre los píxeles del lienzo (ImageData) en cinco pasos:
//   1. "Muros": todo píxel que se aleja del color tocado más que la tolerancia es línea.
//   2. Huequitos: los muros se engordan unos píxeles para que, si una figura hecha a mano
//      quedó casi cerrada, el relleno no se escape por la rendija.
//   3. Se inunda la zona desde el punto tocado (sin cruzar muros engordados).
//   4. La zona vuelve a crecer esos mismos píxeles, de a uno y solo por donde no hay
//      línea, para llegar justo hasta el borde (sin saltar líneas finas).
//   5. Orillas: los píxeles suavizados del borde de la línea (mitad línea, mitad fondo)
//      se recolorean "por debajo": se cambia solo la parte de fondo. Así no queda la
//      orillita blanca típica y la línea no se adelgaza ni se borra.
//
// Es determinista: el mismo dibujo y el mismo toque dan siempre el mismo resultado, por
// eso deshacer/rehacer puede repetir el relleno sin guardar la imagen.

const TOLERANCIA = 26; // de 0 a 255, en el canal que más cambie
const HUECO = 3;       // radio (en píxeles del lienzo) de las rendijas que se cierran solas

export function hexARgb(hex) {
  const n = parseInt(String(hex).replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Engorda una máscara: cada 1 se vuelve un cuadrado de lado 2k+1 (en dos pasadas).
function engordar(m, W, H, k) {
  const tmp = new Uint8Array(W * H);
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    const fila = y * W;
    let cuenta = 0;
    for (let x = 0; x < k && x < W; x += 1) cuenta += m[fila + x];
    for (let x = 0; x < W; x += 1) {
      if (x + k < W) cuenta += m[fila + x + k];
      if (x - k - 1 >= 0) cuenta -= m[fila + x - k - 1];
      tmp[fila + x] = cuenta > 0 ? 1 : 0;
    }
  }
  for (let x = 0; x < W; x += 1) {
    let cuenta = 0;
    for (let y = 0; y < k && y < H; y += 1) cuenta += tmp[y * W + x];
    for (let y = 0; y < H; y += 1) {
      if (y + k < H) cuenta += tmp[(y + k) * W + x];
      if (y - k - 1 >= 0) cuenta -= tmp[(y - k - 1) * W + x];
      out[y * W + x] = cuenta > 0 ? 1 : 0;
    }
  }
  return out;
}

// Inundación por renglones desde (sx, sy): marca con 1 en `zona` todo lo alcanzable sin
// pasar por `bloqueo`. Devuelve el rectángulo que ocupa.
function inundar(bloqueo, zona, W, H, sx, sy) {
  const caja = { x0: sx, y0: sy, x1: sx, y1: sy };
  const pila = [sy * W + sx];
  while (pila.length) {
    const i = pila.pop();
    if (zona[i] || bloqueo[i]) continue;
    const y = (i / W) | 0;
    const fila = y * W;
    let izq = i - fila;
    let der = izq;
    while (izq > 0 && !zona[fila + izq - 1] && !bloqueo[fila + izq - 1]) izq -= 1;
    while (der < W - 1 && !zona[fila + der + 1] && !bloqueo[fila + der + 1]) der += 1;
    for (let x = izq; x <= der; x += 1) zona[fila + x] = 1;
    if (izq < caja.x0) caja.x0 = izq;
    if (der > caja.x1) caja.x1 = der;
    if (y < caja.y0) caja.y0 = y;
    if (y > caja.y1) caja.y1 = y;
    for (const vy of [y - 1, y + 1]) {
      if (vy < 0 || vy >= H) continue;
      const vf = vy * W;
      let enTramo = false;
      for (let x = izq; x <= der; x += 1) {
        const libre = !zona[vf + x] && !bloqueo[vf + x];
        if (libre && !enTramo) pila.push(vf + x);
        enTramo = libre;
      }
    }
  }
  return caja;
}

// Rellena `imagen` ({ data, width, height }) desde (x, y) con el color [r, g, b].
// Modifica imagen.data y devuelve el rectángulo cambiado { x, y, w, h }, o null si no
// había nada que cambiar (por ejemplo, la zona ya era de ese color).
export function rellenar(imagen, x, y, [fr, fg, fb], { tolerancia = TOLERANCIA, hueco = HUECO } = {}) {
  const { data: d, width: W, height: H } = imagen;
  const sx = Math.min(W - 1, Math.max(0, Math.round(x)));
  const sy = Math.min(H - 1, Math.max(0, Math.round(y)));
  const s = (sy * W + sx) * 4;
  const sr = d[s]; const sg = d[s + 1]; const sb = d[s + 2];
  if (Math.max(Math.abs(sr - fr), Math.abs(sg - fg), Math.abs(sb - fb)) <= 2) return null;

  const n = W * H;
  // 1. muros, y qué tan lejos está cada píxel del color tocado
  const muro = new Uint8Array(n);
  const lejania = new Uint8Array(n);
  for (let i = 0, p = 0; i < n; i += 1, p += 4) {
    const dist = Math.max(Math.abs(d[p] - sr), Math.abs(d[p + 1] - sg), Math.abs(d[p + 2] - sb));
    lejania[i] = dist;
    if (dist > tolerancia) muro[i] = 1;
  }

  // 2. y 3. inundar sin pasar por los muros engordados (si tocaste muy pegado a una
  // línea, sin engordar: si no, no se podría rellenar nada ahí)
  let bloqueo = muro;
  if (hueco > 0) {
    const gordo = engordar(muro, W, H, hueco);
    if (!gordo[sy * W + sx]) bloqueo = gordo;
  }
  const zona = new Uint8Array(n);
  const caja = inundar(bloqueo, zona, W, H, sx, sy);

  // 4. volver a crecer, de a un píxel y solo por donde no hay línea
  const pasos = bloqueo === muro ? 0 : hueco * 2;
  if (pasos) {
    let frontera = [];
    for (let yy = caja.y0; yy <= caja.y1; yy += 1) {
      for (let xx = caja.x0; xx <= caja.x1; xx += 1) {
        const i = yy * W + xx;
        if (zona[i] && ((xx > 0 && !zona[i - 1] && !muro[i - 1]) || (xx < W - 1 && !zona[i + 1] && !muro[i + 1])
          || (yy > 0 && !zona[i - W] && !muro[i - W]) || (yy < H - 1 && !zona[i + W] && !muro[i + W]))) frontera.push(i);
      }
    }
    for (let k = 0; k < pasos && frontera.length; k += 1) {
      const nueva = [];
      for (const i of frontera) {
        const yy = (i / W) | 0;
        const xx = i - yy * W;
        const vecinos = [xx > 0 ? i - 1 : -1, xx < W - 1 ? i + 1 : -1, yy > 0 ? i - W : -1, yy < H - 1 ? i + W : -1];
        for (const j of vecinos) {
          if (j >= 0 && !zona[j] && !muro[j]) {
            zona[j] = 1;
            nueva.push(j);
            const jy = (j / W) | 0;
            const jx = j - jy * W;
            if (jx < caja.x0) caja.x0 = jx;
            if (jx > caja.x1) caja.x1 = jx;
            if (jy < caja.y0) caja.y0 = jy;
            if (jy > caja.y1) caja.y1 = jy;
          }
        }
      }
      frontera = nueva;
    }
  }

  // 5. orillas: hasta 2 capas de píxeles de línea pegados a la zona
  const x0 = Math.max(0, caja.x0 - 2); const x1 = Math.min(W - 1, caja.x1 + 2);
  const y0 = Math.max(0, caja.y0 - 2); const y1 = Math.min(H - 1, caja.y1 + 2);
  const orilla = new Uint8Array(n);
  const capas = [[], []];
  const vecinos8 = (i, xx, yy, cada) => {
    for (let dy = -1; dy <= 1; dy += 1) {
      const vy = yy + dy;
      if (vy < 0 || vy >= H) continue;
      for (let dx = -1; dx <= 1; dx += 1) {
        const vx = xx + dx;
        if ((dx || dy) && vx >= 0 && vx < W) cada(vy * W + vx);
      }
    }
  };
  for (let yy = y0; yy <= y1; yy += 1) {
    for (let xx = x0; xx <= x1; xx += 1) {
      const i = yy * W + xx;
      if (!muro[i] || zona[i]) continue;
      let toca = false;
      vecinos8(i, xx, yy, (j) => { if (zona[j]) toca = true; });
      if (toca) { orilla[i] = 1; capas[0].push(i); }
    }
  }
  for (const i of capas[0]) {
    const yy = (i / W) | 0;
    vecinos8(i, i - yy * W, yy, (j) => { if (muro[j] && !zona[j] && !orilla[j]) { orilla[j] = 2; capas[1].push(j); } });
  }
  // Cuánto "fondo" tiene cada píxel de orilla: se compara con el píxel de línea más
  // fuerte de su alrededor (la tinta pura). Se calcula todo antes de escribir nada.
  const cambios = [];
  for (const i of [...capas[0], ...capas[1]]) {
    const yy = (i / W) | 0;
    let tinta = lejania[i];
    vecinos8(i, i - yy * W, yy, (j) => { if (muro[j] && !zona[j] && lejania[j] > tinta) tinta = lejania[j]; });
    const fondo = tinta > 0 ? 1 - lejania[i] / tinta : 0;
    if (fondo > 0.01) cambios.push(i, fondo);
  }

  // escribir: la zona con el color nuevo, y las orillas mezcladas
  for (let yy = caja.y0; yy <= caja.y1; yy += 1) {
    for (let xx = caja.x0; xx <= caja.x1; xx += 1) {
      const i = yy * W + xx;
      if (!zona[i]) continue;
      const p = i * 4;
      d[p] = fr; d[p + 1] = fg; d[p + 2] = fb; d[p + 3] = 255;
    }
  }
  for (let k = 0; k < cambios.length; k += 2) {
    const p = cambios[k] * 4;
    const f = cambios[k + 1];
    d[p] += f * (fr - sr);
    d[p + 1] += f * (fg - sg);
    d[p + 2] += f * (fb - sb);
  }
  return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
