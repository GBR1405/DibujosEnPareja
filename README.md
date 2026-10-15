# Garabatos

Un ratito para dibujar juntos, cada día. Web app para dos personas, pensada para teléfono y iPad (con Apple Pencil), hecha con Node.js. Los dibujos se guardan en **Turso** (SQLite en la nube, gratis), así que no necesitas dejar ninguna computadora encendida.

Cada día aparece un tema sencillo y al azar. Cada quien dibuja en su lienzo y lo termina (ya no se puede editar). Al terminar, ves tu dibujo; cuando la otra persona también termina, aparece el suyo. Si no dibujó ese día, solo se ve una carita triste. El calendario muestra todos los días del mes: al entrar a un mes sale un papelito de "cargando" mientras bajan los dibujos.

## Probarla en tu computadora

```bash
npm install
npm start
```

Se abre en `http://localhost:3000`. Sin variables de entorno usa un archivo SQLite local (`data/garabatos.db`), no necesita Turso. PIN de ejemplo: `123456` (Gabri) y `654321` (Mi amor). Para probarla desde el teléfono, en la misma red wifi, usa la dirección de la computadora (ej. `http://192.168.1.20:3000`).

`npm test` revisa el servidor con una base temporal (no toca la tuya). Los avisos no salen a internet en las pruebas: se usa un envío de mentira.

Sin más variables, la app funciona igual pero **sin avisos** (el cuadrito de "Activar avisos" no aparece). Para probarlos en tu computadora, genera las claves una vez:

```bash
npx web-push generate-vapid-keys
```

y arranca con ellas (en PowerShell):

```powershell
$env:VAPID_PUBLIC_KEY="BLa...";  $env:VAPID_PRIVATE_KEY="xYz...";  $env:VAPID_SUBJECT="mailto:tu@correo.com"
$env:CRON_SECRET="lo-que-quieras";  npm start
```

Los avisos solo funcionan en `http://localhost:3000` (en la misma computadora) o con `https`. Desde el teléfono por wifi (`http://192.168.…`) el navegador no los permite: para probarlos en el teléfono hay que publicarla.

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
| `VAPID_PUBLIC_KEY` | para los avisos: la *Public Key* de `npx web-push generate-vapid-keys` |
| `VAPID_PRIVATE_KEY` | la *Private Key* del mismo comando (no la compartas) |
| `VAPID_SUBJECT` | tu correo, así: `mailto:tu@correo.com` (Apple y Google lo piden; usa uno real) |
| `CRON_SECRET` | otro texto largo al azar (`openssl rand -hex 32`), para el recordatorio del mediodía |

4. **Deploy**. Si cambias variables después, hay que volver a desplegar.

Si falta `TURSO_DATABASE_URL`, la app avisa con un error claro en vez de guardar en un disco que se borra. Si faltan las `VAPID_…` (o están mal copiadas), la app funciona normal, solo que sin avisos.

Las claves VAPID se generan **una sola vez**. Si las cambias después, los aparatos que ya tenían avisos dejan de recibirlos hasta que se abra la app otra vez (ahí se vuelven a registrar solos).

### 3. Instalarla como app

En el iPhone/iPad, abre la dirección en Safari → compartir → **Agregar a pantalla de inicio**. En Android, Chrome ofrece **Instalar app**. Se abre a pantalla completa, lo más cómodo para dibujar.

### 4. Activar los avisos

En la pantalla de **Hoy**, abajo, hay un cuadrito con la carita de tu pareja y el botón **Activar avisos**. Al tocarlo, el teléfono pregunta si permites notificaciones: di que sí. Cada quien lo activa en cada aparato donde quiera recibirlos (teléfono, iPad…).

- **iPhone y iPad:** los avisos solo funcionan con la app **instalada** (paso 3) y con **iOS/iPadOS 16.4 o más nuevo**. Hay que abrirla desde el ícono de la pantalla de inicio y tocar ahí **Activar avisos**; desde Safari normal no se puede (la app lo explica si lo intentas).
- Si dijiste que no por error, el cuadrito explica cómo arreglarlo: en iPhone, **Ajustes → Notificaciones → Garabatos**; en Android, los ajustes del sitio o de la app.
- Al **salir** de la cuenta, ese aparato deja de recibir los avisos de esa cuenta.

Hay dos tipos de aviso:

1. **Cuando tu pareja termina su dibujo de hoy:** "Gabri ya dibujó, ¡te toca! 🎨", o "Ya puedes ver el dibujo de Gabri 💛" si tú ya habías dibujado. Terminar el de ayer no avisa.
2. **Recordatorio del mediodía:** a las 12:00 (hora de Costa Rica), solo a quien todavía no ha dibujado: "Hoy toca dibujar: {tema}. ¿Te animas? ✏️". Este necesita el paso 5.

### 5. El recordatorio del mediodía (cron-job.org, gratis)

Vercel gratis no puede despertar la app a una hora fija, así que lo hace **cron-job.org**: todos los días a las 12:00 visita una dirección secreta de la app y la app manda los recordatorios. Si la visita llega dos veces el mismo día, la segunda no manda nada.

> Los nombres de botones y campos de abajo son los que recuerdo del panel de cron-job.org (está en inglés). **No pude comprobarlos en su documentación**, así que pueden variar un poco; los marco con *(sin verificar)*.

1. Entra a https://cron-job.org y crea una cuenta gratis (**Sign up** *(sin verificar)*). Confirma tu correo.
2. En el panel, ve a **Cronjobs** y toca **Create cronjob** *(sin verificar)*.
3. En la primera pestaña (**Common** *(sin verificar)*):
   - **Title**: `Garabatos mediodía` (lo que quieras).
   - **URL**: `https://TU-DOMINIO.vercel.app/api/cron/recordatorio` (con tu dirección de Vercel).
   - **Execution schedule** *(sin verificar)*: elige **Every day at** y pon **12 : 00**.
   - Deja marcado **Save responses in job history** *(sin verificar)* para ver el resultado después.
4. En la pestaña **Advanced** *(sin verificar)*:
   - **Time zone** *(sin verificar)*: `America/Costa_Rica`. **Importante**: si queda en otra zona, el recordatorio llega a otra hora.
   - **Headers** *(sin verificar)*: agrega una cabecera con
     - nombre (*Key*): `Authorization`
     - valor (*Value*): `Bearer ` + tu `CRON_SECRET` (la palabra Bearer, un espacio y el secreto; ej. `Bearer 3f9a…`).
   - **Request method** *(sin verificar)*: `GET` está bien (también acepta `POST`).
5. Guarda (**Create** *(sin verificar)*). Si hay un botón **Test run** *(sin verificar)*, úsalo para probar.

En el historial de cada ejecución (**History** *(sin verificar)*) verás la respuesta de la app:

| Respuesta | Qué significa |
| --- | --- |
| `{"ok":true,"enviados":1,"avisados":["Eli"]}` | se mandó el recordatorio (a quien no había dibujado) |
| `{"ok":true,"enviados":0,"nota":"ya_se_mando_hoy"}` | ya se había mandado hoy; no se repite |
| `{"ok":true,"enviados":0,"nota":"avisos_desactivados"}` | faltan las variables `VAPID_…` en Vercel |
| error **401** | la cabecera `Authorization` está mal escrita o el secreto no coincide |
| error **503** | falta la variable `CRON_SECRET` en Vercel (o no volviste a desplegar) |

Ojo: si pruebas con **Test run** a media mañana, ese día ya cuenta como "enviado" y el de las 12:00 no saldrá. `enviados` cuenta aparatos, no personas (si alguien tiene teléfono y iPad, son 2).

## Cómo se guarda

Los dibujos van en una sola tabla:

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
- Los temas no se guardan: salen de un orden al azar fijo por año (misma fecha → mismo tema, para los dos). Si editas `lib/temas.js` a mitad de año, los temas de días pasados cambian; agrégalos al final y mejor al empezar el año. Que no se repita ninguno: `npm test` lo revisa.

Y dos tablas nuevas, muy pequeñas, para los avisos (también se crean solas):

```sql
CREATE TABLE avisos (          -- los aparatos que quieren recibir avisos
  endpoint TEXT PRIMARY KEY,   -- la dirección del aparato en el servicio de avisos de Apple/Google
  quien    TEXT NOT NULL,      -- 'uno' o 'dos'
  p256dh   TEXT NOT NULL,      -- claves para cifrar el aviso
  auth     TEXT NOT NULL,
  creado   TEXT NOT NULL
);
CREATE TABLE recordatorios (fecha TEXT PRIMARY KEY);  -- días en que ya salió el recordatorio
```

- Cada persona puede tener varios aparatos (hasta 10; los más viejos se borran solos). Si un aparato entra con la otra cuenta, pasa a esa cuenta.
- Si Apple o Google responden que un aparato ya no existe (desinstalaron la app, quitaron el permiso), se borra de la tabla.
- `recordatorios` solo guarda la última semana.

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
lib/base.js          las tablas y las consultas
lib/imagen.js        compresión con sharp
lib/avisos.js        mandar avisos al teléfono (web-push)
lib/temas.js         ~200 temas · lib/tema-del-dia.js: cuál toca hoy
public/              lo que se ve en el teléfono
public/js/lienzo.js  el lienzo: trazos, formas, borrador, deshacer, Pencil
public/js/avisos.js  el cuadrito de "Activar avisos"
public/sw.js         muestra los avisos (no guarda nada en caché)
scripts/probar.js    pruebas del servidor
```

Las tipografías (Bagel Fat One y Mali, licencia SIL OFL) vienen incluidas en `public/fonts`. Los únicos servicios externos son los de avisos (Apple, Google o Mozilla, según el aparato; sin Firebase ni cuentas extra) y cron-job.org para el recordatorio, y la app funciona sin ellos.
