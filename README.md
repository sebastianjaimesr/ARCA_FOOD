# El Arca – Comidas Rápidas

Tienda en línea con pedidos por WhatsApp y panel administrativo para
**El Arca**, Cl 103 #14-27, Bucaramanga.

> Estado: **las 8 fases construidas; aún no publicado**. Tienda y panel completos: menú,
> carrito, pedidos por WhatsApp; en `/admin`: dashboard, pedidos y estados,
> productos, catálogo (categorías y adicionales), inventario y configuración.
> Validado (docs/validacion.md) y preparado para publicar (docs/despliegue.md);
> no se considera en producción hasta completar la lista de esa guía.
>
> Imágenes: la carta no trae fotos de los productos. Mientras el restaurante no
> cargue fotos reales, cada producto muestra una ilustración de línea de su
> categoría (no se usan fotos genéricas que parezcan del restaurante).

## Documentación

- [Datos del negocio y carta 2025](docs/datos-del-negocio.md)
- [Reglas de negocio](docs/reglas-de-negocio.md): precios, estados, inventario, estadísticas
- [API REST](docs/api.md)
- [Seguridad y creación del primer administrador](docs/seguridad.md)
- [Validación: pruebas, seguridad, accesibilidad y rendimiento](docs/validacion.md)
- [Despliegue a producción y lista de verificación](docs/despliegue.md)

## Estructura

```
el-arca/
├── frontend/              React 19 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── app/           router (el panel /admin se carga bajo demanda)
│       ├── components/    layouts y UI reutilizable
│       ├── pages/         páginas de la tienda y del panel
│       ├── features/      módulos: auth, cart, orders, products, inventory, analytics
│       ├── services/      cliente HTTP de la API
│       └── lib/           utilidades (formato de pesos, cliente de Supabase Auth)
├── backend/               Express 5 + TypeScript
│   ├── src/
│   │   ├── config/        variables de entorno validadas con Zod
│   │   ├── domain/        reglas puras: precios, estados, horario (sin BD)
│   │   ├── routes/        rutas públicas y /admin
│   │   ├── controllers/   entrada/salida HTTP
│   │   ├── services/      reglas de negocio con transacciones
│   │   ├── repositories/  consultas SQL parametrizadas
│   │   ├── middlewares/   auth/roles, rate limit, errores
│   │   └── validators/    esquemas Zod de cada solicitud
│   ├── scripts/           set-role (dar acceso al personal)
│   └── tests/             unitarias e integración
├── supabase/
│   ├── migrations/        esquema, seguridad (RLS) y carta 2025
│   └── tests/             pruebas pgTAP de la base de datos
└── docs/
```

## Requisitos

- Node.js 22 o superior (probado con 24.15)
- Docker Desktop **abierto** (Supabase local corre en contenedores)

## Puesta en marcha (desarrollo)

```bash
npm install
npx supabase start          # primera vez: descarga imágenes (varios minutos)
npx supabase status         # muestra URL y claves locales
```

Crea `backend/.env` a partir de `backend/.env.example` y `frontend/.env.local`
a partir de `frontend/.env.example` con los valores de `supabase status`
(`DB_URL`, `API_URL`, `SERVICE_ROLE_KEY`, `ANON_KEY`).

```bash
npm run dev:backend         # http://localhost:4000/api/health
npm run dev:frontend        # http://localhost:5173  (panel: /admin)
```

Para entrar al panel, crea tu cuenta y dale rol siguiendo
[docs/seguridad.md](docs/seguridad.md#crear-la-primera-cuenta-administradora).

Supabase Studio (ver tablas, usuarios): http://127.0.0.1:54323

## Base de datos

```bash
npm run db:reset            # recrea la base local (carta real, sin pedidos) y la cuenta admin de desarrollo
npm run db:test             # pruebas pgTAP (RLS, restricciones, carta)
```

Las pruebas de integración del backend escriben en la base **local**: crean
categorías `prueba-*` (se desactivan al terminar) y pedidos de prueba que sí
aparecen en el dashboard local. Después de correrlas, `npm run db:reset` deja la
base limpia. `db:reset` vuelve a crear la cuenta de `DEV_ADMIN_EMAIL` /
`DEV_ADMIN_PASSWORD` de `backend/.env` (solo funciona contra Supabase local).

## Calidad

```bash
npm run lint
npm run typecheck
npm test                    # unitarias + integración (requiere Supabase local)
npm run build
```

Sin `backend/.env`, las pruebas de integración se omiten y solo corren las
unitarias. Si `backend/.env` existe pero Supabase no responde, se muestra un
aviso y las de integración fallan. Tras `supabase start`, espera unos segundos a
que Auth esté listo. El CI (`.github/workflows/ci.yml`) corre todo en cada push.

## Publicar

Ver [docs/despliegue.md](docs/despliegue.md): Supabase en la nube, API con
`backend/Dockerfile`, sitio estático con cabeceras de seguridad generadas en el
build, dominio, copias de seguridad y verificación con:

```bash
node scripts/smoke.mjs --api https://api.tudominio --site https://tudominio
```
