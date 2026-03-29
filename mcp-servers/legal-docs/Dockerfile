FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Runtime environment
ENV EBENOVA_API_KEY=""
ENV EBENOVA_API_BASE="https://api.ebenova.dev"
ENV NODE_ENV="production"

EXPOSE 3000

CMD ["node", "src/index.js"]
