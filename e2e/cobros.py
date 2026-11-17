from playwright.sync_api import sync_playwright
import json
TODAY = "2026-11-17"
with sync_playwright() as p:
    b = p.chromium.launch(executable_path="/usr/bin/google-chrome", args=["--no-sandbox"])
    pg = b.new_page(viewport={"width": 390, "height": 800})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errs.append(str(e)))
    # sin base de datos
    pg.goto("file:///home/claude/nails-up/dist/index.html")
    pg.wait_for_selector(".empty")
    print("sin db:", pg.inner_text(".empty"))
    pg.goto("file:///home/claude/nails-up/dist/index.html#demo")
    pg.reload()
    pg.wait_for_selector(".empty")
    today = pg.evaluate("(() => { const d = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Mexico_City'}).format(new Date()); return d })()")
    seed = {
      "clients": {"c1": {"name": "Ana López", "phone": "5512345678", "birthday": ""}, "c2": {"name": "Beto", "phone": "5599998888", "birthday": ""}},
      "services": {"s1": {"name": "Manicure en gel", "price": 400, "durationMin": 45, "color": "#D6459A", "active": True}},
      "appointments": {f"p{i}": {"clientId": "c1", "serviceId": "s1", "serviceName": "Manicure en gel", "serviceColor": "#D6459A", "start": f"2026-0{i+2}-10T10:00", "durationMin": 45, "status": "cobrada", "total": 400, "method": "efectivo", "paidAt": f"2026-0{i+2}-10"} for i in range(5)},
    }
    seed["appointments"]["old"] = {"clientId": "c2", "serviceId": "s1", "serviceName": "Manicure en gel", "serviceColor": "#D6459A", "start": "2026-08-01T10:00", "durationMin": 45, "status": "cobrada", "total": 400, "method": "efectivo", "paidAt": "2026-08-01"}
    seed["appointments"]["cancel"] = {"clientId": "c1", "serviceId": "s1", "serviceName": "Manicure en gel", "serviceColor": "#D6459A", "start": f"{today}T09:00", "durationMin": 45, "status": "cancelada", "price": 400, "advance": 0}
    seed["appointments"]["hoy"] = {"clientId": "c1", "serviceId": "s1", "serviceName": "Manicure en gel", "serviceColor": "#D6459A", "start": f"{today}T12:00", "durationMin": 45, "status": "pendiente", "price": 400, "advance": 1000}
    pg.evaluate("async (seed) => { for (const [c, docs] of Object.entries(seed)) for (const [id, b] of Object.entries(docs)) await window.__demoDb.collection(c).doc(id).set(b); }", seed)
    pg.click(".nav [data-tab=cobros]")
    pg.wait_for_selector(".row-appt")
    pg.click(".row-appt >> nth=-1")  # la pendiente de hoy
    pg.click(".sheet button:text-is('Cobrar')")
    pg.wait_for_selector("#p-sub")
    txt = pg.inner_text(".sheet")
    print("lealtad:", "Lealtad: visita 6" in txt, "| total 340:", "$340.00" in txt, "| saldo 0:", "$0.00" in txt)
    pg.click("text=Quitar descuento")
    print("sin descuento total 400:", "$400.00" in pg.inner_text(".sheet"))
    pg.click("text=Aplicar descuento")
    pg.select_option("#p-method", "transferencia")
    pg.screenshot(path="/tmp/cobrar.png")
    pg.click(".sheet button:text-is('Cobrar')"); pg.wait_for_timeout(400)
    print("toast:", pg.inner_text(".toast"))
    # tras cobrar ya no hay botón Cobrar en el detalle
    pg.click(".nav [data-tab=cobros]"); pg.wait_for_timeout(200)
    pg.click(".item >> nth=0")
    print("detalle cobrada sin boton cobrar:", pg.locator(".sheet button:text-is('Cobrar')").count() == 0)
    pg.click("text=Cerrar >> nth=-1")
    pg.click(".nav [data-tab=resumen]"); pg.wait_for_timeout(200)
    print("resumen:", pg.inner_text("#app").replace("\n", " | ")[:260])
    # promociones
    pg.click(".nav [data-tab=promos]")
    pg.click("text=Nueva promoción >> nth=0")
    pg.fill("#pr-name", "Buen Fin"); pg.fill("#pr-pct", "20")
    pg.click("text=Guardar promoción"); pg.wait_for_timeout(300)
    print("promo:", "Activa hoy" in pg.inner_text("#app"))
    pg.click("text=Captación"); pg.wait_for_selector(".item")
    print("captacion:", pg.inner_text(".item").replace("\n", " | "))
    pg.screenshot(path="/tmp/captacion.png")
    print("errors:", errs)
    b.close()
