import subprocess, time, urllib.request, signal
from playwright.sync_api import sync_playwright

srv = subprocess.Popen(["node", "e2e/serve-memory.mjs"], cwd="/home/claude/nails-up")
for _ in range(50):
    try:
        urllib.request.urlopen("http://127.0.0.1:3100/api/settings"); break
    except Exception:
        time.sleep(0.1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
        pg = b.new_page(viewport={"width": 390, "height": 800})
        errs = []
        pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.goto("http://localhost:3100/")
        pg.wait_for_selector(".empty")
        pg.wait_for_function("document.querySelector('.empty') !== null")
        # seed defaults -> servicios disponibles
        pg.click("text=Nueva cita >> nth=0")
        pg.select_option("#f-client", "__new")
        pg.fill("#f-nn", "Ana López"); pg.fill("#f-np", "55 1234 5678")
        pg.wait_for_selector("#f-svc option:nth-child(2)", state="attached")
        pg.select_option("#f-svc", index=1)
        pg.click("text=Guardar cita"); pg.wait_for_selector(".swatch")
        # cobrar
        pg.click(".swatch"); pg.click(".sheet button:text-is('Cobrar')")
        pg.fill("#p-sub", "400"); pg.click(".sheet button:text-is('Cobrar')")
        pg.wait_for_selector(".toast >> text=Cobrado")
        print("cobrado:", pg.inner_text(".toast"))
        # recargar: los datos siguen
        pg.reload(); pg.wait_for_selector(".swatch")
        print("tras recargar:", pg.inner_text(".swatch").replace("\n", " | "))
        pg.click(".tabs >> text=Resumen"); pg.wait_for_timeout(300)
        print("ingresos:", "$400.00" in pg.inner_text("#app"))
        # el servidor se apaga: una escritura muestra el mensaje en español
        srv.send_signal(signal.SIGTERM); srv.wait()
        pg.click(".tabs >> text=Clientas"); pg.click("text=Nueva clienta >> nth=0")
        pg.fill("#c-name", "Otra"); pg.click("text=Guardar clienta"); pg.wait_for_selector("[role=alert]")
        print("sin servidor:", pg.inner_text("[role=alert]").split("\n")[0])
        print("errors (ignorando red caída):", [e for e in errs if "Failed to load resource" not in e and "ERR_CONNECTION" not in e])
        b.close()
finally:
    if srv.poll() is None: srv.terminate()
