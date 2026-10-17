#!/bin/sh

set -eu

PGDATA=/var/lib/postgresql/data
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    pwfile="$(mktemp)"
    cat /run/secrets/db_password > "$pwfile"
    chown postgres "$pwfile"

    su-exec postgres initdb -D "$PGDATA" -U "$POSTGRES_USER" --pwfile="$pwfile" \
        --auth-local=trust --auth-host=scram-sha-256
    rm -f "$pwfile"

    echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
    echo "host all all all scram-sha-256" >> "$PGDATA/pg_hba.conf"

    su-exec postgres pg_ctl -D "$PGDATA" -w start -o "-c listen_addresses=''"
    su-exec postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"
    su-exec postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS postgis;"
    su-exec postgres psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "CREATE EXTENSION IF NOT EXISTS vector;"
    su-exec postgres pg_ctl -D "$PGDATA" -m fast -w stop
fi

exec su-exec postgres postgres -D "$PGDATA"
