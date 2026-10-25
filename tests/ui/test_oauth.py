# Testa a nossa parte do OAuth (GitHub e 42), sem precisar de conta de verdade nos provedores:
# o botão leva ao provedor com client_id, state e PKCE certos; o retorno com erro mostra mensagem clara.
# uso: com credenciais (podem ser falsas) em GITHUB_CLIENT_ID/SECRET e FT_CLIENT_ID/SECRET, rode
#      python3 tests/ui/test_oauth.py   (APP=... para outra URL)
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import json, time, urllib.parse
from browser import BASE, Browser, Checks, sql

b = Browser()
c = Checks()
email = f"ui-oauth-{int(time.time())}@example.com"


def follow_to_provider(label):
    """Clica no botão e devolve a URL do provedor (sem carregar a página dele)."""
    b.call("Fetch.enable", {"patterns": [{"urlPattern": "https://github.com/*"}, {"urlPattern": "https://api.intra.42.fr/*"}]})
    b.js(f"[...document.querySelectorAll('button')].find(e => e.textContent.trim() === {json.dumps(label)}).click()")
    deadline = time.time() + 10
    while time.time() < deadline:
        m = b._recv()
        if m.get("method") == "Fetch.requestPaused":
            url = m["params"]["request"]["url"]
            b.call("Fetch.failRequest", {"requestId": m["params"]["requestId"], "errorReason": "Aborted"})
            b.call("Fetch.disable")
            return urllib.parse.urlparse(url)
        b._event(m)
    b.call("Fetch.disable")
    return None


try:
    c.step("Botões no login")
    b.goto("/login")
    t = b.text()
    c.check("mostra Entrar com GitHub e Entrar com 42", "Entrar com GitHub" in t and "Entrar com 42" in t)

    for label, host, provider in (("Entrar com GitHub", "github.com", "github"), ("Entrar com 42", "api.intra.42.fr", "42")):
        c.step(label)
        b.goto("/login")
        url = follow_to_provider(label)
        q = urllib.parse.parse_qs(url.query) if url else {}
        c.check(f"vai para {host}", bool(url) and url.netloc == host, url)
        c.check("manda o client_id configurado", q.get("client_id", [""])[0].startswith("teste-"), q.get("client_id"))
        c.check("manda um state aleatório (contra CSRF)", len(q.get("state", [""])[0]) >= 16)
        c.check("volta para /api/auth/callback/" + provider, q.get("redirect_uri", [""])[0] == f"{BASE}/api/auth/callback/{provider}")
        if provider == "42":
            c.check("usa PKCE (code_challenge S256)", q.get("code_challenge_method", [""])[0] == "S256" and q.get("code_challenge"))

        # O provedor devolve um código inválido: a troca pelo token falha e voltamos com mensagem
        b.goto(f"/api/auth/callback/{provider}?code=codigo-falso&state={q.get('state', [''])[0]}", 4)
        c.check("retorno com erro volta para /login", b.path() == "/login", b.path())
        c.check("e mostra uma mensagem clara", "Não foi possível entrar pelo provedor" in b.text())

    c.step("state forjado")
    b.goto("/api/auth/callback/github?code=x&state=forjado", 4)
    c.check("state que não foi gerado por nós é recusado", b.path() == "/login" and "Não foi possível" in b.text(), b.path())

    c.step("Conectar em /conta")
    b.goto("/cadastro")
    b.fill({"name": "Com OAuth", "email": email, "password": "senha-forte-123"})
    b.submit()
    t = b.text()
    c.check("lista e-mail e senha como conectada", "E-mail e senha" in t)
    c.check("oferece Conectar GitHub e Conectar 42", "Conectar GitHub" in t and "Conectar 42" in t)
    url = follow_to_provider("Conectar GitHub")
    c.check("conectar também vai para o GitHub", bool(url) and url.netloc == "github.com")

    c.step("Mensagem de conta já existente")
    b.goto("/conta")
    b.click("Sair")
    b.goto("/login?error=account_not_linked")
    c.check("explica como conectar", "Já existe uma conta com esse e-mail" in b.text())

    c.step("Console do navegador")
    noise = [e for e in b.console if "ERR_FAILED" not in e[1] and "net::" not in e[1]]  # as abortadas pelo teste
    c.check("nenhum erro ou aviso no console", not noise, noise)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
