# Testa o perfil: username gerado no cadastro, edição, perfil público sem e-mail e console limpo.
# uso: python3 tests/ui/test_profile.py   (com o app rodando e o seed aplicado; APP=... para outra URL)
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import time
from browser import Browser, Checks, sql

b = Browser()
c = Checks()
stamp = int(time.time())
email = f"ui-perfil-{stamp}@example.com"
new_username = f"trilheiro{stamp % 100000}"
try:
    c.step("Cadastro gera um username")
    b.goto("/cadastro")
    b.fill({"name": "Ana Lúcia", "email": email, "password": "senha-forte-123"})
    b.submit()
    username = sql(f"SELECT username FROM \"User\" WHERE email = '{email}'")
    c.check(f"username gerado a partir do nome ({username})", username.startswith("analucia") and len(username) == 12)

    c.step("Editar o perfil")
    b.fill({"name": "Ana Lúcia Souza", "username": "Ab", "bio": ""})
    b.submit(1)
    c.check("username curto é recusado no navegador", "pelo menos 3 caracteres" in b.text())
    b.fill({"username": "alice"})
    b.submit()
    c.check("username de outra pessoa é recusado", "já está em uso" in b.text())
    b.fill({"username": new_username.upper(), "bio": "Gosto de trilhas na Cantareira."})
    b.submit()
    c.check("perfil salvo", "Perfil salvo." in b.text())
    saved = sql(f"SELECT name || '|' || username || '|' || bio FROM \"User\" WHERE email = '{email}'")
    c.check("banco atualizado (username em minúsculas)", saved == f"Ana Lúcia Souza|{new_username}|Gosto de trilhas na Cantareira.", saved)

    c.step("Perfil público")
    b.goto(f"/u/{new_username}")
    t = b.text()
    c.check("mostra nome, @username e bio", "Ana Lúcia Souza" in t and f"@{new_username}" in t and "Cantareira" in t)
    c.check("não mostra o e-mail", email not in t and "@example.com" not in b.js("document.documentElement.outerHTML"))
    b.goto("/u/alice")
    c.check("perfil de outra pessoa abre", "Alice Souza" in b.text())
    b.goto("/u/nao-existe-ninguem")
    c.check("username inexistente dá 404", "404" in b.text() or "could not be found" in b.text())
    b.console.clear()  # o 404 acima é esperado

    c.step("Sem login")
    b.goto("/conta")
    b.click("Sair")
    b.goto(f"/u/{new_username}")
    c.check("perfil público abre sem login", "Ana Lúcia Souza" in b.text())

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
