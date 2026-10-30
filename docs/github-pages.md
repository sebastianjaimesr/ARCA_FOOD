# Publicación en GitHub Pages (modo vitrina)

Sitio: **https://sebastianjaimesr.github.io/ARCA_FOOD/**

GitHub Pages solo sirve archivos estáticos: no puede ejecutar el backend ni la
base de datos. Por eso allí se publica la tienda en **modo vitrina**.

| | Modo vitrina (Pages) | Modo completo (con backend) |
|---|---|---|
| Menú, búsqueda, categorías | ✅ desde `frontend/src/static/catalog.json` | ✅ desde la base de datos |
| Carrito, variantes, adicionales | ✅ mismas reglas de precio del backend | ✅ |
| Pedido por WhatsApp | ✅ referencia `WEB-…`, no se guarda | ✅ código `ARC-…` guardado como PENDIENTE |
| Consulta de pedido | ❌ (se pregunta por WhatsApp) | ✅ |
| Panel administrativo, inventario, estadísticas | ❌ | ✅ |
| Cambios de precios desde el panel | ❌ (hay que exportar y volver a publicar) | ✅ inmediato |

El código es el mismo: el modo se elige al compilar con `VITE_STATIC_MODE=true`.
Los precios del modo vitrina se calculan con `backend/src/domain/pricing.ts` y los
datos del cliente se validan con `backend/src/validators/orders.validators.ts`:
no hay reglas duplicadas.

## Cómo se publica

Cada `git push` a `main` ejecuta `.github/workflows/pages.yml`:

1. Instala dependencias y corre las pruebas del frontend.
2. Compila con `VITE_STATIC_MODE=true` y `VITE_BASE=/ARCA_FOOD/`.
3. Publica `frontend/dist` en GitHub Pages.

Requisito (una sola vez): **Settings → Pages → Build and deployment → Source:
GitHub Actions**.

## Actualizar la carta publicada

La carta del sitio es una copia exportada de la base de datos local:

```bash
npx supabase start          # base local con la carta
npm run dev:backend         # API en http://localhost:4000
# …cambia precios o productos desde el panel local (/admin)…
node scripts/export-catalog.mjs
git add frontend/src/static/catalog.json
git commit -m "Actualiza la carta publicada"
git push                    # se vuelve a publicar solo
```

## Detalles técnicos

- `404.html` es una copia de `index.html`: GitHub Pages lo sirve en rutas como
  `/ARCA_FOOD/menu` y la aplicación muestra la página correcta. El servidor
  responde con estado 404 en esas rutas internas (limitación de Pages), aunque
  el visitante ve la página normal.
- Pages no permite cabeceras HTTP propias: el CSP va en una etiqueta `<meta>`
  (solo conexiones al propio sitio). `frame-ancestors` no aplica desde `<meta>`.
- El panel administrativo y el cliente de Supabase no se incluyen en este build.

## Pasar al modo completo

Cuando el backend y Supabase estén en la nube (ver `docs/despliegue.md`), el
sitio se publica sin `VITE_STATIC_MODE` y con `VITE_API_URL`,
`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Desde ese momento los pedidos se
registran y el panel funciona.
