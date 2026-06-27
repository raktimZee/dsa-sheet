FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY libs ./libs
COPY services ./services
COPY gateway ./gateway
RUN npm install --omit=dev
ENV NODE_ENV=production
CMD ["node", "services/notification/src/index.js"]
