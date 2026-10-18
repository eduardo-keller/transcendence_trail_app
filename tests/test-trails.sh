#!/usr/bin/env bash
# Testa de ponta a ponta as rotas de leitura de trilhas (/api/trails) com o app rodando (make):
# paginação, filtros, validação (400) e autorização (trilha privada só para o autor).
# Cria dois usuários e uma trilha privada e apaga tudo no final.
#
# uso: bash tests/test-trails.sh (de qualquer pasta)
#
# As escritas (criar, editar e apagar) são Server Actions, sem rota HTTP: ficam fora deste script.
# O cadastro tem rate limit (3 por minuto por IP): se rodar logo depois do test-auth.sh, espere 1 minuto.

set -u
cd "$(dirname "$0")/.." || exit 1   # raiz do repositório (o compose é relativo a ela)

BASE=http://localhost:3000/api/trails
AUTH=http://localhost:3000/api/auth
COMPOSE="docker compose -f docker/docker-compose.yml"
TS=$(date +%s)
EMAIL_A="trilhas-a-$TS@example.com"
EMAIL_B="trilhas-b-$TS@example.com"
PASSWORD="senha-forte-123"
PRIVATE_ID="teste-privada-$TS"
PRIVATE_TITLE="Trilha Privada de Teste $TS"
JAR_A=$(mktemp)        # cookies do usuário A (autor da trilha privada)
JAR_B=$(mktemp)        # cookies do usuário B
trap 'rm -f "$JAR_A" "$JAR_B"' EXIT

pass=0
fail=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; pass=$((pass + 1)); }
nok()  { printf '  \033[31m✘\033[0m %s\n' "$1"; fail=$((fail + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else nok "$1"; fi; }

# GET na API de trilhas. Grava o corpo em $BODY e o status em $STATUS.
# uso: get '?q=cachoeira' [-b arquivo-de-cookies]
get() {
	local out
	out=$(curl -s -w '\n%{http_code}' "$BASE$1" "${@:2}")
	BODY=$(printf '%s' "$out" | sed '$d')
	STATUS=$(printf '%s' "$out" | tail -1)
}

# Valor numérico de um campo do JSON (o primeiro que aparecer): field total
field() { grep -o "\"$1\":-\?[0-9.]*" <<<"$BODY" | head -1 | cut -d: -f2; }

# Consulta SQL no Postgres do compose; devolve só o valor (sem cabeçalho)
sql() {
	$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\""
}

signup() {
	curl -s -o /dev/null -w '%{http_code}' -c "$3" -H 'Content-Type: application/json' \
		-H 'Origin: http://localhost:3000' -X POST "$AUTH/sign-up/email" \
		-d "{\"name\":\"$1\",\"email\":\"$2\",\"password\":\"$PASSWORD\"}"
}

expect_400() {
	get "$1"
	check "$1 → 400 VALIDATION_ERROR (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q VALIDATION_ERROR <<<"$BODY"'
}

step "0. O app está no ar e tem trilhas?"
if ! curl -s -o /dev/null http://localhost:3000/api/health; then
	nok "http://localhost:3000 não responde. Rode 'make' e tente de novo."
	exit 1
fi
ok "app respondendo em http://localhost:3000"
get ''
TOTAL=$(field total)
check "GET /api/trails responde 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
check "catálogo importado: $TOTAL trilhas" '[ "${TOTAL:-0}" -gt 0 ]'

step "1. Paginação"
check "resposta no formato { items, page, pageSize, total }" 'grep -q "\"items\":\[" <<<"$BODY" && [ "$(field page)" = 1 ] && [ "$(field pageSize)" = 20 ]'
check "padrão: 20 itens por página" '[ "$(grep -o "\"source\":" <<<"$BODY" | wc -l)" -eq 20 ]'
get '?page=2&pageSize=5'
check "?page=2&pageSize=5 devolve 5 itens da página 2" '[ "$(field page)" = 2 ] && [ "$(grep -o "\"source\":" <<<"$BODY" | wc -l)" -eq 5 ]'
get "?page=999999&pageSize=50"
check "página além do fim devolve lista vazia" 'grep -q "\"items\":\[\]" <<<"$BODY"'
get '?q=&page=&pageSize=1'
check "parâmetros vazios são ignorados (veio $STATUS)" '[ "$STATUS" = 200 ] && [ "$(field page)" = 1 ]'

step "2. Filtros e ordenação"
get '?difficulty=HARD&pageSize=50'
check "difficulty=HARD só traz trilhas HARD" '[ "$STATUS" = 200 ] && ! grep -q "\"difficulty\":\"\(EASY\|MODERATE\)\"" <<<"$BODY"'
get '?difficulty=MODERATE,HARD&pageSize=50'
check "difficulty=MODERATE,HARD aceita lista separada por vírgula" '[ "$STATUS" = 200 ] && ! grep -q "\"difficulty\":\"EASY\"" <<<"$BODY"'
get '?minDistanceKm=5&sort=distance&order=asc&pageSize=1'
FIRST=$(field distance)
check "minDistanceKm=5: a menor trilha tem ${FIRST:-?} m (>= 5000)" '[ "${FIRST%.*}" -ge 5000 ]'
get '?sort=elevationGain&order=desc&pageSize=1'
TOP=$(field elevationGain)
MAX=$(sql "SELECT max(\\\"elevationGain\\\")::int FROM \\\"Trail\\\" WHERE visibility = 'PUBLIC'")
check "sort=elevationGain&order=desc começa pelo maior ganho (${TOP%.*} = $MAX)" '[ "${TOP%.*}" = "$MAX" ]'
get '?q=cachoeira'
check "q=cachoeira encontra trilhas ($(field total))" '[ "$(field total)" -gt 0 ]'
get '?bbox=-46.70,-23.60,-46.60,-23.50&pageSize=1'
check "bbox (centro de SP) encontra trilhas ($(field total))" '[ "$STATUS" = 200 ] && [ "$(field total)" -gt 0 ]'
get '?near=-23.777,-46.303&radiusKm=5&pageSize=1'
check "near + radiusKm (Paranapiacaba, 5 km) encontra trilhas ($(field total))" '[ "$STATUS" = 200 ] && [ "$(field total)" -gt 0 ]'

step "3. Entradas inválidas são recusadas no servidor"
expect_400 '?pageSize=999'
expect_400 '?page=abc'
expect_400 '?difficulty=FACIL'
expect_400 '?minDistanceKm=10&maxDistanceKm=2'
expect_400 '?bbox=1,2,3'
expect_400 '?bbox=-46.6,-23.5,-46.7,-23.6'
expect_400 '?near=200,10'
expect_400 '?sort=senha'
get '?pageSize=999'
check "o erro diz qual campo está errado" 'grep -q "\"path\":\"pageSize\"" <<<"$BODY"'

step "4. Detalhe"
OSM_ID=$(sql "SELECT id FROM \\\"Trail\\\" WHERE source = 'OSM' ORDER BY distance DESC LIMIT 1")
get "/$OSM_ID"
check "GET /api/trails/:id responde 200 com o percurso (veio $STATUS)" '[ "$STATUS" = 200 ] && grep -q "\"routeGeoJSON\":{\"type\":\"MultiLineString\"" <<<"$BODY"'
check "o detalhe não expõe authorId" '! grep -q "\"authorId\"" <<<"$BODY"'
get '/nao-existe'
check "id inexistente → 404 TRAIL_NOT_FOUND (veio $STATUS)" '[ "$STATUS" = 404 ] && grep -q TRAIL_NOT_FOUND <<<"$BODY"'

step "5. Autorização: trilha privada só para o autor"
CODE_A=$(signup "Autor" "$EMAIL_A" "$JAR_A")
CODE_B=$(signup "Outra Pessoa" "$EMAIL_B" "$JAR_B")
check "usuários A e B cadastrados (vieram $CODE_A e $CODE_B)" '[ "$CODE_A" = 200 ] && [ "$CODE_B" = 200 ]'
USER_A=$(sql "SELECT id FROM \\\"User\\\" WHERE email = '$EMAIL_A'")
sql "INSERT INTO \\\"Trail\\\" (id, title, distance, \\\"routeGeoJSON\\\", \\\"minLat\\\", \\\"minLon\\\", \\\"maxLat\\\", \\\"maxLon\\\", \\\"authorId\\\", visibility, source, \\\"updatedAt\\\") VALUES ('$PRIVATE_ID', '$PRIVATE_TITLE', 1000, '{\\\"type\\\":\\\"MultiLineString\\\",\\\"coordinates\\\":[[[-46.6,-23.5],[-46.61,-23.51]]]}', -23.51, -46.61, -23.5, -46.6, '$USER_A', 'PRIVATE', 'USER', now())" >/dev/null
echo "     trilha privada de A criada direto no banco: $PRIVATE_ID"
Q="?q=Privada%20de%20Teste%20$TS"

get "$Q"
check "anônimo: a busca não traz a trilha privada" '[ "$(field total)" = 0 ]'
get "/$PRIVATE_ID"
check "anônimo: detalhe → 404 (veio $STATUS)" '[ "$STATUS" = 404 ]'
get "$Q" -b "$JAR_B"
check "B: a busca não traz a trilha privada de A" '[ "$(field total)" = 0 ]'
get "/$PRIVATE_ID" -b "$JAR_B"
check "B: detalhe → 404, sem revelar que ela existe (veio $STATUS)" '[ "$STATUS" = 404 ]'
get "$Q" -b "$JAR_A"
check "A (autor): a busca traz a trilha" '[ "$(field total)" = 1 ]'
get "/$PRIVATE_ID" -b "$JAR_A"
check "A (autor): detalhe → 200 (veio $STATUS)" '[ "$STATUS" = 200 ] && grep -q "$PRIVATE_TITLE" <<<"$BODY"'
check "o autor aparece só com id e nome (sem e-mail)" '! grep -q "$EMAIL_A" <<<"$BODY"'

step "6. author=me"
get '?author=me'
check "anônimo → 401 UNAUTHORIZED (veio $STATUS)" '[ "$STATUS" = 401 ] && grep -q UNAUTHORIZED <<<"$BODY"'
get '?author=me' -b "$JAR_A"
check "A vê as próprias trilhas ($(field total))" '[ "$STATUS" = 200 ] && [ "$(field total)" = 1 ]'
get '?author=me' -b "$JAR_B"
check "B não tem trilhas ($(field total))" '[ "$STATUS" = 200 ] && [ "$(field total)" = 0 ]'

step "Limpeza"
sql "DELETE FROM \\\"User\\\" WHERE email IN ('$EMAIL_A', '$EMAIL_B')" >/dev/null
LEFT=$(sql "SELECT count(*) FROM \\\"Trail\\\" WHERE id = '$PRIVATE_ID'")
check "usuários de teste apagados; a trilha privada foi junto, em cascata" '[ "$LEFT" = 0 ]'

printf '\n\033[1mResultado: %d passaram, %d falharam\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
