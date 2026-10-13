FROM node:24-alpine

WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

# Gera o client do Prisma e compila o projeto
RUN npx prisma generate
RUN npm run build

EXPOSE 3000

# Comando para iniciar a aplicação
CMD ["npm", "run", "start:prod"]

