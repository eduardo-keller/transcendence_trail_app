FROM        alpine:3.24.2

RUN         apk add --no-cache nginx tini && \
            ln -sf /dev/stdout /var/log/nginx/access.log && \
            ln -sf /dev/stderr /var/log/nginx/error.log

COPY        docker/nginx/conf/nginx.conf.template /etc/nginx/nginx.conf.template
COPY        --chmod=755 docker/nginx/tools/entrypoint.sh /usr/local/bin/entrypoint.sh

EXPOSE      80 443
ENTRYPOINT  ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD         ["nginx", "-g", "daemon off;"]
