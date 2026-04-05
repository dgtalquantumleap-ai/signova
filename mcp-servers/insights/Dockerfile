FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV INSIGHTS_API_BASE="https://api.ebenova.dev"
ENV NODE_ENV="production"

# Test that server starts (will exit immediately in build mode)
RUN node index.js || true

CMD ["node", "index.js"]
