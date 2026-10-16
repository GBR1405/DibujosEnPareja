// La radio de la pantalla de dibujar.
//
// Las emisoras son radios de internet públicas y gratuitas, sacadas de Radio Browser
// (https://www.radio-browser.info), un directorio libre con más de 60 000 emisoras.
// Cada estilo tiene unas cuantas escogidas a mano (probadas una por una: https, MP3 o AAC,
// sin anuncios raros). Para no depender de direcciones que cambian, se guarda el
// identificador de Radio Browser de cada una y el servidor le pregunta a la API:
//   - la dirección actual de cada emisora (las radios a veces se mudan),
//   - si la última revisión dice que está caída (entonces se salta).
// Si a un estilo le quedan menos de 4, se completa buscando por etiqueta.
// Si la API no responde, se usan las direcciones guardadas aquí.
//
// El audio NO pasa por este servidor: el teléfono se conecta directo a cada emisora.

// [identificador en Radio Browser, nombre, dirección de respaldo]
const ESTILOS = [
  {
    id: 'lofi', nombre: 'Lofi', emoji: '🎧', etiquetas: ['lofi', 'lo-fi', 'chillhop', 'lofi hip hop'],
    emisoras: [
      ['02338a64-da59-4db6-a1c1-639fdc74d65b', 'REYFM #lofi', 'https://listen.reyfm.de/lofi_128kbps.mp3'],
      ['251e6b0c-2536-4a15-a948-2f6bbf5fb14b', 'Radio Record Lo-Fi', 'https://radiorecord.hostingradio.ru/lofi96.aacp'],
      ['ab9697c4-f1cf-48bc-b4d8-4d15ad5618fa', 'NIA Radio Lo-Fi', 'https://radio.nia.nc/radio/8020/lofi-hq-stream.aac'],
      ['49aedf08-6425-4491-a96c-f598e29aaf00', 'Lofi Hip Hop Radio', 'https://radio.cliamp.stream/lofi/stream'],
      ['c72d442a-d73b-40f1-b741-e143b620eecf', 'Epic Lounge · Jazzhop', 'https://stream.epic-lounge.com/jazzhop-lounge?ref=radiobrowser'],
      ['9614e0a1-0601-11e8-ae97-52543be04c81', 'SomaFM Fluid', 'https://ice6.somafm.com/fluid-128-mp3'],
    ],
  },
  {
    id: 'chill', nombre: 'Chill', emoji: '🌴', etiquetas: ['chillout', 'lounge'],
    emisoras: [
      ['960cf833-0601-11e8-ae97-52543be04c81', 'SomaFM Groove Salad', 'https://ice5.somafm.com/groovesalad-128-mp3'],
      ['478fd7f4-dc36-11e9-a8ba-52543be04c81', 'Smooth Chill', 'https://media-ssl.musicradio.com/ChillMP3'],
      ['3fd18c3f-8157-11e9-aa30-52543be04c81', 'Café del Mar', 'https://streams.radio.co/se1a320b47/listen'],
      ['961173b5-0601-11e8-ae97-52543be04c81', 'SomaFM Lush', 'https://ice5.somafm.com/lush-128-mp3'],
      ['bc0fc480-9229-4d6a-85b8-b91f38191f43', 'Ibiza Chillout Lounge', 'https://stream.epic-lounge.com/ibiza-chillout-lounge?ref=radiobrowser'],
    ],
  },
  {
    id: 'jazz', nombre: 'Jazz', emoji: '🎷', etiquetas: ['jazz', 'smooth jazz'],
    emisoras: [
      ['0eb3dbcf-05f7-480e-83f4-7718102a4820', 'SmoothJazz.com', 'https://smoothjazz.cdnstream1.com/2585_128.mp3'],
      ['518d02e0-9301-4358-bf25-4ed57372fd2d', 'Instrumental Jazz', 'https://jfm1.hostingradio.ru:14536/ijstream.mp3'],
      ['62448837-cbcd-11e8-a54a-52543be04c81', 'Radio Swiss Jazz', 'https://stream.srg-ssr.ch/m/rsj/mp3_128'],
      ['ea8059be-d119-4de3-b27b-0d9bd6aedb17', 'Adroit Jazz Underground', 'https://icecast.walmradio.com:8443/jazz'],
      ['961249b2-0601-11e8-ae97-52543be04c81', 'SomaFM Sonic Universe', 'https://ice6.somafm.com/sonicuniverse-128-mp3'],
    ],
  },
  {
    id: 'clasica', nombre: 'Clásica y piano', emoji: '🎻', etiquetas: ['solo piano', 'piano'],
    emisoras: [
      ['a7397e86-ca42-11e8-a54a-52543be04c81', 'Radio Swiss Classic', 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128'],
      ['5143bb9a-3c5e-4c53-a6ec-0108435caf5a', 'Chillout Piano', 'https://stream.epic-piano.com/chillout-piano?ref=radiobrowser'],
      ['2babf29a-811c-4a51-93c3-9f3531ef2e97', 'Classic FM Calm', 'https://media-ice.musicradio.com/ClassicFMCalmMP3'],
      ['fc2e6c39-7139-4f7a-a0c6-a859244332be', 'Whisperings Solo Piano', 'https://pianosolo.streamguys1.com/live'],
      ['6b4d2d9d-1435-44aa-b5ee-1db50f833ddc', 'Venice Classic Radio', 'https://uk2.streamingpulse.com/ssl/vcr1'],
      ['b78fd386-08ec-4246-8372-d5f97c56a8ee', 'Romantic Piano', 'https://stream.epic-piano.com/romantic-piano?ref=radiobrowser'],
    ],
  },
  {
    id: 'ambiente', nombre: 'Para concentrarse', emoji: '🌙', etiquetas: ['ambient', 'drone'],
    emisoras: [
      ['960eb2e9-0601-11e8-ae97-52543be04c81', 'SomaFM Drone Zone', 'https://ice2.somafm.com/dronezone-128-mp3'],
      ['960d3f6f-0601-11e8-ae97-52543be04c81', 'SomaFM Space Station Soma', 'https://ice2.somafm.com/spacestation-128-aac'],
      ['5886456b-6ed3-40c8-a2c4-4167793d225b', 'Ambient Sleeping Pill', 'https://radio.stereoscenic.com/asp-h'],
      ['e6fa9a8a-02a8-11e9-a1be-52543be04c81', 'SomaFM Groove Salad Classic', 'https://ice5.somafm.com/gsclassic-128-mp3'],
      ['964867ec-0601-11e8-ae97-52543be04c81', 'SomaFM Deep Space One', 'https://ice5.somafm.com/deepspaceone-64-aac'],
    ],
  },
  {
    id: 'naturaleza', nombre: 'Lluvia y naturaleza', emoji: '🌧️', etiquetas: ['nature sounds', 'nature'],
    emisoras: [
      ['95277bca-2c9a-4c08-b2e7-0854e5793f8e', 'Nature Radio Rain', 'https://maggie.torontocast.com:2020/stream/natureradiorain'],
      ['4dad0ae3-720a-434e-b350-7186e4c5ea6f', 'myNoise Pure Nature', 'https://purenature-mynoise.radioca.st/stream'],
      ['fb1add5d-4b7b-45cf-9be4-a1e8df712553', 'Ambi Nature Radio', 'https://nature-rex.radioca.st/stream'],
      ['77eaf32d-241f-4f25-b7d6-347783cd4471', 'Nature Radio Sleep', 'https://az1.mediacp.eu/listen/natureradiosleep/radio.mp3'],
      ['bf5b804b-45ba-41ed-a1a7-41e0544e08e9', 'Radio Nature', 'https://stream.zeno.fm/3ac97ysh6f0uv.aac'],
    ],
  },
  {
    id: 'bossa', nombre: 'Bossa nova', emoji: '🌺', etiquetas: ['bossa nova'],
    emisoras: [
      ['7ada8a81-5ae1-418c-8f18-51d2f38d86a4', 'Bossa Jazz Brasil', 'https://centova5.transmissaodigital.com:20104/live'],
      ['32fed2d8-f1b5-42b4-a560-6e746c699b11', 'Ella Radio · Smooth Bossa Nova', 'https://stream.ella-radio.de/ella-smooth-bossa-nova/mp3-192/?ref=radio-browser'],
      ['4a6ddcd5-71e1-45b7-9d96-c9bacba391f7', 'Radio Art · Smooth Bossa Nova', 'https://live.radioart.com/fSmooth_bossa_nova.mp3'],
      ['ee42ead0-8988-4172-8107-20796676b146', 'SomaFM Bossa Beyond', 'https://ice2.somafm.com/bossa-128-aac'],
      ['03636116-d1d3-4ef9-86e8-3ce1ef35b9ab', 'Monte Carlo · Bossa Nova', 'https://mc-mcbossa.hostingradio.ru/mcbossa96.aacp'],
    ],
  },
  {
    id: 'acustica', nombre: 'Acústica', emoji: '🎸', etiquetas: ['acoustic'],
    emisoras: [
      ['960e14a9-0601-11e8-ae97-52543be04c81', 'SomaFM Folk Forward', 'https://ice2.somafm.com/folkfwd-128-mp3'],
      ['bdd8838b-c054-4399-9fc5-2105aac45f39', 'OUI FM Acoustic', 'https://ouifmacoustic.ice.infomaniak.ch/ouifmacoustic.mp3'],
      ['79cebe09-a7f1-4685-a056-24ed66d439c1', 'Lounge FM Acoustic', 'https://cast.mediaonline.net.ua/acoustic320'],
      ['dda5e837-1da9-40d8-bb69-9f3347060943', 'COOLFM Acoustic', 'https://mediagw.e-tiger.net/stream/zc12'],
    ],
  },
  {
    id: 'romantica', nombre: 'Baladas románticas', emoji: '💕', etiquetas: ['baladas', 'romantica'],
    emisoras: [
      ['bbed394d-8907-435f-8714-8b24c1c56399', 'Café Romántico Radio', 'https://panel.retrolandigital.com/radio/8110/listen'],
      ['f1c094b9-319d-4b58-a00f-20a4e5304098', 'Amor Solo Pop', 'https://playerservices.streamtheworld.com/api/livestream-redirect/ACIR03_s01AAC.aac'],
      ['4ca23be9-ad31-4ac1-9d95-2d9916ecad64', 'LOVE Radio España', 'https://loveradio.streamingmedia.it/espana'],
      ['08bcc582-f87b-43fc-96cd-5be0233566d5', 'Bésame (Medellín)', 'https://playerservices.streamtheworld.com/api/livestream-redirect/BESAME_MEDELLINAAC.aac'],
      ['6dea6c7d-9b22-4698-889f-e7c34203ee6a', 'LOVE Radio · Love Songs', 'https://loveradio.streamingmedia.it/england'],
    ],
  },
  {
    id: 'latina', nombre: 'Pop latino', emoji: '💃', etiquetas: ['pop latino', 'latin pop'],
    emisoras: [
      ['de39fc19-0636-4d05-acbb-2aba2c0d1f7a', 'LOS40 Classic', 'https://playerservices.streamtheworld.com/api/livestream-redirect/LOS40_CLASSIC.mp3'],
      ['0534207e-dea1-4239-a4be-d38017df2e61', 'Mega 96.3 (Los Ángeles)', 'https://liveaudio.lamusica.com/LA_KXOL_icy'],
      ['6f022fbe-c202-4c7d-bd6c-b14953f9163a', 'La Mega (Medellín)', 'https://us-b4-p-e-qg12-audio.cdn.mdstrm.com/live-audio-aw/632cb48f613bac0856b931ab'],
      ['73fc2a69-f1a0-41c0-a2ea-fc5405e4476d', 'Radio La Romántica', 'https://stream.zeno.fm/28hgnyp8568uv'],
      ['bb4c2226-6ccd-4470-b8b3-d6ba0f9ac353', 'Ritmo 96.5', 'https://stream.zeno.fm/y0br5ck4ququv'],
    ],
  },
  {
    id: 'costarica', nombre: 'De Costa Rica', emoji: '🇨🇷', pais: 'CR',
    emisoras: [
      ['b774859a-ba7a-42ac-b0cb-0cea6e53ce26', 'Azul 99.9', 'https://playerservices.streamtheworld.com/api/livestream-redirect/CRC_999AAC.aac'],
      ['c459c782-9605-412e-befe-f29dd5defe7c', 'Amor FM 93.9', 'https://player.hostingtico.com/proxy/8094'],
      ['c54361d9-0e76-410c-815e-e577acbbcff5', 'Radio Mil Recuerdos', 'https://sechin.grupocentroserver.com/radio/8060/radio.mp3'],
      ['f91f863e-6518-4da9-8f27-4571f8a5f877', '103 FM', 'https://playerservices.streamtheworld.com/api/livestream-redirect/CRC_103_1AAC.aac'],
      ['b26b8f25-cdd7-4f27-a49f-5094caf5963e', 'Planet 107.5', 'https://stream20.usastreams.com/8094/stream'],
      ['a5bf09aa-732f-4e94-bd92-35e7f29cd636', '94.7 FM', 'https://playerservices.streamtheworld.com/api/livestream-redirect/CRC_947AAC.aac'],
      ['cdad4475-158f-4f4c-827a-6a4589e582db', 'Urbano 106', 'https://usa18.fastcast4u.com/proxy/rmoohhrw?mp=/1'],
    ],
  },
  {
    id: 'kpop', nombre: 'K-pop', emoji: '💜', etiquetas: ['k-pop', 'kpop'],
    emisoras: [
      ['7ad3b3f3-802d-4ae4-bc62-dc82881c3a43', 'REYFM #kpop', 'https://listen.reyfm.de/kpop_320kbps.mp3'],
      ['4548080b-3497-46dc-a72b-55c136b16f06', 'RauteMusik K-POP', 'https://streams.rautemusik.fm/k-pop/mp3-192?ref=radiobrowser'],
      ['7e0188a0-b332-405d-af8f-57da3223369b', 'LISTEN.moe K-pop', 'https://listen.moe/kpop/fallback'],
      ['7078d270-62b8-49c3-a729-ad325d60d29c', 'SBS PopAsia', 'https://sbs-ice.streamguys1.com/sbs-popasia-sbs-web'],
    ],
  },
  {
    id: 'anime', nombre: 'Anime y J-pop', emoji: '🌸', etiquetas: ['anime', 'j-pop'],
    emisoras: [
      ['e698b1df-bd9c-4084-9c21-22a452b27664', 'LISTEN.moe J-pop', 'https://listen.moe/fallback'],
      ['1adf1539-e647-44c3-85d8-b437b768fb8c', 'Anime Para Ti', 'https://stream.zeno.fm/qpn8mkt8c4duv'],
      ['248a7684-7e28-4912-9812-efefc2bba2e1', 'Gensokyo Radio', 'https://stream.gensokyoradio.net/3'],
      ['8fbe9ffe-2ab4-4faa-85cc-251cc68d0f4f', 'Vocaloid Radio', 'https://vocaloid.radioca.st/stream'],
      ['9f2adf5b-b5e8-4c81-8181-c1981994d2cb', 'Kawaii Music', 'https://kawaii-music.stream.laut.fm/kawaii-music'],
      ['3c64cfe3-2b28-4ccd-bbd0-037a0d36a509', 'J1 Gold', 'https://jenny.torontocast.com:2000/stream/J1GOLD'],
    ],
  },
  {
    id: 'videojuegos', nombre: 'Videojuegos', emoji: '🎮', etiquetas: ['video game music', 'vgm'],
    emisoras: [
      ['32f62475-8900-4364-9fee-d1909f06ae2d', 'Gamesboro Radio', 'https://radio.gamesboro.org/listen/gamesboro_radio/radio.mp3'],
      ['eedc6f09-d19e-4d34-8d4c-7a1f4fe656f6', 'Rainwave · OC Remix', 'https://relay.rainwave.cc/ocremix.mp3'],
      ['76d30169-2619-4240-bcfa-fae1b4c0aaa7', 'Gamepad Music', 'https://centova.listenon.in/proxy/gamepad/stream'],
      ['387753d6-20d0-4aaf-839c-2342b5ba9616', 'Radio Gameplay', 'https://c22.radioboss.fm:8144/GamePlay'],
      ['e4b6d036-8184-484c-94c6-84b11a88d15b', 'Classic Videogames Radio', 'https://lead-server.de:1551/stream/2/'],
      ['a50e5889-8b42-4474-bbbf-a5b2eb0fc80e', 'Gameoverse Radio', 'https://radio.gameoverse.com/listen/gameoverse_radio/radio.mp3'],
    ],
  },
  {
    id: 'synthwave', nombre: 'Synthwave', emoji: '🌆', etiquetas: ['synthwave', 'retrowave'],
    emisoras: [
      ['9067dc39-4bf4-4364-bd6b-8020cff3e15d', 'Nightride FM · Chillsynth', 'https://stream.nightride.fm/chillsynth.mp3'],
      ['9aea4f9e-4170-4d8f-ad8c-67f2bfeaa9e0', 'Nightride FM · Spacesynth', 'https://stream.nightride.fm/spacesynth.mp3'],
      ['0e60a2b4-99de-4507-9931-a23449bcae1d', 'SomaFM Vaporwaves', 'https://ice5.somafm.com/vaporwaves-128-mp3'],
      ['9ca5d25c-f979-48e1-a269-8e71bf74479b', 'Night Drive Radio', 'https://a5.asurahosting.com:7920/radio.mp3'],
      ['9265f88b-3773-40f1-8f3a-7d0ab236d067', 'Sanctuary Radio · Retro 80s', 'https://patmos.cdnstream.com/proxy/sanctua1?mp=/stream2'],
    ],
  },
];

const SERVIDORES = ['https://de1.api.radio-browser.info', 'https://de2.api.radio-browser.info', 'https://all.api.radio-browser.info'];
const AGENTE = 'Garabatos/1.0 (app privada para dibujar en pareja)';
const SEIS_HORAS = 6 * 3600 * 1000;
const DIEZ_MINUTOS = 10 * 60 * 1000;
const MINIMO = 4; // si a un estilo le quedan menos emisoras vivas, se completa por etiqueta
const MAXIMO = 8;

// Lo que un teléfono puede reproducir: https (si no, el navegador lo bloquea), MP3 o AAC
// (no HLS ni OGG, que Safari o Chrome no siempre aguantan), y que funcionó en la última
// revisión de Radio Browser. Sin noticias, deportes ni religión.
const NO = /news|talk|sport|relig|christian|gospel|quran|islam|bible|church|worship|catholic|politic|noticias|deport/i;
const sirve = (s) => typeof s.url_resolved === 'string' && s.url_resolved.startsWith('https://')
  && !s.hls && ['MP3', 'AAC', 'AAC+'].includes(s.codec) && Number(s.lastcheckok) === 1
  && !NO.test(`${s.tags || ''} ${s.name || ''}`);

const limpio = (nombre) => String(nombre).replace(/\s+/g, ' ').trim().slice(0, 60);

// Pide algo a la API de Radio Browser, probando sus servidores uno tras otro.
async function pedirConFetch(ruta) {
  let ultimo;
  for (const servidor of SERVIDORES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const r = await fetch(servidor + ruta, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(3500) });
      if (!r.ok) throw new Error(`Radio Browser respondió ${r.status}`);
      // eslint-disable-next-line no-await-in-loop
      return await r.json();
    } catch (err) {
      ultimo = err;
    }
  }
  throw ultimo;
}

const respaldo = (estilo) => estilo.emisoras.map(([id, nombre, url]) => ({ id, nombre, url }));

function crearRadio() {
  let pedir = pedirConFetch;
  let guardado = null; // { hasta, estilos }

  async function completar(estilo, lista) {
    const busquedas = estilo.pais
      ? [new URLSearchParams({ countrycode: estilo.pais })]
      : (estilo.etiquetas || []).map((tag) => new URLSearchParams({ tag, tagExact: 'true' }));
    const vistas = new Set(lista.map((e) => e.url));
    const nuevas = [];
    const resultados = await Promise.allSettled(busquedas.map((q) => {
      ['hidebroken', 'is_https'].forEach((k) => q.set(k, 'true'));
      q.set('order', 'votes');
      q.set('reverse', 'true');
      q.set('limit', '30');
      return pedir(`/json/stations/search?${q}`);
    }));
    for (const r of resultados) {
      if (r.status !== 'fulfilled' || !Array.isArray(r.value)) continue;
      for (const s of r.value) {
        if (sirve(s) && !vistas.has(s.url_resolved)) {
          vistas.add(s.url_resolved);
          nuevas.push({ id: s.stationuuid, nombre: limpio(s.name), url: s.url_resolved, votos: Number(s.votes) || 0 });
        }
      }
    }
    nuevas.sort((a, b) => b.votos - a.votos);
    return [...lista, ...nuevas.map(({ id, nombre, url }) => ({ id, nombre, url }))].slice(0, MAXIMO);
  }

  async function armar() {
    const uuids = ESTILOS.flatMap((e) => e.emisoras.map(([id]) => id));
    const vivas = await pedir(`/json/stations/byuuid?uuids=${uuids.join(',')}`);
    if (!Array.isArray(vivas)) throw new Error('respuesta rara de Radio Browser');
    const porId = new Map(vivas.map((s) => [s.stationuuid, s]));
    return Promise.all(ESTILOS.map(async (estilo) => {
      let lista = estilo.emisoras.flatMap(([id, nombre, url]) => {
        const s = porId.get(id);
        if (!s) return [{ id, nombre, url }]; // no la conoce: se usa la guardada
        return sirve(s) ? [{ id, nombre, url: s.url_resolved }] : [];
      });
      if (lista.length < MINIMO) lista = await completar(estilo, lista).catch(() => lista);
      return { id: estilo.id, nombre: estilo.nombre, emoji: estilo.emoji, emisoras: lista.length ? lista : respaldo(estilo) };
    }));
  }

  return {
    // Todos los estilos con sus emisoras. Se guarda 6 horas por instancia del servidor
    // (10 minutos si Radio Browser no respondió y se usó el respaldo).
    async catalogo() {
      if (guardado && guardado.hasta > Date.now()) return guardado.estilos;
      try {
        const estilos = await armar();
        guardado = { hasta: Date.now() + SEIS_HORAS, estilos };
      } catch (err) {
        console.warn('Radio Browser no respondió; se usan las emisoras guardadas:', err.message);
        guardado = {
          hasta: Date.now() + DIEZ_MINUTOS,
          estilos: ESTILOS.map((e) => ({ id: e.id, nombre: e.nombre, emoji: e.emoji, emisoras: respaldo(e) })),
        };
      }
      return guardado.estilos;
    },
    // Para las pruebas: cambia cómo se le pregunta a la API y borra lo guardado.
    usarBuscador(fn) { pedir = fn; guardado = null; },
  };
}

module.exports = { crearRadio, ESTILOS };
