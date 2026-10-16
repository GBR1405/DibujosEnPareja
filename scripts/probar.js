// Prueba del servidor: npm test
// Usa una base SQLite temporal; no toca tus datos ni tu base de Turso.

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const sharp = require('sharp');
const webpush = require('web-push');

const carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'garabatos-'));
process.env.TURSO_DATABASE_URL = `file:${path.join(carpeta, 'prueba.db')}`;
delete process.env.TURSO_AUTH_TOKEN;
process.env.SECRETO = 'secreto-de-prueba-secreto-de-prueba';
process.env.PIN_UNO = '111111';
process.env.PIN_DOS = '222222';
// Claves VAPID de verdad (se generan sin internet). Los avisos NO salen a internet:
// más abajo se cambia el envío por uno falso que solo los apunta.
const vapid = webpush.generateVAPIDKeys();
process.env.VAPID_PUBLIC_KEY = vapid.publicKey;
process.env.VAPID_PRIVATE_KEY = vapid.privateKey;
process.env.VAPID_SUBJECT = 'mailto:pruebas@garabatos.test';
process.env.CRON_SECRET = 'cron-de-prueba-cron-de-prueba';

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

// Envío de avisos falso: apunta cada intento y hace lo que diga `fallo` (nada, lanzar
// un error, o quedarse colgado).
const intentos = [];
let fallo = () => {};
server.avisos.usarEnviador(async (aparato, carga, opciones) => {
  intentos.push({ endpoint: aparato.endpoint, ...JSON.parse(carga), opciones });
  await fallo(aparato);
});
const EP = (nombre) => `https://push.ejemplo.com/${nombre}`;
const aparato = (nombre) => ({
  endpoint: EP(nombre),
  expirationTime: null,
  keys: { p256dh: crypto.randomBytes(65).toString('base64url'), auth: crypto.randomBytes(16).toString('base64url') },
});
const endpointsDe = async (quien) => (await base.aparatosDe(quien)).map((a) => a.endpoint).sort();

// Corre scripts/probar-sin-avisos.js en otro proceso, con otras variables de entorno.
function servidorAparte(env) {
  const db = path.join(carpeta, `aparte-${crypto.randomBytes(4).toString('hex')}.db`);
  const salida = execFileSync(process.execPath, [path.join(__dirname, 'probar-sin-avisos.js')], {
    env: { ...process.env, VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '', VAPID_SUBJECT: '', TURSO_DATABASE_URL: `file:${db}`, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  return JSON.parse(salida.trim().split('\n').pop());
}

(async () => {
  const servidor = server.app.listen(0);
  const raiz = `http://127.0.0.1:${servidor.address().port}`;

  async function pedir(metodo, ruta, { cookie, cuerpo, cabeceras } = {}) {
    const r = await fetch(raiz + ruta, {
      method: metodo,
      headers: { ...(cookie ? { Cookie: cookie } : {}), ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...cabeceras },
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

    console.log('Avisos: activar y desactivar');
    assert.equal((await pedir('GET', '/api/avisos/clave')).estado, 401);
    assert.equal((await pedir('GET', '/api/avisos/clave', { cookie: A.cookie })).datos.clave, vapid.publicKey); paso('la clave pública se entrega solo con sesión');
    assert.equal((await pedir('POST', '/api/avisos/activar', { cuerpo: aparato('x') })).estado, 401);
    const malos = [
      {},
      { ...aparato('x'), endpoint: 'http://push.ejemplo.com/sin-https' },
      { ...aparato('x'), endpoint: 'esto no es una dirección' },
      { endpoint: EP('x') },
      { endpoint: EP('x'), keys: { p256dh: aparato('x').keys.p256dh } },
      { endpoint: EP('x'), keys: { auth: aparato('x').keys.auth } },
      { endpoint: EP('x'), keys: { p256dh: '<script>', auth: 'abc' } },
    ];
    for (const malo of malos) {
      assert.equal((await pedir('POST', '/api/avisos/activar', { cookie: A.cookie, cuerpo: malo })).estado, 400, JSON.stringify(malo));
    }
    paso('activar exige https y las claves p256dh y auth');
    for (const [cookie, nombre] of [[A.cookie, 'uno-telefono'], [A.cookie, 'uno-ipad'], [B.cookie, 'dos-telefono'], [A.cookie, 'compartido']]) {
      assert.equal((await pedir('POST', '/api/avisos/activar', { cookie, cuerpo: aparato(nombre) })).estado, 200);
    }
    assert.deepEqual(await endpointsDe('uno'), [EP('compartido'), EP('uno-ipad'), EP('uno-telefono')]); paso('una persona puede tener varios aparatos');
    await pedir('POST', '/api/avisos/activar', { cookie: B.cookie, cuerpo: aparato('compartido') });
    assert.deepEqual(await endpointsDe('uno'), [EP('uno-ipad'), EP('uno-telefono')]);
    assert.deepEqual(await endpointsDe('dos'), [EP('compartido'), EP('dos-telefono')]); paso('si el mismo aparato entra con la otra cuenta, se pasa a esa cuenta (no se duplica)');
    await pedir('POST', '/api/avisos/desactivar', { cookie: A.cookie, cuerpo: { endpoint: EP('compartido') } });
    assert.ok((await endpointsDe('dos')).includes(EP('compartido')), 'A no debe poder borrar el aparato de B');
    await pedir('POST', '/api/avisos/desactivar', { cookie: B.cookie, cuerpo: { endpoint: EP('compartido') } });
    assert.deepEqual(await endpointsDe('dos'), [EP('dos-telefono')]); paso('desactivar borra solo el aparato propio');
    const otraVez = await entrar('uno', '111111');
    await pedir('POST', '/api/avisos/activar', { cookie: otraVez.cookie, cuerpo: aparato('uno-prestado') });
    const salida = await pedir('POST', '/api/salir', { cookie: otraVez.cookie, cuerpo: { endpoint: EP('uno-prestado') } });
    assert.equal(salida.estado, 200);
    assert.deepEqual(await endpointsDe('uno'), [EP('uno-ipad'), EP('uno-telefono')]); paso('al cerrar sesión, ese aparato deja de recibir avisos');
    assert.equal((await pedir('POST', '/api/salir')).estado, 200);

    console.log('Terminar un dibujo');
    intentos.length = 0;
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
    const [gabri, eli] = config.cuentas.map((c) => c.nombre);
    assert.deepEqual(intentos.map((i) => i.endpoint).sort(), [EP('uno-ipad'), EP('uno-telefono')]); paso('los envíos rechazados no avisan; el que se guardó avisa una sola vez, a todos los aparatos de la pareja');
    assert.ok(intentos.every((i) => i.titulo === `${eli} ya dibujó, ¡te toca! 🎨` && i.tag === 'pareja'), intentos[0]?.titulo); paso(`si la pareja no ha dibujado: "${intentos[0].titulo}"`);

    console.log('Quién ve qué');
    const antesA = (await pedir('GET', '/api/hoy', { cookie: A.cookie })).datos;
    assert.deepEqual([antesA.yoListo, antesA.parejaListo, antesA.parejaV], [false, true, null]); paso('A sabe que B ya terminó, pero todavía no recibe su dibujo');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/dos`, { cookie: A.cookie })).estado, 403); paso('el servidor no entrega el dibujo de B hasta que A termine el suyo');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/dos?mini=1`, { cookie: A.cookie })).estado, 403);
    const mesAntes = (await pedir('GET', `/api/mes/${hoy.slice(0, 7)}`, { cookie: A.cookie })).datos.dias.find((d) => d.fecha === hoy);
    assert.deepEqual([mesAntes.yo, mesAntes.pareja.visible, mesAntes.pareja.mini], [null, false, null]); paso('ni el calendario lo filtra');
    assert.equal((await pedir('POST', '/api/reaccion', { cookie: A.cookie, cuerpo: { fecha: hoy, reaccion: 'corazon' } })).estado, 403); paso('tampoco se puede reaccionar a un dibujo que todavía no te toca ver');

    console.log('Recordatorio del mediodía');
    const cron = (cabeceras, metodo = 'GET') => pedir(metodo, '/api/cron/recordatorio', { cabeceras });
    const conClave = { Authorization: `Bearer ${process.env.CRON_SECRET}` };
    config.cronSecreto = '';
    assert.equal((await cron(conClave)).estado, 503);
    config.cronSecreto = process.env.CRON_SECRET; paso('sin CRON_SECRET configurada responde 503 y no hace nada');
    assert.equal((await cron()).estado, 401);
    assert.equal((await cron({ Authorization: 'Bearer otra-clave' })).estado, 401);
    assert.equal((await cron({ Authorization: process.env.CRON_SECRET })).estado, 401);
    assert.equal((await cron({ Authorization: `Bearer ${process.env.CRON_SECRET}x` }, 'POST')).estado, 401); paso('sin la contraseña correcta: 401');
    assert.equal(intentos.length, 2, 'nada de eso debió mandar avisos');
    intentos.length = 0;
    fallo = (a) => { if (a.endpoint === EP('uno-ipad')) throw Object.assign(new Error('Gone'), { statusCode: 410 }); };
    const rec = await cron(conClave, 'POST');
    assert.equal(rec.estado, 200);
    assert.deepEqual(intentos.map((i) => i.endpoint).sort(), [EP('uno-ipad'), EP('uno-telefono')]);
    assert.equal(intentos[0].titulo, `Hoy toca dibujar: ${temaDelDia(hoy)}. ¿Te animas? ✏️`);
    assert.deepEqual([rec.datos.enviados, rec.datos.avisados], [1, [gabri]]); paso(`solo se le recuerda a quien no ha dibujado (${gabri}): "${intentos[0].titulo}"`);
    assert.deepEqual(await endpointsDe('uno'), [EP('uno-telefono')]); paso('si el servicio dice que el aparato ya no existe (410), se borra');
    fallo = () => {};
    intentos.length = 0;
    const rec2 = await cron(conClave);
    assert.deepEqual([rec2.estado, rec2.datos.enviados, intentos.length], [200, 0, 0]); paso('si el cron corre dos veces el mismo día, no repite avisos');

    intentos.length = 0;
    const t = await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } });
    assert.equal(t.estado, 200);
    assert.ok(t.datos.bytes < 40 * 1024, `pesa ${t.datos.bytes}`); paso(`A termina: su dibujo quedó en ${(t.datos.bytes / 1024).toFixed(1)} KB`);
    assert.equal((await pedir('GET', '/api/hoy', { cookie: B.cookie })).datos.parejaV !== null, true);
    assert.deepEqual(intentos.map((i) => [i.endpoint, i.titulo]), [[EP('dos-telefono'), `Ya puedes ver el dibujo de ${gabri} 💛`]]); paso(`si la pareja ya dibujó: "${intentos[0].titulo}"`);
    assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } })).estado, 409); paso('terminar es definitivo (no se puede volver a guardar)');
    assert.equal(intentos.length, 1); paso('un reintento rechazado (409) no vuelve a avisar');

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
    // El día 1, "ayer" cae en el mes anterior; el 1 de enero, en el año anterior (que el
    // calendario ya no muestra).
    if (F.anioDe(ayer) === F.anioDe(hoy)) {
      const mesDeAyer = ayer.slice(0, 7) === hoy.slice(0, 7) ? mes : (await pedir('GET', `/api/mes/${ayer.slice(0, 7)}`, { cookie: A.cookie })).datos;
      assert.equal(mesDeAyer.dias.find((d) => d.fecha === ayer).pareja.visible, true);
    }
    assert.ok(mes.dias.every((d) => d.futuro ? d.tema === null : typeof d.tema === 'string')); paso('los días futuros no muestran tema');
    assert.ok(JSON.stringify(mes).length < 400_000); paso(`un mes entero pesa ${(JSON.stringify(mes).length / 1024).toFixed(0)} KB`);
    assert.equal((await pedir('GET', '/api/mes/2019-05', { cookie: A.cookie })).estado, 400);

    console.log('Reacciones y notitas');
    const reaccionar = (cookie, cuerpo) => pedir('POST', '/api/reaccion', { cookie, cuerpo });
    const notasDe = async (cookie) => (await pedir('GET', '/api/hoy', { cookie })).datos.notas;
    const reaccionesDeLaApp = (await pedir('GET', '/api/yo', { cookie: A.cookie })).datos.reacciones;
    assert.ok(reaccionesDeLaApp.length >= 6 && reaccionesDeLaApp.every((r) => r.id && r.emoji && r.nombre)); paso(`la app recibe la lista de reacciones: ${reaccionesDeLaApp.map((r) => r.emoji).join(' ')}`);
    const emoji = (id) => reaccionesDeLaApp.find((r) => r.id === id).emoji;
    assert.equal((await pedir('POST', '/api/reaccion', { cuerpo: { fecha: hoy, reaccion: 'corazon' } })).estado, 401);
    const malas = [
      { fecha: hoy },
      { fecha: 'ayer', reaccion: 'corazon' },
      { fecha: F.sumarDias(hoy, 1), reaccion: 'corazon' },
      { fecha: hoy, reaccion: 'no-existe' },
      { fecha: hoy, comentario: 'x'.repeat(121) },
      { fecha: hoy, comentario: 42 },
    ];
    for (const mala of malas) assert.equal((await reaccionar(A.cookie, mala)).estado, 400, JSON.stringify(mala).slice(0, 80));
    paso('se rechaza lo que no vale: nada que guardar, fechas raras, emojis inventados, notitas larguísimas');
    assert.equal((await reaccionar(B.cookie, { fecha: ayer, reaccion: 'corazon' })).estado, 404); paso('no se puede reaccionar a un dibujo que no existe');

    intentos.length = 0;
    const conAmor = await reaccionar(A.cookie, { fecha: hoy, reaccion: 'amor' });
    assert.deepEqual(conAmor.datos.nota, { reaccion: 'amor', comentario: null });
    assert.deepEqual(await notasDe(B.cookie), { mio: { reaccion: 'amor', comentario: null }, suyo: null });
    assert.deepEqual(await notasDe(A.cookie), { mio: null, suyo: { reaccion: 'amor', comentario: null } }); paso(`${gabri} reacciona ${emoji('amor')} al dibujo de ${eli} y las dos cuentas lo ven en su lugar`);
    assert.deepEqual(intentos.map((i) => [i.endpoint, i.titulo, i.tag, i.renotify]), [[EP('dos-telefono'), `${gabri} reaccionó ${emoji('amor')} a tu dibujo de hoy`, 'reaccion', false]]); paso(`a ${eli} le llega un aviso: "${intentos[0].titulo}"`);
    intentos.length = 0;
    await reaccionar(A.cookie, { fecha: hoy, reaccion: 'amor' });
    assert.equal(intentos.length, 0); paso('repetir la misma reacción no vuelve a avisar');
    const conNotita = await reaccionar(A.cookie, { fecha: hoy, comentario: '  ¡Qué   lindo\n te quedó!  ' });
    assert.deepEqual(conNotita.datos.nota, { reaccion: 'amor', comentario: '¡Qué lindo te quedó!' }); paso('la notita se guarda en una sola línea y la reacción se queda');
    assert.equal(intentos[0].titulo, `${gabri} te dejó una notita ${emoji('amor')}`);
    assert.match(intentos[0].texto, /«¡Qué lindo te quedó!»/); paso(`y avisa: "${intentos[0].titulo}"`);
    const largo = '💛'.repeat(120);
    assert.equal((await reaccionar(A.cookie, { fecha: hoy, comentario: largo })).datos.nota.comentario, largo); paso('caben 120 letras (un emoji cuenta como una)');
    assert.equal((await reaccionar(B.cookie, { fecha: hoy, reaccion: 'risa' })).estado, 200);
    assert.deepEqual(await notasDe(A.cookie), { mio: { reaccion: 'risa', comentario: null }, suyo: { reaccion: 'amor', comentario: largo } }); paso('cada quien reacciona al dibujo del otro, por separado');
    const conNotas = (await pedir('GET', `/api/mes/${hoy.slice(0, 7)}`, { cookie: A.cookie })).datos.dias.find((d) => d.fecha === hoy);
    assert.deepEqual([conNotas.yo.nota.reaccion, conNotas.pareja.nota.reaccion, conNotas.pareja.nota.comentario], ['risa', 'amor', largo]); paso('el calendario también trae las reacciones');
    intentos.length = 0;
    const quitada = await reaccionar(A.cookie, { fecha: hoy, reaccion: null, comentario: '' });
    assert.equal(quitada.datos.nota, null);
    assert.equal((await notasDe(B.cookie)).mio, null);
    assert.equal(intentos.length, 0); paso('quitar la reacción y la notita las borra, sin avisar');
    const deAyer = await reaccionar(A.cookie, { fecha: ayer, reaccion: 'estrella' });
    assert.equal(deAyer.estado, 200);
    assert.equal(intentos[0].titulo, `${gabri} reaccionó ${emoji('estrella')} a tu dibujo del ${F.fechaCorta(ayer)}`); paso(`en un día que ya pasó se puede reaccionar aunque uno no dibujara: "${intentos[0].titulo}"`);

    console.log('Año nuevo');
    const anioPasado = F.anioDe(hoy) - 1;
    await base.insertarCrudo({ fecha: `${anioPasado}-12-31`, quien: 'uno', imagen: Buffer.from('x'), mini: Buffer.from('y') });
    await base.insertarCrudo({ fecha: `${anioPasado}-06-15`, quien: 'dos', imagen: Buffer.from('x'), mini: Buffer.from('y') });
    await base.guardarReaccion({ fecha: `${anioPasado}-06-15`, quien: 'dos', reaccion: 'corazon', comentario: 'del año pasado' });
    const antes = await base.contar();
    server.reiniciarRevisionDeAnio();
    await pedir('GET', '/api/yo', { cookie: A.cookie });
    // El 1 de enero, el dibujo de "ayer" también es del año anterior y se borra.
    const delAnioPasado = F.anioDe(ayer) < F.anioDe(hoy) ? 3 : 2;
    assert.equal(await base.contar(), antes - delAnioPasado); paso('al empezar el año se borra lo del año anterior…');
    assert.equal((await pedir('GET', `/api/dibujo/${hoy}/uno`, { cookie: A.cookie })).estado, 200); paso('…y lo de este año se queda');
    assert.equal(await base.reaccionDe(`${anioPasado}-06-15`, 'dos'), null);
    assert.equal((await base.reaccionDe(hoy, 'uno')).reaccion, 'risa'); paso('las reacciones del año pasado también se borran; las de este año, no');

    console.log('Avisos: cuando algo sale mal');
    if (F.anioDe(ayer) === F.anioDe(hoy)) {
      intentos.length = 0;
      assert.equal((await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: ayer, imagen: png } })).estado, 200);
      assert.equal(intentos.length, 0); paso('terminar el dibujo de ayer no avisa a nadie');
    }
    await base.borrarDibujo({ fecha: hoy, quien: 'uno' });
    fallo = () => { throw new Error('el servicio de avisos se cayó'); };
    const conError = await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } });
    assert.deepEqual([conError.estado, conError.datos.ok], [200, true]); paso('si el aviso falla, el dibujo igual se guarda');
    await base.borrarDibujo({ fecha: hoy, quien: 'uno' });
    fallo = () => new Promise(() => {}); // nunca responde
    const inicio = Date.now();
    const colgado = await pedir('POST', '/api/terminar', { cookie: A.cookie, cuerpo: { fecha: hoy, imagen: png } });
    const tardo = Date.now() - inicio;
    assert.equal(colgado.estado, 200);
    assert.ok(tardo < 4500, `tardó ${tardo} ms`); paso(`si el aviso se queda colgado, se responde igual (en ${(tardo / 1000).toFixed(1)} s)`);
    fallo = () => {};

    console.log('Sin claves VAPID');
    const sinClaves = servidorAparte({});
    assert.deepEqual([sinClaves.clave, sinClaves.activar, sinClaves.terminar, sinClaves.cron], [null, 503, 200, 200]);
    assert.equal(sinClaves.cronDatos.enviados, 0); paso('sin VAPID la app arranca y funciona, solo que sin avisos');
    const clavesMalas = servidorAparte({ VAPID_PUBLIC_KEY: 'no-es-una-clave', VAPID_PRIVATE_KEY: 'tampoco', VAPID_SUBJECT: 'mailto:a@b.test' });
    assert.deepEqual([clavesMalas.clave, clavesMalas.terminar], [null, 200]); paso('con claves VAPID mal copiadas tampoco se cae');

    console.log('Radio');
    const { ESTILOS } = require('../lib/radio');
    const emisora = (id, url, extra = {}) => ({ stationuuid: id, name: `Emisora ${id.slice(0, 4)}`, url_resolved: url, codec: 'MP3', hls: 0, lastcheckok: 1, tags: 'music', votes: 1, ...extra });
    const lofi = ESTILOS.find((e) => e.id === 'lofi').emisoras.map(([id]) => id);
    const sinRespuesta = ESTILOS.find((e) => e.id === 'chill').emisoras[0][0];
    const preguntas = [];
    server.radio.usarBuscador(async (ruta) => {
      preguntas.push(ruta);
      if (ruta.startsWith('/json/stations/byuuid')) {
        const ids = new URLSearchParams(ruta.split('?')[1]).get('uuids').split(',');
        const guardada = new Map(ESTILOS.flatMap((e) => e.emisoras).map(([id, , url]) => [id, url]));
        return ids.filter((id) => id !== sinRespuesta).map((id) => {
          if (id === lofi[0]) return emisora(id, 'https://nueva.ejemplo/lofi.mp3');
          if (id === lofi[1]) return emisora(id, guardada.get(id), { lastcheckok: 0 });
          if (id === lofi[2]) return emisora(id, 'http://sin-https.ejemplo/lofi.mp3');
          if (id === lofi[3]) return emisora(id, guardada.get(id), { hls: 1 });
          if (id === lofi[4]) return emisora(id, guardada.get(id), { codec: 'OGG' });
          return emisora(id, guardada.get(id));
        });
      }
      if (ruta.includes('tag=lofi')) {
        return [
          emisora('noticias-1', 'https://noticias.ejemplo/live.mp3', { tags: 'news,talk', votes: 999 }),
          emisora('repetida-1', ESTILOS.find((e) => e.id === 'lofi').emisoras[5][2], { votes: 500 }),
          emisora('nueva-poca', 'https://extra.ejemplo/a.mp3', { votes: 10 }),
          emisora('nueva-mucha', 'https://extra.ejemplo/b.mp3', { votes: 50 }),
        ];
      }
      return [];
    });
    assert.equal((await pedir('GET', '/api/radio')).estado, 401);
    const conRadio = await pedir('GET', '/api/radio', { cookie: A.cookie });
    assert.equal(conRadio.estado, 200);
    const catalogo = conRadio.datos.estilos;
    assert.equal(catalogo.length, ESTILOS.length);
    assert.ok(catalogo.every((e) => e.nombre && e.emoji && e.emisoras.length > 0 && e.emisoras.every((x) => x.url.startsWith('https://') && x.nombre))); paso(`la radio trae ${catalogo.length} estilos: ${catalogo.map((e) => e.emoji).join(' ')}`);
    const deLofi = catalogo.find((e) => e.id === 'lofi').emisoras.map((x) => x.url);
    assert.equal(deLofi[0], 'https://nueva.ejemplo/lofi.mp3'); paso('si una emisora se mudó, se usa su dirección nueva');
    assert.deepEqual(deLofi.slice(1), [ESTILOS.find((e) => e.id === 'lofi').emisoras[5][2], 'https://extra.ejemplo/b.mp3', 'https://extra.ejemplo/a.mp3']);
    paso('se saltan las caídas, las sin https, las HLS y las OGG; y si quedan pocas se completa por etiqueta (sin noticias ni repetidas)');
    assert.ok(catalogo.find((e) => e.id === 'chill').emisoras.some((x) => x.id === sinRespuesta)); paso('si la API no conoce una emisora, se usa la dirección guardada');
    const yaPreguntadas = preguntas.length;
    await pedir('GET', '/api/radio', { cookie: B.cookie });
    assert.equal(preguntas.length, yaPreguntadas); paso('el catálogo se guarda un rato: no se le pregunta a la API cada vez');
    server.radio.usarBuscador(async () => { throw new Error('Radio Browser caído'); });
    const sinApi = (await pedir('GET', '/api/radio', { cookie: A.cookie })).datos.estilos;
    assert.deepEqual(sinApi.find((e) => e.id === 'lofi').emisoras.map((x) => x.url), ESTILOS.find((e) => e.id === 'lofi').emisoras.map(([, , url]) => url)); paso('si Radio Browser no responde, suenan las emisoras guardadas');
    assert.match((await pedir('GET', '/api/radio', { cookie: A.cookie })).cabeceras.get('content-security-policy'), /media-src https:/); paso("la CSP deja sonar audio de las emisoras (media-src https:) y nada más cambia");

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
