FROM node:24-alpine

WORKDIR /usr/src/app

# Copia os arquivos de dependência
COPY package*.json ./

# Instala as dependências
RUN npm install

# Copia o restante do código
COPY . .

EXPOSE 5173

# Executa o Vite com a flag --host para expor a porta na rede do Docker
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
