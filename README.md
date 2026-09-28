# Sistema de Distribuidora (PDV)

Um sistema completo de Ponto de Venda (PDV), controle de estoque e fluxo de caixa, construído com arquitetura moderna separando Frontend e Backend, além de um banco de dados relacional.

## Tecnologias e Versões

As principais tecnologias e versões utilizadas neste projeto são:

- **Node.js**: v24.16.0
- **npm**: v11.13.0
- **React**: v19.2.7 (Vite + TailwindCSS v4)
- **NestJS**: v11.0.1
- **Prisma ORM**: v7.8.0
- **PostgreSQL**: v15 (via Docker)
- **Docker Compose**: v3.8

## Estrutura do Projeto

O repositório é um monorepo dividido em duas pastas principais:

* `/backend`: API RESTful feita em NestJS com autenticação JWT e Prisma ORM para comunicação com o Postgres.
* `/frontend`: Aplicação Web SPA feita em React e Vite, consumindo a API do backend.

## Como Executar Localmente (com Docker)

O projeto possui um `docker-compose.yml` pré-configurado que sobe o banco de dados e as aplicações de forma integrada.

1. Instale o Docker e o Docker Compose.
2. Certifique-se de que existe um arquivo `.env` na raiz do projeto com as credenciais.
3. Rode o comando:
   ```bash
   docker-compose up --build -d
   ```
4. O Backend estará disponível na porta `3000` (http://localhost:3000/api) e o Frontend na porta `5173` (http://localhost:5173).

## Como Executar Localmente (Modo Desenvolvimento)

Se preferir rodar apenas o banco no Docker e o código diretamente na sua máquina:

1. Suba o banco de dados: `docker-compose up postgres -d`
2. No terminal do **Backend**:
   ```bash
   cd backend
   npm install
   npx prisma db push
   npm run start:dev
   ```
3. No terminal do **Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
