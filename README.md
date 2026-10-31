# SaaS Distribuidora

SaaS multi-tenant para distribuidoras de bebidas: PDV, controle de estoque por loja,
caixa, comandas, vasilhames e fiado (com abatimento entre lojas). Cada cliente do SaaS
(`Organization`) pode ter várias distribuidoras (`Company`), cada uma com várias lojas
(`Store`). A assinatura é cobrada pelo Asaas (cartão recorrente ou Pix Automático).

> **Estado atual:** o banco de dados e o **backend** já estão no modelo SaaS (multi-tenant,
> auditoria completa, soft delete): autenticação, empresas, lojas, equipe, catálogo, estoque,
> vasilhames, clientes/fiado, caixa, vendas, comandas, painéis, histórico de alterações,
> plataforma e notificações estão prontos, com 415 testes automatizados. O **frontend** foi
> refeito em Next.js e cobre todo o uso diário (PDV, caixa, comandas, vendas, estoque,
> vasilhames, clientes/fiado, painéis, equipe, assinatura e a Central de Dúvidas); veja o
> relatório no [plano do frontend](plano_implementacao_frontend.md). Há também a área da
> plataforma (`/plataforma`) e testes automatizados (96 unitários e 39 de ponta a ponta). Falta
> a **cobrança com o Asaas** (por enquanto o status da assinatura é ajustado pela plataforma).
> Depois disso vieram melhorias pedidas no uso (limite de fiado com autorização do gerente,
> venda antiga, venda em fardo, caixa que abre e fecha sozinho, LGPD e outras), registradas
> nos planos e no [docs/a_fazer.md](docs/a_fazer.md).

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md) | Tabelas, relacionamentos (diagramas), auditoria, soft delete, cobrança e migrations |
| [docs/API.md](docs/API.md) | Todas as rotas do backend e quem pode chamar cada uma (gerado do código) |
| [plano_implementacao_backend.md](plano_implementacao_backend.md) | Plano de implementação do backend, por fases, com o relatório do que foi feito |
| [plano_implementacao_frontend.md](plano_implementacao_frontend.md) | Plano de implementação do frontend, por fases, com o relatório do que foi feito |
| [docs/a_fazer.md](docs/a_fazer.md) | O que ainda falta no sistema (fora o gateway de pagamento) |
| [docs/testes.md](docs/testes.md) | Roteiro de testes manuais, por papel e por tela |
| [frontend/README.md](frontend/README.md) | Como rodar o frontend, como o BFF funciona e a estrutura de pastas |
| [CLAUDE.md](CLAUDE.md) | Regras do projeto para agentes de IA (servem também como resumo para pessoas) |

## Tecnologias

| | Versão |
|---|---|
| Node.js / npm | 24 / 11 |
| Backend | NestJS 11, Prisma 7 (`@prisma/adapter-pg`), JWT, bcryptjs |
| Banco | PostgreSQL 16 (Docker) |
| Frontend | Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS 4, shadcn/ui, TanStack Query |
| Cobrança | Asaas (a implementar) |

Estrutura: `backend/` (API REST em `/api`, porta 3001) e `frontend/` (Next.js, porta 3000).

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

**3. Frontend** (`http://localhost:3000`):

```bash
cd frontend
npm install
cp .env.example .env.local   # só se a API não estiver em localhost:3001
npm run dev
```

O navegador só fala com o Next, que repassa as chamadas ao backend (cookies httpOnly para os
tokens). Detalhes em [frontend/README.md](frontend/README.md).

## Regras importantes do banco

- Toda alteração gera histórico automaticamente (tabelas `th_*`, via triggers).
- Não existe exclusão física: o banco recusa `DELETE`. Excluir = preencher `deletedAt`.
- Para criar ou alterar tabelas, sempre por migration do Prisma. Veja §7 de
  [docs/BANCO_DE_DADOS.md](docs/BANCO_DE_DADOS.md).
