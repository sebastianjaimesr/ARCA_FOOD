# El Arca – Comidas Rápidas

Tienda en línea con pedidos por WhatsApp y panel administrativo para
**El Arca**, Cl 103 #14-27, Bucaramanga.

> Estado: **Fase 2 (estructura)**. La base de datos, el menú y los pedidos se
> construyen en las fases siguientes. Datos reales del negocio en
> [docs/datos-del-negocio.md](docs/datos-del-negocio.md).

## Estructura

```
el-arca/
├── frontend/          React + Vite + TypeScript + Tailwind (tienda y panel /admin)
│   └── src/
│       ├── app/           router
│       ├── components/    layouts y UI reutilizable
│       ├── pages/         páginas de la tienda y del panel
│       ├── features/      lógica por módulo (products, cart, orders, inventory, analytics)
│       ├── services/      cliente HTTP de la API
│       ├── config/        datos del negocio (temporal, pasan a la BD en Fase 3)
│       └── lib/           utilidades (formato de pesos, etc.)
├── backend/           Express + TypeScript (API REST)
│   └── src/
│       ├── config/        variables de entorno validadas con Zod
│       ├── routes/        definición de rutas
│       ├── controllers/   entrada/salida HTTP
│       ├── services/      reglas de negocio
│       ├── repositories/  consultas SQL
│       ├── middlewares/   errores, auth, rate limit
│       └── validators/    esquemas Zod de las solicitudes
├── supabase/          config local, migraciones SQL y pruebas de la BD
└── docs/              documentación del negocio y del sistema
```

## Requisitos

- Node.js 22 o superior (probado con 24.15)
- Docker Desktop (para Supabase local, desde la Fase 3)

## Desarrollo

```bash
npm install
cp backend/.env.example backend/.env
npm run dev:backend    # http://localhost:4000/api/health
npm run dev:frontend   # http://localhost:5173
```

El frontend reenvía `/api` al backend (proxy de Vite), así que en desarrollo
no hace falta configurar CORS.

## Comandos de calidad

```bash
npm run lint
npm run typecheck
npm test
npm run build
```
