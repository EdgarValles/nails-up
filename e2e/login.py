import os, subprocess, time, urllib.request
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = "/usr/bin/google-chrome"
srv = subprocess.Popen(["node", "e2e/serve-memory.mjs"], cwd=ROOT)
for _ in range(50):
    try:
        urllib.request.urlopen("http://127.0.0.1:3100/login"); break
    except Exception:
        time.sleep(0.1)
try:
    with sync_playwright() as p:
        opts = {"args": ["--no-sandbox"]}
        if os.path.exists(CHROME):
            opts["executable_path"] = CHROME
        b = p.chromium.launch(**opts)
        pg = b.new_page(viewport={"width": 390, "height": 800})
        errs, logs = [], []
        pg.on("console", lambda m: (logs.append(m.text), errs.append(m.text) if m.type == "error" else None))
        pg.on("pageerror", lambda e: errs.append(str(e)))
        # sin sesión, / lleva a /login
        pg.goto("http://localhost:3100/")
        pg.wait_for_selector("#pw")
        assert pg.url.endswith("/login"), pg.url
        # contraseña incorrecta
        pg.fill("#pw", "incorrecta-123"); pg.click("#go")
        pg.wait_for_function("document.getElementById('msg').textContent.length > 0")
        assert "Contraseña incorrecta" in pg.inner_text("#msg"), pg.inner_text("#msg")
        # contraseña correcta
        pg.fill("#pw", "portal-de-prueba-1"); pg.click("#go")
        pg.wait_for_selector(".top")
        # salir
        pg.click(".top >> text=Salir")
        pg.wait_for_url("**/login")
        assert pg.url.endswith("/login"), pg.url
        print("logs:", logs)
        assert not [l for l in logs if "Content Security Policy" in l], logs
        real = [e for e in errs if "Failed to load resource" not in e]
        assert real == [], real
        print("login ok")
        b.close()
finally:
    if srv.poll() is None: srv.terminate()
