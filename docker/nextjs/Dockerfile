FROM        alpine:3.24.2 AS dev

RUN         apk upgrade --no-cache zlib && \
            apk add --no-cache nodejs npm openssl tini socat

WORKDIR     /app

COPY        apps/web/package*.json ./
RUN         npm ci

COPY        --chmod=755 docker/nextjs/tools/entrypoint.sh /usr/local/bin/entrypoint.sh

EXPOSE      3000
ENTRYPOINT  ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD         ["npm","run","dev"]

FROM        dev AS prod

COPY        apps/web/ ./
RUN         export NEXT_TELEMETRY_DISABLED=1 \
                DATABASE_URL=postgresql://build:build@localhost:5432/build \
                BETTER_AUTH_SECRET=build-only-placeholder-not-used-at-runtime && \
            npx prisma generate && \
            npx next build

ENV         NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
CMD         ["npm","start"]
