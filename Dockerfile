# Imagen opcional. La aplicación NO requiere Docker: `npm install && npm run dev` basta.
# Este Dockerfile construye y ejecuta la consola completa (backend sirviendo el frontend
# compilado) usando SQLite embebido, para despliegues rápidos o demos reproducibles.

FROM node:20-bookworm-slim AS build
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV DATABASE_URL="file:/app/data/app.db"
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/package.json ./apps/backend/package.json
COPY --from=build /app/apps/frontend/dist ./apps/frontend/dist
COPY --from=build /app/packages ./packages
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data
EXPOSE 4000
ENTRYPOINT ["./docker-entrypoint.sh"]
