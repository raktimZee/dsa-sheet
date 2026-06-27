# Build context is the repo root (see docker-compose). We install the whole backend
# workspace tree once; each backend image differs only in its CMD.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY libs ./libs
COPY services ./services
COPY gateway ./gateway
RUN npm install --omit=dev
ENV NODE_ENV=production
CMD ["node", "services/auth/src/index.js"]
