"""Controlador mínimo do Chrome (DevTools Protocol) sem dependências, para testes de tela."""
import base64, json, os, shutil, socket, struct, subprocess, tempfile, time, urllib.request

# Mesmo padrão dos testes em bash: o app pelo nginx; APP=http://localhost:3000 para o ambiente antigo
BASE = os.environ.get("APP", "https://localhost:8443")


class Browser:
    def __init__(self, port=9333):
        self.profile = tempfile.mkdtemp(prefix="cdp-")
        self.proc = subprocess.Popen(
            ["google-chrome", "--headless=new", "--disable-gpu", "--no-first-run", "--ignore-certificate-errors",
             f"--user-data-dir={self.profile}", f"--remote-debugging-port={port}", "about:blank"],
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=1)
                break
            except Exception:
                time.sleep(0.2)
        req = urllib.request.Request(f"http://127.0.0.1:{port}/json/new?about:blank", method="PUT")
        page = json.load(urllib.request.urlopen(req))
        self.sock = self._connect(page["webSocketDebuggerUrl"])
        self.msg_id = 0
        self.console = []  # (nível, texto)
        for domain in ("Page", "Runtime", "Log", "Network"):
            self.call(f"{domain}.enable")

    # --- WebSocket ---
    def _connect(self, url):
        host_port, path = url[len("ws://"):].split("/", 1)
        host, port = host_port.split(":")
        s = socket.create_connection((host, int(port)))
        key = base64.b64encode(os.urandom(16)).decode()
        s.sendall((f"GET /{path} HTTP/1.1\r\nHost: {host_port}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
                   f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
        buf = b""
        while b"\r\n\r\n" not in buf:
            buf += s.recv(4096)
        return s

    def _send(self, text):
        data = text.encode()
        mask = os.urandom(4)
        n = len(data)
        head = bytes([0x81]) + (bytes([0x80 | n]) if n < 126 else
                                bytes([0x80 | 126]) + struct.pack(">H", n) if n < 65536 else
                                bytes([0x80 | 127]) + struct.pack(">Q", n))
        self.sock.sendall(head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data)))

    def _exact(self, n):
        out = b""
        while len(out) < n:
            chunk = self.sock.recv(n - len(out))
            if not chunk:
                raise EOFError
            out += chunk
        return out

    def _recv(self):
        _, b2 = self._exact(2)
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._exact(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._exact(8))[0]
        return json.loads(self._exact(n).decode(errors="replace"))

    def _event(self, m):
        method, p = m.get("method"), m.get("params", {})
        if method == "Runtime.consoleAPICalled" and p.get("type") in ("error", "warning", "warn", "assert"):
            text = " ".join(str(a.get("value", a.get("description", ""))) for a in p.get("args", []))
            self.console.append((p["type"], text))
        elif method == "Runtime.exceptionThrown":
            self.console.append(("exception", p["exceptionDetails"].get("exception", {}).get("description", "")))
        elif method == "Log.entryAdded" and p["entry"]["level"] in ("error", "warning"):
            self.console.append((p["entry"]["level"], p["entry"].get("text", "") + " " + p["entry"].get("url", "")))

    def call(self, method, params=None):
        self.msg_id += 1
        my = self.msg_id
        self._send(json.dumps({"id": my, "method": method, "params": params or {}}))
        while True:
            m = self._recv()
            if m.get("id") == my:
                return m.get("result", m)
            self._event(m)

    def pump(self, seconds):
        """Processa eventos (console) por alguns segundos."""
        self.sock.settimeout(0.2)
        end = time.time() + seconds
        while time.time() < end:
            try:
                self._event(self._recv())
            except (socket.timeout, TimeoutError):
                pass
        self.sock.settimeout(None)

    # --- atalhos ---
    def js(self, expr):
        r = self.call("Runtime.evaluate", {"expression": expr, "awaitPromise": True, "returnByValue": True})
        if "exceptionDetails" in r:
            return f"ERRO JS: {r['exceptionDetails'].get('exception', {}).get('description')}"
        return r.get("result", {}).get("value")

    def goto(self, path, wait=2.5):
        self.last_field = None
        self.call("Page.navigate", {"url": BASE + path})
        self.pump(wait)

    def path(self):
        return self.js("location.pathname")

    def fill(self, values):
        for name, value in values.items():
            self.js(f"document.querySelector('[name=\"{name}\"]').value = {json.dumps(value)}")
            self.last_field = name

    def submit(self, wait=2.5):
        """Envia o formulário do último campo preenchido (a página pode ter vários)."""
        field = getattr(self, "last_field", None)
        target = f"document.querySelector('[name=\"{field}\"]')?.form" if field else "document.querySelector('form')"
        self.js(f"({target} || document.querySelector('form')).requestSubmit()")
        self.pump(wait)

    def click(self, text, wait=2.5):
        self.js(f"[...document.querySelectorAll('button,a')].find(e => e.textContent.trim() === {json.dumps(text)}).click()")
        self.pump(wait)

    def upload(self, selector, path, wait=4):
        """Escolhe um arquivo num <input type=file> (como se a pessoa tivesse escolhido)."""
        root = self.call("DOM.getDocument")["root"]["nodeId"]
        node = self.call("DOM.querySelector", {"nodeId": root, "selector": selector})["nodeId"]
        self.call("DOM.setFileInputFiles", {"nodeId": node, "files": [path]})
        self.js(f"document.querySelector({json.dumps(selector)}).dispatchEvent(new Event('change', {{bubbles: true}}))")
        self.pump(wait)

    def text(self):
        return self.js("document.body.innerText")

    def cookies(self):
        return self.call("Network.getCookies", {"urls": [BASE]}).get("cookies", [])

    def close(self):
        try:
            self.call("Browser.close")
        except Exception:
            pass
        self.proc.wait(timeout=10)
        shutil.rmtree(self.profile, ignore_errors=True)


REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def sql(query):
    """Consulta no Postgres do compose (para conferir o banco e limpar os dados do teste)."""
    cmd = ["docker", "compose", "-f", os.path.join(REPO, "docker/docker-compose.yml"), "exec", "-T", "postgres",
           "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$0"', query]
    return subprocess.run(cmd, capture_output=True, text=True).stdout.strip()


def app_logs(since="5m"):
    """Log do container do app (onde vão os e-mails quando não há SMTP configurado)."""
    cmd = ["docker", "compose", "-f", os.path.join(REPO, "docker/docker-compose.yml"), "logs", "--no-log-prefix", "--since", since, "nextjs"]
    return subprocess.run(cmd, capture_output=True, text=True).stdout


class Checks:
    def __init__(self):
        self.ok = 0
        self.fail = 0

    def check(self, label, cond, info=""):
        if cond:
            self.ok += 1
            print(f"  ✔ {label}")
        else:
            self.fail += 1
            print(f"  ✘ {label} {info}")

    def step(self, title):
        print(f"\n{title}")

    def done(self):
        print(f"\nResultado: {self.ok} passaram, {self.fail} falharam")
        return self.fail == 0
