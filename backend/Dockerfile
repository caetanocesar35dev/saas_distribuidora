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

# Converte quebras de linha do Windows (CRLF) para Linux (LF) e dá permissão de execução
RUN sed -i 's/\r$//' entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 3000

# Roda migrations automaticamente e depois inicia o servidor
ENTRYPOINT ["./entrypoint.sh"]

