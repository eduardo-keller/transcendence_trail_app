#!/usr/bin/env bash
# Testa de ponta a ponta o planejador de IA (POST /api/ai/plan) pelo nginx, com o app rodando (make dev):
# login (401), validação (400), trilha inexistente (404), streaming de verdade (o texto chega aos poucos),
# falha do provedor dentro do stream, cancelamento ao fechar a conexão e rate limit (429).
# Cria um usuário e apaga no final.
#
# uso: bash tests/test-ai.sh (de qualquer pasta)
#
# Precisa de LLM_PROVIDER=mock no docker/.env (e make dev): com o Gemini, gastaria ~15 pedidos da cota.
# O cadastro tem rate limit (3 por minuto por IP): se rodar logo depois de outro teste, espere 1 minuto.

set -u
cd "$(dirname "$0")/.." || exit 1   # raiz do repositório (o compose é relativo a ela)

# O app só responde pelo nginx; -k nos curl aceita o certificado autoassinado
APP=${APP:-https://localhost:8443}
API=$APP/api/ai/plan
AUTH=$APP/api/auth
COMPOSE="docker compose -f docker/docker-compose.yml"
EMAIL="ia-$(date +%s)@example.com"
PASSWORD="senha-forte-123"
TMP=$(mktemp -d)
JAR=$TMP/cookies
trap 'rm -rf "$TMP"' EXIT

pass=0
fail=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; pass=$((pass + 1)); }
nok()  { printf '  \033[31m✘\033[0m %s\n' "$1"; fail=$((fail + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else nok "$1"; fi; }

# Consulta SQL no Postgres do compose; devolve só o valor (sem cabeçalho)
sql() {
	$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\""
}
in_web() { $COMPOSE exec -T nextjs sh -c "$1"; }

# Pedido válido em JSON; campos extras sobrescrevem (no JSON, a última chave repetida vale): body '"hours":0'
body() { printf '{"trailId":"%s","date":"%s","experience":"BEGINNER","hours":4%s}' "$TRAIL" "$DATE" "${1:+,$1}"; }

# POST no planejador. Grava o corpo em $BODY e o status em $STATUS. uso: plan '<json>' [-b cookies]
plan() {
	local out
	out=$(curl -sk -w '\n%{http_code}' -X POST "$API" -H 'Content-Type: application/json' -d "$1" "${@:2}")
	BODY=$(printf '%s' "$out" | sed '$d')
	STATUS=$(printf '%s' "$out" | tail -1)
}

usage() { sql "SELECT coalesce(sum(count), 0) FROM \\\"AiUsage\\\" WHERE \\\"userId\\\" = '$USER_ID'"; }

step "0. O app está no ar, com o modelo falso?"
if ! curl -sk -o /dev/null "$APP/api/health"; then
	nok "$APP não responde. Rode 'make dev' e tente de novo."
	exit 1
fi
MODE=$(in_web 'printf %s "$LLM_PROVIDER"')
if [ "$MODE" != mock ]; then
	nok "LLM_PROVIDER=$MODE: ponha LLM_PROVIDER=mock no docker/.env e rode make dev (para não gastar a cota do Gemini)"
	exit 1
fi
ok "app respondendo em $APP, com LLM_PROVIDER=mock"
LIMIT=$(in_web 'printf %s "${AI_LIMIT_PER_MINUTE:-5}"')
TRAIL=$(sql "SELECT id FROM \\\"Trail\\\" WHERE source = 'OSM' AND distance >= 2000 ORDER BY title LIMIT 1")
DATE=$(date -u -d '+7 days' +%F)
check "há uma trilha para planejar ($TRAIL)" '[ -n "$TRAIL" ]'

step "1. Login, validação e trilha inexistente"
plan "$(body)"
check "sem login → 401 UNAUTHORIZED (veio $STATUS)" '[ "$STATUS" = 401 ] && grep -q UNAUTHORIZED <<<"$BODY"'
CODE=$(curl -sk -o /dev/null -w '%{http_code}' -c "$JAR" -H 'Content-Type: application/json' -H "Origin: $APP" \
	-X POST "$AUTH/sign-up/email" -d "{\"name\":\"Teste IA\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
check "usuário de teste cadastrado (veio $CODE)" '[ "$CODE" = 200 ]'
USER_ID=$(sql "SELECT id FROM \\\"User\\\" WHERE email = '$EMAIL'")
plan "$(body '"hours":0')" -b "$JAR"
check "horas = 0 → 400 VALIDATION_ERROR no campo hours (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q "\"path\":\"hours\"" <<<"$BODY"'
plan "$(body '"date":"2020-01-01"')" -b "$JAR"
check "data no passado → 400 (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q "\"path\":\"date\"" <<<"$BODY"'
plan '{isto não é json' -b "$JAR"
check "JSON inválido → 400 (veio $STATUS)" '[ "$STATUS" = 400 ]'
plan "$(body '"trailId":"nao-existe"')" -b "$JAR"
check "trilha inexistente → 404 TRAIL_NOT_FOUND (veio $STATUS)" '[ "$STATUS" = 404 ] && grep -q TRAIL_NOT_FOUND <<<"$BODY"'
check "nenhum desses pedidos gastou cota" '[ "$(usage)" = 0 ]'

step "2. Streaming pelo nginx"
START=$(date +%s%N)
curl -skN -D "$TMP/headers" -b "$JAR" -X POST "$API" -H 'Content-Type: application/json' -d "$(body)" |
	while IFS= read -r line; do
		case $line in data:*) echo "$((($(date +%s%N) - START) / 1000000)) $line" ;; esac
	done >"$TMP/stream"
DELTAS=$(grep -c '"type":"text-delta"' "$TMP/stream")
FIRST=$(grep -m1 '"type":"text-delta"' "$TMP/stream" | cut -d' ' -f1)
LAST=$(grep '"type":"text-delta"' "$TMP/stream" | tail -1 | cut -d' ' -f1)
check "resposta 200 em SSE (text/event-stream)" 'grep -q "^HTTP/[0-9.]* 200" "$TMP/headers" && grep -qi "^content-type: text/event-stream" "$TMP/headers"'
check "o texto chega em $DELTAS pedaços" '[ "$DELTAS" -gt 20 ]'
check "os pedaços chegam ao longo de $((LAST - FIRST)) ms, não todos juntos (o nginx não segura o stream)" '[ $((LAST - FIRST)) -gt 1500 ]'
check "o texto é o do modelo falso" 'grep -q "LLM_PROVIDER=mock" "$TMP/stream"'
check "o pedido gastou 1 da cota" '[ "$(usage)" = 2 ]'   # 1 no contador do minuto + 1 no do dia

step "3. Provedor fora do ar no meio da resposta (simulado com [falha])"
plan "$(body '"notes":"teste [falha]"')" -b "$JAR"
check "a resposta começou com 200 e trouxe parte do texto" '[ "$STATUS" = 200 ] && grep -q "\"type\":\"text-delta\"" <<<"$BODY"'
check "o erro chega dentro do stream, com a mensagem amigável" 'grep -q "\"type\":\"error\",\"errorText\":\"O assistente está indisponível agora" <<<"$BODY"'
check "o detalhe técnico não vai para o navegador" '! grep -q "mock: provedor" <<<"$BODY"'

step "4. Parar no meio: fechar a conexão cancela a geração no servidor"
T0=$(date -u +%Y-%m-%dT%H:%M:%SZ)
curl -sk --max-time 1 -o /dev/null -b "$JAR" -X POST "$API" -H 'Content-Type: application/json' -d "$(body)"
sleep 2
check "o servidor registrou '[ai/plan] cancelado (o cliente desconectou)'" \
	'$COMPOSE logs nextjs --since "$T0" 2>&1 | grep -q "\[ai/plan\] cancelado (o cliente desconectou)"'

step "5. Rate limit: $LIMIT pedidos por minuto"
for attempt in 1 2; do
	sql "DELETE FROM \\\"AiUsage\\\" WHERE \\\"userId\\\" = '$USER_ID'" >/dev/null
	rm -f "$TMP"/rl-*
	MINUTE=$(date -u +%H%M)
	for i in $(seq 1 $((LIMIT * 2))); do
		curl -sk -o "$TMP/rl-$i.body" -w '%{http_code}\n' -b "$JAR" -X POST "$API" \
			-H 'Content-Type: application/json' -d "$(body)" >"$TMP/rl-$i.status" &
	done
	wait
	[ "$(date -u +%H%M)" = "$MINUTE" ] && break   # o minuto virou no meio (a contagem zerou): repete
done
PASSED=$(cat "$TMP"/rl-*.status | grep -c '^200$')
LIMITED=$(cat "$TMP"/rl-*.status | grep -c '^429$')
check "$((LIMIT * 2)) pedidos ao mesmo tempo: $PASSED passaram e $LIMITED receberam 429 (esperado $LIMIT e $LIMIT)" \
	'[ "$PASSED" = "$LIMIT" ] && [ "$LIMITED" = "$LIMIT" ]'
R429=$(grep -l AI_RATE_LIMITED "$TMP"/rl-*.body | head -1)
check "o 429 traz o código AI_RATE_LIMITED e em quantos segundos tentar de novo" '[ -n "$R429" ] && grep -q "\"retryAfter\":[0-9]" "$R429"'

step "Limpeza"
sql "DELETE FROM \\\"User\\\" WHERE email = '$EMAIL'" >/dev/null
check "usuário de teste apagado; os contadores do rate limit foram junto, em cascata" '[ "$(usage)" = 0 ]'

printf '\n\033[1mResultado: %d passaram, %d falharam\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
