// Prueba del servidor: npm test
// Usa una base SQLite temporal; no toca tus datos ni tu base de Turso.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const sharp = require('sharp');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'garabatos-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(carpeta, 'prueba.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SECRETO = 'secreto-de-prueba-secreto-de-prueba';
process.env.PIN_UNO = '111111';
process.env.PIN_DOS = '222222';

const server = require('../server');
const { base } = server;
const F = require('../lib/fecha');
const { temaDelDia } = require('../lib/tema-del-dia');
const config = require('../config');

let ok = 0;
const paso = (nombre) => { ok += 1; console.log(`  ✓ ${nombre}`); };

// Un dibujo de prueba: 720 x 960 con unas formas de colores (se manda como PNG).
async function dibujo({ ancho = 720, alto = 960, formato = 'png', color = '#ff8a3d' } = {}) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <rect width="100%" height="100%" fill="#fffdf7"/>
    <circle cx="${ancho / 2}" cy="${alto / 2}" r="${ancho / 3}" fill="${color}"/>
    <path d="M60 80 L${ancho - 60} ${alto - 90}" stroke="#3d8bff" stroke-width="14" stroke-linecap="round"/>
    <path d="M${ancho / 2} 120 l30 70 l-70 -45 h80 l-70 45z" fill="#ffd23f"/></svg>`;
  const buf = await sharp(Buffer.from(svg))[formato]().toBuffer();
  return `data:image/${formato};base64,${buf.toString('base64')}`;
}

(async () => {
  const servidor = server.app.listen(0);
  const raiz = `http://127.0.0.1:${servidor.address().port}`;

  async function pedir(metodo, ruta, { cookie, cuerpo } = {}) {
    const r = await fetch(raiz + ruta, {
      method: metodo,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined,
    });
    const tipo = r.headers.get('content-type') || '';
    const datos = tipo.includes('json') ? await r.json() : Buffer.from(await r.arrayBuffer());
    return { estado: r.status, datos, cabeceras: r.headers };
  }
  async function entrar(id, pin) {
    const r = await pedir('POST', '/api/entrar', { cuerpo: { id, pin } });
    const c = r.cabeceras.get('set-cookie');
    return { ...r, cookie: c ? c.split(';')[0] : null };
  }

  try {
    const hoy = F.claveDeHoy(config.zonaHoraria);
    const ayer = F.sumarDias(hoy, -1);

    console.log('Acceso');
    assert.equal((await pedir('GET', '/api/hoy')).estado, 401); paso('sin sesión no se entra');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/uno`)).estado, 401);
    assert.equal((await pedir('GET', `/api/mes/${hoy.slice(0, 7)}`)).estado, 401); paso('imágenes y calendario también piden sesión');
    const lista = await pedir('GET', '/api/cuentas');
    assert.equal(lista.datos.cuentas.length, 2);
    assert.equal(lista.datos.cuentas[0].largoPin, 6);
    assert.ok(!JSON.stringify(lista.datos).includes('111111')); paso('la lista de cuentas no revela PIN');
    assert.equal((await entrar('uno', '999999')).estado, 401); paso('PIN incorrecto rechazado');
    const A = await entrar('uno', '111111');
    const B = await entrar('dos', '222222');
    assert.ok(A.cookie && B.cookie); paso('las dos cuentas entran');
    assert.equal((await pedir('GET', '/api/hoy', { cookie: 'garabatos=uno.9999999999999.firmafalsa' })).estado, 401); paso('cookie falsificada rechazada');

    console.log('Tema del día');
    const hA = (await pedir('GET', '/api/hoy', { cookie: A.cookie })).datos;
    const hB = (await pedir('GET', '/api/hoy', { cookie: B.cookie })).datos;
    assert.equal(hA.tema, hB.tema);
    assert.equal(hA.tema, temaDelDia(hoy)); paso(`el mismo tema para las dos, siempre: "${hA.tema}"`);
    const unAnio = new Set();
    for (let d = 0; d < 200; d += 1) unAnio.add(temaDelDia(F.sumarDias('2027-01-01', d)));
    assert.equal(unAnio.size, 200); paso('200 días seguidos sin repetir tema');
    assert.deepEqual([hA.yoListo, hA.parejaListo, hA.racha], [false, false, 0]);

    console.log('Terminar un dibujo');
    const png = await dibujo();
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: 'data:image/png;base64,AAAA' } })).estado, 400); paso('una imagen falsa se rechaza');
    const mentirosa = `data:image/png;base64,${Buffer.from('esto no es una imagen').toString('base64')}`;
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: mentirosa } })).estado, 400); paso('un texto disfrazado de PNG se rechaza');
    const ancha = await dibujo({ ancho: 900, alto: 600 });
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: ancha } })).estado, 400); paso('una imagen que no es 3:4 se rechaza');
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: F.sumarDias(hoy, -3), imagen: png } })).estado, 400); paso('un día de hace 3 días ya no acepta dibujos');
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: F.sumarDias(hoy, 1), imagen: png } })).estado, 400); paso('tampoco uno del futuro');

    // B termina primero (y manda dos veces a la vez: solo uno se guarda)
    const jpg = await dibujo({ formato: 'jpeg', color: '#8f5cff' });
    const webp = await dibujo({ formato: 'webp', color: '#4cc26b' });
    const [r1, r2] = await Promise.all([
      pedir('POST', '/api/terminar', { cookie: B.cookie, cuerpo: { fecha: hoy, imagen: jpg } }),
      pedir('POST', '/api/terminar', { cookie: B.cookie, cuerpo: { fecha: hoy, imagen: webp } }),
    ]);
    assert.deepEqual([r1.estado, r2.estado].sort(), [200, 409]); paso('dos envíos a la vez: uno se guarda y el otro se rechaza');
    assert.equal(await base.contar(), 1);

    console.log('Quién ve qué');
    const antesA = (await pedir('GET', '/api/hoy', { cookie: A.cookie })).datos;
    assert.deepEqual([antesA.yoListo, antesA.parejaListo, antesA.parejaV], [false, true, null]); paso('A sabe que B ya terminó, pero todavía no recibe su dibujo');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/dos`, { cookie: A.cookie })).estado, 403); paso('el servidor no entrega el dibujo de B hasta que A termine el suyo');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/dos?mini=1`, { cookie: A.cookie })).estado, 403);
    const mesAntes = (await pedir('GET', `/api/mes/${hoy.slice(0, 7)}`, { cookie: A.cookie })).datos.dias.find((d) => d.fecha === hoy);
    assert.deepEqual([mesAntes.yo, mesAntes.pareja.visible, mesAntes.pareja.mini], [null, false, null]); paso('ni el calendario lo filtra');

    const t = await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } });
    assert.equal(t.estado, 200);
    assert.ok(t.datos.bytes < 40 * 1024, `pesa ${t.datos.bytes}`); paso(`A termina: su dibujo quedó en ${(t.datos.bytes / 1024).toFixed(1)} KB`);
    assert.equal((await pedir('GET', '/api/hoy', { cookie: B.cookie })).datos.parejaV !== null, true);
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } })).estado, 409); paso('terminar es definitivo (no se puede volver a guardar)');

    const ahora = (await pedir('GET', '/api/hoy', { cookie: A.cookie })).datos;
    assert.ok(ahora.yoListo && ahora.parejaListo && ahora.parejaV && ahora.racha === 1); paso('al terminar los dos: se ven, y la racha es 1');
    const img = await pedir('GET', `/api/dibujo/${hoy}/dos`, { cookie: A.cookie });
    assert.equal(img.estado, 200);
    assert.equal(img.cabeceras.get('content-type'), 'image/webp');
    assert.match(img.cabeceras.get('cache-control'), /immutable/);
    const meta = await sharp(img.datos).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ['webp', 720, 960]); paso('la imagen sale como WebP de 720 x 960');
    const mini = await sharp((await pedir('GET', `/api/dibujo/${hoy}/dos?mini=1`, { cookie: A.cookie })).datos).metadata();
    assert.deepEqual([mini.width, mini.height], [150, 200]); paso('y la miniatura de 150 x 200');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/uno`, { cookie: B.cookie })).estado, 200);

    // Un día que ya pasó, donde solo dibujó B
    await base.insertarCrudo({ fecha: ayer, quien: 'dos', imagen: Buffer.from('x'), mini: Buffer.from('y') });
    assert.equal((await pedir('GET', `/api/dibujo/${ayer}/dos`, { cookie: A.cookie })).estado, 200); paso('en un día que ya pasó se ve el dibujo de la pareja aunque uno no dibujara');
    assert.equal((await pedir('GET', `/api/dibujo/${ayer}/uno`, { cookie: B.cookie })).estado, 404); paso('si la pareja no dibujó ese día: 404 (la app muestra la carita triste)');

    console.log('Calendario');
    const mes = (await pedir('GET', `/api/mes/${hoy.slice(0, 7)}`, { cookie: A.cookie })).datos;
    const dHoy = mes.dias.find((d) => d.fecha === hoy);
    assert.ok(dHoy.yo.mini.startsWith('data:image/webp;base64,') && dHoy.pareja.visible && dHoy.pareja.mini); paso('el mes trae los dos dibujos de hoy, con miniaturas');
    assert.equal(mes.dias.find((d) => d.fecha === ayer).pareja.visible, true);
    assert.ok(mes.dias.every((d) => d.futuro ? d.tema === null : typeof d.tema === 'string')); paso('los días futuros no muestran tema');
    assert.ok(JSON.stringify(mes).length < 400_000); paso(`un mes entero pesa ${(JSON.stringify(mes).length / 1024).toFixed(0)} KB`);
    assert.equal((await pedir('GET', '/api/mes/2019-05', { cookie: A.cookie })).estado, 400);

    console.log('Año nuevo');
    const anioPasado = F.anioDe(hoy) - 1;
    await base.insertarCrudo({ fecha: `${anioPasado}-12-31`, quien: 'uno', imagen: Buffer.from('x'), mini: Buffer.from('y') });
    await base.insertarCrudo({ fecha: `${anioPasado}-06-15`, quien: 'dos', imagen: Buffer.from('x'), mini: Buffer.from('y') });
    const antes = await base.contar();
    server.reiniciarRevisionDeAnio();
    await pedir('GET', '/api/yo', { cookie: A.cookie });
    assert.equal(await base.contar(), antes - 2); paso('al empezar el año se borra lo del año anterior…');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/uno`, { cookie: A.cookie })).estado, 200); paso('…y lo de este año se queda');

    console.log('Protección de PIN');
    for (let i = 0; i < 5; i += 1) await entrar('dos', '000000');
    assert.equal((await entrar('dos', '222222')).estado, 429); paso('tras 5 fallos se bloquea un rato');

    console.log(`\nTodo bien: ${ok} comprobaciones.`);
  } catch (err) {
    console.error('\n✗ Falló:', err.stack || err.message);
    process.exitCode = 1;
  } finally {
    servidor.close();
    await base.cerrar();
    fs.rmSync(carpeta, { recursive: true, force: true });
  }
})();
