FROM        alpine:3.24.2

RUN         apk upgrade --no-cache zlib && \
            apk add --no-cache nodejs npm openssl tini socat

WORKDIR     /app

COPY        apps/web/package*.json ./
RUN         npm ci

COPY        --chmod=755 docker/nextjs/tools/entrypoint.sh /usr/local/bin/entrypoint.sh

EXPOSE      3000
ENTRYPOINT  ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD         ["npm","run","dev"]
