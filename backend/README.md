# Backend

API REST em NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16, servida em
`http://localhost:3001/api`.

> O código de `src/` é da versão anterior (single-tenant) e não compila contra o schema
> atual. Ele será refeito conforme o [plano de implementação](../plano_implementacao_backend.md).
> O banco (`prisma/`) já está na versão nova.

## Scripts

```bash
npm install
npm run dev          # desenvolvimento com watch
npm run build        # compila para dist/
npm run start:prod   # roda o build (node dist/src/main)
npm run lint
npm test             # unitários
npm run test:e2e     # e2e (test/jest-e2e.json, a criar na Fase 0 do plano)
```

## Banco de dados

O schema fica em [prisma/schema.prisma](prisma/schema.prisma) e as migrations em
[prisma/migrations/](prisma/migrations/). Toda a explicação do modelo, auditoria e soft
delete está em [docs/BANCO_DE_DADOS.md](../docs/BANCO_DE_DADOS.md).

```bash
npx prisma migrate deploy   # aplica migrations pendentes
npx prisma migrate status   # confere se o banco está em dia
npx prisma generate         # gera o Prisma Client
npx prisma migrate dev --name <nome>   # cria nova migration (terminal interativo)
```

Ao criar tabela nova, acrescente os triggers de auditoria e de bloqueio de DELETE na
migration (veja §7 da documentação do banco).

## Variáveis de ambiente

Ficam em `backend/.env` (fora do git). A lista completa, com o que é obrigatório, está
na Fase 0 do [plano do backend](../plano_implementacao_backend.md). O mínimo para o banco
funcionar é `DATABASE_URL`.

## Docker

O [Dockerfile](Dockerfile) gera a imagem de produção; o [entrypoint.sh](entrypoint.sh)
roda `prisma migrate deploy` antes de iniciar o servidor.
