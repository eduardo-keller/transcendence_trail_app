# Testa trocar a senha e encerrar sessões, com dois navegadores (dois "dispositivos").
# uso: python3 tests/ui/test_security.py   (com o app rodando; APP=... para outra URL)
import sys, time
from browser import Browser, Checks, sql

c = Checks()
email = f"ui-seg-{int(time.time())}@example.com"
a = Browser(9333)  # notebook
b = Browser(9334)  # celular


def login(browser, password):
    browser.goto("/login")
    browser.fill({"email": email, "password": password})
    browser.submit()
    return browser.path() == "/conta"


try:
    a.goto("/cadastro")
    a.fill({"name": "Segura Mente", "email": email, "password": "senha-antiga-1"})
    a.submit()
    login(b, "senha-antiga-1")

    c.step("Sessões ativas")
    a.goto("/conta")
    t = a.text()
    c.check("lista as duas sessões", t.count("último acesso") == 2, t.count("último acesso"))
    c.check("marca a sessão atual", "este dispositivo" in t)

    c.step("Encerrar a sessão do outro dispositivo")
    a.click("Encerrar")
    c.check("sobra uma sessão", a.text().count("último acesso") == 1)
    b.goto("/conta")
    c.check("o outro dispositivo perde o acesso", b.path() == "/login", b.path())
    c.check("este continua logado", (a.goto("/conta") or a.path()) == "/conta")

    c.step("Trocar a senha")
    login(b, "senha-antiga-1")
    a.goto("/conta")
    a.js("document.querySelectorAll('form')[1].id = 'senha'")
    a.js("document.querySelector('#senha [name=currentPassword]').value = 'x'; document.querySelector('#senha [name=newPassword]').value = 'senha-nova-123'; document.querySelector('#senha [name=confirmPassword]').value = 'outra-coisa'")
    a.js("document.querySelector('#senha').requestSubmit()"); a.pump(1)
    c.check("confirmação diferente é apontada no navegador", "As senhas não conferem" in a.text())
    a.js("document.querySelector('#senha [name=confirmPassword]').value = 'senha-nova-123'")
    a.js("document.querySelector('#senha').requestSubmit()"); a.pump(3)
    c.check("senha atual errada é recusada", "Senha atual incorreta." in a.text())
    a.js("document.querySelector('#senha [name=currentPassword]').value = 'senha-antiga-1'")
    a.js("document.querySelector('#senha').requestSubmit()"); a.pump(3)
    c.check("senha trocada", "Senha trocada" in a.text())
    b.goto("/conta")
    c.check("o outro dispositivo foi desconectado", b.path() == "/login", b.path())
    a.goto("/conta")
    c.check("quem trocou continua logado", a.path() == "/conta", a.path())
    c.check("a senha antiga não entra mais", not login(b, "senha-antiga-1"))
    c.check("a senha nova entra", login(b, "senha-nova-123"))

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not a.console and not b.console, a.console + b.console)
finally:
    a.close()
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
