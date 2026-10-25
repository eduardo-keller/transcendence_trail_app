# Testa o 2FA (TOTP): ativar, login com código, código de recuperação (uso único) e desativar.
# uso: python3 tests/ui/test_two_factor.py   (com o app rodando; APP=... para outra URL)
# Demora ~2 min: respeita o rate limit do 2FA (3 tentativas a cada 10 s) e a janela de 30 s do TOTP.
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import base64, hashlib, hmac, struct, time
from browser import Browser, Checks, sql


def totp(secret, at=None):
    """RFC 6238: HMAC-SHA1 do número da janela de 30 s, truncado em 6 dígitos (o que o app autenticador faz)."""
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    counter = int((at or time.time()) // 30)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    return f"{(struct.unpack('>I', digest[offset:offset + 4])[0] & 0x7FFFFFFF) % 1_000_000:06d}"


def next_window():
    """Espera a próxima janela de 30 s (um código já usado não vale de novo)."""
    time.sleep(30 - time.time() % 30 + 1)


b = Browser()
c = Checks()
email = f"ui-2fa-{int(time.time())}@example.com"
password = "senha-forte-123"


def login():
    b.goto("/login")
    b.fill({"email": email, "password": password})
    b.submit()
    return b.path()


def logout():
    b.goto("/conta")
    b.click("Sair")


try:
    b.goto("/cadastro")
    b.fill({"name": "Dois Fatores", "email": email, "password": password})
    b.submit()

    c.step("Ativar: passo 1 (senha)")
    b.fill({"password": "senha-errada"})
    b.submit(3)
    c.check("senha errada é recusada", "Senha incorreta." in b.text())
    time.sleep(4)
    b.fill({"password": password})
    b.submit(3)
    secret = (b.js("document.querySelector('[data-testid=totp-secret]')?.textContent") or "").replace(" ", "")
    codes = b.js("[...document.querySelectorAll('[data-testid=backup-codes] li')].map(li => li.textContent)") or []
    c.check(f"mostra a chave ({len(secret)} caracteres)", len(secret) >= 16)
    c.check(f"mostra {len(codes)} códigos de recuperação", len(codes) >= 8)
    c.check("ainda não está ativado", sql(f"SELECT \"twoFactorEnabled\" FROM \"User\" WHERE email = '{email}'") == "f")

    c.step("Ativar: passo 2 (código do app)")
    b.js("document.querySelector('input[type=checkbox]').click()")
    b.pump(0.5)
    b.fill({"code": "000000" if totp(secret) != "000000" else "111111"})
    b.submit(3)
    c.check("código errado é recusado", "Código inválido" in b.text())
    time.sleep(4)
    b.fill({"code": totp(secret)})
    b.submit(3)
    c.check("ativado", "Verificação em duas etapas ativada." in b.text())
    c.check("banco marca twoFactorEnabled", sql(f"SELECT \"twoFactorEnabled\" FROM \"User\" WHERE email = '{email}'") == "t")
    stored = sql(f"SELECT t.secret FROM \"TwoFactor\" t JOIN \"User\" u ON u.id = t.\"userId\" WHERE u.email = '{email}'")
    c.check("o segredo não fica em texto puro no banco", stored and secret not in stored)

    c.step("Login com 2FA")
    logout()
    c.check("depois da senha, pede o código", login() == "/login/2fa", b.path())
    b.goto("/conta")
    c.check("só a senha não dá acesso a /conta", b.path() == "/login")
    b.goto("/login/2fa")
    time.sleep(4)
    b.fill({"code": "123456" if totp(secret) != "123456" else "654321"})
    b.submit(3)
    c.check("código errado é recusado", "Código inválido" in b.text())
    next_window()
    b.fill({"code": totp(secret)})
    b.submit()
    c.check("código certo entra", b.path() == "/conta", b.path())

    c.step("Código de recuperação")
    logout()
    login()
    time.sleep(4)
    b.click("Perdi o celular: usar um código de recuperação", 1)
    b.fill({"code": codes[0]})
    b.submit()
    c.check("código de recuperação entra", b.path() == "/conta", b.path())
    logout()
    login()
    time.sleep(4)
    b.click("Perdi o celular: usar um código de recuperação", 1)
    b.fill({"code": codes[0]})
    b.submit(3)
    c.check("o mesmo código não serve duas vezes", "inválido ou já usado" in b.text())
    time.sleep(4)
    b.fill({"code": codes[1]})
    b.submit()
    c.check("outro código de recuperação entra", b.path() == "/conta", b.path())

    c.step("Desativar")
    time.sleep(4)
    b.fill({"password": password})
    b.submit(3)
    c.check("desativado", "Verificação em duas etapas desativada." in b.text())
    logout()
    c.check("o login volta a ser só com a senha", login() == "/conta", b.text()[-160:])

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
