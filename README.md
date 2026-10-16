# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, controle de estoque por loja,
caixa, comandas, vasilhames e fiado (com abatimento entre lojas). Cada cliente do SaaS
(`Organization`) pode ter várias distribuidoras (`Company`), cada uma com várias lojas
(`Store`). A assinatura é cobrada pelo Asaas (cartão recorrente ou Pix Automático).

> **Estado atual:** o banco de dados já está no modelo SaaS (multi-tenant, auditoria
> completa, soft delete e cobrança). O código do backend e do frontend ainda é o da
> versão anterior (uma distribuidora só) e **não compila contra o banco novo**. Ele será
> refeito seguindo os planos de implementação abaixo.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Tabelas, relacionamentos (diagramas), auditoria, soft delete, cobrança e migrations |
| [plano_implementacao_backend.md](plano_implementacao_backend.md) | Plano de implementação do backend, por fases |
| [plano_implementacao_frontend.md](plano_implementacao_frontend.md) | Plano de implementação do frontend, por fases |
| [CLAUDE.md](CLAUDE.md) | Regras do projeto para agentes de IA (servem também como resumo para pessoas) |

## Tecnologias

| | Versão |
|---|---|
| Node.js / npm | 24 / 11 |
| Backend | NestJS 11, Prisma 7 (`@prisma/adapter-pg`), JWT, bcryptjs |
| Banco | PostgreSQL 16 (Docker) |
| Frontend | React 19, Vite 8, TailwindCSS 4 |
| Cobrança | Asaas (a implementar) |

Estrutura: `backend/` (API REST em `/api`) e `frontend/` (SPA).

## Como rodar localmente

Não existe docker-compose: só o banco roda em Docker.

**1. Banco de dados** (Postgres 16 na porta 5437):

```bash
# primeira vez: cria o container
docker run -d --name banco_saas_distribuidora \
  -e POSTGRES_USER=postgres -e POSTGRES_PASSWORD=<senha> \
  -e POSTGRES_DB=distribuidora_online \
  -p 5437:5432 postgres:16

# nas próximas vezes (o container não reinicia sozinho com o Docker)
docker start banco_saas_distribuidora
```

**2. Backend** (`http://localhost:3001/api`):

```bash
cd backend
npm install
# criar backend/.env com DATABASE_URL apontando para o banco acima e JWT_SECRET
# (lista completa de variáveis: Fase 0 do plano de backend)
npx prisma migrate deploy   # cria tabelas, triggers de auditoria etc.
npx prisma generate
npm run dev
```

**3. Frontend** (`http://localhost:5173`):

```bash
cd frontend
npm install
npm run dev                 # usa VITE_API_URL ou http://localhost:3001/api
```

## Regras importantes do banco

- Toda alteração gera histórico automaticamente (tabelas `th_*`, via triggers).
- Não existe exclusão física: o banco recusa `DELETE`. Excluir = preencher `deletedAt`.
- Para criar ou alterar tabelas, sempre por migration do Prisma. Veja §7 de
  [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md).
