FROM    alpine:3.24.2

RUN     apk upgrade --no-cache zlib && \
        apk add --no-cache postgresql18 postgresql18-contrib postgis postgresql-pgvector su-exec tini && \
        mkdir -p /run/postgresql /var/lib/postgresql/data && \
        chown -R postgres:postgres /run/postgresql /var/lib/postgresql

COPY    --chmod=755 docker/postgres/tools/entrypoint.sh /usr/local/bin/entrypoint.sh

EXPOSE  5432

ENTRYPOINT  [ "/sbin/tini", "--", "/usr/local/bin/entrypoint.sh" ]
