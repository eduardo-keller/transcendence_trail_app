# Testa a tela do planejador de IA (/planejar) com o modelo falso: validação no navegador, texto em streaming,
# Parar (cancela no servidor), erro do provedor, cota que desabilita o botão antes do 429 e console limpo.
# uso: python3 tests/ui/test_ai_planner.py   (com make dev e LLM_PROVIDER=mock no docker/.env; APP=... para outra URL)
# O cadastro tem rate limit (3 por minuto por IP): se rodar logo depois de outro teste, espere 1 minuto.
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import datetime, os, subprocess, time
from browser import REPO, Browser, Checks, sql

COMPOSE = ["docker", "compose", "-f", os.path.join(REPO, "docker/docker-compose.yml")]


def web_env(name, default=""):
    out = subprocess.run(COMPOSE + ["exec", "-T", "nextjs", "printenv", name], capture_output=True, text=True).stdout
    return out.strip() or default


def server_log_since(since):
    return subprocess.run(COMPOSE + ["logs", "nextjs", "--since", since], capture_output=True, text=True).stdout


def output():
    return b.js("document.querySelector('[data-testid=plan-output]')?.innerText ?? ''") or ""


def button_disabled(text):
    return b.js(f"[...document.querySelectorAll('button')].find(e => e.textContent.trim() === '{text}')?.disabled")


def usage():
    return sql(f"SELECT coalesce(sum(count), 0) FROM \"AiUsage\" WHERE period = '{today}' AND \"userId\" = '{user_id}'")


if web_env("LLM_PROVIDER") != "mock":
    print("Ponha LLM_PROVIDER=mock no docker/.env e rode make dev (para não gastar a cota do Gemini).")
    sys.exit(1)
LIMIT_MINUTE = int(web_env("AI_LIMIT_PER_MINUTE", "5"))
LIMIT_DAY = int(web_env("AI_LIMIT_PER_DAY", "50"))

b = Browser()
c = Checks()
email = f"ui-planejar-{int(time.time())}@example.com"
user_id = ""
today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
trail_id, trail_title = sql(
    "SELECT id || '|' || title FROM \"Trail\" WHERE source = 'OSM' AND distance >= 2000 "
    "AND title ~* '(trilha|pico|pedra)' ORDER BY title LIMIT 1").split("|", 1)
try:
    c.step("Acesso")
    b.goto("/planejar")
    c.check("sem login, manda para /login", b.path() == "/login", b.path())
    b.goto("/cadastro")
    b.fill({"name": "Teste Planejador", "email": email, "password": "senha-forte-123"})
    b.submit()
    user_id = sql(f"SELECT id FROM \"User\" WHERE email = '{email}'")
    b.goto("/planejar")
    t = b.text()
    c.check("logado, a página abre", b.path() == "/planejar" and "Planejar uma trilha" in t, b.path())
    options = b.js("document.querySelectorAll('[name=trailId] option').length - 1")
    c.check(f"a lista tem só as trilhas de verdade ({options})", 50 <= options <= 150)
    c.check("mostra a cota restante", f"Restam {LIMIT_DAY} de {LIMIT_DAY} pedidos hoje" in t)
    c.check("avisa que a IA pode errar e não vê a previsão do tempo", "A IA pode errar" in t and "previsão do tempo" in t)

    c.step("Validação no navegador (zod), sem gastar cota")
    b.fill({"trailId": "", "hours": "13"})
    b.submit(1)
    t = b.text()
    c.check("sem trilha → 'Escolha uma trilha'", "Escolha uma trilha" in t)
    c.check("13 horas → 'No máximo 12 horas'", "No máximo 12 horas" in t)
    c.check("nenhum pedido foi feito", usage() == "0", usage())

    c.step("Gerar: o texto chega aos poucos")
    b.fill({"trailId": trail_id, "hours": "4"})
    b.submit(1.0)
    first = len(output())
    c.check("botão vira 'Gerando…' e aparece o Parar", button_disabled("Gerando…") and button_disabled("Parar") is False)
    b.pump(1.0)
    second = len(output())
    b.pump(5)
    final = output()
    c.check(f"o texto cresce durante a geração ({first} → {second} → {len(final)} caracteres)", 0 < first < second < len(final))
    c.check("o plano termina inteiro (texto do modelo falso)", "LLM_PROVIDER=mock" in final and "Na trilha" in final)
    c.check("a cota na tela diminui depois do pedido", f"Restam {LIMIT_DAY - 1} de {LIMIT_DAY}" in b.text())

    c.step("Parar no meio")
    since = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    b.submit(1.0)
    b.click("Parar", 2.5)
    stopped_text = output()
    t = b.text()
    c.check("o texto para no meio", 0 < len(stopped_text) and "Na trilha" not in stopped_text, len(stopped_text))
    c.check("avisa que foi interrompido e oferece 'Tentar de novo'", "Geração interrompida" in t and "Tentar de novo" in t)
    c.check("o servidor cancelou a geração (log)", "[ai/plan] cancelado (o cliente desconectou)" in server_log_since(since))

    c.step("Provedor fora do ar (simulado com [falha])")
    b.fill({"notes": "teste [falha]"})
    b.submit(3)
    t = b.text()
    c.check("mensagem amigável na tela", "O assistente está indisponível agora" in t)
    c.check("sem detalhe técnico", "mock: provedor" not in t)
    c.check("a página continua de pé, com o formulário e o 'Tentar de novo'", "Gerar plano" in t and "Tentar de novo" in t)

    c.step("Limite por minuto: o botão desabilita antes do 429")
    # Espera um momento do minuto em que a liberação chegue logo (o contador zera quando o minuto vira)
    while not 40 <= datetime.datetime.now(datetime.timezone.utc).second <= 48:
        time.sleep(1)
    minute = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M")
    sql(f"INSERT INTO \"AiUsage\" (\"userId\", period, count) VALUES ('{user_id}', '{minute}', {LIMIT_MINUTE}) "
        f"ON CONFLICT (\"userId\", period) DO UPDATE SET count = {LIMIT_MINUTE}")
    b.goto("/planejar")
    t = b.text()
    c.check("'Gerar plano' desabilitado, com contagem regressiva", button_disabled("Gerar plano") and "Libera em" in t, t[-300:])
    b.pump(25)
    c.check("quando o minuto vira, o botão volta sozinho", button_disabled("Gerar plano") is False and "Restam" in b.text())

    c.step("Limite do dia")
    # A data na hora (o dia UTC pode ter virado durante o teste) e upsert (a linha do dia pode não existir)
    day = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    sql(f"INSERT INTO \"AiUsage\" (\"userId\", period, count) VALUES ('{user_id}', '{day}', {LIMIT_DAY}) "
        f"ON CONFLICT (\"userId\", period) DO UPDATE SET count = {LIMIT_DAY}")
    b.goto("/planejar")
    c.check("'Gerar plano' desabilitado e aviso de que a cota de hoje acabou",
            button_disabled("Gerar plano") and f"Você usou os {LIMIT_DAY} pedidos de hoje" in b.text())

    c.step("Link vindo da página da trilha")
    b.goto(f"/planejar?trilha={trail_id}")
    c.check("?trilha=<id> já vem selecionada", b.js("document.querySelector('[name=trailId]').value") == trail_id)
    b.goto("/planejar?trilha=nao-existe")
    c.check("id inexistente é ignorado", b.js("document.querySelector('[name=trailId]').value") == "")

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console (gerando, parado, erro, limite)", not b.console, b.console)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
