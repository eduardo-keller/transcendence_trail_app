COMPOSE = docker compose -f docker/docker-compose.yml
SECRETS = docker/secrets/db_password.txt docker/secrets/better_auth_secret.txt
CERT = docker/nginx/certs/server.crt

# O DATABASE_URL só existe no processo do entrypoint; comandos via exec precisam montá-lo
DB_ENV = export DATABASE_URL="postgresql://$$POSTGRES_USER:$$(cat /run/secrets/db_password)@postgres:5432/$$POSTGRES_DB?schema=public";

.PHONY: all build up stop down logs sh npm migrate test import-trails studio check-env clean fclean re

all: up

up: docker/.env check-env $(SECRETS) $(CERT) data/postgres
	$(COMPOSE) up -d --build
	@echo "App em https://localhost:$$(sed -n 's/^HTTPS_PORT=//p' docker/.env | grep . || echo 8443)"

build:
	$(COMPOSE) build

stop:
	$(COMPOSE) stop

down:
	$(COMPOSE) down

logs:
	$(COMPOSE) logs -f

sh:
	$(COMPOSE) exec nextjs sh

# uso: make npm args="install zod"
npm:
	$(COMPOSE) exec nextjs npm $(args)

# uso: make migrate name=add_trails
migrate:
	$(if $(name),,$(error uso: make migrate name=<nome>))
	$(COMPOSE) exec nextjs sh -c '$(DB_ENV) npx prisma migrate dev --name $(name)'

# Testes (Vitest) num banco separado, <POSTGRES_DB>_test, criado e migrado na primeira execução
TEST_DB_ENV = export DATABASE_URL="postgresql://$$POSTGRES_USER:$$(cat /run/secrets/db_password)@postgres:5432/$${POSTGRES_DB}_test?schema=public";

# uso: make test  (ou make test args="tests/unit" para rodar só uma parte)
test:
	$(COMPOSE) exec nextjs sh -c '$(TEST_DB_ENV) npx vitest run $(args)'

# Importa (ou atualiza) as trilhas do OSM a partir de apps/web/prisma/data/*.sqlite
import-trails:
	$(COMPOSE) exec nextjs sh -c '$(DB_ENV) node prisma/import-trails.mts'

studio:
	$(COMPOSE) --profile tools up -d prisma-studio

# Só gera se não existir: regerar quebraria o login de um banco já criado
docker/secrets/%.txt:
	@mkdir -p docker/secrets
	openssl rand -hex 32 > $@
	chmod 600 $@

# Certificado autoassinado para o nginx. Para usar outro (ex.: mkcert), ponha server.crt e server.key na pasta
$(CERT):
	@mkdir -p docker/nginx/certs
	openssl req -x509 -newkey rsa:2048 -nodes -days 365 -subj "/CN=localhost" \
		-addext "subjectAltName=DNS:localhost,IP:127.0.0.1" \
		-keyout docker/nginx/certs/server.key -out $@ 2>/dev/null
	chmod 600 docker/nginx/certs/server.key

data/postgres:
	mkdir -p $@

docker/.env:
	cp docker/.env.example $@

# O docker/.env é copiado uma vez só: avisa quando ele ficou para trás do .env.example
check-env: docker/.env
	@for v in $$(sed -n 's/^\([A-Z_]*\)=.*/\1/p' docker/.env.example); do \
		grep -q "^$$v=" docker/.env || echo "aviso: falta $$v em docker/.env (copie de docker/.env.example)"; \
	done
	@for v in $$(sed -n 's/^\([A-Z_]*\)=.*/\1/p' docker/.env); do \
		grep -q "^$$v=" docker/.env.example || echo "aviso: $$v em docker/.env não é mais usado (pode apagar)"; \
	done

clean:
	$(COMPOSE) --profile tools down --rmi local -v


fclean: clean
	docker run --rm -v "$(CURDIR)/data:/data" alpine:3.24.2 rm -rf /data/postgres

re: fclean all
