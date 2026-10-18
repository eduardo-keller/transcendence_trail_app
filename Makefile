COMPOSE = docker compose -f docker/docker-compose.yml
SECRETS = docker/secrets/db_password.txt docker/secrets/better_auth_secret.txt

# O DATABASE_URL só existe no processo do entrypoint; comandos via exec precisam montá-lo
DB_ENV = export DATABASE_URL="postgresql://$$POSTGRES_USER:$$(cat /run/secrets/db_password)@postgres:5432/$$POSTGRES_DB?schema=public";

.PHONY: all build up stop down logs sh npm migrate test import-trails studio clean fclean re

all: up

up: docker/.env $(SECRETS) data/postgres
	$(COMPOSE) up -d --build

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

data/postgres:
	mkdir -p $@

docker/.env:
	cp docker/.env.example $@

clean:
	$(COMPOSE) --profile tools down --rmi local -v


fclean: clean
	docker run --rm -v "$(CURDIR)/data:/data" alpine:3.24.2 rm -rf /data/postgres

re: fclean all
