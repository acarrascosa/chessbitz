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
