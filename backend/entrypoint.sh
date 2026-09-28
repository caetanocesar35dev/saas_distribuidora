#!/bin/sh
# Executa as migrations pendentes antes de iniciar o servidor
echo "Aplicando migrations do Prisma..."
npx prisma migrate deploy

# Inicia o servidor
echo "Iniciando o servidor..."
exec npm run start:prod
