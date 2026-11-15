
FROM node:24 AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile

COPY nest-cli.json tsconfig.json tsconfig.build.json prisma7.config.ts ./
COPY prisma ./prisma
COPY src ./src

RUN pnpm exec prisma generate --config prisma7.config.ts
RUN pnpm build

FROM node:24 AS runtime
WORKDIR /app

ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --prod --frozen-lockfile

COPY --from=build /app/dist ./dist

# Required for Railway pre-deploy migrations
COPY prisma7.config.ts ./
COPY prisma ./prisma

EXPOSE 3000
CMD ["node", "dist/main.js"]
