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
// Las pruebas de antes de los comodines asumen que "ayer" se puede terminar a cualquier
// hora; la hora de gracia y los comodines se prueban aparte, más abajo.
config.horasDeGracia = 24;

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

    console.log('Comodines');
    const { saldo, siguienteMes } = require('../lib/comodines');
    assert.deepEqual(
      [saldo([], '2026-10'), saldo(['2026-10', '2026-10'], '2026-10'), saldo(['2026-10', '2026-10'], '2026-11'), saldo(['2026-10', '2026-10'], '2026-12'),
        saldo(['2026-10', '2026-10', '2026-11'], '2026-11'), saldo(['2026-12', '2026-12'], '2027-01')],
      [2, 0, 1, 2, 0, 1],
    ); paso('empiezan con 2, cada mes se recarga 1 y nunca hay más de 2');
    const hace = (n) => F.sumarDias(hoy, -n);
    if (F.anioDe(hace(8)) !== F.anioDe(hoy)) {
      console.log('  (se saltan las demás: la semana cruza el año nuevo)');
    } else {
      config.horasDeGracia = 0; // ya pasó la hora de gracia: ayer también cuesta un comodín
      // La pareja empezó hace 6 días; B dibujó hace 2 días y A no.
      await base.insertarCrudo({ fecha: hace(6), quien: 'dos', imagen: Buffer.from('x'), mini: Buffer.from('y') });
      await base.insertarCrudo({ fecha: hace(2), quien: 'dos', imagen: Buffer.from('x'), mini: Buffer.from('y') });
      const estado = async (cookie) => (await pedir('GET', '/api/hoy', { cookie })).datos;
      let eA = await estado(A.cookie);
      assert.deepEqual(eA.comodines, { quedan: 2, maximo: 2, proximo: null });
      assert.deepEqual(eA.perdidos.map((p) => p.fecha), [hace(2), hace(3), hace(4), hace(5), hace(6)]);
      assert.ok(eA.perdidos.every((p) => p.tema === temaDelDia(p.fecha) && p.gratis === false));
      paso('cada quien ve sus comodines y los días que se le pasaron (de la última semana, desde que empezaron)');
      const terminar = (cookie, fecha, comodin) => pedir('POST', '/api/terminar', { cookie, cuerpo: { fecha, imagen: png, ...(comodin ? { comodin: true } : {}) } });
      assert.equal((await terminar(A.cookie, hace(2))).estado, 400); paso('sin pedir el comodín, un día pasado no se acepta (como antes)');
      const rachaAntes = eA.racha;
      intentos.length = 0;
      const recuperado = await terminar(A.cookie, hace(2), true);
      assert.deepEqual([recuperado.estado, recuperado.datos.comodines], [200, 1]);
      eA = await estado(A.cookie);
      assert.deepEqual([eA.comodines.quedan, eA.comodines.proximo], [1, `${siguienteMes(hoy.slice(0, 7))}-01`]);
      assert.ok(!eA.perdidos.some((p) => p.fecha === hace(2)));
      assert.equal(eA.racha, rachaAntes + 1); paso(`recuperar un día gasta 1 comodín y salva la racha (${rachaAntes} → ${eA.racha} días)`);
      assert.deepEqual(intentos.map((i) => [i.endpoint, i.titulo]), [[EP('dos-telefono'), `${gabri} recuperó su dibujo del ${F.fechaCorta(hace(2))} 🎟️`]]); paso(`y le avisa a la pareja: "${intentos[0].titulo}"`);
      assert.equal((await terminar(A.cookie, hace(3), true)).datos.comodines, 0);
      const sinComodines = await terminar(A.cookie, hace(4), true);
      assert.deepEqual([sinComodines.estado, sinComodines.datos.error], [403, 'sin_comodines']);
      assert.ok((await estado(A.cookie)).perdidos.some((p) => p.fecha === hace(4))); paso('con 0 comodines ya no se puede (y el día sigue pendiente, sin gastar nada)');
      assert.equal((await estado(B.cookie)).comodines.quedan, 2); paso('los comodines de cada quien son aparte');
      assert.equal((await terminar(B.cookie, hace(8), true)).estado, 400);
      assert.equal((await terminar(B.cookie, hace(7), true)).estado, 400); paso('no se recupera un día de hace más de una semana, ni de antes de que empezaran');
      assert.equal((await terminar(B.cookie, hace(3), true)).estado, 200);
      assert.equal((await terminar(B.cookie, hace(3), true)).estado, 409);
      assert.equal((await estado(B.cookie)).comodines.quedan, 1); paso('mandar dos veces el mismo día no gasta dos comodines');
      config.horasDeGracia = 24; // todavía es de madrugada: ayer es gratis
      await base.borrarDibujo({ fecha: ayer, quien: 'uno' });
      const deAyerGratis = (await estado(A.cookie)).perdidos.find((p) => p.fecha === ayer);
      assert.ok(deAyerGratis && deAyerGratis.gratis);
      assert.equal((await terminar(A.cookie, ayer)).estado, 200);
      assert.equal((await estado(A.cookie)).comodines.quedan, 0); paso('en la hora de gracia, el de ayer es gratis (no gasta comodín)');
      const diaRecuperado = (await pedir('GET', `/api/mes/${hace(2).slice(0, 7)}`, { cookie: B.cookie })).datos.dias.find((d) => d.fecha === hace(2));
      assert.deepEqual([diaRecuperado.yo.recuperado, diaRecuperado.pareja.recuperado], [false, true]); paso('el calendario marca los dibujos recuperados con comodín');
    }

    console.log('Balde (relleno)');
    // balde.js es un módulo del navegador sin dependencias: se carga tal cual.
    const fuenteBalde = fs.readFileSync(path.join(__dirname, '..', 'public', 'js', 'balde.js'), 'utf8');
    const { rellenar, hexARgb } = await import(`data:text/javascript,${encodeURIComponent(fuenteBalde)}`);
    const PAPEL_RGB = hexARgb('#fffdf7');
    async function escena(interior, ancho = 400, alto = 400) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}"><rect width="100%" height="100%" fill="#fffdf7"/>${interior}</svg>`;
      const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      return { data: new Uint8ClampedArray(data), width: info.width, height: info.height };
    }
    const pixel = (im, x, y) => { const p = (y * im.width + x) * 4; return [im.data[p], im.data[p + 1], im.data[p + 2]]; };
    const parecido = (a, b, t = 3) => a.every((v, i) => Math.abs(v - b[i]) <= t);
    const ROJO = hexARgb('#e8424a');
    const AZUL = hexARgb('#3d8bff');
    const CIRCULO = '<circle cx="200" cy="200" r="120" fill="none" stroke="#2b2220" stroke-width="6"/>';

    let im = await escena(CIRCULO);
    rellenar(im, 200, 200, ROJO);
    assert.ok(parecido(pixel(im, 200, 200), ROJO) && parecido(pixel(im, 10, 10), PAPEL_RGB) && parecido(pixel(im, 200, 340), PAPEL_RGB)); paso('el balde rellena una figura cerrada y no se sale');
    assert.ok(Math.max(...pixel(im, 320, 200)) < 90, `la línea quedó ${pixel(im, 320, 200)}`);
    let orillaBlanca = 0;
    for (let x = 200; x < 316; x += 1) { const c = pixel(im, x, 200); if (c[0] > 200 && c[1] > 120 && c[2] > 120) orillaBlanca += 1; }
    assert.equal(orillaBlanca, 0); paso('no borra la línea ni deja orillita blanca junto a ella');
    im = await escena('<path d="M 200 80 A 120 120 0 1 1 196 80.07" fill="none" stroke="#2b2220" stroke-width="6"/>');
    rellenar(im, 200, 200, ROJO);
    assert.ok(parecido(pixel(im, 200, 200), ROJO) && parecido(pixel(im, 10, 10), PAPEL_RGB)); paso('si la figura quedó con un huequito, no se escapa por ahí');
    for (const pastel of ['#ffe88f', '#d4cfdd']) {
      im = await escena(`<path d="M 0 0 L 400 400" stroke="${pastel}" stroke-width="2"/>`);
      rellenar(im, 300, 60, AZUL);
      assert.ok(parecido(pixel(im, 300, 60), AZUL) && parecido(pixel(im, 60, 300), PAPEL_RGB), pastel);
    }
    paso('respeta hasta las líneas finitas de colores clarísimos (pastel)');
    im = await escena(CIRCULO);
    rellenar(im, 200, 200, ROJO);
    rellenar(im, 200, 200, AZUL);
    assert.ok(parecido(pixel(im, 200, 200), AZUL) && parecido(pixel(im, 250, 260), AZUL)); paso('rellenar encima reemplaza el color (no lo mezcla)');
    assert.equal(rellenar(im, 200, 200, AZUL), null); paso('rellenar con el mismo color no cambia nada (no se guarda un paso vacío)');
    im = await escena('<circle cx="600" cy="800" r="400" fill="none" stroke="#2b2220" stroke-width="12"/>', 1200, 1600);
    const inicioBalde = Date.now();
    rellenar(im, 600, 800, ROJO);
    const msBalde = Date.now() - inicioBalde;
    assert.ok(msBalde < 1500, `tardó ${msBalde} ms`); paso(`en el lienzo de tamaño real tarda ${msBalde} ms`);

    console.log('Racha y posponer (reglas)');
    const { calcularRacha, nivelDeRacha } = require('../lib/racha');
    const H = '2026-06-10';
    const d = (n) => F.sumarDias(H, -n);
    const conjunto = (pares) => new Map(pares.map(([f, ...q]) => [f, new Set(q)]));
    const quienes = ['uno', 'dos'];
    assert.equal(calcularRacha({ completos: [d(1), d(2), d(3), d(4), d(5)], quienes, hoy: H }), 5); paso('sin posponer: cuenta los días seguidos de los dos (hoy no rompe)');
    assert.equal(calcularRacha({
      completos: [d(2), d(3), d(4)], recientes: conjunto([[d(1), 'dos']]), pospuestos: conjunto([[d(1), 'uno']]), quienes, hoy: H,
    }), 3); paso('ayer pospuesto (y todavía a tiempo): la racha se congela, no se rompe ni suma');
    assert.equal(calcularRacha({
      completos: [d(1), d(2), d(3), d(4)], pospuestos: conjunto([[d(1), 'uno']]), quienes, hoy: H,
    }), 4); paso('al hacer el pospuesto, ese día vuelve a sumar');
    const vencida = { completos: [d(1), d(3), d(4)], recientes: conjunto([[d(2), 'dos']]), pospuestos: conjunto([[d(2), 'uno']]), quienes, hoy: H };
    assert.equal(calcularRacha(vencida), 1);
    assert.equal(calcularRacha({ ...vencida, enGracia: true }), 3); paso('si el pospuesto no se hizo a tiempo, la racha se rompe (a la madrugada todavía hay gracia)');
    assert.equal(calcularRacha({ completos: [d(2), d(3)], recientes: conjunto([[d(1), 'dos']]), quienes, hoy: H }), 0); paso('un día que no se pospuso y no se hizo rompe la racha como siempre');
    assert.deepEqual([0, 3, 4, 7, 8, 15, 16, 30, 31, 59, 60, 200].map(nivelDeRacha), [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5]); paso('el fondo cambia: 0-3 nada, 4-7, 8-15, 16-30, 31-59 y 60 o más');

    console.log('Retos (reglas)');
    const RETOS = require('../lib/retos');
    const JUEGO = require('../lib/reto-juego');
    const nombres = { uno: 'Gabri', dos: 'Eli' };
    const tiposVistos = new Set();
    for (let s = 0; s < 12; s += 1) tiposVistos.add(RETOS.retoDeLaSemana(F.sumarDias('2026-11-02', 7 * s), quienes).tipo);
    assert.equal(tiposVistos.size, 6); paso('en 12 semanas salen los 6 tipos de reto');
    const s1 = RETOS.retoDeLaSemana('2026-11-11', quienes);
    const s2 = RETOS.retoDeLaSemana('2026-11-15', quienes);
    assert.deepEqual([s1.semana, s1.hasta, s1.tipo, s1.primero], [s2.semana, "2026-11-15", s2.tipo, s2.primero]);
    assert.notEqual(RETOS.retoDeLaSemana('2026-11-16', quienes).primero, s1.primero); paso('el reto dura de lunes a domingo y quien empieza se turna cada semana');
    assert.ok(RETOS.adivino('Un globo', 'globo') && RETOS.adivino('volcan', 'volcán') && RETOS.adivino('las tortugas', 'tortuga') && RETOS.adivino('muñecos de nieve', 'muñeco de nieve'));
    assert.ok(!RETOS.adivino('perro', 'gato') && !RETOS.adivino('', 'gato')); paso('al adivinar no importan tildes, artículos ni plurales');
    const juega = (tipo) => ({ ...RETOS.retoDeLaSemana('2026-11-11', quienes), tipo, ...RETOS.TIPOS[tipo], primero: 'uno', segundo: 'dos' });
    const conImg = (datos, clave) => ({ ...datos, imgs: { ...(datos.imgs || {}), [clave]: 'v' } });
    const ver = (reto, datos, yo) => JUEGO.vista(reto, { datos }, yo, nombres, { hoy: '2026-11-11' });
    // mitad
    let reto = juega('mitad');
    assert.deepEqual([ver(reto, {}, 'uno').accion.zona, ver(reto, {}, 'dos').fase], ['izq', 'esperando']);
    let datos = conImg({}, 'base');
    assert.deepEqual([ver(reto, datos, 'dos').accion.zona, ver(reto, datos, 'dos').accion.fondo, ver(reto, datos, 'uno').fase], ['der', 'base', 'esperando']);
    assert.equal(ver(reto, conImg(datos, 'final'), 'uno').fase, 'listo'); paso('mitad y mitad: izquierda primero, después la derecha sobre la otra mitad');
    // garabato
    reto = juega('garabato');
    assert.equal(ver(reto, {}, 'uno').accion.maxTrazos, 3);
    assert.ok(ver(reto, conImg({}, 'base'), 'dos').accion.pideTitulo); paso('termina mi garabato: 3 trazos, y el otro le pone nombre');
    // adivina
    reto = juega('adivina');
    const opciones = ver(reto, {}, 'uno').extra.opciones;
    assert.equal(opciones.length, 3);
    assert.throws(() => JUEGO.aplicar(reto, {}, 'uno', 'palabra', { palabra: 'no-esta' }), /palabra_invalida/);
    datos = conImg(JUEGO.aplicar(reto, {}, 'uno', 'palabra', { palabra: opciones[0] }), 'dibujo');
    assert.equal(ver(reto, datos, 'dos').extra.palabra, undefined); paso('adivina: la palabra secreta no le llega al que adivina');
    assert.throws(() => JUEGO.aplicar(reto, datos, 'uno', 'adivinar', { intento: 'x' }), /no_te_toca/);
    let d2 = JUEGO.aplicar(reto, datos, 'dos', 'adivinar', { intento: 'nada que ver' });
    d2 = JUEGO.aplicar(reto, d2, 'dos', 'adivinar', { intento: 'tampoco' });
    assert.equal(ver(reto, d2, 'dos').extra.quedan, 1);
    const fallado = JUEGO.aplicar(reto, d2, 'dos', 'adivinar', { intento: 'ni idea' });
    assert.deepEqual([fallado.acertado, ver(reto, fallado, 'dos').extra.palabra, ver(reto, fallado, 'dos').fase], [false, opciones[0], 'listo']);
    assert.equal(JUEGO.aplicar(reto, datos, 'dos', 'adivinar', { intento: opciones[0].toUpperCase() }).acertado, true); paso('adivina: 3 intentos; al acertar o fallar, se revela');
    // colores
    reto = juega('colores');
    assert.equal(ver(reto, {}, 'dos').accion.tipo, 'elegir_colores');
    assert.throws(() => JUEGO.aplicar(reto, {}, 'dos', 'colores', { colores: ['#ff0000', '#ff0000', '#00ff00'] }), /colores_invalidos/);
    datos = JUEGO.aplicar(reto, {}, 'dos', 'colores', { colores: ['#ff0000', '#00ff00', '#0000ff'] });
    assert.deepEqual([ver(reto, datos, 'uno').accion.tipo, ver(reto, datos, 'dos').fase], ['elegir_colores', 'esperando']);
    datos = JUEGO.aplicar(reto, datos, 'uno', 'colores', { colores: ['#ffe500', '#8a00ff', '#00cfff'] });
    assert.deepEqual(ver(reto, datos, 'uno').accion.paleta, ['#ff0000', '#00ff00', '#0000ff']);
    assert.deepEqual(ver(reto, datos, 'dos').accion.paleta, ['#ffe500', '#8a00ff', '#00cfff']);
    datos = conImg(datos, 'uno');
    assert.deepEqual([JUEGO.puedeVer(reto, datos, 'dos', 'uno'), JUEGO.puedeVer(reto, conImg(datos, 'dos'), 'dos', 'uno')], [false, true]); paso('tus colores, mi dibujo: cada quien dibuja con los 3 colores que le eligieron');
    // memoria
    reto = juega('memoria');
    datos = conImg({}, 'dibujo');
    assert.equal(ver(reto, datos, 'dos').accion.tipo, 'mirar');
    assert.equal(JUEGO.puedeVer(reto, datos, 'dos', 'dibujo'), false);
    const mirando = JUEGO.aplicar(reto, datos, 'dos', 'mirar', {});
    assert.deepEqual([JUEGO.puedeVer(reto, mirando, 'dos', 'dibujo'), JUEGO.puedeVer(reto, mirando, 'dos', 'dibujo', Date.now() + 60_000)], [true, false]);
    assert.throws(() => JUEGO.aplicar(reto, mirando, 'dos', 'mirar', {}), /ya_hecho/);
    assert.equal(ver(reto, mirando, 'dos').accion.clave, 'copia'); paso('de memoria: se mira una sola vez, unos segundos, y luego se dibuja');
    // tema
    reto = juega('tema');
    datos = JUEGO.aplicar(reto, {}, 'uno', 'tema', { tema: '  un dragón   con lentes ' }, { hoy: '2026-11-11', manana: '2026-11-12' });
    assert.deepEqual([datos.tema, datos.fecha, ver(reto, datos, 'dos').extra.tema], ['un dragón con lentes', '2026-11-12', null]);
    assert.equal(JUEGO.vista(reto, { datos }, 'dos', nombres, { hoy: '2026-11-12' }).extra.tema, 'un dragón con lentes'); paso('tú eliges el tema: es sorpresa hasta el día siguiente');

    console.log('Casa (reglas)');
    const CASA = require('../lib/casa');
    const puestos = [{ id: 1, tipo: 'cama', x: 0, z: 0, rot: 0 }, { id: 2, tipo: 'cuadro', x: 2, pared: 'izq' }];
    assert.equal(CASA.revisarLugar({ id: 3, tipo: 'sofa', x: 1, z: 2, rot: 0 }, puestos), 'lugar_ocupado');
    assert.equal(CASA.revisarLugar({ id: 3, tipo: 'sofa', x: 6, z: 5, rot: 0 }, puestos), 'lugar_invalido');
    assert.equal(CASA.revisarLugar({ id: 3, tipo: 'sofa', x: 7, z: 4, rot: 1 }, puestos), null);
    assert.equal(CASA.revisarLugar({ id: 3, tipo: 'alfombra', x: 0, z: 0, rot: 0 }, puestos), null);
    assert.equal(CASA.revisarLugar({ id: 1, tipo: 'cama', x: 1, z: 1, rot: 0 }, puestos), null); paso('los muebles no se enciman (salvo las alfombras) ni se salen del cuarto; al girar cambian de forma');
    assert.equal(CASA.revisarLugar({ id: 4, tipo: 'ventana', x: 1, pared: 'izq' }, puestos), 'lugar_ocupado');
    assert.equal(CASA.revisarLugar({ id: 4, tipo: 'ventana', x: 1, pared: 'der' }, puestos), null); paso('en las paredes tampoco se enciman');

    console.log('Posponer');
    if (F.anioDe(hace(8)) !== F.anioDe(hoy)) {
      console.log('  (se salta: la semana cruza el año nuevo)');
    } else {
      config.horasDeGracia = 0;
      const estado = async (cookie) => (await pedir('GET', '/api/hoy', { cookie })).datos;
      await base.borrarDibujo({ fecha: hoy, quien: 'uno' });
      const posponer = (cookie, cuerpo) => pedir('POST', '/api/posponer', { cookie, cuerpo });
      assert.equal((await posponer(A.cookie, { motivo: 'aburrido', nivel: 5, texto: 'x' })).estado, 400);
      assert.equal((await posponer(A.cookie, { motivo: 'mal', nivel: 11, texto: 'x' })).estado, 400);
      assert.equal((await posponer(A.cookie, { motivo: 'mal', nivel: 7, texto: '   ' })).estado, 400); paso('para posponer hay que decir por qué (motivo, de 1 a 10 y un textito)');
      intentos.length = 0;
      assert.equal((await posponer(A.cookie, { motivo: 'mal', nivel: 7, texto: 'Me duele la cabeza' })).estado, 200);
      assert.equal(intentos[0].titulo, `${gabri} pospuso el dibujo de hoy 🤒`); paso(`a la pareja le llega: "${intentos[0].titulo}"`);
      assert.equal((await posponer(A.cookie, { motivo: 'mal', nivel: 7, texto: 'otra vez' })).datos.error, 'ya_pospusiste');
      const eA = await estado(A.cookie);
      const eB = await estado(B.cookie);
      assert.deepEqual([eA.posponer.puedo, eA.posponer.porque, eA.posponer.mio.nivel], [false, 'ya_pospusiste', 7]);
      assert.deepEqual(eB.posponer.suyo, { motivo: 'mal', nivel: 7, texto: 'Me duele la cabeza' }); paso('los dos ven que se pospuso, con el motivo y su carita del 1 al 10');
      assert.equal((await pedir('POST', '/api/animos', { cookie: B.cookie })).estado, 200);
      assert.equal((await pedir('POST', '/api/animos', { cookie: B.cookie })).estado, 409);
      assert.equal((await pedir('POST', '/api/animos', { cookie: A.cookie })).estado, 400); paso('la pareja le puede mandar ánimos (una vez al día)');
      assert.equal((await posponer(B.cookie, { motivo: 'ocupado', nivel: 3, texto: 'Trabajo' })).datos.error, 'ya_dibujaste'); paso('no se pospone si ya dibujaste');

      // B pospuso AYER (y A sí dibujó ayer): hoy B tiene que hacer los dos.
      await base.borrarDibujo({ fecha: hoy, quien: 'dos' });
      await base.borrarDibujo({ fecha: ayer, quien: 'dos' });
      await base.insertarPospuesto({ fecha: ayer, quien: 'dos', motivo: 'ocupado', nivel: 4 });
      assert.equal((await posponer(B.cookie, { motivo: 'ocupado', nivel: 3, texto: 'Otra vez' })).datos.error, 'ayer_pospusiste'); paso('no se puede posponer dos días seguidos');
      let e2 = await estado(B.cookie);
      assert.deepEqual(e2.posponer.pendientes.map((p) => p.fecha), [ayer]);
      assert.ok(!e2.perdidos.some((p) => p.fecha === ayer));
      assert.deepEqual((await estado(A.cookie)).posponer.suyosPendientes.map((p) => p.fecha), [ayer]); paso('al día siguiente, el pospuesto aparece como pendiente (no como "perdido")');
      assert.equal((await pedir('GET', `/api/dibujo/${ayer}/uno`, { cookie: B.cookie })).estado, 403); paso('mientras no lo haga, no ve el dibujo de su pareja de ese día');
      const comodinesAntes = e2.comodines.quedan;
      intentos.length = 0;
      const hecho = await pedir('POST', '/api/terminar', { cookie: B.cookie, cuerpo: { fecha: ayer, imagen: png } });
      assert.equal(hecho.estado, 200);
      e2 = await estado(B.cookie);
      assert.deepEqual([e2.comodines.quedan, e2.posponer.pendientes.length], [comodinesAntes, 0]);
      assert.ok(intentos.some((i) => i.titulo === `${eli} hizo el dibujo que había pospuesto 💪`)); paso('el pospuesto se hace gratis (sin comodín) y se le avisa a la pareja');
      assert.equal((await pedir('GET', `/api/dibujo/${ayer}/uno`, { cookie: B.cookie })).estado, 200); paso('ya hecho, se ve el de la pareja');
      // Un día pospuesto que se pasó: ya no se recupera, ni con comodín.
      await base.insertarPospuesto({ fecha: hace(5), quien: 'dos' });
      e2 = await estado(B.cookie);
      assert.ok(!e2.perdidos.some((p) => p.fecha === hace(5)));
      const vencido = await pedir('POST', '/api/terminar', { cookie: B.cookie, cuerpo: { fecha: hace(5), imagen: png, comodin: true } });
      assert.deepEqual([vencido.estado, vencido.datos.error], [400, 'pospuesto_vencido']); paso('si se pasó el plazo, el día pospuesto no se recupera ni con comodín');
      const diaMes = (await pedir('GET', `/api/mes/${ayer.slice(0, 7)}`, { cookie: A.cookie })).datos.dias.find((x) => x.fecha === ayer);
      assert.equal(diaMes.pospuesto.pareja.motivo, 'ocupado'); paso('el calendario muestra los días pospuestos');
      config.horasDeGracia = 24;
    }

    console.log('Monedas y casa');
    let casa = (await pedir('GET', '/api/casa', { cookie: A.cookie })).datos;
    const totalDibujos = await base.contar();
    assert.ok(casa.monedas >= totalDibujos * CASA.GANANCIAS.dibujo, `${casa.monedas} monedas para ${totalDibujos} dibujos`);
    assert.equal((await pedir('GET', '/api/casa', { cookie: B.cookie })).datos.monedas, casa.monedas); paso(`cada dibujo da monedas a la alcancía de los dos (hay ${casa.monedas} 🪙) y no se cuentan dos veces`);
    await base.sumarMonedas([{ clave: 'prueba:tope', quien: null, cantidad: 400 - casa.monedas, motivo: 'prueba' }]);
    const comprar = (cookie, tipo) => pedir('POST', '/api/casa/comprar', { cookie, cuerpo: { tipo } });
    const cama = await comprar(A.cookie, 'cama');
    assert.deepEqual([cama.estado, cama.datos.monedas], [200, 260]);
    const sofa = await comprar(B.cookie, 'sofa');
    const cuadro = await comprar(B.cookie, 'cuadro');
    assert.equal(cuadro.datos.monedas, 400 - 140 - 110 - 30);
    const caro = await comprar(A.cookie, 'piano');
    assert.deepEqual([caro.estado, caro.datos.error], [402, 'sin_monedas']); paso('se compran muebles con la plata de los dos; si no alcanza, no');
    const poner = (cuerpo) => pedir('POST', '/api/casa/poner', { cookie: A.cookie, cuerpo });
    assert.equal((await poner({ id: cama.datos.id, x: 0, z: 0, rot: 0 })).estado, 200);
    assert.equal((await poner({ id: sofa.datos.id, x: 1, z: 2, rot: 0 })).estado, 409);
    assert.equal((await poner({ id: sofa.datos.id, x: 7, z: 0, rot: 0 })).estado, 400);
    assert.equal((await poner({ id: sofa.datos.id, x: 4, z: 7, rot: 0 })).estado, 200);
    assert.equal((await poner({ id: cuadro.datos.id, x: 3, pared: 'der' })).estado, 200); paso('se acomodan en el cuarto (piso y paredes) sin encimarse');
    assert.equal((await pedir('POST', '/api/casa/cuadro', { cookie: A.cookie, cuerpo: { id: cuadro.datos.id, fecha: ayer, quien: 'dos' } })).estado, 200);
    assert.equal((await pedir('POST', '/api/casa/cuadro', { cookie: A.cookie, cuerpo: { id: cama.datos.id, fecha: ayer, quien: 'dos' } })).estado, 404); paso('en el cuadro se puede poner uno de sus dibujos');
    await pedir('POST', '/api/casa/guardar', { cookie: A.cookie, cuerpo: { id: sofa.datos.id } });
    const vendido = await pedir('POST', '/api/casa/vender', { cookie: A.cookie, cuerpo: { id: sofa.datos.id } });
    assert.equal(vendido.datos.monedas, 120 + 55);
    casa = (await pedir('GET', '/api/casa', { cookie: B.cookie })).datos;
    assert.deepEqual(casa.muebles.map((m) => [m.tipo, m.x, m.dibujo]), [['cama', 0, null], ['cuadro', 3, `${ayer}/dos`]]); paso('guardar y vender (se devuelve la mitad)');
    assert.equal((await comprar(A.cookie, 'pintura_rosa')).estado, 200);
    assert.equal((await comprar(A.cookie, 'pintura_rosa')).estado, 409);
    casa = (await pedir('GET', '/api/casa', { cookie: B.cookie })).datos;
    assert.deepEqual([casa.ajustes.pintura, casa.tiene.includes('pintura_crema'), casa.tiene.includes('pintura_rosa')], ['pintura_rosa', true, true]);
    assert.equal((await pedir('POST', '/api/casa/cuarto', { cookie: B.cookie, cuerpo: { tipo: 'pintura_crema' } })).estado, 200);
    assert.equal((await pedir('POST', '/api/casa/cuarto', { cookie: B.cookie, cuerpo: { tipo: 'piso_lila' } })).estado, 402); paso('la pintura y el piso se compran una vez y se cambian cuando quieran');
    assert.ok(casa.movimientos.some((m) => m.motivo === 'compra:cama' && m.cantidad === -140)); paso('la alcancía guarda en qué se gastó');

    console.log('Personajes');
    const personaje = async (w, h, formato = 'png') => `data:image/${formato};base64,${(await sharp({ create: { width: w, height: h, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><circle cx="${w / 2}" cy="${h / 3}" r="${w / 4}" fill="#ff6f91"/></svg>`) }])[formato]().toBuffer()).toString('base64')}`;
    assert.equal((await pedir('POST', '/api/avatar', { cookie: A.cookie, cuerpo: { imagen: await personaje(600, 600) } })).estado, 400);
    assert.equal((await pedir('POST', '/api/avatar', { cookie: A.cookie, cuerpo: { imagen: await personaje(600, 800, 'jpeg') } })).estado, 400);
    const subido = await pedir('POST', '/api/avatar', { cookie: A.cookie, cuerpo: { imagen: await personaje(600, 800) } });
    assert.equal(subido.estado, 200);
    const avatar = await pedir('GET', '/api/avatar/uno', { cookie: B.cookie });
    const metaAvatar = await sharp(avatar.datos).metadata();
    assert.deepEqual([metaAvatar.format, metaAvatar.width, metaAvatar.height, metaAvatar.hasAlpha], ['webp', 480, 640, true]);
    assert.equal((await pedir('GET', '/api/casa', { cookie: B.cookie })).datos.avatares.uno, subido.datos.v); paso('cada quien sube su personaje (con fondo transparente) y la casa sabe cuál es');

    console.log('Reto de la semana');
    const rA = (await pedir('GET', '/api/reto', { cookie: A.cookie })).datos.reto;
    const rB = (await pedir('GET', '/api/reto', { cookie: B.cookie })).datos.reto;
    assert.deepEqual([rA.semana, rA.tipo, rA.soyPrimero, rB.soyPrimero], [RETOS.lunesDe(hoy), RETOS.retoDeLaSemana(hoy, quienes).tipo, rA.primero === 'uno', rB.primero === 'dos']); paso(`esta semana: ${rA.emoji} ${rA.nombre}`);
    const yoEmpiezo = rA.soyPrimero ? { cookie: A.cookie, r: rA } : { cookie: B.cookie, r: rB };
    const otroSigue = rA.soyPrimero ? B.cookie : A.cookie;
    const acc = yoEmpiezo.r.accion || {};
    intentos.length = 0;
    let paso1;
    if (acc.tipo === 'dibujar') paso1 = await pedir('POST', '/api/reto/dibujo', { cookie: yoEmpiezo.cookie, cuerpo: { imagen: png } });
    else if (acc.tipo === 'elegir_tema') paso1 = await pedir('POST', '/api/reto/tema', { cookie: yoEmpiezo.cookie, cuerpo: { tema: 'un pingüino astronauta' } });
    else if (acc.tipo === 'elegir_palabra') paso1 = await pedir('POST', '/api/reto/palabra', { cookie: yoEmpiezo.cookie, cuerpo: { palabra: yoEmpiezo.r.extra.opciones[0] } });
    else if (acc.tipo === 'elegir_colores') paso1 = await pedir('POST', '/api/reto/colores', { cookie: yoEmpiezo.cookie, cuerpo: { colores: ['#ff1a3c', '#00b14f', '#0050ff'] } });
    assert.equal(paso1 && paso1.estado, 200, JSON.stringify(acc));
    assert.equal((await pedir('POST', '/api/reto/dibujo', { cookie: otroSigue, cuerpo: { imagen: png } })).estado, rA.tipo === 'colores' ? 200 : 409); paso('quien empieza hace su parte; el otro no puede adelantarse');
    if (rA.tipo === 'tema') {
      const manana = F.sumarDias(hoy, 1);
      assert.deepEqual((await base.temasElegidosEntre(manana, manana)).map((t) => t.tema), ['un pingüino astronauta']); paso('el tema elegido queda para mañana');
    } else if (rA.tipo !== 'colores') {
      assert.ok(intentos.some((i) => i.titulo.startsWith('¡Te toca en el reto!'))); paso('a la pareja le avisa que le toca');
    }
    if (rA.tipo === 'mitad' || rA.tipo === 'garabato') {
      const fin = await pedir('POST', '/api/reto/dibujo', { cookie: otroSigue, cuerpo: { imagen: png, titulo: 'Un dragón' } });
      assert.deepEqual([fin.estado, fin.datos.reto.fase], [200, 'listo']);
      assert.equal((await pedir('GET', `/api/reto/imagen/${rA.semana}/final`, { cookie: yoEmpiezo.cookie })).estado, 200); paso('al completarlo, los dos ven el dibujo final y ganan monedas');
    }

    console.log('Pregunta del día');
    const { preguntaDelDia } = require('../lib/preguntas');
    let pA = (await pedir('GET', '/api/pregunta', { cookie: A.cookie })).datos;
    assert.equal(pA.hoy.pregunta, preguntaDelDia(hoy));
    assert.equal((await pedir('POST', '/api/pregunta', { cookie: A.cookie, cuerpo: { texto: '   ' } })).estado, 400);
    assert.equal((await pedir('POST', '/api/pregunta', { cookie: A.cookie, cuerpo: { texto: 'A la playa 🏖️' } })).datos.monedas, CASA.GANANCIAS.pregunta);
    assert.equal((await pedir('POST', '/api/pregunta', { cookie: A.cookie, cuerpo: { texto: 'otra' } })).estado, 409);
    let pB = (await pedir('GET', '/api/pregunta', { cookie: B.cookie })).datos;
    assert.deepEqual([pB.hoy.suya, pB.hoy.parejaRespondio], [null, true]); paso('la respuesta de la pareja se ve solo después de responder la tuya');
    await pedir('POST', '/api/pregunta', { cookie: B.cookie, cuerpo: { texto: 'A la montaña' } });
    pB = (await pedir('GET', '/api/pregunta', { cookie: B.cookie })).datos;
    pA = (await pedir('GET', '/api/pregunta', { cookie: A.cookie })).datos;
    assert.deepEqual([pB.hoy.suya, pA.hoy.suya], ['A la playa 🏖️', 'A la montaña']); paso('ya respondidas, los dos ven las dos');

    console.log('Cartitas');
    const escribir = (cuerpo) => pedir('POST', '/api/cartas', { cookie: A.cookie, cuerpo: { color: '#ffc2d1', ...cuerpo } });
    assert.equal((await escribir({ cuando: 'nunca', texto: 'hola' })).estado, 400);
    assert.equal((await escribir({ cuando: 'triste', texto: 'hola', color: '#000000' })).estado, 400);
    assert.equal((await escribir({ cuando: 'fecha', fecha: hoy, texto: 'hola' })).estado, 400);
    intentos.length = 0;
    const carta = await escribir({ cuando: 'triste', texto: 'Eres lo más bonito\nque tengo 💛' });
    assert.equal(carta.estado, 200);
    assert.ok(intentos.some((i) => i.titulo === `${gabri} te escribió una cartita 💌` && i.texto === '«Ábrela cuando estés triste»'));
    const futura = await escribir({ cuando: 'fecha', fecha: F.sumarDias(hoy, 30), texto: 'Feliz mes 🎉' });
    let cB = (await pedir('GET', '/api/cartas', { cookie: B.cookie })).datos;
    assert.deepEqual(cB.recibidas.map((c) => [c.cuando, c.texto]), [['fecha', null], ['triste', null]]); paso('la cartita llega cerradita: no se lee hasta abrirla');
    assert.equal((await pedir('POST', `/api/cartas/${futura.datos.id}/abrir`, { cookie: B.cookie })).estado, 403);
    assert.equal((await pedir('POST', `/api/cartas/${carta.datos.id}/abrir`, { cookie: A.cookie })).estado, 404);
    intentos.length = 0;
    const abierta = await pedir('POST', `/api/cartas/${carta.datos.id}/abrir`, { cookie: B.cookie });
    assert.equal(abierta.datos.carta.texto, 'Eres lo más bonito\nque tengo 💛');
    assert.ok(intentos.some((i) => i.titulo === `${eli} abrió tu cartita 🥹`)); paso('se abre cuando la necesites (la de fecha, no antes) y a quien la escribió le avisa');

    console.log('Novedades');
    assert.equal((await pedir('GET', '/api/yo', { cookie: A.cookie })).datos.novedades, null);
    assert.deepEqual((await pedir('GET', '/api/yo', { cookie: B.cookie })).datos.novedades, { id: config.novedades.id, de: 'uno' });
    await pedir('POST', '/api/novedades/visto', { cookie: B.cookie });
    assert.equal((await pedir('GET', '/api/yo', { cookie: B.cookie })).datos.novedades, null); paso(`la cartita de novedades le sale a ${eli} una sola vez (y a ${gabri} no)`);
    assert.ok(CASA.CATALOGO.some((m) => m.id === 'perrito_nube') && CASA.CATALOGO.some((m) => m.id === 'rollitos')); paso('en la tienda están el perrito nube y los rollitos de canela ☁️');

    console.log('Versión publicada');
    const v1 = await pedir('GET', '/api/version');
    const v2 = await pedir('GET', '/api/version');
    assert.equal(v1.estado, 200);
    assert.match(v1.datos.version, /^[0-9a-f]{12}$/);
    assert.equal(v1.datos.version, v2.datos.version);
    assert.equal(v1.cabeceras.get('cache-control'), 'no-store'); paso(`la app puede preguntar qué versión hay publicada (${v1.datos.version}), sin sesión y sin caché`);
    const portada = await pedir('GET', '/');
    assert.equal(portada.cabeceras.get('etag'), null);
    assert.equal(portada.cabeceras.get('cache-control'), 'no-cache'); paso('la portada no se queda pegada en una versión vieja (sin ETag por fecha)');

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
    try { fs.rmSync(carpeta, { recursive: true, force: true, maxRetries: 8, retryDelay: 250 }); } catch { console.warn(`(no se pudo borrar la carpeta temporal ${carpeta})`); }
  }
})();
