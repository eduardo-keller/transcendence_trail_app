#!/usr/bin/env bash
# Bateria de testes do projeto inteiro, com o app rodando (make):
# repositório e segredos, Makefile, Docker, banco, importação do OSM, health check, páginas,
# autenticação (tests/test-auth.sh + casos extras), trilhas (tests/test-trails.sh), Vitest (make test),
# qualidade de código e build de produção. No fim, lista o que o subject pede e ainda falta (avisos).
#
# uso: bash tests/test-all.sh [--rapido]     (de qualquer pasta)
#   --rapido  pula o build de produção e o Postgres do zero (os passos mais lentos)
#
# Leva uns 5 minutos: cadastro e login têm rate limit, e o script espera a janela de 60 s duas vezes.
# Mexe no ambiente só de forma temporária: para e sobe o Postgres (teste do 503), reinicia o nextjs,
# sobe e para o Prisma Studio, cria bancos e usuários de teste. Tudo é desfeito no final, mesmo com Ctrl+C.

set -u
cd "$(dirname "$0")/.." || exit 1   # raiz do repositório

COMPOSE="docker compose -f docker/docker-compose.yml"
# O app só responde pelo nginx; -k nos curl aceita o certificado autoassinado
APP=${APP:-https://localhost:8443}
HTTP_APP=${HTTP_APP:-http://localhost:8080}
QUICK=0
[ "${1:-}" = "--rapido" ] && QUICK=1
TS=$(date +%s)
TMP=$(mktemp -d)
TEST_EMAIL_PREFIX="teste-all-$TS"
SCRATCH_PG="trilhas-teste-pg-$TS"
STUDIO_STARTED=0
POSTGRES_STOPPED=0
BOOT_DB=""

# Mesmo DATABASE_URL que o Makefile monta para os comandos via exec
DB_ENV='export DATABASE_URL="postgresql://$POSTGRES_USER:$(cat /run/secrets/db_password)@postgres:5432/$POSTGRES_DB?schema=public";'

pass=0
fail=0
warns=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; pass=$((pass + 1)); }
nok()  { printf '  \033[31m✘\033[0m %s\n' "$1"; fail=$((fail + 1)); }
warn() { printf '  \033[33m!\033[0m %s\n' "$1"; warns=$((warns + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
info() { printf '     %s\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else nok "$1"; fi; }
# Como check, mas falha vira aviso (o que ainda não foi feito, não o que quebrou)
check_warn() { if eval "$2"; then ok "$1"; else warn "$1"; fi; }

# SQL no Postgres do compose (uma linha, sem cabeçalho)
sql() {
	$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\""
}
# SQL lido da entrada padrão (heredoc); para no primeiro erro
sqlf() {
	$COMPOSE exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAq -v ON_ERROR_STOP=1' 2>&1
}
# Comando de shell dentro do container do app (pasta /app = apps/web)
in_web() { $COMPOSE exec -T nextjs sh -c "$1"; }

# Requisição HTTP: req MÉTODO CAMINHO [args do curl]. Grava $STATUS, $HEADERS e $BODY.
req() {
	local method=$1 path=$2 out
	shift 2
	out=$(curl -sk -i -X "$method" "$APP$path" "$@")
	HEADERS=$(printf '%s' "$out" | sed '/^\r$/q')
	BODY=$(printf '%s' "$out" | sed '1,/^\r$/d')
	STATUS=$(printf '%s' "$HEADERS" | head -1 | awk '{print $2}')
}
# POST JSON no Better Auth com a origem do app (exigida quando há cookie)
auth_post() {
	local path=$1 data=$2
	shift 2
	req POST "/api/auth$path" -H 'Content-Type: application/json' -H "Origin: $APP" -d "$data" "$@"
}

wait_health() {
	local i
	for i in $(seq 1 90); do
		[ "$(curl -sk -o /dev/null -w '%{http_code}' "$APP/api/health")" = 200 ] && return 0
		sleep 1
	done
	return 1
}

wait_postgres() {
	local i
	for i in $(seq 1 60); do
		$COMPOSE ps postgres | grep -q healthy && return 0
		sleep 1
	done
	return 1
}

pause_rate_limit() {
	info "aguardando 61 s: o rate limit do cadastro e do login conta por minuto..."
	sleep 61
}

# Roda outro script de teste, mostra a saída e soma o "Resultado: N passaram, M falharam" dele
run_suite() {
	local name=$1 out code result p f
	shift
	out=$("$@" 2>&1)
	code=$?
	printf '%s\n' "$out" | sed 's/^/    /'
	result=$(printf '%s' "$out" | sed 's/\x1b\[[0-9;]*m//g' | grep -oE 'Resultado: [0-9]+ passaram, [0-9]+ falharam' | tail -1)
	if [ -z "$result" ]; then
		nok "$name não terminou (código $code)"
		return
	fi
	p=$(grep -oE '[0-9]+ passaram' <<<"$result" | cut -d' ' -f1)
	f=$(grep -oE '[0-9]+ falharam' <<<"$result" | cut -d' ' -f1)
	pass=$((pass + p))
	fail=$((fail + f))
	info "→ $name: $p passaram, $f falharam (somados ao total)"
}

cleanup() {
	if [ "$POSTGRES_STOPPED" = 1 ]; then
		$COMPOSE start postgres >/dev/null 2>&1
		wait_postgres
	fi
	docker rm -f "$SCRATCH_PG" >/dev/null 2>&1
	if [ "$STUDIO_STARTED" = 1 ]; then
		$COMPOSE --profile tools rm -sfv prisma-studio >/dev/null 2>&1
	fi
	if [ -n "$BOOT_DB" ]; then
		$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -qc 'DROP DATABASE IF EXISTS \"$BOOT_DB\" WITH (FORCE)'" >/dev/null 2>&1
	fi
	sql "DELETE FROM \\\"User\\\" WHERE email LIKE '$TEST_EMAIL_PREFIX-%'" >/dev/null 2>&1
	rm -rf "$TMP"
}
trap cleanup EXIT
trap 'exit 130' INT TERM

# ──────────────────────────────────────────────────────────────────────────────
step "0. Pré-requisitos"
for cmd in docker curl openssl make git; do
	check "comando '$cmd' disponível" 'command -v $cmd >/dev/null'
done
if ! $COMPOSE ps --status running --services 2>/dev/null | grep -qx nextjs || ! wait_health; then
	nok "o app não está no ar em $APP. Rode 'make' e tente de novo."
	exit 1
fi
ok "app respondendo em $APP"
DBNAME=$(sql "SELECT current_database()")

# ──────────────────────────────────────────────────────────────────────────────
step "1. Repositório e segredos"
for f in Makefile README.md docker/docker-compose.yml docker/.env.example docker/postgres/Dockerfile \
	docker/postgres/tools/entrypoint.sh docker/nextjs/Dockerfile docker/nextjs/tools/entrypoint.sh \
	apps/web/package.json apps/web/package-lock.json apps/web/prisma.config.ts apps/web/prisma/schema.prisma \
	apps/web/prisma/import-trails.mts apps/web/prisma/data/trilhas_20261007.sqlite apps/web/vitest.config.mts; do
	check "existe $f" '[ -f "$f" ] && git ls-files --error-unmatch "$f" >/dev/null 2>&1'
done
check "segredos fora do git (só o .gitkeep de docker/secrets está versionado)" \
	'[ "$(git ls-files docker/.env docker/secrets)" = "docker/secrets/.gitkeep" ]'
check ".gitignore cobre .env, segredos, dados do Postgres, node_modules e .next" \
	'( for p in docker/.env docker/secrets/db_password.txt data/postgres apps/web/node_modules apps/web/.next; do git check-ignore -q "$p" || exit 1; done )'
check "nenhum node_modules/ ou .next/ versionado" '! git ls-files | grep -qE "(^|/)(node_modules|\.next)/"'
for s in db_password better_auth_secret; do
	f=docker/secrets/$s.txt
	check "$f: 64 caracteres hexadecimais" '[[ "$(cat "$f")" =~ ^[0-9a-f]{64}$ ]]'
	check "$f: permissão 600 (só o dono lê)" '[ "$(stat -c %a "$f")" = 600 ]'
done
check ".env.example tem as variáveis usadas pelo compose" \
	'( for v in POSTGRES_USER POSTGRES_DB HTTPS_PORT HTTP_PORT; do grep -q "^$v=" docker/.env.example || exit 1; done )'
check ".gitignore cobre o certificado do nginx" 'git check-ignore -q docker/nginx/certs/server.key'
check ".env.example não tem senha nem segredo" '! grep -qiE "^[A-Z_]*(PASSWORD|SECRET)[A-Z_]*=." docker/.env.example'
check "toda migration tem migration.sql e o lock é postgresql" \
	'( for d in apps/web/prisma/migrations/*/; do [ -s "$d/migration.sql" ] || exit 1; done ) && grep -q "provider = \"postgresql\"" apps/web/prisma/migrations/migration_lock.toml'
check "README começa com a linha em itálico exigida pelo subject" \
	'head -1 README.md | grep -q "^\*This project has been created as part of the 42 curriculum by"'

# ──────────────────────────────────────────────────────────────────────────────
step "2. Makefile"
check "make -n: todos os alvos se resolvem" \
	'make -n all build stop down logs sh test import-trails studio check-env clean fclean >/dev/null 2>&1 && make -n migrate name=x >/dev/null 2>&1'
OUT=$(make -n migrate 2>&1)
check "make migrate sem nome mostra o uso e falha" '! make -n migrate >/dev/null 2>&1 && grep -q "uso: make migrate name=<nome>" <<<"$OUT"'
# Geração de segredos e do .env numa cópia do Makefile, longe dos arquivos reais
mkdir -p "$TMP/mk/docker" && cp Makefile "$TMP/mk/" && cp docker/.env.example "$TMP/mk/docker/"
make -C "$TMP/mk" docker/secrets/db_password.txt docker/secrets/better_auth_secret.txt docker/.env >/dev/null 2>&1
check "gera os segredos com 64 hex e permissão 600" \
	'[[ "$(cat "$TMP/mk/docker/secrets/db_password.txt")" =~ ^[0-9a-f]{64}$ ]] && [ "$(stat -c %a "$TMP/mk/docker/secrets/db_password.txt")" = 600 ]'
check "os dois segredos gerados são diferentes" \
	'! cmp -s "$TMP/mk/docker/secrets/db_password.txt" "$TMP/mk/docker/secrets/better_auth_secret.txt"'
check "gera docker/.env a partir do .env.example" 'cmp -s "$TMP/mk/docker/.env" docker/.env.example'
OUT=$(make -s -C "$TMP/mk" check-env 2>&1)
check "check-env não avisa nada com o .env recém-copiado" '[ -z "$OUT" ]'
printf 'POSTGRES_USER=app\nPOSTGRES_DB=trails\nBETTER_AUTH_URL=http://localhost:3000\n' > "$TMP/mk/docker/.env"
OUT=$(make -s -C "$TMP/mk" check-env 2>&1)
check "check-env avisa variável faltando e variável que sobrou" \
	'grep -q "falta HTTPS_PORT" <<<"$OUT" && grep -q "BETTER_AUTH_URL .* não é mais usado" <<<"$OUT"'
make -C "$TMP/mk" docker/nginx/certs/server.crt >/dev/null 2>&1
check "gera o certificado do nginx (localhost) com a chave em permissão 600" \
	'openssl x509 -in "$TMP/mk/docker/nginx/certs/server.crt" -noout -ext subjectAltName | grep -q "DNS:localhost" && [ "$(stat -c %a "$TMP/mk/docker/nginx/certs/server.key")" = 600 ]'
BEFORE=$(cat "$TMP/mk/docker/secrets/db_password.txt")
make -C "$TMP/mk" docker/secrets/db_password.txt >/dev/null 2>&1
check "não regera um segredo que já existe (quebraria o login do banco)" '[ "$(cat "$TMP/mk/docker/secrets/db_password.txt")" = "$BEFORE" ]'

# ──────────────────────────────────────────────────────────────────────────────
step "3. Docker e containers"
PG=$($COMPOSE ps -q postgres)
WEB=$($COMPOSE ps -q nextjs)
NGINX=$($COMPOSE ps -q nginx)
check "docker compose config é válido" '$COMPOSE config -q'
check "postgres rodando e saudável (healthcheck)" '$COMPOSE ps postgres | grep -q healthy'
check "nextjs rodando" '[ "$(docker inspect -f "{{.State.Running}}" "$WEB")" = true ]'
check "nginx rodando" '[ -n "$NGINX" ] && [ "$(docker inspect -f "{{.State.Running}}" "$NGINX")" = true ]'
check "PID 1 é o tini nos três containers (sinais e processos zumbis)" \
	'( for c in "$PG" "$WEB" "$NGINX"; do [ "$(docker exec "$c" cat /proc/1/comm)" = tini ] || exit 1; done )'
check "o Postgres roda como usuário postgres, não root" \
	'docker exec "$PG" ps -o user,comm | grep -E "postgres +postgres" -q && ! docker exec "$PG" ps -o user,comm | grep -qE "^root +postgres"'
check "a porta do Postgres não é publicada no host" '[ -z "$(docker port "$PG")" ]'
check "nextjs não publica porta (só é acessível pelo nginx)" '[ -z "$(docker port "$WEB")" ]'
check "nginx publica só a 443 e a 80" '[ "$(docker port "$NGINX" | cut -d/ -f1 | sort -u | tr "\n" " ")" = "443 80 " ]'
check "Prisma Studio fora do make padrão (profile tools)" '! $COMPOSE config --services | grep -qx prisma-studio'
LOCATION=$(curl -sk -o /dev/null -w '%{redirect_url}' "$HTTP_APP/trilhas?x=1")
check "HTTP redireciona para HTTPS mantendo o caminho (veio $LOCATION)" '[ "$LOCATION" = "$APP/trilhas?x=1" ]'
check "segredos montados em /run/secrets e iguais aos do host" \
	'[ "$(docker exec "$WEB" cat /run/secrets/db_password)" = "$(cat docker/secrets/db_password.txt)" ] && [ "$(docker exec "$WEB" cat /run/secrets/better_auth_secret)" = "$(cat docker/secrets/better_auth_secret.txt)" ] && [ "$(docker exec "$PG" cat /run/secrets/db_password)" = "$(cat docker/secrets/db_password.txt)" ]'
ENVS="$(docker inspect -f '{{json .Config.Env}}' "$WEB" "$PG")"
check "segredos não aparecem nas variáveis de ambiente dos containers" \
	'! grep -qF "$(cat docker/secrets/db_password.txt)" <<<"$ENVS" && ! grep -qF "$(cat docker/secrets/better_auth_secret.txt)" <<<"$ENVS"'
check "DATABASE_URL (com a senha) não fica na configuração do container" '! grep -q DATABASE_URL <<<"$ENVS"'
check "entrypoints sem erro de sintaxe (sh -n)" \
	'docker exec "$WEB" sh -n /usr/local/bin/entrypoint.sh && docker exec "$PG" sh -n /usr/local/bin/entrypoint.sh'
check_warn "volumes anônimos do nextjs apontam para /app (hoje node_modules e .next vão parar no host como root)" \
	'docker inspect -f "{{range .Mounts}}{{.Destination}} {{end}}" "$WEB" | grep -q "/app/node_modules"'
check_warn "o app não roda como root dentro do container" '[ "$(docker exec "$WEB" id -u)" != 0 ]'

SINCE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
$COMPOSE restart nextjs >/dev/null 2>&1
check "nextjs volta depois de reiniciar" 'wait_health'
LOGS=$($COMPOSE logs --since "$SINCE" nextjs 2>&1)
check "na subida, o entrypoint aplica as migrations" 'grep -qE "No pending migrations|migrations have been successfully applied" <<<"$LOGS"'
check "na subida, a importação do OSM não repete (--if-empty)" 'grep -q "import-trails: .* já importadas, nada a fazer" <<<"$LOGS"'

if $COMPOSE --profile tools ps --status running --services 2>/dev/null | grep -qx prisma-studio; then
	info "Prisma Studio já estava rodando: só confiro a resposta"
else
	STUDIO_OUT=$(make studio 2>&1) && STUDIO_STARTED=1
	check "make studio cria e inicia o container do Prisma Studio" '[ "$STUDIO_STARTED" = 1 ]'
	[ "$STUDIO_STARTED" = 1 ] || tail -5 <<<"$STUDIO_OUT" | sed 's/^/       /'
fi
STUDIO_CODE=000
for i in $(seq 1 180); do
	STUDIO_CODE=$(curl -sk -o /dev/null -w '%{http_code}' --max-time 2 http://localhost:5555)
	[ "$STUDIO_CODE" = 200 ] && break
	sleep 1
done
check "Prisma Studio responde em http://localhost:5555 (veio $STUDIO_CODE em ${i}s)" '[ "$STUDIO_CODE" = 200 ]'
[ "$STUDIO_CODE" = 200 ] || $COMPOSE --profile tools logs --tail 15 prisma-studio 2>&1 | sed 's/^/       /'
check "Prisma Studio só aceita conexões desta máquina (127.0.0.1)" 'docker port "$($COMPOSE --profile tools ps -q prisma-studio)" | grep -q "^5556/tcp -> 127.0.0.1:5555$"'
if [ "$STUDIO_STARTED" = 1 ]; then
	$COMPOSE --profile tools rm -sfv prisma-studio >/dev/null 2>&1 && STUDIO_STARTED=0
	info "Prisma Studio parado de novo"
fi

if [ "$QUICK" = 1 ]; then
	info "--rapido: pulando o Postgres do zero"
else
	printf 'senha-de-teste-%s' "$TS" >"$TMP/pgpass" && chmod 644 "$TMP/pgpass"
	docker run -d --name "$SCRATCH_PG" -e POSTGRES_USER=app -e POSTGRES_DB=banco_teste \
		-v "$TMP/pgpass:/run/secrets/db_password:ro" "$(docker inspect -f '{{.Config.Image}}' "$PG")" >/dev/null
	READY=1
	for i in $(seq 1 60); do
		docker exec "$SCRATCH_PG" pg_isready -h 127.0.0.1 -U app -d banco_teste >/dev/null 2>&1 && READY=0 && break
		sleep 1
	done
	check "Postgres do zero: inicializa sozinho (initdb) e fica pronto em ${i}s" '[ "$READY" = 0 ]'
	check "Postgres do zero: cria o banco do POSTGRES_DB com postgis e vector" \
		'[ "$(docker exec "$SCRATCH_PG" psql -U app -d banco_teste -tAc "SELECT string_agg(extname, '"'"','"'"' ORDER BY extname) FROM pg_extension")" = "plpgsql,postgis,vector" ]'
	check "Postgres do zero: pela rede, senha errada é recusada" \
		'! docker exec -e PGPASSWORD=errada "$SCRATCH_PG" psql -h 127.0.0.1 -U app -d banco_teste -tAc "SELECT 1" >/dev/null 2>&1'
	check "Postgres do zero: pela rede, a senha do secret funciona" \
		'docker exec -e PGPASSWORD="senha-de-teste-$TS" "$SCRATCH_PG" psql -h 127.0.0.1 -U app -d banco_teste -tAc "SELECT 1" >/dev/null 2>&1'
	docker rm -f "$SCRATCH_PG" >/dev/null 2>&1
fi

# ──────────────────────────────────────────────────────────────────────────────
step "4. Banco de dados"
check "PostgreSQL 18" '[[ "$(sql "SHOW server_version")" == 18* ]]'
check "extensões postgis e vector instaladas no banco do app" \
	'[ "$(sql "SELECT count(*) FROM pg_extension WHERE extname IN ('"'"'postgis'"'"', '"'"'vector'"'"')")" = 2 ]'
check "senhas com scram-sha-256 e nenhuma regra 'trust' para a rede" \
	'[ "$(sql "SHOW password_encryption")" = scram-sha-256 ] && [ "$(sql "SELECT count(*) FROM pg_hba_file_rules WHERE type = '"'"'host'"'"' AND auth_method = '"'"'trust'"'"'")" = 0 ]'
check "pela rede, senha errada é recusada no banco do app" \
	'! docker exec -e PGPASSWORD=errada "$PG" psql -h 127.0.0.1 -U "$(docker exec "$PG" printenv POSTGRES_USER)" -d "$DBNAME" -tAc "SELECT 1" >/dev/null 2>&1'
OUT=$(in_web "$DB_ENV npx prisma migrate status 2>&1")
check "todas as migrations aplicadas (prisma migrate status)" 'grep -q "Database schema is up to date" <<<"$OUT"'
OUT=$(in_web "$DB_ENV npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null")
check "banco idêntico ao schema.prisma (sem drift)" 'grep -q "empty migration" <<<"$OUT"'

# spatial_ref_sys é criada pela extensão PostGIS
EXPECTED_TABLES="Account Activity Badge Community CommunityMember Event EventParticipant Notification Post Session Trail User UserBadge Verification _prisma_migrations spatial_ref_sys"
TABLES=$(sql "SELECT tablename FROM pg_tables WHERE schemaname = 'public'" | LC_ALL=C sort | tr '\n' ' ' | sed 's/ $//')
check "tabelas esperadas, nem mais nem menos" '[ "$TABLES" = "$(tr " " "\n" <<<"$EXPECTED_TABLES" | LC_ALL=C sort | tr "\n" " " | sed "s/ \$//")" ]'
ENUMS=$(sqlf <<'SQL'
SELECT t.typname || '=' || string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder)
FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid GROUP BY t.typname ORDER BY 1;
SQL
)
check "enums com os valores esperados" \
	'[ "$(tr "\n" " " <<<"$ENUMS")" = "Difficulty=EASY,MODERATE,HARD Role=ADMIN,MODERATOR,MEMBER TrailSource=OSM,USER Visibility=PUBLIC,PRIVATE " ]'

# onDelete de cada chave estrangeira (c = Cascade, n = SetNull), como na ADR-0010
FKS=$(sqlf <<'SQL' | LC_ALL=C sort
SELECT t.relname || '.' || a.attname || '>' || r.relname || ':' || c.confdeltype::text
FROM pg_constraint c
JOIN pg_class t ON t.oid = c.conrelid
JOIN pg_class r ON r.oid = c.confrelid
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
WHERE c.contype = 'f';
SQL
)
EXPECTED_FKS=$(LC_ALL=C sort <<'EOF'
Account.userId>User:c
Activity.trailId>Trail:n
Activity.userId>User:c
CommunityMember.communityId>Community:c
CommunityMember.userId>User:c
Event.communityId>Community:c
Event.organizerId>User:c
EventParticipant.eventId>Event:c
EventParticipant.userId>User:c
Notification.userId>User:c
Post.communityId>Community:c
Post.userId>User:c
Session.userId>User:c
Trail.authorId>User:c
UserBadge.badgeId>Badge:c
UserBadge.userId>User:c
EOF
)
check "chaves estrangeiras e regras de exclusão iguais à ADR-0010 (16 relações)" '[ "$FKS" = "$EXPECTED_FKS" ]'
[ "$FKS" = "$EXPECTED_FKS" ] || diff <(echo "$EXPECTED_FKS") <(echo "$FKS") | sed 's/^/       /'

INDEXES=$(sql "SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
for idx in User_email_key Session_token_key Trail_externalId_key Badge_name_key Community_name_key \
	CommunityMember_userId_communityId_key EventParticipant_eventId_userId_key UserBadge_userId_badgeId_key; do
	check "índice único $idx" 'grep -qx "$idx" <<<"$INDEXES"'
done
for idx in Trail_authorId_idx Trail_source_difficulty_idx Trail_distance_idx Trail_elevationGain_idx Trail_title_id_idx \
	Activity_userId_idx Activity_trailId_idx Session_userId_idx Notification_userId_isRead_idx; do
	check "índice $idx" 'grep -qx "$idx" <<<"$INDEXES"'
done

OUT=$(sqlf <<'SQL'
BEGIN;
INSERT INTO "User" (id, name, email) VALUES ('teste-uniq-1', 'U', 'teste-uniq@example.com');
INSERT INTO "User" (id, name, email) VALUES ('teste-uniq-2', 'U', 'teste-uniq@example.com');
ROLLBACK;
SQL
)
check "o banco recusa dois usuários com o mesmo e-mail" 'grep -q "User_email_key" <<<"$OUT"'
OUT=$(sqlf <<'SQL'
BEGIN;
INSERT INTO "User" (id, name, email) VALUES ('teste-cascata', 'C', 'teste-cascata@example.com'), ('teste-outro', 'O', 'teste-outro@example.com');
INSERT INTO "Session" (id, "expiresAt", token, "userId", "updatedAt") VALUES ('teste-s', now() + interval '1 day', 'teste-token', 'teste-cascata', now());
INSERT INTO "Account" (id, "accountId", "providerId", "userId", "updatedAt") VALUES ('teste-a', 'teste-cascata', 'credential', 'teste-cascata', now());
INSERT INTO "Trail" (id, title, distance, "routeGeoJSON", "minLat", "minLon", "maxLat", "maxLon", "authorId") VALUES ('teste-t', 'T', 1, '{}', 0, 0, 0, 0, 'teste-cascata');
INSERT INTO "Activity" (id, title, distance, duration, "userId", "trailId") VALUES ('teste-act-dele', 'A', 1, 1, 'teste-cascata', 'teste-t'), ('teste-act-outro', 'B', 1, 1, 'teste-outro', 'teste-t');
INSERT INTO "Notification" (id, message, "userId") VALUES ('teste-n', 'N', 'teste-cascata');
DELETE FROM "User" WHERE id = 'teste-cascata';
SELECT (SELECT count(*) FROM "Session" WHERE id = 'teste-s') || ',' || (SELECT count(*) FROM "Account" WHERE id = 'teste-a')
	|| ',' || (SELECT count(*) FROM "Trail" WHERE id = 'teste-t') || ',' || (SELECT count(*) FROM "Activity" WHERE id = 'teste-act-dele')
	|| ',' || (SELECT count(*) FROM "Notification" WHERE id = 'teste-n')
	|| ',' || (SELECT count(*) FROM "Activity" WHERE id = 'teste-act-outro' AND "trailId" IS NULL);
ROLLBACK;
SQL
)
check "apagar usuário leva sessão, conta, trilha, atividade e notificação; a atividade de outra pessoa fica sem trilha" '[ "$OUT" = "0,0,0,0,0,1" ]'

# ──────────────────────────────────────────────────────────────────────────────
step "5. Importação do OSM"
SQLITE_STATS=$(in_web 'node -' <<'JS'
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('prisma/data/trilhas_20261007.sqlite', { readOnly: true });
const r = db.prepare(`SELECT count(*) n, sum(round(km_total * 1000)) d, cast(sum(ganho_m) AS int) g,
	cast(sum(perda_m) AS int) p, sum(circular = 'sim') c, sum(dificuldade_calc = 'facil') e,
	sum(dificuldade_calc = 'moderada') m, sum(dificuldade_calc = 'dificil') h FROM trilhas`).get();
console.log([r.n, r.d, r.g, r.p, r.c, `${r.e},${r.m},${r.h}`].join('|'));
JS
)
PG_STATS=$(sqlf <<'SQL'
SELECT count(*) || '|' || sum(distance)::bigint || '|' || sum("elevationGain")::int || '|' || sum("elevationLoss")::int
	|| '|' || count(*) FILTER (WHERE "isCircular") || '|' || count(*) FILTER (WHERE difficulty = 'EASY')
	|| ',' || count(*) FILTER (WHERE difficulty = 'MODERATE') || ',' || count(*) FILTER (WHERE difficulty = 'HARD')
FROM "Trail" WHERE source = 'OSM';
SQL
)
info ".sqlite:  $SQLITE_STATS   (trilhas|metros|ganho|perda|circulares|fácil,moderada,difícil)"
info "postgres: $PG_STATS"
check "banco igual ao .sqlite: contagem, distância, desnível, circulares e dificuldade" '[ -n "$SQLITE_STATS" ] && [ "$SQLITE_STATS" = "$PG_STATS" ]'
OUT=$(sqlf <<'SQL'
SELECT
	(SELECT count(*) FROM "Trail" WHERE description = '' OR surface = '' OR highway = '' OR "sacScale" = '') || ',' ||
	(SELECT count(*) FROM "Trail", jsonb_each_text("osmTags") t WHERE t.value = '') || ',' ||
	(SELECT count(*) FROM "Trail" WHERE "routeGeoJSON"->>'type' <> 'MultiLineString') || ',' ||
	(SELECT count(*) FROM "Trail" WHERE source = 'OSM' AND ("minLat" < -25 OR "maxLat" > -22.5 OR "minLon" < -48 OR "maxLon" > -45.5)) || ',' ||
	(SELECT count(*) FROM "Trail" WHERE source = 'OSM' AND NOT ("startLat" BETWEEN "minLat" - 1e-5 AND "maxLat" + 1e-5 AND "startLon" BETWEEN "minLon" - 1e-5 AND "maxLon" + 1e-5)) || ',' ||
	(SELECT count(*) FROM "Trail" WHERE source = 'OSM' AND ("authorId" IS NOT NULL OR visibility <> 'PUBLIC' OR "externalId" IS NULL));
SQL
)
check "sem string vazia nos campos nem nas tags (viram null)" '[ "$(cut -d, -f1-2 <<<"$OUT")" = "0,0" ]'
check "todo percurso é MultiLineString" '[ "$(cut -d, -f3 <<<"$OUT")" = 0 ]'
check "bbox de toda trilha dentro da Grande SP e com o ponto inicial dentro dela" '[ "$(cut -d, -f4-5 <<<"$OUT")" = "0,0" ]'
check "trilhas do OSM: sem autor, públicas e com externalId" '[ "$(cut -d, -f6 <<<"$OUT")" = 0 ]'

HASH_SQL="SELECT md5(string_agg(id || ':' || \\\"externalId\\\" || ':' || distance || ':' || title, ',' ORDER BY \\\"externalId\\\")) FROM \\\"Trail\\\" WHERE source = 'OSM'"
BEFORE=$(sql "$HASH_SQL")
OUT=$(make import-trails 2>&1)
check "make import-trails reimporta tudo sem recusar linhas" 'grep -q "importadas/atualizadas, 0 inválidas" <<<"$OUT"'
check "reimportar não duplica nem muda os ids (atividades continuam apontando para a trilha certa)" '[ "$(sql "$HASH_SQL")" = "$BEFORE" ]'
OUT=$(in_web "$DB_ENV node prisma/import-trails.mts --if-empty 2>&1")
check "--if-empty não faz nada quando o catálogo já existe" 'grep -q "nada a fazer" <<<"$OUT"'

BOOT_DB="${DBNAME}_bootstrap_$TS"
$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -qc 'CREATE DATABASE \"$BOOT_DB\"'" >/dev/null
BOOT_ENV="export DATABASE_URL=\"postgresql://\$POSTGRES_USER:\$(cat /run/secrets/db_password)@postgres:5432/$BOOT_DB?schema=public\";"
OUT=$(in_web "$BOOT_ENV npx prisma migrate deploy 2>&1")
check "banco novo: todas as migrations aplicam do zero" 'grep -q "migrations have been successfully applied" <<<"$OUT"'
OUT=$(in_web "$BOOT_ENV npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script 2>/dev/null")
check "banco novo: resultado idêntico ao schema.prisma" 'grep -q "empty migration" <<<"$OUT"'
OUT=$(in_web "$BOOT_ENV node prisma/import-trails.mts --if-empty 2>&1; node prisma/import-trails.mts --if-empty 2>&1")
check "banco novo: --if-empty importa o catálogo na primeira vez e não repete na segunda" \
	'grep -q "importadas/atualizadas, 0 inválidas" <<<"$OUT" && grep -q "nada a fazer" <<<"$OUT"'
$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d postgres -qc 'DROP DATABASE \"$BOOT_DB\" WITH (FORCE)'" >/dev/null && BOOT_DB=""

# ──────────────────────────────────────────────────────────────────────────────
step "6. Health check e persistência"
req GET /api/health
check "GET /api/health → 200 com status, db, dbLatencyMs e uptime" \
	'[ "$STATUS" = 200 ] && grep -qE "\"status\":\"ok\",\"db\":\"up\",\"dbLatencyMs\":[0-9]+,\"uptime\":[0-9]+" <<<"$BODY"'
req POST /api/health
check "POST /api/health → 405 (método não permitido)" '[ "$STATUS" = 405 ]'
COUNT_BEFORE=$(sql "SELECT count(*) FROM \\\"Trail\\\"")
$COMPOSE stop postgres >/dev/null 2>&1 && POSTGRES_STOPPED=1
req GET /api/health --max-time 20
check "com o banco parado → 503 com db: down" '[ "$STATUS" = 503 ] && grep -q "\"db\":\"down\"" <<<"$BODY"'
$COMPOSE start postgres >/dev/null 2>&1 && wait_postgres && POSTGRES_STOPPED=0
check "o banco volta e o health check também (sem reiniciar o app)" 'wait_health'
check "os dados sobrevivem ao reinício do Postgres ($COUNT_BEFORE trilhas)" '[ "$(sql "SELECT count(*) FROM \\\"Trail\\\"")" = "$COUNT_BEFORE" ]'

# ──────────────────────────────────────────────────────────────────────────────
step "7. Páginas e HTTP"
req GET /
check "GET / → 200 em pt-BR" '[ "$STATUS" = 200 ] && grep -q "<html lang=\"pt-BR\"" <<<"$BODY"'
req GET /login
check "GET /login → 200 com campos de e-mail e senha obrigatórios" \
	'[ "$STATUS" = 200 ] && grep -qE "<input type=\"email\" required=\"\" name=\"email\"" <<<"$BODY" && grep -qE "<input type=\"password\" required=\"\" name=\"password\"" <<<"$BODY"'
req GET /pagina-que-nao-existe
check "página inexistente → 404" '[ "$STATUS" = 404 ]'
check "favicon → 200 (sem 404 no console)" '[ "$(curl -sk -o /dev/null -w "%{http_code}" "$APP/favicon.ico")" = 200 ]'
req POST /api/trails
check "POST /api/trails → 405 (escritas são Server Actions)" '[ "$STATUS" = 405 ]'
req GET /api/auth/ok
check "GET /api/auth/ok → 200 {\"ok\":true} (Better Auth montado)" '[ "$STATUS" = 200 ] && [ "$BODY" = "{\"ok\":true}" ]'
req GET /api/auth/rota-que-nao-existe
check "rota inexistente do Better Auth → 404" '[ "$STATUS" = 404 ]'
req GET /
check_warn "sem o header X-Powered-By (revela o framework)" '! grep -qi "^x-powered-by" <<<"$HEADERS"'

# ──────────────────────────────────────────────────────────────────────────────
step "8. Autenticação (tests/test-auth.sh)"
run_suite "test-auth.sh" bash tests/test-auth.sh
pause_rate_limit

step "9. Trilhas (tests/test-trails.sh) e rate limit do cadastro"
run_suite "test-trails.sh" bash tests/test-trails.sh
# test-trails.sh fez 2 cadastros neste minuto: o 3º passa (inválido) e o 4º estoura o limite de 3
auth_post /sign-up/email '{"name":"X","email":"nao-e-email","password":"senha-forte-123"}'
check "cadastro com e-mail inválido → 400 VALIDATION_ERROR (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q VALIDATION_ERROR <<<"$BODY"'
auth_post /sign-up/email "{\"name\":\"X\",\"email\":\"$TEST_EMAIL_PREFIX-limite@example.com\",\"password\":\"senha-forte-123\"}"
check "4º cadastro no mesmo minuto → 429 (veio $STATUS)" '[ "$STATUS" = 429 ]'
pause_rate_limit

step "10. Autenticação: casos extras"
EMAIL="$TEST_EMAIL_PREFIX-extra@example.com"
JAR="$TMP/cookies.txt"
auth_post /sign-up/email "{\"name\":\"Extra\",\"email\":\"$EMAIL\",\"password\":\"senha-forte-123\"}" -c "$JAR"
check "cadastro → 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
auth_post /sign-up/email "{\"name\":\"Extra\",\"email\":\"$EMAIL\",\"password\":\"outra-senha-123\"}"
check "e-mail repetido → 422 USER_ALREADY_EXISTS (veio $STATUS)" '[ "$STATUS" = 422 ] && grep -q USER_ALREADY_EXISTS <<<"$BODY"'
check "e continua existindo um só usuário com esse e-mail" '[ "$(sql "SELECT count(*) FROM \\\"User\\\" WHERE email = '"'"'$EMAIL'"'"'")" = 1 ]'
auth_post /sign-up/email "{\"name\":\"Extra\",\"email\":\"$TEST_EMAIL_PREFIX-longa@example.com\",\"password\":\"$(printf 'a%.0s' $(seq 1 129))\"}"
check "senha com 129 caracteres → 400 PASSWORD_TOO_LONG (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q PASSWORD_TOO_LONG <<<"$BODY"'
req POST /api/auth/sign-in/email -H 'Content-Type: application/json' -H 'Origin: http://site-malicioso.example' \
	-d "{\"email\":\"$EMAIL\",\"password\":\"senha-forte-123\"}"
check "login vindo de outra origem → 403 INVALID_ORIGIN (veio $STATUS)" '[ "$STATUS" = 403 ] && grep -q INVALID_ORIGIN <<<"$BODY"'
auth_post /sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"senha-forte-123\"}" -c "$JAR"
check "login → 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
SESSION_INFO=$(sql "SELECT count(*) FILTER (WHERE s.\\\"ipAddress\\\" IS NOT NULL AND s.\\\"userAgent\\\" LIKE 'curl/%') || ',' || count(*) FILTER (WHERE s.\\\"expiresAt\\\" BETWEEN now() + interval '6 days' AND now() + interval '8 days') FROM \\\"Session\\\" s JOIN \\\"User\\\" u ON u.id = s.\\\"userId\\\" WHERE u.email = '$EMAIL'")
check "a sessão guarda IP e navegador e expira em 7 dias" '[ "$(cut -d, -f1 <<<"$SESSION_INFO")" -ge 1 ] && [ "$(cut -d, -f2 <<<"$SESSION_INFO")" -ge 1 ]'
req GET /api/auth/get-session -b '__Secure-better-auth.session_token=forjado.assinatura-falsa'
check "cookie forjado não vale: get-session → null" '[ "$BODY" = null ]'
req POST /api/auth/sign-out -b "$JAR" -H 'Content-Type: application/json' -H 'Origin: http://site-malicioso.example' -d '{}'
check "logout com o cookie mas vindo de outra origem → 403 (proteção contra CSRF)" '[ "$STATUS" = 403 ]'
req POST /api/auth/sign-out -b "$JAR" -H 'Content-Type: application/json' -d '{}'
check "logout com o cookie e sem Origin → 403 MISSING_OR_NULL_ORIGIN" '[ "$STATUS" = 403 ] && grep -q MISSING_OR_NULL_ORIGIN <<<"$BODY"'
req GET /api/auth/get-session -b "$JAR"
check "depois das tentativas recusadas, a sessão continua válida" 'grep -q "$EMAIL" <<<"$BODY"'
check_warn "get-session não devolve o token da sessão no corpo (um XSS conseguiria lê-lo, apesar do HttpOnly)" \
	'! grep -q "\"token\":" <<<"$BODY"'
auth_post /sign-out '{}' -b "$JAR"
check "logout legítimo → 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'

# ──────────────────────────────────────────────────────────────────────────────
step "11. Testes automatizados (make test)"
OUT=$(make test 2>&1)
CODE=$?
SUMMARY=$(printf '%s' "$OUT" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^ +(Test Files|Tests) ")
printf '%s\n' "$SUMMARY" | sed 's/^ */     /'
V_PASS=$(grep -E "^ +Tests " <<<"$SUMMARY" | grep -oE "[0-9]+ passed" | cut -d' ' -f1)
V_FAIL=$(grep -E "^ +Tests " <<<"$SUMMARY" | grep -oE "[0-9]+ failed" | cut -d' ' -f1)
check "Vitest: suíte completa passa (código $CODE)" '[ "$CODE" = 0 ] && [ -n "$V_PASS" ]'
pass=$((pass + ${V_PASS:-0}))
fail=$((fail + ${V_FAIL:-0}))
info "→ Vitest: ${V_PASS:-0} passaram, ${V_FAIL:-0} falharam (somados ao total)"
[ "$CODE" = 0 ] || printf '%s\n' "$OUT" | sed 's/\x1b\[[0-9;]*m//g' | grep -E "FAIL|AssertionError" | head -20 | sed 's/^/       /'

# ──────────────────────────────────────────────────────────────────────────────
step "12. Qualidade de código e build"
OUT=$(in_web "npx tsc --noEmit -p . 2>&1")
check "TypeScript sem erros (tsc --noEmit)" '[ -z "$OUT" ]'
[ -z "$OUT" ] || head -10 <<<"$OUT" | sed 's/^/       /'
OUT=$(in_web "npx biome lint src tests prisma/import-trails.mts 2>&1")
LINT_ERRORS=$(grep -oE "Found [0-9]+ errors?" <<<"$OUT" | grep -oE "[0-9]+")
check "Biome lint sem erros em src, tests e no import (${LINT_ERRORS:-0} erros)" '[ -z "$LINT_ERRORS" ]'
[ -z "$LINT_ERRORS" ] || grep -E "^\S+\.(ts|tsx|mts):[0-9]+:[0-9]+ " <<<"$OUT" | sed 's/^/       /'
if [ "$QUICK" = 1 ]; then
	info "--rapido: pulando o build de produção"
else
	info "build de produção num container descartável (npm ci + next build, ~1 min)..."
	OUT=$(docker run --rm -v "$PWD/apps/web:/src:ro" -e NEXT_TELEMETRY_DISABLED=1 \
		-e DATABASE_URL=postgresql://build:build@localhost:5432/build \
		-e BETTER_AUTH_SECRET=segredo-so-para-o-build-de-teste-1234567890 -e BETTER_AUTH_URL=http://localhost:3000 \
		--entrypoint sh "$(docker inspect -f '{{.Config.Image}}' "$WEB")" -c '
			mkdir /build && cd /src && tar --exclude=./node_modules --exclude=./.next -cf - . | tar -xf - -C /build && cd /build \
			&& npm ci --no-audit --no-fund --loglevel=error >/dev/null && npx prisma generate >/dev/null 2>&1 \
			&& npx next build > /tmp/build.log 2>&1; code=$?; cat /tmp/build.log; echo "BUILD_EXIT=$code"' 2>&1)
	check "next build de produção passa a partir de um clone limpo" 'grep -q "BUILD_EXIT=0" <<<"$OUT"'
	check "o build não registra erros (variáveis de ambiente, server actions)" '! grep -qE "Error|Failed" <<<"$OUT"'
	check "rotas da API compiladas como dinâmicas (sem cache de dados)" \
		'grep -qE "ƒ /api/health" <<<"$OUT" && grep -qE "ƒ /api/trails$" <<<"$OUT" && grep -qE "ƒ /api/trails/\[id\]" <<<"$OUT"'
	grep -qE "BUILD_EXIT=0" <<<"$OUT" || tail -20 <<<"$OUT" | sed 's/^/       /'
fi

# ──────────────────────────────────────────────────────────────────────────────
step "13. Requisitos do subject ainda pendentes (avisos, não falhas)"
req GET /
check_warn "app em modo produção (hoje é next dev, que gera avisos no console)" '! grep -q "hmr-client" <<<"$BODY"'
PRIVACY=$(for p in privacy privacidade politica-de-privacidade; do curl -sk -o /dev/null -w '%{http_code}\n' "$APP/$p"; done | grep -c 200)
TERMS=$(for p in terms termos termos-de-uso; do curl -sk -o /dev/null -w '%{http_code}\n' "$APP/$p"; done | grep -c 200)
check_warn "página de Política de Privacidade (obrigatória)" '[ "$PRIVACY" -ge 1 ]'
check_warn "página de Termos de Uso (obrigatória)" '[ "$TERMS" -ge 1 ]'
check_warn "README com os logins da 42 na primeira linha (hoje: <login_...>)" '! head -1 README.md | grep -q "<login"'
warn "console do Chrome sem erros: não dá para verificar daqui (precisa de navegador; ex.: Playwright)"

# ──────────────────────────────────────────────────────────────────────────────
printf '\n\033[1mResultado: %d passaram, %d falharam, %d avisos\033[0m\n' "$pass" "$fail" "$warns"
[ "$fail" -eq 0 ]
