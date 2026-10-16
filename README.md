# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, controle de estoque por loja,
caixa, comandas, vasilhames e fiado (com abatimento entre lojas). Cada cliente do SaaS
(`Organization`) pode ter várias distribuidoras (`Company`), cada uma com várias lojas
(`Store`). A assinatura é cobrada pelo Asaas (cartão recorrente ou Pix Automático).

> **Estado atual:** o banco de dados e o **backend** já estão no modelo SaaS (multi-tenant,
> auditoria completa, soft delete): autenticação, empresas, lojas, equipe, catálogo, estoque,
> vasilhames, clientes/fiado, caixa, vendas, comandas, painéis, histórico de alterações,
> plataforma e notificações estão prontos, com 377 testes automatizados. Falta a **cobrança
> com o Asaas** (por enquanto o status da assinatura é ajustado pela plataforma). O
> **frontend** ainda é o da versão anterior (uma distribuidora só) e será refeito pelo plano
> dele.

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Tabelas, relacionamentos (diagramas), auditoria, soft delete, cobrança e migrations |
| [docs/API.md](docs/API.md) | Todas as rotas do backend e quem pode chamar cada uma (gerado do código) |
| [plano_implementacao_backend.md](plano_implementacao_backend.md) | Plano de implementação do backend, por fases, com o relatório do que foi feito |
| [plano_implementacao_frontend.md](plano_implementacao_frontend.md) | Plano de implementação do frontend, por fases |
| [CLAUDE.md](CLAUDE.md) | Regras do projeto para agentes de IA (servem também como resumo para pessoas) |

## Tecnologias

| | Versão |
|---|---|
| Node.js / npm | 24 / 11 |
| Backend | NestJS 11, Prisma 7 (`@prisma/adapter-pg`), JWT, bcryptjs |
| Banco | PostgreSQL 16 (Docker) |
| Frontend (novo, a fazer) | Next.js (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Frontend (legado atual) | React 19, Vite 8, TailwindCSS 4, JavaScript |
| Cobrança | Asaas (a implementar) |

Estrutura: `backend/` (API REST em `/api`) e `frontend/` (a ser refeito em Next.js).

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
# copiar backend/.env.example para backend/.env; preencher DATABASE_URL (banco acima)
# e JWT_SECRET (o segredo é você quem define)
npx prisma migrate deploy   # cria tabelas, triggers de auditoria etc.
npx prisma generate
npm run db:seed             # (opcional) dados de demonstração: empresa, lojas, usuários, produtos
npm run dev
```

Com o seed, entre com `dono@exemplo.com` (dono das duas lojas), `gerente@exemplo.com`,
`funcionario@exemplo.com` ou `admin@plataforma.com` (plataforma), todos com a senha
`123456`. Fora de produção, a documentação interativa da API fica em
`http://localhost:3001/api/docs`.

**3. Frontend:** ainda não existe a versão nova (Next.js). O que está em `frontend/` é o
legado em Vite, que fala com a API antiga e não funciona com o backend atual. Veja o
[plano do frontend](plano_implementacao_frontend.md).

## Regras importantes do banco

- Toda alteração gera histórico automaticamente (tabelas `th_*`, via triggers).
- Não existe exclusão física: o banco recusa `DELETE`. Excluir = preencher `deletedAt`.
- Para criar ou alterar tabelas, sempre por migration do Prisma. Veja §7 de
  [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md).
