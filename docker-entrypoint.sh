#!/bin/sh
set -e

echo "Aplicando migraciones de base de datos..."
npx prisma migrate deploy --schema prisma/schema.prisma

exec node apps/backend/dist/server.js
