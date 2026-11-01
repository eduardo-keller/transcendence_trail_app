FROM        alpine:3.24.2

# O Mailpit não está nos repositórios do Alpine: baixa o binário oficial e confere o checksum
ARG         MAILPIT_VERSION=1.31.6
ARG         MAILPIT_SHA256=10fa12ccc610f653d4ed4df848c1817f9935dcf4e9a6a458a19ab0fa02093f91

RUN         apk add --no-cache tini && \
            wget -qO /tmp/mailpit.tar.gz "https://github.com/axllent/mailpit/releases/download/v${MAILPIT_VERSION}/mailpit-linux-amd64.tar.gz" && \
            echo "$MAILPIT_SHA256  /tmp/mailpit.tar.gz" | sha256sum -c - && \
            tar -xzf /tmp/mailpit.tar.gz -C /usr/local/bin mailpit && \
            rm /tmp/mailpit.tar.gz && \
            adduser -D -H -s /sbin/nologin mailpit

USER        mailpit

EXPOSE      1025 8025
ENTRYPOINT  ["/sbin/tini", "--"]
# A interface fica em /mailpit/ porque chega pelo nginx (https://localhost:8443/mailpit/).
# Sem checagem de versão: nada no projeto depende de internet depois do build
CMD         ["mailpit", "--webroot", "/mailpit/", "--disable-version-check"]
