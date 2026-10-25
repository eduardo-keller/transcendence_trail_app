# Testa o GDPR de ponta a ponta: baixar os dados (com e-mail de aviso) e excluir a conta
# (senha + link por e-mail), conferindo no banco que nada da pessoa sobrou.
# uso: python3 tests/ui/test_gdpr.py   (com o app rodando; sem SMTP_HOST os e-mails vão para o log do app)
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

import json, re, time
from browser import Browser, Checks, app_logs, sql

b = Browser(9333)
outsider = Browser(9334)
c = Checks()
email = f"ui-gdpr-{int(time.time())}@example.com"
password = "senha-forte-123"
TABLES = ["Session", "Account", "Avatar", "TwoFactor", "Activity", "Notification", "Post", "UserBadge", "CommunityMember"]
try:
    b.goto("/cadastro")
    b.fill({"name": "Titular Dados", "email": email, "password": password})
    b.submit()
    uid = sql(f"SELECT id FROM \"User\" WHERE email = '{email}'")
    # Dados de verdade ligados à pessoa: uma trilha criada por ela e uma atividade
    sql(f"""INSERT INTO "Trail" (id, title, distance, "routeGeoJSON", "minLat", "minLon", "maxLat", "maxLon", "authorId")
            VALUES ('trilha-{uid}', 'Trilha da Titular', 1000, '{{"type":"LineString","coordinates":[[-46.6,-23.5],[-46.59,-23.49]]}}', -23.5, -46.6, -23.49, -46.59, '{uid}');
            INSERT INTO "Activity" (id, title, distance, duration, "userId", "trailId") VALUES ('ativ-{uid}', 'Fiz a trilha', 1000, 600, '{uid}', 'trilha-{uid}')""")

    c.step("Baixar meus dados")
    b.goto("/conta/dados")
    c.check("a página explica os direitos e tem os botões", "Baixar meus dados" in b.text() and "Excluir minha conta" in b.text())
    raw = b.js("fetch('/api/me/export').then(async r => JSON.stringify({type: r.headers.get('content-type'), disp: r.headers.get('content-disposition'), body: await r.text()}))")
    res = json.loads(raw)
    data = json.loads(res["body"])
    c.check("vem como arquivo JSON para baixar", res["type"].startswith("application/json") and res["disp"].startswith("attachment"))
    c.check("JSON legível (indentado)", "\n  " in res["body"])
    c.check("traz perfil, username e e-mail", data["profile"]["email"] == email and data["profile"]["username"])
    c.check("traz a trilha e a atividade", len(data["trails"]) == 1 and len(data["activities"]) == 1)
    secret_words = [w for w in ("password", "token", "secret", "backupCodes") if w in res["body"]]
    c.check("não traz segredos (hash de senha, tokens, 2FA)", not secret_words, secret_words)
    time.sleep(1)
    c.check("aviso da exportação enviado por e-mail", f"para {email}: Você baixou uma cópia dos seus dados" in app_logs("1m"))
    outsider.goto("/api/me/export")
    c.check("sem login, a exportação responde 401", "UNAUTHORIZED" in outsider.text())

    c.step("Excluir a conta: passo 1 (senha)")
    b.goto("/conta/dados")
    b.fill({"password": "senha-errada"})
    b.submit(3)
    c.check("senha errada é recusada", "Senha incorreta." in b.text())
    b.fill({"password": password})
    b.submit(3)
    c.check("pede para abrir o link do e-mail", "Enviamos um link de confirmação" in b.text())
    c.check("ainda não apagou nada", sql(f"SELECT count(*) FROM \"User\" WHERE id = '{uid}'") == "1")
    time.sleep(1)
    links = re.findall(r"https?://\S+/conta/excluir\?token=[a-z0-9]+", app_logs("2m"))
    link = links[-1] if links else ""
    c.check("o e-mail traz o link de confirmação", bool(link), link)
    path = link[link.index("/conta/"):] if link else "/"

    c.step("O link sozinho não basta")
    outsider.goto(path, 3)
    c.check("sem estar logado na conta, o link manda para o login", outsider.path() == "/login")
    b.goto(path, 3)
    c.check("abrir o link (GET) não apaga nada: pede confirmação", "Excluir definitivamente" in b.text()
            and sql(f"SELECT count(*) FROM \"User\" WHERE id = '{uid}'") == "1")
    b.goto(path.split("token=")[0] + "token=" + "a" * 32, 3)
    b.click("Excluir definitivamente", 3)
    c.check("token falso é recusado", "Link inválido, expirado ou já usado." in b.text()
            and sql(f"SELECT count(*) FROM \"User\" WHERE id = '{uid}'") == "1")

    c.step("Excluir a conta: passo 2 (link + confirmar, logado)")
    b.goto(path, 3)
    b.click("Excluir definitivamente", 4)
    c.check("vai para a página de conta excluída", b.path() == "/conta-excluida", b.path())
    leftovers = {t: sql(f"SELECT count(*) FROM \"{t}\" WHERE \"userId\" = '{uid}'") for t in TABLES}
    leftovers["User"] = sql(f"SELECT count(*) FROM \"User\" WHERE id = '{uid}'")
    leftovers["Trail"] = sql(f"SELECT count(*) FROM \"Trail\" WHERE \"authorId\" = '{uid}'")
    c.check("nada da pessoa sobrou no banco", all(v == "0" for v in leftovers.values()), leftovers)
    c.check("confirmação da exclusão por e-mail", f"para {email}: Sua conta foi excluída" in app_logs("1m"))
    b.goto("/conta")
    c.check("a sessão acabou", b.path() == "/login")
    b.fill({"email": email, "password": password})
    b.submit()
    c.check("não dá mais para entrar", "E-mail ou senha incorretos." in b.text())
    b.goto(path, 3)
    c.check("o link não funciona de novo (sem sessão, vai para o login)", b.path() == "/login")

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
    outsider.close()
    sql(f"DELETE FROM \"User\" WHERE email = '{email}'")
sys.exit(0 if c.done() else 1)
