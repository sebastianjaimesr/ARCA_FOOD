# Imagen de producción de la API de El Arca.
# Se construye desde la RAÍZ del repositorio (usa el package-lock de los workspaces):
#   docker build -f backend/Dockerfile -t el-arca-api .

# --- 1. Compilación ---------------------------------------------------------
FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @el-arca/backend --include-workspace-root=false
COPY backend/ backend/
RUN npm run build --workspace @el-arca/backend

# --- 2. Dependencias de producción -----------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci --workspace @el-arca/backend --include-workspace-root=false --omit=dev

# --- 3. Ejecución -----------------------------------------------------------
FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/dist ./backend/dist
COPY backend/package.json ./backend/
WORKDIR /app/backend
# Usuario sin privilegios (viene en la imagen oficial de Node).
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/api/health" || exit 1
CMD ["node", "dist/server.js"]
