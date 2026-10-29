# Solvexxa AI

Solvexxa AI es una aplicación web moderna de chat con IA pensada para Android, escritorio y despliegue gratuito con Cloudflare.

## Stack

- Frontend: React + Vite
- Backend compatible con Cloudflare Workers
- Persistencia local: IndexedDB para historial del navegador
- Integración IA: OpenRouter API
- PWA: manifest + service worker

## Requisitos

- Node.js 18+
- npm
- Cuenta en OpenRouter con una API key
- (Opcional) acceso a Cloudflare Pages / Workers para desplegar

## Variables de entorno

Copia `.env.example` y configura tu clave real, o usa las variables secretas del worker al desplegar.

Importante:
- Nunca guardes la clave en el frontend.
- Nunca la subas a GitHub ni la guardes en localStorage.

## Ejecutar localmente

```bash
npm install
npm run dev
```

La app quedará disponible en:

- Frontend: http://localhost:5173
- Worker local: http://localhost:8787

## Configuración de OpenRouter

1. Crea una cuenta en https://openrouter.ai
2. Genera una clave API
3. Configura la variable `OPENROUTER_API_KEY` en tu entorno de producción o en `.env.local` para desarrollo local si usas un proxy local
4. Opcionalmente ajusta:
   - `OPENROUTER_MODEL`
   - `OPENROUTER_SITE_URL`
   - `OPENROUTER_SITE_NAME`

## Despliegue gratis

### Cloudflare Workers

```bash
npm install
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler deploy worker/index.js
```

Luego configura tu dominio o usa la URL pública que Cloudflare te asigne.

## Limitaciones reales

- La API de OpenRouter requiere una clave válida para responder.
- El plan gratuito de Cloudflare y OpenRouter puede tener límites de uso y tokens.
- La app de voz depende del soporte del navegador del dispositivo.
- La PWA requiere HTTPS real para instalación completa en Android.

## Historial local

La aplicación guarda conversaciones en IndexedDB del navegador para que puedan persistir tras recargar la página. No se envía información sensible a la caché del service worker.

## Archivos clave

- `src/App.jsx`: interfaz principal
- `src/lib/storage.js`: persistencia local
- `worker/index.js`: backend seguro para OpenRouter
- `public/sw.js`: service worker de PWA
- `public/manifest.webmanifest`: configuración de instalación
- `.env.example`: ejemplo de variables sin secretos reales

## Estado actual

La base funcional se dejó lista para configurar modelos, probar en local y desplegar. Para que la IA responda de verdad, debe configurarse la clave real de OpenRouter en el entorno de ejecución.
