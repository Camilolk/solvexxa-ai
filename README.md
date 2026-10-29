# Solvexxa AI

Solvexxa AI es una PWA de chat con IA para Android, escritorio y web, con historial local en IndexedDB y un worker seguro de Cloudflare.

## Requisitos

- Node.js 18+
- npm
- Una cuenta en OpenRouter con clave API activa
- Cloudflare account para producción

## Configuración local

1. Instala dependencias:

```bash
npm install
```

2. Crea tu entorno local a partir del ejemplo:

```bash
cp .env.example .env.local
```

3. Completa las variables reales del backend:

```env
OPENROUTER_API_KEY=tu_clave_real
OPENROUTER_MODEL=openai/gpt-4o-mini
OPENROUTER_SITE_URL=https://tu-dominio.com
OPENROUTER_SITE_NAME=Solvexxa AI
ALLOWED_MODELS=openai/gpt-4o-mini,anthropic/claude-3.5-sonnet,google/gemini-2.0-flash-exp
```

Importante:
- No guardes la key en el frontend.
- No la subas a GitHub.
- NUNCA la guardes en localStorage ni IndexedDB.

## Ejecutar localmente

Frontend:

```bash
npm run dev
```

Worker local:

```bash
npm run worker:dev
```

Endpoints esperados:

- Frontend: http://localhost:5173
- Worker: http://localhost:8787/healthz
- Proxy API Vite: /api/chat y /api/models

## Validación de compilación

```bash
npm run build
```

Si el build falla, corrige primero los errores de compilación antes de desplegar.

## Pruebas

```bash
npm test
```

La suite disponible debe comprobar rutas del worker y utilidades clave. Si el entorno no tiene dependencias instaladas, no se ejecutará.

## Despliegue en Cloudflare Workers + Assets

1. Inicia sesión:

```bash
npx wrangler login
```

2. Configura los secretos:

```bash
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put OPENROUTER_MODEL
npx wrangler secret put OPENROUTER_SITE_URL
npx wrangler secret put OPENROUTER_SITE_NAME
```

3. Compila el frontend:

```bash
npm run build
```

4. Despliega el worker y los assets:

```bash
npx wrangler deploy
```

La configuración del proyecto usa `wrangler.json` para servir el directorio `dist` como assets y resolver `/api/*` usando el worker.

## Seguridad

- La API key vive exclusivamente en Cloudflare Worker / entorno seguro.
- El worker valida CORS, modelos permitidos y tamaño de solicitudes.
- Las rutas `/api/*` no se cachean en el service worker.
- La app no guarda secretos ni tokens del backend.

## PWA y Android

- El manifiesto se sirve desde `/manifest.webmanifest`.
- El service worker solo cachea el shell de la app y evita `/api/*`.
- La UI está adaptada para pantallas pequeñas y móviles.
- La instalación en Android requiere HTTPS real, normalmente vía Cloudflare Pages o dominio con TLS activo.

## Estado actual

La base del proyecto ya está corregida y preparada para validación real. La funcionalidad completa con OpenRouter requiere una clave válida configurada en el entorno seguro del worker y una validación final con build y runtime.
