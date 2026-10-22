#!/usr/bin/env bash
# Testa de ponta a ponta o Better Auth (/api/auth/*) e a página protegida /conta, com o app rodando (make).
# Cada execução cria um usuário novo e o apaga no final.
#
# uso: bash tests/test-auth.sh (de qualquer pasta)
#
# O rate limit é em memória e dura 60 s: se rodar duas vezes seguidas, espere 1 minuto.

set -u
cd "$(dirname "$0")/.." || exit 1   # raiz do repositório (o compose é relativo a ela)

# O app só responde pelo nginx; -k nos curl aceita o certificado autoassinado
APP=${APP:-https://localhost:8443}
BASE=$APP/api/auth
COMPOSE="docker compose -f docker/docker-compose.yml"
EMAIL="teste-$(date +%s)@example.com"
PASSWORD="senha-forte-123"
JAR=$(mktemp)          # arquivo de cookies, faz o papel do navegador
trap 'rm -f "$JAR"' EXIT

pass=0
fail=0
ok()   { printf '  \033[32m✔\033[0m %s\n' "$1"; pass=$((pass + 1)); }
nok()  { printf '  \033[31m✘\033[0m %s\n' "$1"; fail=$((fail + 1)); }
step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
check() { if eval "$2"; then ok "$1"; else nok "$1"; fi; }

# POST com JSON. O Origin é exigido pelo Better Auth (proteção contra CSRF).
# Grava o corpo em $BODY, o status em $STATUS e os cabeçalhos em $HEADERS.
post() {
	local path=$1 data=$2; shift 2
	local out
	out=$(curl -sk -i -H 'Content-Type: application/json' -H "Origin: $APP" \
		-X POST "$BASE$path" -d "$data" "$@")
	HEADERS=$(printf '%s' "$out" | sed '/^\r$/q')
	BODY=$(printf '%s' "$out" | sed '1,/^\r$/d')
	STATUS=$(printf '%s' "$HEADERS" | head -1 | awk '{print $2}')
}

get() {
	BODY=$(curl -sk "$BASE$1" "${@:2}")
}

# Página do app: grava o status em $STATUS, o destino do redirect em $LOCATION e o HTML em $BODY
page() {
	local out
	out=$(curl -sk -w '\n%{http_code} %{redirect_url}' "$APP$1" "${@:2}")
	BODY=$(printf '%s' "$out" | sed '$d')
	read -r STATUS LOCATION <<<"$(printf '%s' "$out" | tail -1)"
}

# Consulta SQL no Postgres do compose; devolve só o valor (sem cabeçalho)
sql() {
	$COMPOSE exec -T postgres sh -c "psql -U \"\$POSTGRES_USER\" -d \"\$POSTGRES_DB\" -tAc \"$1\""
}

step "0. O app está no ar?"
if ! curl -sk -o /dev/null "$APP/api/health"; then
	nok "$APP não responde. Rode 'make' e tente de novo."
	exit 1
fi
ok "app respondendo em $APP"

step "1. Sem cookie, ninguém está logado"
get /get-session
check "GET /get-session sem cookie devolve null" '[ "$BODY" = "null" ]'
page /conta
check "página /conta sem login redireciona para /login (veio $STATUS)" '[ "$STATUS" = 307 ] && [[ "$LOCATION" == */login ]]'

step "2. Cadastro ($EMAIL)"
post /sign-up/email "{\"name\":\"Teste\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
check "POST /sign-up/email responde 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
check "resposta não contém a senha" '! grep -q "$PASSWORD" <<<"$BODY"'
check "cookie de sessão com HttpOnly" 'grep -qiE "set-cookie: (__Secure-)?better-auth.session_token=.*HttpOnly" <<<"$HEADERS"'
check "cookie de sessão com SameSite=Lax" 'grep -qiE "set-cookie: (__Secure-)?better-auth.session_token=.*SameSite=Lax" <<<"$HEADERS"'

step "3. O que ficou gravado no banco"
HASH=$(sql "SELECT a.password FROM \\\"Account\\\" a JOIN \\\"User\\\" u ON u.id = a.\\\"userId\\\" WHERE u.email = '$EMAIL'")
echo "     Account.password = ${HASH:0:40}..."
check "senha guardada como salt:hash (scrypt), não em texto puro" '[[ "$HASH" =~ ^[0-9a-f]{32}:[0-9a-f]+$ ]]'
check "a tabela User não tem coluna de senha" '[ -z "$(sql "SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'User'"'"' AND column_name = '"'"'password'"'"'")" ]'

step "4. Login e \"quem sou eu?\""
post /sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" -c "$JAR"
check "POST /sign-in/email responde 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
check "o cookie foi guardado como HttpOnly" 'grep -q "^#HttpOnly_" "$JAR"'
get /get-session -b "$JAR"
check "GET /get-session com cookie devolve o usuário" 'grep -q "$EMAIL" <<<"$BODY"'
SESSIONS=$(sql "SELECT count(*) FROM \\\"Session\\\" s JOIN \\\"User\\\" u ON u.id = s.\\\"userId\\\" WHERE u.email = '$EMAIL'")
echo "     sessões deste usuário no banco: $SESSIONS (cadastro + login)"
page /conta -b "$JAR"
check "página /conta com login abre e mostra o nome (veio $STATUS)" '[ "$STATUS" = 200 ] && grep -q "Teste</h1>" <<<"$BODY"'

step "5. Logout"
post /sign-out '{}' -b "$JAR"
check "POST /sign-out responde 200 (veio $STATUS)" '[ "$STATUS" = 200 ]'
get /get-session -b "$JAR"
check "o cookie antigo não vale mais: /get-session devolve null" '[ "$BODY" = "null" ]'
page /conta -b "$JAR"
check "depois do logout, /conta volta a redirecionar para /login (veio $STATUS)" '[ "$STATUS" = 307 ]'
LEFT=$(sql "SELECT count(*) FROM \\\"Session\\\" s JOIN \\\"User\\\" u ON u.id = s.\\\"userId\\\" WHERE u.email = '$EMAIL'")
check "a sessão do login foi apagada do banco (eram $SESSIONS, sobraram $LEFT)" '[ "$LEFT" -lt "$SESSIONS" ]'

step "6. Erros que não entregam informação"
post /sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"errada-errada\"}"
WRONG_PASS="$STATUS $BODY"
post /sign-in/email '{"email":"ninguem-existe@example.com","password":"errada-errada"}'
NO_USER="$STATUS $BODY"
echo "     senha errada:       $WRONG_PASS"
echo "     e-mail inexistente: $NO_USER"
check "as duas respostas são idênticas (não revela se o e-mail existe)" '[ "$WRONG_PASS" = "$NO_USER" ]'
post /sign-up/email '{"name":"Curta","email":"curta@example.com","password":"1234567"}'
check "senha com 7 caracteres é recusada no cadastro (veio $STATUS)" '[ "$STATUS" = 400 ] && grep -q PASSWORD_TOO_SHORT <<<"$BODY"'

step "7. Rate limit no login (5 por minuto por IP)"
CODES=""
for i in 1 2 3 4 5 6 7; do
	post /sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"errada-errada\"}"
	CODES="$CODES $STATUS"
done
echo "     status das tentativas seguidas:$CODES"
check "depois de 5 tentativas no minuto, o servidor responde 429" 'grep -q 429 <<<"$CODES"'
post /sign-in/email "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}"
check "durante o bloqueio, até a senha certa recebe 429 (veio $STATUS)" '[ "$STATUS" = 429 ]'

step "Limpeza"
sql "DELETE FROM \\\"User\\\" WHERE email = '$EMAIL'" >/dev/null
ok "usuário de teste apagado (Account e Session vão junto, em cascata)"

printf '\n\033[1mResultado: %d passaram, %d falharam\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
