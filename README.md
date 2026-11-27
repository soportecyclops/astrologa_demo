# Selene Aldana · Astrología (demo)

Landing inmersiva (Vite + TypeScript + three.js + GSAP/ScrollTrigger + Lenis) con turnero (Express + JSON) y panel admin.

## Uso
```
npm install
npm run dev      # web en :5173 y API en :3001
npm run build    # tsc + vite build → dist/
npm start        # sirve la API (y dist/ si existe)
```
Panel: `/admin.html`. Clave por defecto `astro-demo`; definí `ADMIN_PASSWORD` en producción.

## Estructura
- `src/ephemeris.ts` todo el cálculo (astronomy-engine): posiciones, fase lunar, eventos, ascendente.
- `src/scene.ts` orrery 3D · `src/wheel.ts` rueda SVG · `src/booking.ts` turnero · `server/index.js` API.
- `content/*.json` textos editables: `site` (textos, bio, testimonios, WhatsApp), `servicios` (precio/duración), `horarios` (franjas semanales), `casas`, `signos`, `ciudades`.
- `data/db.json` turnos y bloqueos (se crea solo, no se versiona).

## Notas honestas
- Casas por **signo entero** desde el ascendente (no Placidus). Sin hora o ciudad, solo planetas en signos.
- No hay recordatorio automático por WhatsApp: ningún stack previo lo tenía. Hay botón de WhatsApp y `.ics` al confirmar.
- Textos interpretativos y testimonios son placeholders. Audio ambiente generado con `scripts/gen-audio.mjs`.

## Deploy en Vercel
El front se despliega tal cual (`npm run build`, salida `dist`). El archivo JSON no persiste en funciones serverless de Vercel: para el turnero usá un host Node (Render/Railway/VPS) con `npm start` y apuntá `/api` ahí con un rewrite en `vercel.json`, o migrá `data/db.json` a Vercel KV/Postgres.
