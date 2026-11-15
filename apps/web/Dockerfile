FROM node:24 AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY index.html env.d.ts tsconfig*.json vite.config.ts ./
COPY eslint.config.ts ./
COPY src ./src

ENV VITE_API_BASE_URL=/api
RUN pnpm build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY Caddyfile /etc/caddy/Caddyfile
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
EXPOSE 8080
