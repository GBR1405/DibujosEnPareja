// Un almacén chiquito en este aparato (IndexedDB), para los borradores con capas.
// localStorage solo guarda texto y tiene ~5 MB; aquí caben las capas como imágenes
// (Blob) sin pasarlas a base64. Si IndexedDB no está (o falla), todo devuelve null y la
// app sigue funcionando, solo que sin borrador.

const NOMBRE = 'garabatos';
const TIENDA = 'borradores';
let abierta = null;

function abrir() {
  if (!abierta) {
    abierta = new Promise((ok, fallo) => {
      if (!('indexedDB' in window)) { fallo(new Error('sin IndexedDB')); return; }
      const pedido = indexedDB.open(NOMBRE, 1);
      pedido.onupgradeneeded = () => pedido.result.createObjectStore(TIENDA);
      pedido.onsuccess = () => ok(pedido.result);
      pedido.onerror = () => fallo(pedido.error);
      pedido.onblocked = () => fallo(new Error('bloqueado'));
    }).catch((e) => { abierta = null; throw e; });
  }
  return abierta;
}

async function operar(modo, hacer) {
  const db = await abrir();
  return new Promise((ok, fallo) => {
    const tx = db.transaction(TIENDA, modo);
    const pedido = hacer(tx.objectStore(TIENDA));
    tx.oncomplete = () => ok(pedido ? pedido.result : undefined);
    tx.onerror = () => fallo(tx.error);
    tx.onabort = () => fallo(tx.error);
  });
}

export const almacen = {
  leer: (clave) => operar('readonly', (t) => t.get(clave)).catch(() => null),
  guardar: (clave, valor) => operar('readwrite', (t) => t.put(valor, clave)).then(() => true).catch(() => false),
  borrar: (clave) => operar('readwrite', (t) => t.delete(clave)).catch(() => null),
  claves: () => operar('readonly', (t) => t.getAllKeys()).catch(() => []),
};
