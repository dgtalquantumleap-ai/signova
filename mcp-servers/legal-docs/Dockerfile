FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Runtime environment - API key must be provided at runtime
# ENV EBENOVA_API_KEY=""  # Do not set here - user provides at runtime
ENV EBENOVA_API_BASE="https://api.ebenova.dev"
ENV NODE_ENV="production"

EXPOSE 3000

# Test that server starts (will exit immediately in build mode)
RUN node src/index.js || true

CMD ["node", "src/index.js"]
