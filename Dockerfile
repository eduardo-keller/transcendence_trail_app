FROM debian:bookworm-slim AS base

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

RUN apt update && \
	apt install -y \
		curl \
		ca-certificates \
		gnupg \
		&& curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
		&& apt install -y nodejs \
		&& apt clean \
		&& rm -rf /var/lib/apt/lists/*

# Ambiente de Desenvolvimento
FROM base AS dev

ENV NODE_ENV=development

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

ENTRYPOINT ["npm","run","dev"]

# Builda para Producao
FROM base AS builder

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate

# Prod
FROM base AS prod

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN groupadd --system --gid 1001 nodejs \
	&& useradd --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENTRYPOINT ["node","server.js"]


