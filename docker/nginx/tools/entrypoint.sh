#!/bin/sh

set -eu

# O certificado vem de docker/nginx/certs/ (o make gera um autoassinado se faltar)
if [ ! -f /etc/nginx/certs/server.crt ] || [ ! -f /etc/nginx/certs/server.key ]; then
    echo "erro: faltam server.crt e server.key em docker/nginx/certs/ (rode make)" >&2
    exit 1
fi

# O redirect de HTTP precisa da porta HTTPS do host, que o nginx não enxerga de dentro do container
sed "s/@HTTPS_PORT@/${HTTPS_PORT}/g" /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf
nginx -t -q
exec "$@"
