# Garabatos

Un ratito para dibujar juntos, cada día. Web app para dos personas, pensada para teléfono y iPad (con Apple Pencil), hecha con Node.js. Los dibujos se guardan en **Turso** (SQLite en la nube, gratis), así que no necesitas dejar ninguna computadora encendida.

Cada día aparece un tema sencillo y al azar. Cada quien dibuja en su lienzo y lo termina (ya no se puede editar). Al terminar, ves tu dibujo; cuando la otra persona también termina, aparece el suyo. Si no dibujó ese día, solo se ve una carita triste. El calendario muestra todos los días del mes: al entrar a un mes sale un papelito de "cargando" mientras bajan los dibujos.

## Probarla en tu computadora

```bash
npm install
npm start
```

Se abre en `http://localhost:3000`. Sin variables de entorno usa un archivo SQLite local (`data/garabatos.db`), no necesita Turso. PIN de ejemplo: `123456` (Gabri) y `654321` (Mi amor). Para probarla desde el teléfono, en la misma red wifi, usa la dirección de la computadora (ej. `http://192.168.1.20:3000`).

`npm test` revisa el servidor con una base temporal (no toca la tuya).

## Publicarla: Turso + Vercel (gratis)

### 1. Crear la base en Turso

Instala la CLI de Turso (https://docs.turso.tech/cli/installation) y:

```bash
turso auth signup            # o: turso auth login
turso db create garabatos --location aws-us-east-1   # cerca de Vercel (Virginia)
turso db show garabatos --url        # -> libsql://garabatos-tuusuario.turso.io
turso db tokens create garabatos     # -> el token (guárdalo)
```

No hace falta crear la tabla: la app la crea sola la primera vez.

### 2. Subir a Vercel

1. Sube esta carpeta a un repositorio de GitHub (`node_modules`, `data` y `.env` ya están en `.gitignore`).
2. En Vercel: **Add New → Project**, importa el repositorio. No cambies nada del build.
3. En **Settings → Environment Variables** agrega:

| Variable | Valor |
| --- | --- |
| `TURSO_DATABASE_URL` | la URL `libsql://...` del paso 1 |
| `TURSO_AUTH_TOKEN` | el token del paso 1 |
| `SECRETO` | un texto largo al azar (`openssl rand -hex 32`) |
| `PIN_UNO` | PIN de la primera cuenta (4 a 8 números) |
| `PIN_DOS` | PIN de la segunda cuenta |

4. **Deploy**. Si cambias variables después, hay que volver a desplegar.

Si falta `TURSO_DATABASE_URL`, la app avisa con un error claro en vez de guardar en un disco que se borra.

### 3. Instalarla como app

En el iPhone/iPad, abre la dirección en Safari → compartir → **Agregar a pantalla de inicio**. En Android, Chrome ofrece **Instalar app**. Se abre a pantalla completa, lo más cómodo para dibujar.

## Cómo se guarda

Una sola tabla:

```sql
CREATE TABLE dibujos (
  fecha  TEXT NOT NULL,   -- 2026-10-15
  quien  TEXT NOT NULL,   -- 'uno' o 'dos'
  imagen BLOB NOT NULL,   -- WebP 720x960
  mini   BLOB NOT NULL,   -- WebP 150x200 para el calendario
  creado TEXT NOT NULL,
  PRIMARY KEY (fecha, quien)
);
```

- La llave `(fecha, quien)` garantiza un dibujo por persona por día; si se envía dos veces, la segunda se rechaza (409). Por eso terminar es definitivo.
- Al terminar, el servidor recomprime la imagen (cualquier navegador, incluso Safari que no crea WebP) a WebP de 720×960 y baja la calidad hasta que pese **menos de 40 KB** (límite en `config.js`, `objetivoKB`). Un dibujo normal queda en 8–30 KB; uno muy cargado puede llegar a ~65 KB.
- La columna `mini` es la única adición a "una tabla": el calendario carga miniaturas de ~2–10 KB (todo un mes ≈ 7 KB de datos) y las imágenes completas se bajan en segundo plano. Así el teléfono no tiene que decodificar 60 imágenes grandes.
- Son BLOB reales, no base64 (~33 % menos espacio). Un año completo ronda los 10–20 MB, muy por debajo de los 5 GB gratis de Turso.
- Los temas no se guardan: salen de un orden al azar fijo por año (misma fecha → mismo tema, para los dos). Si editas `lib/temas.js` a mitad de año, los temas de días pasados cambian; agrégalos al final y mejor al empezar el año.

## Reglas del día

- El día cambia a medianoche, hora de Costa Rica (`zonaHoraria`).
- Se puede terminar el dibujo de hoy, o el de ayer si la medianoche te agarró dibujando.
- El dibujo de la otra persona no se entrega (403) hasta que tú hayas terminado el de ese día.
- El **borrador** (mientras dibujas) se guarda solo en el aparato, no en el servidor: si empiezas en el teléfono y sigues en el iPad, no lo verás.

## Año nuevo

El 1 de enero, la primera vez que alguien abre la app, se borran todos los dibujos y todo empieza en blanco (`borrarAlEmpezarAnio` en `config.js`; ponlo en `false` para conservarlos). **No se hace ningún respaldo automático.** Desde el 1 de diciembre la pantalla de hoy lo recuerda: al tocar un dibujo en el calendario se abre grande, con un botón **Guardar** para bajarlo.

## PIN y seguridad

Cuentas fijas, no hay rutas para crear o borrar cuentas. La sesión dura un año por aparato (cookie firmada). Tras 5 PIN incorrectos se bloquea un rato y cada intento tarda ~0,7 s, pero el bloqueo vive en memoria de cada instancia de Vercel, así que no es perfecto: usa PIN de **6 a 8 números**.

## Estructura

```
config.js            cuentas, zona horaria, Turso, tamaño de imagen
server.js            servidor y API (se exporta para Vercel)
vercel.json          cabeceras de seguridad y caché
lib/base.js          la tabla y las consultas
lib/imagen.js        compresión con sharp
lib/temas.js         ~200 temas · lib/tema-del-dia.js: cuál toca hoy
public/              lo que se ve en el teléfono
public/js/lienzo.js  el lienzo: trazos, formas, borrador, deshacer, Pencil
scripts/probar.js    pruebas del servidor
```

Las tipografías (Bagel Fat One y Mali, licencia SIL OFL) vienen incluidas en `public/fonts`; la app no depende de servicios externos.
