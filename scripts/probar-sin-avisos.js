// Lo usa scripts/probar.js: arranca el servidor en un proceso aparte con las variables
// VAPID que le pasen (o sin ellas) y revisa que todo funcione igual, solo que sin avisos.
// Imprime el resultado como JSON en la última línea.

const sharp = require('sharp');
const F = require('../lib/fecha');

(async () => {
  const server = require('../server');
  const config = require('../config');
  const servidor = server.app.listen(0);
  const raiz = `http://127.0.0.1:${servidor.address().port}`;
  try {
    const entrar = await fetch(`${raiz}/api/entrar`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'uno', pin: config.cuentas[0].pin }),
    });
    const cookie = entrar.headers.get('set-cookie').split(';')[0];
    const json = { Cookie: cookie, 'Content-Type': 'application/json' };

    const clave = await (await fetch(`${raiz}/api/avisos/clave`, { headers: { Cookie: cookie } })).json();
    const activar = await fetch(`${raiz}/api/avisos/activar`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ endpoint: 'https://push.ejemplo.com/x', keys: { p256dh: 'BBBB', auth: 'cccc' } }),
    });
    const png = await sharp({ create: { width: 300, height: 400, channels: 3, background: '#ffcf4a' } }).png().toBuffer();
    const terminar = await fetch(`${raiz}/api/terminar`, {
      method: 'POST', headers: json,
      body: JSON.stringify({ fecha: F.claveDeHoy(config.zonaHoraria), imagen: `data:image/png;base64,${png.toString('base64')}` }),
    });
    const cron = await fetch(`${raiz}/api/cron/recordatorio`, { headers: { Authorization: `Bearer ${config.cronSecreto}` } });
    console.log(JSON.stringify({
      clave: clave.clave, activar: activar.status, terminar: terminar.status, cron: cron.status, cronDatos: await cron.json(),
    }));
  } finally {
    servidor.close();
    await server.base.cerrar();
  }
})().catch((err) => { console.error(err); process.exitCode = 1; });
