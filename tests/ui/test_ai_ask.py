# Testa a tela "Pergunte sobre as trilhas" (/perguntar) com o modelo falso e o índice do RAG carregado:
# tamanho da base, exemplos, fontes antes do texto, memória (seguimento, resumo, corpo do pedido enxuto),
# Parar, "não encontrei", erro do provedor, validação, Nova conversa e console limpo.
# uso: python3 tests/ui/test_ai_ask.py   (com make dev, LLM_PROVIDER=mock e make index-rag; APP=... para outra URL)
# O cadastro tem rate limit (3 por minuto por IP): se rodar logo depois de outro teste, espere 1 minuto.
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import os, subprocess, time
from browser import REPO, Browser, Checks, sql

COMPOSE = ["docker", "compose", "-f", os.path.join(REPO, "docker/docker-compose.yml")]


def web_env(name):
    return subprocess.run(COMPOSE + ["exec", "-T", "nextjs", "printenv", name], capture_output=True, text=True).stdout.strip()


def answers():
    return b.js("[...document.querySelectorAll('[data-testid=answer-text]')].map(e => e.innerText)") or []


def sources_count():
    return b.js("document.querySelectorAll('[data-testid=answer]:last-of-type [data-testid=sources] li').length") or 0


def ask(question, wait=4):
    # Zera a cota do teste antes de cada pergunta: o limite por minuto (5) não é o que este teste confere
    sql(f"DELETE FROM \"AiUsage\" WHERE \"userId\" = '{user_id}'")
    b.js(f"""(() => {{
        const field = document.querySelector('[name=question]');
        Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(field, {question!r});
        field.dispatchEvent(new Event('input', {{ bubbles: true }}));
    }})()""")
    b.pump(0.3)
    # O botão de envio (a aba "Perguntar" do menu tem o mesmo texto)
    b.js("document.querySelector('form button[type=submit]').click()")
    b.pump(wait)


if web_env("LLM_PROVIDER") != "mock":
    print("Ponha LLM_PROVIDER=mock no docker/.env e rode make dev (para não gastar a cota do Gemini).")
    sys.exit(1)
if int(sql('SELECT count(*) FROM "RagChunk"') or 0) == 0:
    print("O índice do RAG está vazio: rode make index-rag.")
    sys.exit(1)

b = Browser()
c = Checks()
email = f"ui-perguntar-{int(time.time())}@example.com"
user_id = ""
try:
    c.step("Acesso e base")
    b.goto("/perguntar")
    c.check("sem login, manda para /login", b.path() == "/login", b.path())
    b.goto("/cadastro")
    b.fill({"name": "Teste Perguntas", "email": email, "password": "senha-forte-123"})
    b.submit()
    user_id = sql(f"SELECT id FROM \"User\" WHERE email = '{email}'")
    b.goto("/perguntar")
    t = b.text()
    c.check("logado, a página abre", "Pergunte sobre as trilhas" in t, b.path())
    corpus = b.js("document.querySelector('[data-testid=corpus-size]').innerText")
    chunks = int(corpus.split("Base: ")[1].split(" trechos")[0].replace(".", ""))
    c.check(f"mostra o tamanho da base ({chunks} trechos)", chunks >= 2000, corpus)
    c.check("mostra exemplos clicáveis na conversa vazia", "Experimente perguntar" in t)
    c.check("avisa que a conversa é esquecida ao recarregar", "esquecida ao recarregar" in t)

    c.step("Validação no navegador (zod)")
    ask("oi", 1)
    c.check("pergunta curta → 'pelo menos 3 caracteres', sem pedido", "pelo menos 3 caracteres" in b.text() and answers() == [])

    c.step("Exemplo: fontes chegam antes do texto terminar")
    sql(f"DELETE FROM \"AiUsage\" WHERE \"userId\" = '{user_id}'")
    b.click("O que levar numa trilha de um dia?", 0.1)
    # Espera as fontes aparecerem e anota quanto texto já tinha chegado naquele momento
    early_sources, early_text = 0, ""
    for _ in range(100):
        early_sources = sources_count()
        if early_sources:
            early_text = (answers() or [""])[-1]
            break
        b.pump(0.1)
    b.pump(4)
    final_text = answers()[-1]
    c.check(f"fontes na tela enquanto o texto ainda chega ({early_sources} fontes; {len(early_text)} → {len(final_text)} caracteres)",
            early_sources > 0 and len(early_text) < len(final_text))
    c.check("a resposta cita [1]", "[1]" in final_text)
    source_text = b.js("document.querySelector('[data-testid=sources]').innerText")
    c.check("cada fonte tem número, título e relevância", "[1]" in source_text and "relevância" in source_text, source_text)

    c.step("Memória: pergunta de seguimento")
    # Guarda o corpo de cada pedido ao /api/ai/ask (para conferir o que o navegador manda)
    b.js("""(() => { window.__bodies = []; const original = window.fetch;
        window.fetch = (url, options) => { if (String(url).includes('/api/ai/ask')) window.__bodies.push(JSON.parse(options.body)); return original(url, options); };
    })()""")
    c.check("antes do seguimento, o assistente ainda não tem resumo", "Ainda nada" in b.js("document.querySelector('[data-testid=memory-summary]').textContent"))
    ask("E quanto peso dá para levar?", 4)
    rewritten = b.js("[...document.querySelectorAll('[data-testid=rewritten]')].at(-1)?.innerText") or ""
    c.check("a pergunta de seguimento é reescrita antes da busca", "(sobre: O que levar numa trilha de um dia?)" in rewritten, rewritten)
    summary = b.js("document.querySelector('[data-testid=memory-summary]').textContent")
    c.check("'O que o assistente lembra' mostra o resumo da conversa", "O que levar numa trilha de um dia?" in summary, summary)
    body = (b.js("window.__bodies") or [{}])[-1]
    c.check("o pedido leva só a pergunta, as trocas anteriores e o resumo (não o histórico)",
            sorted(body) == ["question", "recent"] and len(body["recent"]) == 1, body)

    c.step("Parar no meio")
    ask("O que fazer se uma cobra me picar na trilha?", 1.0)
    b.click("Parar", 2)
    stopped = answers()[-1]
    c.check("a resposta para no meio e avisa", "193" not in stopped and "Resposta interrompida" in b.text(), stopped[-80:])

    c.step("Nada na base")
    ask("pergunta sem resposta [fora]", 3)
    c.check("responde 'não encontrei', sem fontes", "Não encontrei essa informação" in answers()[-1] and sources_count() == 0)

    c.step("Provedor fora do ar (simulado com [falha])")
    ask("O que levar numa trilha [falha]", 3)
    body = (b.js("window.__bodies") or [{}])[-1]
    c.check("depois de várias trocas, o pedido leva só as últimas 3 e o resumo (≤ 1.000 caracteres)",
            len(body.get("recent", [])) == 3 and len(body.get("summary", "")) <= 1000 and "messages" not in body,
            {k: (len(v) if isinstance(v, (list, str)) else v) for k, v in body.items()})
    t = b.text()
    c.check("mensagem amigável e 'Tentar de novo'; a conversa continua na tela",
            "O assistente está indisponível agora" in t and "Tentar de novo" in t and len(answers()) >= 3)

    c.step("Nova conversa")
    b.click("Nova conversa", 1)
    c.check("a conversa some e os exemplos voltam", answers() == [] and "Experimente perguntar" in b.text())
    ask("O que levar numa trilha de um dia?", 4)
    body = (b.js("window.__bodies") or [{}])[-1]
    c.check("a conversa nova começa sem memória (sem trocas nem resumo no pedido)", sorted(body) == ["question", "recent"] and body["recent"] == [], body)
    c.check("e sem resumo na tela", "Ainda nada" in b.js("document.querySelector('[data-testid=memory-summary]').textContent"))
    b.goto("/perguntar", 3)
    c.check("recarregar a página também esquece a conversa", answers() == [] and "Experimente perguntar" in b.text())
    c.check("nada da conversa ficou no banco (só o contador do rate limit)",
            sql(f"SELECT count(*) FROM \"AiUsage\" WHERE \"userId\" = '{user_id}'") in ("0", "1", "2"))

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console (respondendo, parado, sem resultado, erro)", not b.console, b.console)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
