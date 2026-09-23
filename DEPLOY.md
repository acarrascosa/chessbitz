# Despliegue en Cloudflare Workers

Chessbitz se sirve desde un **Cloudflare Worker con archivos estáticos**:

- Astro genera el sitio estático en `dist/` (`npm run build`, que además renderiza las imágenes Open Graph).
- El Worker (`worker/index.ts`) solo intercepta `/api/*` y las portadas `/` y `/en/` (para inyectar la previsualización del día). Todo lo demás lo sirve directamente el almacén de assets.
- Las estadísticas globales anónimas se guardan en **D1** (`migrations/`).

La configuración completa está en [`wrangler.jsonc`](wrangler.jsonc).

## 1. Crear la base de datos D1 (una sola vez)

```bash
npx wrangler login
npx wrangler d1 create chessbitz
```

Copia el `database_id` que devuelve el comando y sustituye el valor de ejemplo en `wrangler.jsonc`:

```jsonc
"database_id": "00000000-0000-0000-0000-000000000000"
```

Después aplica las migraciones en remoto:

```bash
npx wrangler d1 migrations apply chessbitz --remote
```

Haz commit del `wrangler.jsonc` con el id real.

Cada migración nueva de `migrations/` (por ejemplo `0002_hints_and_time.sql`, que añade las sumas de pistas y tiempo) se aplica igual, **antes** de desplegar el código que la usa:

```bash
npx wrangler d1 migrations apply chessbitz --remote
```

Las migraciones son aditivas: los resultados enviados antes siguen contando como jugadores, pero no entran en las medias de pistas y tiempo.

## 2. Ajustes de Workers Builds

El Worker `chessbitz` ya está conectado al repositorio. En **Workers & Pages → chessbitz → Settings → Build**:

| Ajuste | Valor |
| --- | --- |
| Build command | *(vacío: lo ejecuta `wrangler deploy` desde `build.command`)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| Variable de entorno | `NODE_VERSION = 22` |

## 3. Mover el dominio de Pages al Worker

No hay "transferencia" entre Pages y Workers: se libera el dominio en Pages y el Worker lo reclama al desplegar.

1. **Workers & Pages → (proyecto de Pages) → Custom domains**: elimina `chessbitz.com` y `www.chessbitz.com`.
2. **DNS** de `chessbitz.com`: borra los registros `CNAME` que apuntaban a `*.pages.dev` si no se han borrado solos.
3. Despliega el Worker (haciendo push a `master` o con `npx wrangler deploy`). Las rutas `custom_domain` de `wrangler.jsonc` crean los registros DNS y el certificado automáticamente.

La web solo está sin servicio los minutos que pasan entre el paso 1 y el 3.

### Redirigir `www` al dominio raíz

`www.chessbitz.com` no se sirve desde el Worker: una Redirect Rule de Cloudflare lo manda a `https://chessbitz.com` antes de que la petición llegue a ningún origen.

1. **DNS → Records**: `www` debe existir y estar **proxied** (nube naranja). Vale el `CNAME www → chessbitz.com` o un `AAAA www → 100::`; el destino da igual porque nunca se contacta.
2. **Rules → Redirect Rules → Create rule** (o la plantilla *Redirect from WWW to root*):
   - *If incoming requests match*: `Hostname` `equals` `www.chessbitz.com`
   - *Then*: `Dynamic`, expresión `concat("https://chessbitz.com", http.request.uri.path)`
   - *Status code*: `301`, marcando *Preserve query string*
3. Comprueba: `curl -I https://www.chessbitz.com/en/` debe responder `301` con `location: https://chessbitz.com/en/`.

## 4. Comprobar

```bash
curl -I https://chessbitz.com/
curl https://chessbitz.com/api/stats/0
curl https://chessbitz.com/api/summary
curl -s https://chessbitz.com/ | grep 'og:image'
```

## 5. Limpieza

Cuando el Worker lleve unos días sirviendo sin problemas, desconecta el repositorio del proyecto de Pages (o bórralo) para que deje de compilar con cada push.

## Desarrollo local del Worker

```bash
npx wrangler d1 migrations apply chessbitz --local
npx wrangler dev          # compila el sitio y sirve Worker + assets + D1 local en :8787
```

Para trabajar solo en la interfaz basta con `npm run dev`: sin el Worker, las estadísticas globales simplemente no se muestran.

## 4. Batallas (Durable Objects)

Las batallas usan un **Durable Object** por mesa (`BattleRoom`, en `worker/battle.ts`), declarado en `wrangler.jsonc` con su migración (`new_sqlite_classes`). No hay que crear nada a mano: el primer `wrangler deploy` registra la clase y la migración `v1`. Los Durable Objects con almacenamiento SQLite están incluidos en el plan gratuito de Workers.

- Las mesas viven solo en el Durable Object: se borran solas una hora después de quedarse vacías y no tocan D1.
- `BATTLE_LIMITER` limita las conexiones a mesas (30 por minuto e IP; la IP no se guarda).
- Si alguna vez se renombra o elimina la clase `BattleRoom`, hay que añadir una migración nueva (`renamed_classes` o `deleted_classes`) en lugar de editar la `v1`.

## 5. Actividad de Discord (solo la Batalla)

Chessbitz puede jugarse dentro de Discord como **Actividad**: el iframe de Discord carga `https://<client_id>.discordsays.com/?instance_id=…&frame_id=…`, su proxy lo reenvía a `chessbitz.com` y el Worker sirve la página `/discord/` (solo la batalla). Todo el que se une a la actividad se sienta en la misma mesa (un Durable Object por instancia). Al terminar, el bot publica el podio en el canal y, al día siguiente a las 17:00 UTC, un recordatorio con un botón **Jugar** que abre la actividad.

Sin configurar, `/api/discord/*` responde 503 y el resto de la web funciona igual.

### 5.1 Crear la aplicación en Discord (una vez)

En <https://discord.com/developers/applications> → **New Application** (Chessbitz):

1. **General Information**: copia el **Application ID** y la **Public Key**. Icono de la app: [`public/media/discord/app-icon.png`](public/media/discord/app-icon.png) (1024×1024); cartel del bot (pestaña **Bot**): [`public/media/discord/banner.png`](public/media/discord/banner.png) (680×240). Se regeneran con `node scripts/discord-assets.mjs`. Condiciones del servicio: `https://chessbitz.com/legal/`; política de privacidad: `https://chessbitz.com/legal/#privacy`.
2. **OAuth2**: pulsa **Reset Secret** y copia el **Client Secret**. En **Redirects** añade `https://127.0.0.1` y guarda: Discord exige al menos una *redirect URI* para que funcione `authorize` del SDK, aunque en una actividad nunca se use (el SDK hace la redirección).
   Sin ella, la actividad muestra «No se pudo conectar con Discord» con el detalle `authorize: …`.
3. **Bot**: **Reset Token** y copia el token. No necesita *privileged intents*.
4. **Installation**: en **Installation Contexts** marca **User Install** y **Guild Install**. *User Install* permite que cualquiera añada la app a su cuenta y la abra en cualquier servidor o MD sin que un administrador la instale. En *Guild Install* añade los scopes `applications.commands` y `bot` con los permisos **View Channels** y **Send Messages**. Usa el enlace de instalación para añadir la app a tu servidor de pruebas.
5. **Activities → Settings**: marca **Enable Activities**. Discord crea solo el comando de entrada *Launch* (lo gestiona Discord).
6. **Activities → URL Mappings**: `/` → `chessbitz.com` (sin `https://`). No hacen falta más mapeos: todas las peticiones de la actividad (páginas, `/_astro`, `/api` y el WebSocket de la mesa) van al mismo dominio. Ya no se necesita el prefijo `/.proxy/`.
7. **General Information → Interactions Endpoint URL**: `https://chessbitz.com/api/discord/interactions`. Discord lo verifica al guardar, así que hazlo **después** de desplegar con la Public Key configurada. Es lo que hace que los botones *Jugar* / *Revancha* de los mensajes abran la actividad.

### 5.2 Configurar el Worker

Valores públicos en `wrangler.jsonc` (`vars`), ya configurados con la app de Chessbitz:

```jsonc
"vars": {
  "DISCORD_CLIENT_ID": "<Application ID>",
  "DISCORD_PUBLIC_KEY": "<Public Key>"
},
```

Secretos (no van al repositorio):

```bash
npx wrangler secret put DISCORD_CLIENT_SECRET
```

```bash
npx wrangler secret put DISCORD_BOT_TOKEN
```

Migración de la tabla de recordatorios, **antes** de desplegar:

```bash
npx wrangler d1 migrations apply chessbitz --remote
```

El cron (`triggers.crons` en `wrangler.jsonc`) se registra solo al desplegar.

### 5.3 Cabeceras y CSP

- **Nuestro lado:** Chessbitz no envía `X-Frame-Options` ni `Content-Security-Policy: frame-ancestors`, así que Discord puede incrustarlo sin cambios. Si algún día se añaden cabeceras de seguridad (p. ej. una *Transform Rule* de Cloudflare), hay que permitir `frame-ancestors https://discord.com https://*.discordsays.com` al menos en `/` y `/discord/`.
- **Lado de Discord:** la CSP del iframe solo permite peticiones al propio proxy (`<client_id>.discordsays.com`). La página de Discord solo pide rutas relativas del mismo dominio, las fuentes están autoalojadas y los enlaces externos (Lichess) se abren con `openExternalLink` del SDK. Si en el futuro se cargan recursos de otro dominio (p. ej. avatares de `cdn.discordapp.com`), hay que añadir un URL mapping y usar `patchUrlMappings`.

### 5.4 Desarrollo local dentro de Discord (túnel)

1. Instala el túnel de Cloudflare: `brew install cloudflared`.
2. Crea `.dev.vars` en la raíz (está en `.gitignore`):

   ```ini
   DISCORD_CLIENT_ID=<Application ID>
   DISCORD_PUBLIC_KEY=<Public Key>
   DISCORD_CLIENT_SECRET=<Client Secret>
   DISCORD_BOT_TOKEN=<Bot Token>
   ```

3. Aplica las migraciones en local y arranca el Worker (la primera vez construye el sitio y las imágenes OG, ~90 s):

   ```bash
   npx wrangler d1 migrations apply chessbitz --local
   ```

   ```bash
   npx wrangler dev --port 8787 --test-scheduled
   ```

4. En otra terminal abre el túnel y copia la URL `https://<algo>.trycloudflare.com`:

   ```bash
   cloudflared tunnel --url http://localhost:8787
   ```

5. En el Developer Portal cambia temporalmente **URL Mappings** `/` → `<algo>.trycloudflare.com` y, si quieres probar los botones, la **Interactions Endpoint URL** a `https://<algo>.trycloudflare.com/api/discord/interactions`. La URL del túnel rápido cambia cada vez que lo arrancas (un túnel con nombre la mantiene).
6. En Discord, entra en un canal de voz (o de texto) del servidor de pruebas → icono del cohete (**App Launcher**) → Chessbitz. Para ver la consola: Ajustes → Avanzado → **Modo desarrollador**, y `Ctrl/Cmd + Shift + I` en la app de escritorio.
7. Para probar el recordatorio sin esperar a mañana, cambia el día de la última partida y dispara el cron:

   ```bash
   npx wrangler d1 execute chessbitz --local --command "UPDATE discord_battles SET day = day - 1"
   ```

   ```bash
   curl "http://localhost:8787/cdn-cgi/handler/scheduled?cron=0+17+*+*+*"
   ```

   Al terminar, vuelve a poner los mapeos de producción.

**Sin Discord:** con `DISCORD_MOCK=1` en `.dev.vars` (y nada más), `http://localhost:8787/?frame_id=x&instance_id=y&mock_user=Ana` simula el cliente con el mock del SDK. Los mensajes al canal se imprimen en la consola de `wrangler dev`. Abre un segundo jugador en `http://127.0.0.1:8787/…&mock_user=Bea`: otro origen, otra identidad. El mock solo se acepta en `localhost`.

### 5.5 Que aparezca para todo el mundo (App Directory)

Sin publicar, la app solo la ven su equipo y quien la instala. Para que salga en el **App Directory** y en la búsqueda del **App Launcher** (el cohete) de cualquier usuario:

1. **User Install** activado (5.1), para que se pueda usar sin permisos de administrador.
2. **App Verification** (menú del portal): el propietario verifica su identidad (Stripe Identity) y la app. Hace falta 2FA en la cuenta, condiciones y política de privacidad públicas (`https://chessbitz.com/legal/` y `…/legal/#privacy`) y contenido apto para mayores de 13 años.
3. **Discovery → Discovery Settings**: descripción, al menos 1 etiqueta (hasta 5), icono, capturas y categoría. Las capturas (1920×1080) están en `public/media/discord/media-*.png`, así que se publican en `https://chessbitz.com/media/discord/…` (Discovery pide enlaces), y se regeneran con `npx playwright test -c scripts/discord-media.config.ts`. Después, **Enable Discovery**. Tarda hasta 24 h en aparecer.

Juegos como Wordle salen sin buscarlos porque son actividades de Discord o de socios que Discord destaca (colecciones, *staff picks*). Eso no se solicita: depende del uso y de que Discord la elija.

### 5.6 Limitaciones

- El bot solo puede escribir donde está instalado: en canales de servidores. Si la actividad se abre en un MD o grupo, se juega igual pero no hay podio ni recordatorio en el chat.
- Cada canal guarda solo su última batalla (IDs de canal y de jugadores, ganador y puntos) y se olvida tras 30 días sin jugar.
