# Multi-stage: build the SPA with Node, then serve the static output with nginx.
FROM node:20-alpine AS build
WORKDIR /app
# Optional Google OAuth client id baked at build time (Vite inlines VITE_* at build).
ARG VITE_GOOGLE_CLIENT_ID=""
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
COPY web/package.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM nginx:1.27-alpine
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
