from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 800})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto("file:///home/claude/nails-up/dist/index.html#demo")
    pg.click(".tabs >> text=Clientas")
    pg.wait_for_selector(".empty")
    pg.click("text=Nueva clienta >> nth=0")
    pg.fill("#c-name", "Ana López"); pg.fill("#c-phone", "55 1234 5678")
    pg.select_option("#c-mes", "11"); pg.fill("#c-dia", "30")
    pg.click("text=Guardar clienta"); pg.wait_for_selector(".item")
    print("lista:", pg.inner_text(".item").replace("\n", " | "))
    # duplicado con otro formato
    pg.click("text=Nueva clienta >> nth=0")
    pg.fill("#c-name", "Otra Ana"); pg.fill("#c-phone", "+52 55-1234-5678")
    pg.click("text=Guardar clienta"); pg.wait_for_selector(".note")
    print("dup:", pg.inner_text(".note").split("\n")[0])
    pg.click("text=Cerrar >> nth=-1")
    # ficha sin cumpleaños ni teléfono
    pg.click("text=Nueva clienta >> nth=0"); pg.fill("#c-name", "Sin Datos"); pg.click("text=Guardar clienta")
    pg.wait_for_timeout(300)
    pg.click("text=Sin Datos"); pg.wait_for_selector("text=Historial")
    print("ficha sin datos ok:", pg.locator("text=Abrir WhatsApp").count() == 0)
    pg.click("text=Cerrar >> nth=-1")
    # búsqueda conserva el foco
    pg.fill('[data-keep="q"]', "ana"); pg.wait_for_timeout(200)
    print("busqueda:", pg.locator(".item").count(), "foco:", pg.evaluate("document.activeElement.dataset.keep"))
    # servicios
    pg.click("text=Servicios"); pg.wait_for_selector(".item")
    pg.click("text=Retoque"); pg.fill("#s-price", "150"); pg.click("text=Guardar servicio"); pg.wait_for_timeout(300)
    print("servicio:", pg.inner_text(".item >> nth=-1").replace("\n", " | "))
    pg.screenshot(path="/tmp/servicios.png")
    print("errors:", errs)
    b.close()
