# Seguridad

## Arquitectura: el backend es la única puerta

```
Navegador ──► Express (/api) ──► PostgreSQL (rol de servidor)
    │
    └──► Supabase Auth (solo iniciar sesión en el panel)
```

- El navegador **nunca** lee ni escribe tablas. Todas las tablas tienen RLS
  activo, **sin políticas** para `anon` ni `authenticated`, y además se
  revocaron sus privilegios. La API REST automática de Supabase no expone nada
  (hay pruebas que lo verifican, incluso con la sesión de un administrador).
- La clave **anon/publishable** va en el frontend y es pública por diseño: solo
  sirve para iniciar sesión.
- La clave **service_role** y `DATABASE_URL` viven **solo** en el backend.
- Cada solicitud del panel valida el token con Supabase Auth y luego el rol en
  `profiles`. Ocultar botones en el frontend es solo comodidad.

## Controles implementados

| Riesgo | Control |
|---|---|
| Precios manipulados | El backend recalcula todo; los precios del cliente se ignoran |
| Pedidos duplicados | `Idempotency-Key` + restricción única en la base |
| Spam de pedidos | Límite de solicitudes por IP |
| Inyección SQL | Solo consultas parametrizadas (`$1, $2…`) |
| Datos inválidos | Zod en cada endpoint + restricciones `CHECK` en la base |
| Stock negativo / carreras | `CHECK (stock >= 0)` + `SELECT … FOR UPDATE` en transacción |
| Cambios no autorizados | Roles `admin` / `staff` verificados en el backend |
| Historial alterado | Movimientos de inventario e historial de estados son de solo inserción (trigger) |
| Borrado de historial | `ON DELETE RESTRICT`: productos con pedidos se desactivan, no se borran |
| Cabeceras | Helmet (HSTS, nosniff, CSP de API, etc.), sin `X-Powered-By` |
| CORS | Solo los orígenes de `CORS_ORIGINS` |
| Cuerpos enormes | Límite de 100 KB |
| Logs con secretos | Se redactan `Authorization` y cookies; nunca se registran datos del cliente |
| Consulta de pedidos | Requiere código **y** teléfono; no devuelve la dirección |
| Auditoría | `audit_log` registra quién cambió precios, productos, estados, inventario y configuración |

## Crear la primera cuenta administradora

Nunca se guardan contraseñas en el repositorio ni en scripts.

1. **Crear el usuario en Supabase Auth**
   - Local: abre Supabase Studio en `http://127.0.0.1:54323` → *Authentication*
     → *Add user* → *Create new user*. Escribe el correo y una contraseña fuerte
     y marca *Auto Confirm User*.
   - Producción: el mismo procedimiento en el dashboard de tu proyecto en
     supabase.com.
   - Al crearse, un trigger le asigna un perfil **sin rol** (sin acceso).
2. **Darle el rol de administrador** desde la carpeta del proyecto:
   ```bash
   npm run set-role -w backend -- correo@ejemplo.com admin
   ```
   Usa el `DATABASE_URL` de `backend/.env` (en producción, apúntalo a la base de
   producción solo durante este paso).
3. Inicia sesión en `/admin/login`.

Para el personal de cocina o caja usa `staff`. Para quitar el acceso: `none`.

> En desarrollo local existe una cuenta `admin@el-arca.test` cuya contraseña
> aleatoria está solo en `backend/.env` (ignorado por Git). No existe en producción.

## Pendiente antes de producción

- Desactivar el registro público de usuarios en Supabase Auth
  (*Authentication → Providers → Email → Allow new users to sign up = off*). Aunque
  una cuenta nueva no tiene rol, es mejor cerrarlo.
- Usar un rol de PostgreSQL dedicado para el backend en lugar de `postgres`.
- Activar `DATABASE_SSL=true` con la base de Supabase en la nube.
- Validación de imágenes al integrar Cloudinary (tipo, tamaño, firma del lado del servidor).
