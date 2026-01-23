# Guía de Despliegue - Chessbitz

Esta guía explica cómo subir el proyecto a GitHub, desplegarlo en Cloudflare Pages y conectar tu dominio de OVH.

## 1. Subir a GitHub

El proyecto ya tiene git inicializado localmente. Ahora necesitas subirlo a un repositorio remoto.

1.  Ve a [GitHub](https://github.com) e inicia sesión.
2.  Crea un **Nuevo Repositorio** (New Repository).
    *   Nombre: `chessbitz` (o el que prefieras).
    *   Público o Privado: A tu elección.
    *   **No** inicialices con README, .gitignore o licencia (ya los tenemos).
3.  Copia la URL del repositorio (tipo `https://github.com/tu-usuario/chessbitz.git`).
4.  En tu terminal (en la carpeta del proyecto), ejecuta:

```bash
git remote add origin <URL_DE_TU_REPO>
git branch -M main
git push -u origin main
```

## 2. Desplegar en Cloudflare Pages

1.  Ve al [Dashboard de Cloudflare](https://dash.cloudflare.com/) e inicia sesión.
2.  Ve a **Workers & Pages** > **Create application** > **Pages** > **Connect to Git**.
3.  Selecciona tu repositorio de GitHub (`chessbitz`).
4.  Configura el despliegue:
    *   **Project name:** `chessbitz`
    *   **Production branch:** `main`
    *   **Framework preset:** Selecciona `Astro`.
    *   **Build command:** `npm run build`
    *   **Build output directory:** `dist`
5.  Haz clic en **Save and Deploy**. Cloudflare construirá tu sitio (tardará un minuto).

## 3. Configurar Dominio en OVH

Una vez desplegado, Cloudflare te dará una URL tipo `chessbitz.pages.dev`. Para usar tu dominio `chessbitz.com`:

### Opción A: Usar DNS de Cloudflare (Recomendado)
Es la opción más rápida y te da HTTPS automático y seguridad extra.

1.  En Cloudflare, ve a **Websites** > **Add Site** > Escribe `chessbitz.com`.
2.  Selecciona el plan **Free**.
3.  Cloudflare escaneará tus DNS actuales. Continúa.
4.  Cloudflare te dirá: "Replace these nameservers". Te dará dos (ej: `bob.ns.cloudflare.com` y `linda.ns.cloudflare.com`).
5.  Ve a tu panel de **OVH Cloud**.
6.  Selecciona tu dominio `chessbitz.com`.
7.  Ve a la pestaña **Servidores DNS**.
8.  Sustituye los servidores de OVH por los dos que te dio Cloudflare.
9.  Guarda y espera (puede tardar de 1h a 24h en propagarse).
10. Una vez activo, ve a tu proyecto en **Cloudflare Pages** > **Custom domains** > **Set up a custom domain** > Escribe `chessbitz.com`. Cloudflare lo validará automáticamente.

### Opción B: Usar CNAME en OVH (Si quieres mantener DNS en OVH)
1.  En **Cloudflare Pages**, ve a **Custom domains** > **Set up a custom domain** > Escribe `chessbitz.com` (o `www.chessbitz.com`).
2.  Cloudflare te pedirá añadir un registro DNS.
3.  Ve a tu panel de **OVH Cloud** > Dominio > **Zona DNS**.
4.  Añade un registro:
    *   Tipo: `CNAME`
    *   Subdominio: `www` (si usas www) o `@` (si permite CNAME en raíz, aunque a veces da problemas, mejor usar `www`).
    *   Destino: `chessbitz.pages.dev.` (con el punto al final).
5.  Cloudflare verificará el registro y activará el SSL.

¡Listo! Tu web debería estar online.
