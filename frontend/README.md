# Frontend

Next.js 16 (App Router) + React 19 + TypeScript (strict) + Tailwind CSS 4 + shadcn/ui,
em português do Brasil. Substitui o frontend antigo (React + Vite, uma distribuidora só),
que continua só no histórico do git.

Plano e decisões: [plano_implementacao_frontend.md](../plano_implementacao_frontend.md).
Regras gerais do projeto: [CLAUDE.md](../CLAUDE.md).

## Como rodar

```bash
cd frontend
npm install
cp .env.example .env.local   # só precisa mudar se a API não estiver em localhost:3001
npm run dev                  # http://localhost:3000
```

O backend precisa estar de pé (`npm run dev` em `backend/`, porta 3001). Para ter dados:
`npm run db:seed` em `backend/` e entre com `dono@exemplo.com`, `gerente@exemplo.com`,
`funcionario@exemplo.com` ou `admin@plataforma.com` (senha `123456`).

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` / `npm start` | Build e execução de produção |
| `npm run lint` | ESLint |
| `npx tsc --noEmit` | Checagem de tipos |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:e2e` | Testes de ponta a ponta (Playwright, no Chromium) |

| Variável | Padrão | Uso |
|---|---|---|
| `API_URL` | `http://localhost:3001/api` | URL da API. **Só o servidor do Next usa**: o navegador nunca fala direto com a API |

## Como funciona

**O navegador só conversa com o próprio Next (`/api/*`).** Um servidor intermediário (BFF)
repassa as chamadas para o backend:

- Os tokens ficam em **cookies httpOnly** (`sd_at`, `sd_rt`): o JavaScript da página nunca vê
  nenhum token (proteção contra XSS). Login, cadastro, troca de senha e logout têm rotas
  próprias em `src/app/api/auth/*`; o resto passa por `src/app/api/[...path]/route.ts`.
- O BFF coloca o access token no cabeçalho, **renova a sessão sozinho** (uma renovação por vez,
  porque o refresh token é de uso único) e apaga os cookies se a sessão acabou.
- Requisições que gravam só valem se vierem da própria página (conferência de `Origin`).
- Para as páginas, `src/proxy.ts` manda quem não tem sessão para `/login`.
- O BFF repassa o IP do navegador (`X-Forwarded-For`) para o rate limit do backend funcionar
  por pessoa. Em produção, o BFF deve ficar numa rede privada junto do backend.
- A renovação em fila fica na memória do processo do Next: com **mais de uma instância** do
  frontend, é preciso afinidade de sessão (ou mover essa fila para um armazenamento comum).

## Testes

- **Unitários** (`npm test`, Vitest, `src/**/*.test.ts`): dinheiro e datas (`format.ts`), carrinho do
  PDV, faixa de assinatura, histórico de alterações, cliente da API, **renovação de sessão em fila**
  e BFF (`lib/server`), e a **integridade da Central de Dúvidas** (todo botão "?" e todo "veja
  também" apontam para um artigo que existe; os artigos obrigatórios existem).
- **De ponta a ponta** (`npm run test:e2e`, Playwright, pasta `e2e/`): login e segurança da sessão
  (cookies httpOnly, renovação, origem), venda com vasilhame, fiado, recebimento, comanda,
  cancelamento, histórico, estoque, produtos, vasilhames, clientes, permissões por papel,
  somente leitura, cadastro e a área da plataforma.
  - Precisam do **banco, do backend (porta 3001) e do seed** (`npm run db:seed` em `backend/`).
    O Next sobe sozinho (ou reaproveita o que já está rodando).
  - **Gravam dados de verdade** no banco de desenvolvimento (vendas, clientes, produtos "E2E"):
    rode só em ambiente local.
  - O login do backend tem limite (5 por minuto e 20 por hora por e-mail), então cada papel entra
    **uma vez** na preparação (`e2e/global-setup.ts`) e os testes reaproveitam a sessão salva
    (`e2e/.auth/`, ignorada pelo git). Se aparecer erro 429 na preparação, espere um pouco ou
    reinicie o backend de desenvolvimento (o limite fica na memória dele).
  - A preparação também repõe o estoque dos produtos do seed e volta a assinatura para "teste".

## Estrutura

```
src/
  app/
    (auth)/        login, cadastro, esqueci-a-senha, redefinir-senha
    (user)/        conta, notificacoes
    (help)/        duvidas (Central de Dúvidas, abre sem login)
    selecionar/    escolha de empresa e loja
    loja/[storeId]/...      PDV, caixa, comandas, vendas, estoque, produtos, vasilhames, clientes
    empresa/[companyId]/... painel, lojas, equipe, dados, assinatura, nova empresa
    plataforma/    organizações (ajuste da assinatura), planos, usuários, notificações
    api/           BFF (rotas do servidor)
  components/      ui/ (shadcn) e app/ (componentes do sistema)
  content/duvidas/ artigos da Central de Dúvidas (conteúdo estático)
  lib/api/         cliente da API, tipos (types.ts) e hooks do TanStack Query
  lib/server/      BFF: cookies, renovação de sessão, repasse
  lib/session/     sessão, contexto da loja/empresa, última seleção
```

## Regras do projeto

- **Tipos da API** só em `src/lib/api/types.ts` (o Swagger do backend não descreve corpos nem
  respostas, então são escritos a partir dos DTOs). Nenhuma tela declara formato de resposta.
- **Nunca enviar preço ou custo** em venda ou comanda: o backend lê do banco.
- Ids de empresa e loja vão **na URL** da API (`companyApi(id)`, `storeApi(id)`), nunca em header.
- **Toda tela nasce com a sua ajuda:** ao criar ou mudar uma tela, crie ou atualize o artigo na
  Central de Dúvidas (`src/content/duvidas/`) e o caminho "onde encontrar".
- Esconder botão é UX, não segurança: o backend sempre valida (403/402 são tratados).
- Os componentes do shadcn aqui são baseados em **Base UI** (`render=` no lugar de `asChild`).
