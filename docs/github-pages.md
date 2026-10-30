# Publicación en GitHub Pages (modo vitrina)

Sitio: **https://sebastianjaimesr.github.io/ARCA_FOOD/**

GitHub Pages solo sirve archivos estáticos: no puede ejecutar el backend ni la
base de datos. Por eso allí se publica la tienda en **modo vitrina**.

| | Modo vitrina / demostración (Pages) | Modo completo (con backend) |
|---|---|---|
| Menú, búsqueda, categorías | ✅ carta inicial de `frontend/src/static/catalog.json` | ✅ desde la base de datos |
| Carrito, variantes, adicionales | ✅ mismas reglas de precio del backend | ✅ |
| Pedido por WhatsApp | ✅ referencia `WEB-…` | ✅ código `ARC-…` |
| ¿Dónde se guardan pedidos y cambios? | LocalStorage de **cada navegador** | PostgreSQL (compartido) |
| Panel: dashboard, pedidos, menú, catálogo, configuración | ✅ demostración (datos de este navegador) | ✅ |
| Inventario por unidades, consulta de pedido | ❌ | ✅ |
| Inicio de sesión | usuario + hash en el navegador (no es seguridad real) | Supabase Auth + roles en el backend |

El código es el mismo: el modo se elige al compilar con `VITE_STATIC_MODE=true`.
Precios y validación del pedido usan `backend/src/domain/pricing.ts` y
`backend/src/validators/orders.validators.ts`; el panel de demostración usa las
transiciones de `backend/src/domain/order-status.ts` y los validadores de
`backend/src/validators/admin.validators.ts`. No hay reglas duplicadas.

## Panel de demostración (`/ARCA_FOOD/admin`)

- Usuario: `sebasjaimes222`. La contraseña **no está en el código**: solo su hash
  PBKDF2-SHA256 (210 000 iteraciones, con sal) en `frontend/src/local/local-auth.ts`.
- Dashboard (ventas de pedidos entregados, ticket promedio, pedidos del periodo,
  más vendidos) con filtro Hoy / Esta semana / Este mes, gestión de pedidos con
  sus estados, CRUD del menú y de adicionales, configuración y una **Guía de
  producción** dentro del panel.
- La tienda y el panel abiertos **en el mismo navegador** se sincronizan al
  instante, también entre pestañas.

Limitaciones que hay que tener claras:

1. **Cada navegador tiene su propia base.** Un pedido hecho desde el celular de un
   cliente no aparece en el panel del restaurante: llega por WhatsApp. Para un
   panel compartido hace falta el modo completo.
2. **El login no es seguridad real.** El sitio es estático y su código es público;
   alguien con conocimientos puede saltarse la pantalla de login. Como cada quien
   solo ve los datos de su propio navegador, no expone pedidos de otras personas.
3. La contraseña actual es débil y su hash es público: se puede adivinar. No la
   reutilices en ningún otro servicio.
4. Borrar los datos del navegador borra pedidos y cambios. En la Guía del panel
   hay botones para descargar un respaldo JSON o restablecer la demostración.

Cambiar la contraseña (genera el hash sin escribirla en ningún archivo):

```bash
node -e "const c=require('crypto').webcrypto;(async()=>{const s=c.getRandomValues(new Uint8Array(16));const k=await c.subtle.importKey('raw',new TextEncoder().encode(process.argv[1]),'PBKDF2',false,['deriveBits']);const b=await c.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:s,iterations:210000},k,256);console.log({salt:Buffer.from(s).toString('base64'),hash:Buffer.from(new Uint8Array(b)).toString('base64')})})()" "NUEVA-CONTRASEÑA"
```

Copia `salt` y `hash` en `CREDENTIALS` de `frontend/src/local/local-auth.ts` y haz push.

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
