// Service worker de Garabatos: SOLO sirve para mostrar avisos.
// No guarda nada en caché ni intercepta pedidos (no hay evento "fetch"), así que la app
// se sigue cargando exactamente igual que antes.

self.addEventListener('push', (event) => {
  let datos = {};
  try {
    datos = event.data ? event.data.json() : {};
  } catch {
    datos = { texto: event.data ? event.data.text() : '' };
  }
  // En iPhone/iPad cada aviso que llega TIENE que mostrarse, así que siempre se muestra algo.
  event.waitUntil(self.registration.showNotification(datos.titulo || 'Garabatos', {
    body: datos.texto || '',
    icon: '/icono-192.png',
    // Un aviso nuevo del mismo tipo reemplaza al anterior en vez de amontonarse
    // (y vuelve a sonar, salvo las reacciones: si cambian seguido, no molestan).
    tag: datos.tag || 'garabatos',
    renotify: datos.renotify !== false,
    lang: 'es',
    data: { url: datos.url || '/' },
  }));
});

// Al tocar el aviso: si la app ya está abierta, se trae al frente; si no, se abre.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const destino = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const ventanas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const abierta = ventanas.find((v) => new URL(v.url).origin === self.location.origin);
    if (abierta && 'focus' in abierta) return abierta.focus();
    return self.clients.openWindow(destino);
  })());
});
