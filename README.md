# Garabatos

Un ratito para dibujar juntos, cada día. Web app para dos personas, pensada para teléfono y iPad (con Apple Pencil), hecha con Node.js. Los dibujos se guardan en **Turso** (SQLite en la nube, gratis), así que no necesitas dejar ninguna computadora encendida.

Cada día aparece un tema sencillo y al azar. Cada quien dibuja en su lienzo y lo termina (ya no se puede editar). Al terminar, ves tu dibujo; cuando la otra persona también termina, aparece el suyo. Si no dibujó ese día, solo se ve una carita triste. El calendario muestra todos los días del mes: al entrar a un mes sale un papelito de "cargando" mientras bajan los dibujos.

Además:

- **Comodines 🎟️.** Por si a alguien se le pasa un día: cada quien tiene hasta **2 comodines**, y el día 1 de cada mes se le recarga **1** (nunca más de 2). Con un comodín se puede dibujar un día que se te pasó, de la última semana, y así **la racha no se rompe**. En Hoy aparece una tarjeta con los días que se te pasaron (y también desde el calendario, al abrir ese día); antes de gastar, la app pregunta. A la pareja le llega un aviso, y en el calendario se ve qué dibujos se recuperaron con comodín.
- **Pincel o balde.** El primer botón de las herramientas abre dos opciones: **Pincel** (trazos a mano) y **Balde** (toca una zona y se rellena con el color elegido). El balde se detiene en las líneas, incluso en las finitas de colores pastel; si una figura hecha a mano quedó con un huequito chico, no se escapa por ahí; y no deja la orillita blanca junto a la línea ni la borra. Si se toca encima de una línea, la recolorea. Deshacer y rehacer funcionan igual que con los trazos.
- **Colores y pincel.** Al dibujar hay 4 grupos de 12 colores: **Normales**, **Suaves** (poco saturados: terracota, mostaza, amarillo pálido, verde oliva…), **Vivos** (muy saturados: verde fuerte, cian, magenta…) y **Pastel**. Se cambia de grupo con las flechitas ‹ ›. El tamaño del pincel (y del borrador) se elige con una barra; la bolita de al lado muestra el tamaño real del trazo, en su color. El grupo, el color y el tamaño se recuerdan en cada aparato.
- **Reacciones y notitas.** Al dibujo de tu pareja le puedes poner una reacción (❤️ 🥰 😍 😮 😂 🥺 🌟 👏) y dejarle una notita cortita (hasta 120 letras). La reacción aparece como una pegatina en la esquina de su polaroid y la notita como un globito con tu carita. Se puede cambiar o quitar cuando quieras, en Hoy o desde el calendario. Si tiene los avisos activados, le llega uno.
- **Postal de los dos.** El botón **Postal de los dos** arma una imagen con los dos dibujos del día, como en la app: el tema en su cartelito, la fecha, las polaroids con nombre y carita, las reacciones, las notitas y "garabatos" abajo. Con **Compartir** se manda por WhatsApp o se guarda en Fotos (en iPhone, desde el menú de compartir: *Guardar imagen*); con **Guardar** se baja como archivo. Se arma en el teléfono, no se guarda en el servidor.
- **Radio para dibujar.** En la pantalla de dibujar, el botón 🎵 abre una radio con 15 estilos: Lofi, Chill, Jazz, Clásica y piano, Para concentrarse, Lluvia y naturaleza, Bossa nova, Acústica, Baladas románticas, Pop latino, De Costa Rica, K-pop, Anime y J-pop, Videojuegos y Synthwave. Cada estilo tiene varias emisoras en vivo (el botón ⏭ cambia a otra). Solo suena mientras dibujas: al volver a Hoy o al terminar el dibujo, se apaga. Más detalles abajo, en **La radio**.
- **Garabatito**, el lapicito de la casa. Vive en la pantalla de Hoy: flota, parpadea y en su globito cuenta cómo va el día ("¡Eli ya dibujó! Te está esperando 👀", "¡Eli te dejó una notita!"…). De noche se duerme. Si lo tocas, salta y dice alguna ocurrencia o un truquito de la app.

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

Cuando publicas cambios, la app instalada se actualiza sola la próxima vez que la abran: se recarga y dice "¡Garabatos se actualizó! ✨". Si en ese momento están dibujando, espera a que salgan de esa pantalla (el borrador no se pierde). Esto existe porque en iPhone la app instalada puede quedarse "dormida" en memoria con la versión vieja.

Si falta `TURSO_DATABASE_URL`, la app avisa con un error claro en vez de guardar en un disco que se borra. Si faltan las `VAPID_…` (o están mal copiadas), la app funciona normal, solo que sin avisos.

Las claves VAPID se generan **una sola vez**. Si las cambias después, los aparatos que ya tenían avisos dejan de recibirlos hasta que se abra la app otra vez (ahí se vuelven a registrar solos).

### 3. Instalarla como app

En el iPhone/iPad, abre la dirección en Safari → compartir → **Agregar a pantalla de inicio**. En Android, Chrome ofrece **Instalar app**. Se abre a pantalla completa, lo más cómodo para dibujar.

### 4. Activar los avisos

En la pantalla de **Hoy**, abajo, hay un cuadrito con la carita de tu pareja y el botón **Activar avisos**. Al tocarlo, el teléfono pregunta si permites notificaciones: di que sí. Cada quien lo activa en cada aparato donde quiera recibirlos (teléfono, iPad…).

- **iPhone y iPad:** los avisos solo funcionan con la app **instalada** (paso 3) y con **iOS/iPadOS 16.4 o más nuevo**. Hay que abrirla desde el ícono de la pantalla de inicio y tocar ahí **Activar avisos**; desde Safari normal no se puede (la app lo explica si lo intentas).
- Si dijiste que no por error, el cuadrito explica cómo arreglarlo: en iPhone, **Ajustes → Notificaciones → Garabatos**; en Android, los ajustes del sitio o de la app.
- Al **salir** de la cuenta, ese aparato deja de recibir los avisos de esa cuenta.

Hay tres tipos de aviso:

1. **Cuando tu pareja termina su dibujo de hoy:** "Gabri ya dibujó, ¡te toca! 🎨", o "Ya puedes ver el dibujo de Gabri 💛" si tú ya habías dibujado. Terminar el de ayer no avisa.
2. **Cuando tu pareja reacciona o te deja una notita:** "Gabri reaccionó 🥰 a tu dibujo de hoy" o "Gabri te dejó una notita 🥰". Quitar una reacción, o volver a poner la misma, no avisa; si la cambia varias veces seguidas, el aviso nuevo reemplaza al anterior sin volver a sonar.
3. **Recordatorio del mediodía:** a las 12:00 (hora de Costa Rica), solo a quien todavía no ha dibujado: "Hoy toca dibujar: {tema}. ¿Te animas? ✏️". Este necesita el paso 5.

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

Las reacciones y notitas van en otra tabla chiquita (se crea sola):

```sql
CREATE TABLE reacciones (
  fecha       TEXT NOT NULL,   -- el día del dibujo
  quien       TEXT NOT NULL,   -- de quién es el DIBUJO (la reacción la pone la otra persona)
  reaccion    TEXT,            -- 'corazon', 'amor'… (la lista está en lib/reacciones.js)
  comentario  TEXT,            -- la notita, hasta 120 letras
  actualizado TEXT NOT NULL,
  PRIMARY KEY (fecha, quien)   -- una reacción por dibujo; se puede cambiar
);
```

- Solo se puede reaccionar a lo que uno puede ver: el dibujo de hoy de la pareja, cuando ya terminaste el tuyo, o el de un día que ya pasó.
- Si se quitan el emoji y la notita, la fila se borra. En año nuevo se borran junto con los dibujos.
- Para cambiar los emojis, edita `lib/reacciones.js` (la app recibe la lista del servidor). Se guarda el `id`, así que puedes cambiar el emoji o el nombre sin perder nada.

Los comodines usados se anotan en otra tablita (se crea sola). El saldo no se guarda: se calcula desde estas anotaciones (empieza en 2, +1 cada mes, máximo 2), así nunca se desincroniza:

```sql
CREATE TABLE comodines (
  fecha TEXT NOT NULL,   -- el día que se recuperó
  quien TEXT NOT NULL,   -- 'uno' o 'dos'
  mes   TEXT NOT NULL,   -- '2026-10': el mes en que se usó
  usado TEXT NOT NULL,
  PRIMARY KEY (fecha, quien)
);
```

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

## La radio

- Son radios de internet públicas y gratuitas, en vivo (no es Spotify: no se eligen canciones). Salen de **[Radio Browser](https://www.radio-browser.info)**, un directorio libre de más de 60 000 emisoras, sin cuenta ni clave.
- Las emisoras de cada estilo están escogidas a mano en `lib/radio.js` y probadas: todas por https, en MP3 o AAC (lo que suena en iPhone y Android). Se guarda el identificador de Radio Browser de cada una; el servidor le pregunta a la API su dirección actual y si está caída, así que si una radio se muda, la app se entera sola. Si a un estilo le quedan menos de 4, se completa buscando por etiqueta (sin noticias, deportes ni religión). Si Radio Browser no responde, se usan las direcciones guardadas.
- Si una emisora no arranca en 12 segundos o se cae, la app salta sola a la siguiente del mismo estilo.
- **El audio no pasa por Vercel**: el teléfono se conecta directo a cada emisora. Por eso la CSP ahora tiene `media-src https:` (solo deja sonar audio y video de sitios https; no permite ejecutar nada).
- Se recuerdan el estilo, la emisora y el volumen en cada aparato, pero **nunca suena sola**: siempre con un toque. En iPhone/iPad el volumen se cambia con los botones del aparato (la barra no aparece).
- En la pantalla bloqueada se ve "Garabatos · Radio Lofi" con play, pausa y siguiente.
- **Datos móviles:** una emisora de 128 kbps gasta unos 55–60 MB por hora (las de 320 kbps, ~140 MB). Con wifi no importa.
- Para cambiar emisoras: busca la radio en https://www.radio-browser.info, copia su identificador (el *stationuuid*, en la dirección de su página) y agrégala en `lib/radio.js` con su nombre y su dirección de stream.

## Reglas del día

- El día cambia a medianoche, hora de Costa Rica (`zonaHoraria`).
- Se puede terminar el dibujo de hoy. El de ayer, gratis hasta las **3:00 a. m.** (por si la medianoche te agarró dibujando; `horasDeGracia` en `config.js`). Después de esa hora, o para otro día de la última semana, hace falta un **comodín**.
- Comodines: hasta 2 por persona, se recarga 1 cada mes (`comodines` en `config.js`). Solo sirven para días de este año y desde que la pareja empezó a usar la app.
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
lib/reacciones.js    la lista de emojis para reaccionar
lib/radio.js         los estilos y emisoras de la radio (Radio Browser)
lib/comodines.js     el saldo de comodines (2 como máximo, +1 cada mes)
lib/temas.js         ~200 temas · lib/tema-del-dia.js: cuál toca hoy
public/              lo que se ve en el teléfono
public/js/lienzo.js  el lienzo: trazos, formas, borrador, deshacer, Pencil
public/js/avisos.js  el cuadrito de "Activar avisos"
public/js/reacciones.js  pegatinas, notitas y el panel para reaccionar
public/js/postal.js  arma la postal de los dos dibujos (canvas)
public/js/mascota.js Garabatito
public/js/radio.js   la radio de la pantalla de dibujar
public/sw.js         muestra los avisos (no guarda nada en caché)
scripts/probar.js    pruebas del servidor
```

Las tipografías (Bagel Fat One y Mali, licencia SIL OFL) vienen incluidas en `public/fonts`. Los únicos servicios externos son los de avisos (Apple, Google o Mozilla, según el aparato; sin Firebase ni cuentas extra), cron-job.org para el recordatorio y, para la radio, Radio Browser y las propias emisoras. La app funciona sin ellos.
