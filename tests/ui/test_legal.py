# Confere que Privacidade e Termos existem e cobrem o conteúdo mínimo de docs/AVALIACAO.md (eliminatório).
# uso: python3 tests/ui/test_legal.py   (com o app rodando; APP=... para outra URL)
import sys

sys.dont_write_bytecode = True  # não cria tests/ui/__pycache__

from browser import Browser, Checks

PRIVACY = {
    "dados coletados": ["nome, e-mail", "foto de perfil", "atividades", "mensagens", "XP e emblemas", "perguntas"],
    "para quê e base legal": ["Para que usamos", "legítimo interesse", "LGPD"],
    "onde ficam e por quanto tempo": ["PostgreSQL", "enquanto a sua conta existir"],
    "cookies": ["Cookie de sessão", "HttpOnly"],
    "cache offline do PWA": ["Cache offline"],
    "terceiros (LLM, OAuth, tiles)": ["modelos de linguagem", "GitHub ou pela 42", "servidor de mapas"],
    "quem vê o quê": ["Quem vê o quê", "nunca aparece"],
    "direitos e como exercê-los": ["Acesso e portabilidade", "Correção", "Exclusão", "/conta/dados"],
    "e-mails de confirmação": ["por e-mail"],
    "contato": ["Contato"],
}
TERMS = {
    "quem pode usar": ["Quem pode usar"],
    "conduta": ["Regras de conduta"],
    "aviso de segurança": ["Fazer trilha envolve riscos", "podem estar imprecisos"],
    "IA pode errar": ["podem conter erros"],
    "licenças (OSM/ODbL, Wikipedia/CC BY-SA)": ["OpenStreetMap", "ODbL", "CC BY-SA"],
    "limitação de responsabilidade": ["Limitação de responsabilidade"],
    "encerramento de conta": ["Encerramento da conta"],
    "projeto acadêmico da 42": ["projeto acadêmico da 42"],
}

b = Browser()
c = Checks()
try:
    for path, title, required in (("/privacidade", "Política de Privacidade", PRIVACY), ("/termos", "Termos de Uso", TERMS)):
        c.step(title)
        b.goto(path)
        text = b.text()
        html = b.js("document.documentElement.outerHTML")
        c.check("página abre sem login", b.path() == path and title in text)
        for topic, words in required.items():
            missing = [w for w in words if w not in text and w not in html]
            c.check(f"fala de {topic}", not missing, missing)
    c.step("Navegação")
    b.goto("/privacidade")
    b.click("Termos de Uso")
    c.check("da Privacidade vai para os Termos", b.path() == "/termos")
    c.step("Console do navegador")
    c.check("nenhum erro ou aviso no console", not b.console, b.console)
finally:
    b.close()
sys.exit(0 if c.done() else 1)
