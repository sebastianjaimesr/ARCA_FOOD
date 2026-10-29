# El Arca – Comidas Rápidas

Tienda en línea con pedidos por WhatsApp y panel administrativo para
**El Arca**, Cl 103 #14-27, Bucaramanga.

> Estado: **Fase 5 (pedidos por WhatsApp)**. La tienda completa funciona: menú,
> carrito, formulario de pedido, registro en la base, envío del resumen por
> WhatsApp y consulta del pedido. Siguen las pantallas del panel (Fase 6).
>
> Imágenes: la carta no trae fotos de los productos. Mientras el restaurante no
> cargue fotos reales, cada producto muestra una ilustración de línea de su
> categoría (no se usan fotos genéricas que parezcan del restaurante).

## Documentación

- [Datos del negocio y carta 2025](docs/datos-del-negocio.md)
- [Reglas de negocio](docs/reglas-de-negocio.md): precios, estados, inventario, estadísticas
- [API REST](docs/api.md)
- [Seguridad y creación del primer administrador](docs/seguridad.md)

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
npx supabase db reset       # recrea la base local desde las migraciones (borra datos locales)
npx supabase test db        # pruebas pgTAP (RLS, restricciones, carta)
```

Las pruebas de integración del backend crean categorías `prueba-*` (inactivas
al terminar) y pedidos de prueba en la base **local**. `db reset` los limpia.

## Calidad

```bash
npm run lint
npm run typecheck
npm test                    # unitarias + integración (requiere Supabase local)
npm run build
```

Sin Supabase local, las pruebas de integración se omiten y solo corren las
unitarias. Tras `supabase start`, espera unos segundos a que Auth esté listo.
