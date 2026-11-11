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
  version: () => pedir('GET', '/api/version'),
  cuentas: () => pedir('GET', '/api/cuentas'),
  entrar: (id, pin) => pedir('POST', '/api/entrar', { id, pin }),
  salir: (endpoint) => pedir('POST', '/api/salir', endpoint ? { endpoint } : undefined),
  yo: () => pedir('GET', '/api/yo'),
  hoy: () => pedir('GET', '/api/hoy'),
  terminar: (cuerpo) => pedir('POST', '/api/terminar', cuerpo),
  mes: (mes) => pedir('GET', `/api/mes/${mes}`),
  reaccionar: (cuerpo) => pedir('POST', '/api/reaccion', cuerpo),
  radio: () => pedir('GET', '/api/radio'),
  claveAvisos: () => pedir('GET', '/api/avisos/clave'),
  activarAvisos: (aparato) => pedir('POST', '/api/avisos/activar', aparato),
  desactivarAvisos: (endpoint) => pedir('POST', '/api/avisos/desactivar', { endpoint }),
  // posponer
  posponer: (cuerpo) => pedir('POST', '/api/posponer', cuerpo),
  animos: () => pedir('POST', '/api/animos', {}),
  // reto de la semana
  reto: () => pedir('GET', '/api/reto'),
  retos: () => pedir('GET', '/api/retos'),
  retoDibujo: (cuerpo) => pedir('POST', '/api/reto/dibujo', cuerpo),
  retoAccion: (accion, cuerpo = {}) => pedir('POST', `/api/reto/${accion}`, cuerpo),
  // casa
  casa: () => pedir('GET', '/api/casa'),
  comprar: (tipo) => pedir('POST', '/api/casa/comprar', { tipo }),
  poner: (cuerpo) => pedir('POST', '/api/casa/poner', cuerpo),
  guardarMueble: (id) => pedir('POST', '/api/casa/guardar', { id }),
  vender: (id) => pedir('POST', '/api/casa/vender', { id }),
  cuarto: (tipo) => pedir('POST', '/api/casa/cuarto', { tipo }),
  cuadro: (cuerpo) => pedir('POST', '/api/casa/cuadro', cuerpo),
  avatar: (imagen) => pedir('POST', '/api/avatar', { imagen }),
  // pregunta del día y cartitas
  pregunta: () => pedir('GET', '/api/pregunta'),
  responder: (texto) => pedir('POST', '/api/pregunta', { texto }),
  cartas: () => pedir('GET', '/api/cartas'),
  escribirCarta: (cuerpo) => pedir('POST', '/api/cartas', cuerpo),
  abrirCarta: (id) => pedir('POST', `/api/cartas/${id}/abrir`, {}),
  novedadesVistas: () => pedir('POST', '/api/novedades/visto', {}),
  // la galaxia secreta
  galaxia: () => pedir('GET', '/api/galaxia'),
  atraparEstrella: () => pedir('POST', '/api/galaxia/estrella', {}),
  guardarRecuerdo: (cuerpo) => pedir('POST', '/api/galaxia/recuerdos', cuerpo),
  borrarRecuerdo: (id) => pedir('DELETE', `/api/galaxia/recuerdos/${id}`),
  guardarFrase: (texto) => pedir('POST', '/api/galaxia/frases', { texto }),
  borrarFrase: (id) => pedir('DELETE', `/api/galaxia/frases/${id}`),
  datoGalaxia: (clave, valor) => pedir('POST', '/api/galaxia/dato', { clave, valor }),
};

export const urlRecuerdo = (id, v, mini = false) => `/api/galaxia/recuerdos/${id}/foto?v=${encodeURIComponent(v)}${mini ? '&mini=1' : ''}`;

export const urlReto = (semana, clave, v) => `/api/reto/imagen/${semana}/${clave}?v=${encodeURIComponent(v)}`;
export const urlAvatar = (quien, v) => `/api/avatar/${quien}?v=${encodeURIComponent(v)}`;

// `v` (la hora en que se terminó el dibujo) hace que la dirección sea única por dibujo,
// así el navegador puede guardarlo en su caché para siempre.
export const urlDibujo = (fecha, id, v, mini = false) =>
  `/api/dibujo/${fecha}/${id}?v=${encodeURIComponent(v)}${mini ? '&mini=1' : ''}`;
