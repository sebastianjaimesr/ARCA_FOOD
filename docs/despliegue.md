# Despliegue a producción

Esta guía deja el sistema publicado con tres piezas. **Nada de esto está
contratado ni publicado todavía**: cada paso con una cuenta o un costo lo decide
el dueño del negocio.

```
Navegador ──► Sitio estático (Cloudflare Pages o Netlify)     https://elarca.example
   │                │  _headers: CSP, anti-iframe, caché
   │                ▼
   ├──────────► API Express (Docker: Render, Railway o Fly)     https://api.elarca.example
   │                │  TLS ──► PostgreSQL de Supabase (session pooler)
   └──────────► Supabase Auth (solo login del panel)            https://xxxx.supabase.co
```

> Reemplaza `elarca.example` por el dominio real. Los planes gratuitos de estos
> servicios existen pero tienen límites (pausas por inactividad, arranque lento,
> sin copias automáticas). Revisa precios y condiciones vigentes antes de elegir.

## 0. Requisitos

- Node.js 22 o superior (probado con 24) y npm.
- Docker (solo para probar la imagen del backend en local).
- Cuenta de GitHub con el repositorio subido (los hostings despliegan desde ahí).
- Dominio propio (recomendado) con acceso a su DNS.

Antes de empezar, en local:

```bash
npm ci
npm run lint && npm run typecheck && npm test && npm run db:test && npm run build
```

## 1. Base de datos y autenticación (Supabase)

1. Crea un proyecto en supabase.com. Región sugerida: **South America (São Paulo)**,
   la más cercana a Bucaramanga. Guarda la contraseña de la base en un gestor de
   contraseñas (no en el repositorio).
2. Aplica las migraciones (esquema, seguridad y carta 2025):
   ```bash
   npx supabase login
   npx supabase link --project-ref <id-del-proyecto>
   npx supabase db push
   ```
   `db push` aplica `supabase/migrations/*.sql` en orden. **No** ejecutes
   `db reset` contra producción: borra todo.
3. **Authentication → Providers → Email**: deja el proveedor activo y desactiva
   *Allow new users to sign up*. Solo el personal tendrá cuenta.
4. **Authentication → URL Configuration → Site URL**: `https://elarca.example`.
5. Datos que necesitarás (Project Settings):
   - *API → Project URL* → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - *API → anon / publishable key* → `VITE_SUPABASE_ANON_KEY` (pública)
   - *API → service_role / secret key* → `SUPABASE_SERVICE_ROLE_KEY` (**secreta, solo backend**)
   - *Database → Connection string → Session pooler* → `DATABASE_URL` (funciona con IPv4)
   - *Database → SSL Configuration → Download certificate* → `DATABASE_CA_CERT`
6. Comprueba la seguridad de las tablas desde tu computador (debe fallar el acceso):
   ```bash
   npx supabase test db --linked
   ```

## 2. Primera cuenta administradora

1. **Authentication → Users → Add user → Create new user**: correo del
   administrador, contraseña fuerte, *Auto Confirm User*.
2. Dale el rol en **SQL Editor**:
   ```sql
   update public.profiles set role = 'admin' where email = 'correo@elarca.example';
   ```
   (o desde tu computador: `DATABASE_URL=<producción> npm run set-role -w backend -- correo admin`).
3. Para el personal de cocina o caja usa `'staff'`.

La recuperación de contraseña por correo no está implementada: un administrador
la cambia desde **Authentication → Users**.

## 3. API (backend)

Se despliega como contenedor con `backend/Dockerfile` (contexto: raíz del repo).

**Render** (otros hostings son equivalentes):

1. *New → Web Service* → conecta el repositorio → *Runtime: Docker*.
2. *Dockerfile path*: `backend/Dockerfile` · *Docker context*: `.` (raíz).
3. *Health check path*: `/api/health` (responde 503 si la base no responde).
4. Variables de entorno:

| Variable | Valor |
|---|---|
| `NODE_ENV` | `production` |
| `PORT` | el que indique el hosting (Render usa `10000` o inyecta `PORT`) |
| `TRUST_PROXY` | `1` (hay un proxy del hosting delante) |
| `CORS_ORIGINS` | `https://elarca.example,https://www.elarca.example` (solo https) |
| `DATABASE_URL` | session pooler de Supabase |
| `DATABASE_SSL` | `verify-full` (o `require` como mínimo) |
| `DATABASE_CA_CERT` | contenido del certificado, en una línea con `\n` |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | clave service_role (secreta) |
| `LOG_LEVEL` | `info` |

El servidor **se niega a arrancar** si en producción falta algo, si
`DATABASE_SSL=disable` o si algún origen CORS no es https.

Notas:
- El límite de solicitudes vive en memoria: usa **una sola instancia**. Para
  varias, hay que mover el límite a un almacén compartido (Redis).
- En planes gratuitos el servicio puede dormirse y tardar en la primera visita.
  Para un restaurante abierto al público conviene un plan siempre activo.

Prueba local de la imagen:

```bash
docker build -f backend/Dockerfile -t el-arca-api .
docker run --rm -p 4000:4000 --env-file backend/.env el-arca-api
```

## 4. Sitio (frontend)

**Cloudflare Pages** (Netlify funciona igual con los mismos archivos):

1. *Create → Pages → Connect to Git* → el repositorio.
2. *Build command*: `npm ci && npm run build -w @el-arca/frontend`
3. *Build output directory*: `frontend/dist`
4. Variables de entorno **del build** (quedan visibles en el navegador; solo valores públicos):

| Variable | Valor |
|---|---|
| `NODE_VERSION` | `24` |
| `VITE_API_URL` | `https://api.elarca.example` |
| `VITE_SUPABASE_URL` | Project URL de Supabase |
| `VITE_SUPABASE_ANON_KEY` | clave anon/publishable (pública) |

El build genera `dist/_headers` (CSP con la API y Supabase permitidas,
`X-Frame-Options: DENY`, HSTS, caché de un año para `/assets/*`) y
`dist/_redirects` (todas las rutas sirven `index.html`). Si cambias la URL de la
API, **vuelve a compilar**: el CSP se arma en el build.

Para revisar el build tal como se publicará:

```bash
npm run build -w @el-arca/frontend && npm run preview -w @el-arca/frontend
```

## 5. Dominio y HTTPS

- `elarca.example` (y `www`) → dominio personalizado del sitio en Cloudflare
  Pages/Netlify.
- `api.elarca.example` → dominio personalizado del servicio en Render (registro
  CNAME que indique el hosting).
- Ambos emiten certificados HTTPS automáticamente. Verifica que `http://`
  redirija a `https://`.
- Actualiza `CORS_ORIGINS` (backend) y `VITE_API_URL` (frontend) con los
  dominios finales y vuelve a desplegar ambos.

## 6. Configuración del negocio (desde el panel)

En `/admin/configuracion`, con la cuenta administradora:

- WhatsApp de pedidos: `573006681727` (ya viene cargado de la carta). Haz un
  pedido de prueba coordinado con el restaurante y confirma que el mensaje llega.
- Horario, zonas y tarifas de domicilio cuando el restaurante las entregue.
- Revisa dirección, Instagram y la nota de domicilios.
- Activa el inventario solo en los productos que se cuentan por unidad y
  registra una entrada con el conteo inicial.

## 7. Imágenes (Cloudinary)

Hoy el formulario de producto acepta un **enlace https** de la foto: ya puedes
subir las fotos a Cloudinary (o cualquier almacenamiento con https) y pegar el
enlace. El CSP permite imágenes https.

La subida directa desde el panel está pendiente: requiere una cuenta de
Cloudinary y un *upload preset* firmado desde el backend (para validar tipo y
tamaño del archivo y no exponer secretos). Cuando exista la cuenta se agregan
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` al
backend.

## 8. Copias de seguridad

- Planes pagos de Supabase incluyen copias diarias automáticas; el gratuito no.
- Copia manual (recomendado semanal, y antes de cada cambio grande):
  ```bash
  npx supabase db dump --db-url "$DATABASE_URL" -f respaldo-esquema.sql
  npx supabase db dump --db-url "$DATABASE_URL" --data-only -f respaldo-datos.sql
  ```
  Guarda los archivos fuera del repositorio (contienen datos personales de
  clientes) y en un lugar cifrado.
- Restauración en un proyecto nuevo: `psql "$DATABASE_URL" -f respaldo-esquema.sql`
  y luego `-f respaldo-datos.sql`. Prueba la restauración al menos una vez.

## 9. Verificación después de publicar

Automática (solo lee; no crea pedidos):

```bash
node scripts/smoke.mjs --api https://api.elarca.example --site https://elarca.example \
  --supabase https://xxxx.supabase.co --anon <clave anon>
```

Revisa: salud y base de datos, catálogo, panel exige sesión, CORS solo para el
sitio, cabeceras de seguridad y HSTS, CSP del sitio, rutas internas, caché de
`/assets` y que las tablas de Supabase no sean accesibles desde el navegador.

Manual, en un celular:

1. Portada, menú, búsqueda y una hoja de producto (verifica las animaciones).
2. Pedido de prueba a domicilio → confirmación → **enviar por WhatsApp al
   restaurante** (coordinado) → el mensaje llega con el código.
3. En el panel: el pedido aparece pendiente → confirmar → … → entregado.
4. Dashboard: aparecen los ingresos del pedido entregado.
5. Cancela el pedido de prueba si no debe contar (o márcalo como cancelado con
   motivo "prueba de lanzamiento").

## 10. Lista para declarar el sistema en producción

No declares el sistema listo hasta marcar todo:

- [ ] Migraciones aplicadas con `db push` y `supabase test db --linked` en verde
- [ ] Registro público de usuarios desactivado en Supabase Auth
- [ ] Cuenta admin creada y probada; ninguna cuenta de prueba en producción
- [ ] Backend con `NODE_ENV=production`, `DATABASE_SSL=verify-full`, `TRUST_PROXY=1`
- [ ] `CORS_ORIGINS` y `VITE_API_URL` con los dominios finales https
- [ ] `scripts/smoke.mjs` en verde contra producción
- [ ] Pedido real de prueba recibido por WhatsApp en el número del restaurante
- [ ] Horario y zonas/tarifas cargados (o confirmado con el negocio que quedan "por confirmar")
- [ ] Copia de seguridad manual hecha y restauración probada
- [ ] El personal sabe confirmar, preparar, entregar y cancelar pedidos en el panel

## Limitaciones conocidas de esta versión

- El backend usa el rol `postgres` de Supabase (con `BYPASSRLS`). Mejora
  recomendada: un rol dedicado con solo los privilegios necesarios.
- Límite de solicitudes en memoria (una instancia).
- Sin pagos en línea ni confirmación automática de pagos.
- Sin integración con la API de WhatsApp Business (enlace `wa.me`).
- Sin recuperación de contraseña por correo.
