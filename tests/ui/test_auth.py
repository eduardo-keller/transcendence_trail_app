# Testa as telas de login, cadastro e logout num Chrome de verdade (sem janela).
# uso: python3 tests/ui/test_auth.py   (com o app rodando; APP=... para outra URL)
# Cada execução cria um usuário ui-<hora>@example.com. Espere 1 min entre execuções (rate limit).
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import time
from browser import Browser, Checks, sql

b = Browser()
c = Checks()
email = f"ui-{int(time.time())}@example.com"
try:
    c.step("Página protegida sem login")
    b.goto("/conta")
    c.check("/conta sem login vai para /login", b.path() == "/login", b.path())

    c.step("Validação no navegador (cadastro)")
    b.goto("/cadastro")
    b.fill({"name": "D", "email": "nao-e-email", "password": "123"})
    b.submit(1)
    t = b.text()
    c.check("nome curto apontado", "Nome com pelo menos 2 caracteres" in t)
    c.check("e-mail inválido apontado", "E-mail inválido" in t)
    c.check("senha curta apontada", "pelo menos 8 caracteres" in t)
    c.check("continua em /cadastro", b.path() == "/cadastro")

    c.step("Cadastro")
    b.fill({"name": "Diego UI", "email": email, "password": "senha-forte-123"})
    b.submit()
    c.check("vai para /conta", b.path() == "/conta", b.path())
    c.check("mostra o nome", "Olá, Diego UI" in b.text())
    ck = [x for x in b.cookies() if "session_token" in x["name"]]
    c.check("cookie de sessão HttpOnly", bool(ck) and ck[0]["httpOnly"], ck)

    c.step("Logout")
    b.click("Sair")
    c.check("volta para /login", b.path() == "/login", b.path())
    b.goto("/conta")
    c.check("/conta volta a exigir login", b.path() == "/login", b.path())

    c.step("Login com senha errada")
    b.fill({"email": email, "password": "senha-errada-1"})
    b.submit()
    c.check("mensagem genérica", "E-mail ou senha incorretos." in b.text())
    c.check("continua em /login", b.path() == "/login")

    c.step("Login certo")
    b.fill({"email": email, "password": "senha-forte-123"})
    b.submit()
    c.check("vai para /conta", b.path() == "/conta", b.path())
    b.goto("/login")
    c.check("logado, /login manda para /conta", b.path() == "/conta", b.path())

    c.step("Cadastro com e-mail que já existe")
    b.click("Sair")
    b.goto("/cadastro")
    b.fill({"name": "Outro", "email": email, "password": "outra-senha-123"})
    b.submit()
    c.check("mensagem que não confirma o e-mail", "Não foi possível criar a conta" in b.text())

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
