// Comunicación con el servidor.

async function pedir(metodo, ruta, cuerpo) {
  const r = await fetch(ruta, {
    method: metodo,
    credentials: 'same-origin',
    headers: cuerpo ? { 'Content-Type': 'application/json' } : undefined,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const datos = await r.json().catch(() => ({}));
  if (!r.ok) {
    const error = new Error(datos.error || 'error');
    error.estado = r.status;
    error.datos = datos;
    throw error;
  }
  return datos;
}

export const api = {
  cuentas: () => pedir('GET', '/api/cuentas'),
  entrar: (id, pin) => pedir('POST', '/api/entrar', { id, pin }),
  salir: (endpoint) => pedir('POST', '/api/salir', endpoint ? { endpoint } : undefined),
  yo: () => pedir('GET', '/api/yo'),
  hoy: () => pedir('GET', '/api/hoy'),
  terminar: (cuerpo) => pedir('POST', '/api/terminar', cuerpo),
  mes: (mes) => pedir('GET', `/api/mes/${mes}`),
  claveAvisos: () => pedir('GET', '/api/avisos/clave'),
  activarAvisos: (aparato) => pedir('POST', '/api/avisos/activar', aparato),
  desactivarAvisos: (endpoint) => pedir('POST', '/api/avisos/desactivar', { endpoint }),
};

// `v` (la hora en que se terminó el dibujo) hace que la dirección sea única por dibujo,
// así el navegador puede guardarlo en su caché para siempre.
export const urlDibujo = (fecha, id, v, mini = false) =>
  `/api/dibujo/${fecha}/${id}?v=${encodeURIComponent(v)}${mini ? '&mini=1' : ''}`;
