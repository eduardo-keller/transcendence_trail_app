# Testa o avatar: padrão com iniciais, envio (redimensionado no navegador), arquivo falso e remoção.
# uso: python3 tests/ui/test_avatar.py   (com o app rodando e o seed aplicado; APP=... para outra URL)
import os, struct, sys, tempfile, urllib.request, ssl, zlib
from browser import BASE, Browser, Checks, sql


def png(width, height):
    """PNG de verdade, gerado sem bibliotecas: um degradê."""
    raw = b"".join(b"\x00" + bytes(v for x in range(width) for v in (x * 255 // width, y * 255 // height, 120)) for y in range(height))
    chunk = lambda tag, data: struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


tmp = tempfile.mkdtemp()
real = os.path.join(tmp, "foto.png")
fake = os.path.join(tmp, "virus.png")
open(real, "wb").write(png(600, 400))
open(fake, "wb").write(b"MZ isto e um executavel renomeado para .png")

b = Browser()
c = Checks()
user_id = sql("SELECT id FROM \"User\" WHERE email = 'carla@example.com'")
sql(f"DELETE FROM \"Avatar\" WHERE \"userId\" = '{user_id}'; UPDATE \"User\" SET image = NULL WHERE id = '{user_id}'")
try:
    b.goto("/login")
    b.fill({"email": "carla@example.com", "password": "trilhas-dev-123"})
    b.submit()

    c.step("Avatar padrão")
    c.check("sem foto, mostra as iniciais", b.js("document.querySelector('[aria-label^=\"Avatar padrão\"]')?.textContent") == "CM")

    c.step("Arquivo falso com extensão .png")
    b.upload("input[type=file]", fake)
    c.check("recusado com mensagem", "Não foi possível ler essa imagem." in b.text())
    c.check("nada gravado no banco", sql(f"SELECT count(*) FROM \"Avatar\" WHERE \"userId\" = '{user_id}'") == "0")

    c.step("Envio de uma foto de verdade (600×400 PNG)")
    b.upload("input[type=file]", real)
    src = b.js("document.querySelector('img[alt^=\"Foto de\"]')?.getAttribute('src')")
    c.check("a página mostra a foto nova", bool(src) and src.startswith(f"/api/avatar/{user_id}?v="), src)
    row = sql(f"SELECT mime || '|' || length(data) FROM \"Avatar\" WHERE \"userId\" = '{user_id}'")
    mime, size = row.split("|") if "|" in row else ("", "0")
    c.check(f"guardada como WebP pequena ({size} bytes)", mime == "image/webp" and 0 < int(size) < 60_000, row)
    ctx = ssl._create_unverified_context()
    res = urllib.request.urlopen(BASE + src, context=ctx)
    body = res.read()
    c.check("a rota serve a imagem com o tipo certo e nosniff",
            res.headers["Content-Type"] == "image/webp" and res.headers["X-Content-Type-Options"] == "nosniff"
            and body[:4] == b"RIFF" and body[8:12] == b"WEBP")
    c.check("redimensionada para 256×256", b.js(f"new Promise(r => {{ const i = new Image(); i.onload = () => r(i.naturalWidth + 'x' + i.naturalHeight); i.src = {src!r}; }})") == "256x256")

    c.step("Perfil público")
    b.goto("/u/carla")
    c.check("mostra a foto", b.js("document.querySelector('img[alt^=\"Foto de\"]')?.getAttribute('src')") == src)

    c.step("Remover a foto")
    b.goto("/conta")
    b.click("Remover foto")
    c.check("volta para as iniciais", b.js("!!document.querySelector('[aria-label^=\"Avatar padrão\"]')"))
    c.check("apagada do banco", sql(f"SELECT count(*) FROM \"Avatar\" WHERE \"userId\" = '{user_id}'") == "0")

    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
sys.exit(0 if c.done() else 1)
