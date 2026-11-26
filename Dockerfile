FROM node:22-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY tsconfig.web.json ./
COPY src ./src
COPY web ./web
COPY DataBase/migrations ./DataBase/migrations
COPY DataBase/seeds ./DataBase/seeds

RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["sh", "-c", "npm run migrate && npm start"]
