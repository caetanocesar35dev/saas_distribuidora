# Backend

API REST em NestJS 11 + Prisma 7 (`@prisma/adapter-pg`) + PostgreSQL 16, servida em
`http://localhost:3001/api`.

> Implementado conforme o [plano de implementação](../plano_implementacao_backend.md)
> (status e relatório nele): autenticação com refresh token, empresas, lojas, equipe,
> catálogo, vasilhames, clientes/fiado, caixa, vendas, comandas, painéis, histórico de
> alterações, plataforma e notificações. **Falta só a cobrança com Asaas** (Fase 10).
> Todas as rotas e permissões: [docs/API.md](../docs/API.md). Fora de produção, o Swagger
> fica em `http://localhost:3001/api/docs`.

## Scripts

```bash
npm install
npm run dev          # desenvolvimento com watch
npm run build        # compila para dist/
npm run start:prod   # roda o build (node dist/src/main)
npm run lint         # formata (Prettier) e confere
npm run db:seed      # dados de demonstração (não duplica; recusa rodar em produção)
npm run docs:api     # regenera ../docs/API.md a partir dos controllers
npm test             # todos os testes (services e e2e)
npm run test:unit    # só os testes de service/unitários (src/**/*.spec.ts)
npm run test:e2e     # só os e2e HTTP (test/*.e2e-spec.ts)
npm run test:cov     # com cobertura
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

Ficam em `backend/.env` (fora do git). Copie o [.env.example](.env.example), que lista todas
as variáveis com os padrões. **Obrigatórias:** `DATABASE_URL` e `JWT_SECRET` (você define o
segredo). Em produção também `CORS_ORIGINS` e `APP_URL` (em desenvolvimento o padrão de
ambas é `http://localhost:3000`, a porta do Next). Sem `EMAIL_USER`/`EMAIL_PASS` nenhum
e-mail é enviado (a mensagem aparece só no log).

Sessão: access token de 15 min (`JWT_ACCESS_EXPIRES_IN`) e refresh token com rotação de
30 dias (`REFRESH_TOKEN_DAYS`).

## Testes

Os testes rodam no banco `distribuidora_test`, no mesmo servidor do `DATABASE_URL`. Ele é criado
e migrado automaticamente na primeira execução, e os testes se recusam a rodar em qualquer
outro banco (eles esvaziam as tabelas). Os testes de service usam o Prisma real, com a
extensão de auditoria e os triggers; só o envio de e-mail é substituído.

## Docker

O [Dockerfile](Dockerfile) gera a imagem de produção, que só inicia o servidor
(`npm run start:prod`). **A imagem não aplica migrations.**

## Deploy

As migrations de produção são aplicadas pela pipeline de deploy, com
`npx prisma migrate deploy`, **antes** de subir a nova versão da aplicação. A pipeline de
CI/CD ainda não existe; quando for criada, esse passo é obrigatório.
