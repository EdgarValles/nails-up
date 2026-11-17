// pantallas de Nails Up
(function () {
  const L = NailsLogic;
  const root = document.getElementById("app");
  const TONES = ["#D6459A", "#8E6BD1", "#B8924A", "#2F9C95", "#E0707A", "#5B6FD6"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  const S = {
    tab: "agenda", view: "dia", date: L.dateKey(new Date()),
    clients: [], services: [], appts: [], promos: [], settings: {},
    sheet: null, toast: "", error: "", loading: true, clientTab: "clientas", clientQuery: "",
  };

  /* ---------- utilidades ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "style") el.setAttribute("style", v);
      else if (k === "value") el.value = v;
      else if (v === true) el.setAttribute(k, "");
      else el.setAttribute(k, v);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }
  const todayKey = () => L.dateKey(new Date());
  const addDays = (key, n) => new Date(Date.parse(key + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const weekday = (key) => new Date(key + "T00:00:00Z").getUTCDay();
  const dmy = (key) => key.slice(8, 10) + "/" + key.slice(5, 7) + "/" + key.slice(0, 4);
  const longDate = (key) => DIAS[weekday(key)] + " " + Number(key.slice(8, 10)) + "/" + key.slice(5, 7);
  const timeOf = (a) => a.start.slice(11, 16);
  const byStart = (a, b) => a.start.localeCompare(b.start);
  const clientOf = (id) => S.clients.find((c) => c.id === id);
  const serviceOf = (id) => S.services.find((s) => s.id === id);
  const apptsOn = (key) => S.appts.filter((a) => a.start.slice(0, 10) === key).sort(byStart);
  const settings = () => ({ loyaltyEvery: 6, loyaltyPercent: 15, inactiveWeeks: 5, ...(S.settings.main || {}) });
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) && n > 0 ? n : 0; };

  let toastTimer;
  function toast(msg) {
    S.toast = msg; render();
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { S.toast = ""; render(); }, 2500);
  }
  // la hoja se construye una sola vez al abrirse, para que un cambio de datos no borre lo que se está escribiendo
  function openSheet(fn) {
    S.sheet = h("div", { class: "sheet-back", onclick: (e) => { if (e.target === e.currentTarget) closeSheet(); } },
      h("div", { class: "sheet", role: "dialog", "aria-modal": "true" }, fn()));
    render();
  }
  function closeSheet() { S.sheet = null; render(); }
  async function run(promise, okMsg) {
    try { await promise; if (okMsg) toast(okMsg); return true; }
    catch (e) { S.error = e && e.message ? e.message : "No se pudo guardar. Intenta de nuevo."; render(); return false; }
  }

  /* ---------- render ---------- */
  let queued = false;
  function render() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; paint(); });
  }
  function paint() {
    const focus = document.activeElement;
    const keep = focus && focus.dataset && focus.dataset.keep;
    const pos = keep && focus.selectionStart;
    root.replaceChildren();
    if (!Store.ready && !S.loading) {
      root.append(h("div", { class: "empty", style: "margin-top:40px" },
        h("p", {}, "No se pudo abrir la base de datos. Recarga la página o abre el portal desde tu cuenta.")));
      return;
    }
    const screens = { agenda: screenAgenda, clientas: screenClientas, cobros: screenCobros, promos: screenPromos, resumen: screenResumen };
    root.append(h("div", { class: "top" }, h("span", { class: "brand" }, "Nails Up")),
      S.error && h("div", { class: "note", role: "alert" }, S.error + " ", h("button", { class: "btn small ghost", onclick: () => { S.error = ""; render(); } }, "Cerrar")),
      screens[S.tab]());
    root.append(tabs());
    if (S.sheet) root.append(S.sheet);
    if (S.toast) root.append(h("div", { class: "toast", role: "status" }, S.toast));
    if (keep) { const el = root.querySelector('[data-keep="' + keep + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} } }
  }
  function tabs() {
    const items = [["agenda", "Agenda"], ["clientas", "Clientas"], ["cobros", "Cobros"], ["promos", "Promociones"], ["resumen", "Resumen"]];
    return h("div", { class: "tabs" }, h("nav", { "aria-label": "Secciones" },
      items.map(([id, label]) => h("button", { "aria-current": S.tab === id ? "page" : null, onclick: () => { S.tab = id; render(); } }, label))));
  }

  /* ---------- agenda ---------- */
  function screenAgenda() {
    const isWeek = S.view === "semana";
    const step = isWeek ? 7 : 1;
    const start = isWeek ? addDays(S.date, -((weekday(S.date) + 6) % 7)) : S.date;
    const title = isWeek ? longDate(start) + " al " + longDate(addDays(start, 6)) : longDate(S.date) + (S.date === todayKey() ? " (hoy)" : "");
    return h("div", { class: "stack" },
      h("div", { class: "row between" },
        h("div", { class: "seg", role: "group", "aria-label": "Vista" },
          h("button", { "aria-pressed": String(!isWeek), onclick: () => { S.view = "dia"; render(); } }, "Día"),
          h("button", { "aria-pressed": String(isWeek), onclick: () => { S.view = "semana"; render(); } }, "Semana")),
        h("button", { class: "btn", onclick: () => openSheet(() => apptForm({ date: S.date })) }, "Nueva cita")),
      h("div", { class: "datebar" },
        h("button", { class: "iconbtn", "aria-label": "Anterior", onclick: () => { S.date = addDays(S.date, -step); render(); } }, "‹"),
        h("h2", {}, title),
        h("button", { class: "btn small sec", onclick: () => { S.date = todayKey(); render(); } }, "Hoy"),
        h("button", { class: "iconbtn", "aria-label": "Siguiente", onclick: () => { S.date = addDays(S.date, step); render(); } }, "›")),
      isWeek ? weekView(start) : dayView(S.date));
  }
  function swatch(a) {
    const c = clientOf(a.clientId);
    const color = a.serviceColor || (serviceOf(a.serviceId) || {}).color || TONES[0];
    return h("button", { class: "swatch " + a.status, style: "--c:" + color, onclick: () => openSheet(() => apptDetail(a.id)) },
      h("span", { class: "hora" }, timeOf(a)),
      h("span", {}, h("div", { class: "quien" }, c ? c.name : "Clienta eliminada"), h("div", { class: "que" }, a.serviceName || "Servicio")),
      h("span", { class: "estado" }, { pendiente: "Pendiente", cobrada: "Cobrada", cancelada: "Cancelada" }[a.status]));
  }
  function dayView(key) {
    const list = apptsOn(key);
    if (!list.length) return h("div", { class: "empty" }, h("p", {}, "No hay citas este día. Agenda la primera."), h("button", { class: "btn", onclick: () => openSheet(() => apptForm({ date: key })) }, "Nueva cita"));
    return h("div", { class: "list" }, list.map(swatch));
  }
  function weekView(start) {
    const days = [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i));
    return h("div", { class: "week" }, days.map((d) => h("button", { class: "weekday" + (d === todayKey() ? " hoy" : ""), style: "font:inherit", "aria-label": longDate(d) + ", " + apptsOn(d).filter((a) => a.status !== "cancelada").length + " citas", onclick: () => { S.date = d; S.view = "dia"; render(); } },
      h("div", { class: "dn" }, DIAS[weekday(d)].slice(0, 3)), h("div", { class: "num" }, Number(d.slice(8, 10))),
      apptsOn(d).filter((a) => a.status !== "cancelada").slice(0, 6).map((a) => h("span", { class: "dot", style: "--c:" + (a.serviceColor || TONES[0]) })))));
  }

  /* ---------- formulario de cita ---------- */
  function apptForm(init, existing) {
    const f = existing ? { ...existing, date: existing.start.slice(0, 10), time: existing.start.slice(11, 16) } : { date: init.date, time: "10:00", clientId: "", serviceId: "", notes: "", advance: "", durationMin: "" };
    let warn = "";
    const clientSel = h("select", { id: "f-client" }, h("option", { value: "" }, "Elige una clienta"),
      S.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => h("option", { value: c.id, selected: c.id === f.clientId }, c.name)),
      h("option", { value: "__new" }, "+ Nueva clienta"));
    const newBox = h("div", { class: "grid2", hidden: true },
      h("label", {}, "Nombre", h("input", { id: "f-nn", autocomplete: "off" })),
      h("label", {}, "Teléfono", h("input", { id: "f-np", inputmode: "tel", autocomplete: "off" })));
    clientSel.addEventListener("change", () => { newBox.hidden = clientSel.value !== "__new"; });
    const activos = S.services.filter((s) => s.active !== false || s.id === f.serviceId);
    const svcSel = h("select", { id: "f-svc" }, h("option", { value: "" }, "Elige un servicio"),
      activos.map((s) => h("option", { value: s.id, selected: s.id === f.serviceId }, s.name + (s.price ? " · " + L.formatMXN(s.price) : ""))));
    const dur = h("input", { id: "f-dur", type: "number", min: "5", step: "5", value: f.durationMin });
    svcSel.addEventListener("change", () => { const s = serviceOf(svcSel.value); if (s && !dur.value) dur.value = s.durationMin; });
    const msg = h("div", { "aria-live": "polite" });

    async function save(force) {
      msg.replaceChildren();
      let clientId = clientSel.value;
      const svc = serviceOf(svcSel.value);
      const date = root.querySelector("#f-date").value, time = root.querySelector("#f-time").value;
      if (!clientId) return msg.append(h("div", { class: "note" }, "Elige una clienta o crea una nueva."));
      if (!svc) return msg.append(h("div", { class: "note" }, "Elige un servicio."));
      if (!date || !time) return msg.append(h("div", { class: "note" }, "Indica fecha y hora."));
      if (clientId === "__new") {
        const name = root.querySelector("#f-nn").value.trim(), phone = root.querySelector("#f-np").value;
        if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la clienta."));
        const dup = L.findClientByPhone(S.clients, phone);
        if (dup) return msg.append(h("div", { class: "note" }, "Ya existe " + dup.name + " con ese teléfono. Elígela en la lista."));
        clientId = await Store.save("clients", { name, phone, canal: "whatsapp", birthday: "", notes: "" });
      }
      const appt = {
        ...(existing || {}), id: existing && existing.id,
        clientId, serviceId: svc.id, serviceName: svc.name, serviceColor: svc.color,
        start: date + "T" + time, durationMin: Number(dur.value) || svc.durationMin || 30,
        notes: root.querySelector("#f-notes").value.trim(), advance: num(root.querySelector("#f-adv").value),
        status: existing ? existing.status : "pendiente", price: svc.price || 0,
      };
      if (!force) {
        const clash = S.appts.find((o) => o.id !== appt.id && o.status !== "cancelada" && L.appointmentsOverlap(o, appt));
        if (clash) {
          const who = clientOf(clash.clientId);
          return msg.append(h("div", { class: "note" }, "Se empalma con la cita de " + (who ? who.name : "otra clienta") + " a las " + timeOf(clash) + ". ",
            h("button", { class: "btn small ghost", onclick: () => save(true) }, "Guardar de todos modos")));
        }
      }
      if (await run(Store.save("appointments", appt), "Cita guardada")) { S.date = date; closeSheet(); }
    }
    return h("div", { class: "stack" }, h("h2", {}, existing ? "Editar cita" : "Nueva cita"),
      h("label", {}, "Clienta", clientSel), newBox,
      h("label", {}, "Servicio", svcSel),
      h("div", { class: "grid2" }, h("label", {}, "Fecha", h("input", { id: "f-date", type: "date", value: f.date })), h("label", {}, "Hora", h("input", { id: "f-time", type: "time", value: f.time }))),
      h("div", { class: "grid2" }, h("label", {}, "Duración (min)", dur), h("label", {}, "Anticipo recibido", h("input", { id: "f-adv", type: "number", min: "0", inputmode: "decimal", value: f.advance || "" }))),
      h("label", {}, "Notas del diseño", h("textarea", { id: "f-notes" }, f.notes || "")),
      msg,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: () => save(false) }, "Guardar cita"), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }

  /* ---------- detalle de cita ---------- */
  function apptDetail(id) {
    const a = S.appts.find((x) => x.id === id);
    if (!a) return h("div", {}, h("p", {}, "Esta cita ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const c = clientOf(a.clientId);
    const wa = c ? L.whatsappLink(c.phone, "Hola " + c.name.split(" ")[0] + ", te confirmo tu cita en Nails Up el " + dmy(a.start.slice(0, 10)) + " a las " + timeOf(a) + ".") : "";
    return h("div", { class: "stack" },
      h("h2", {}, c ? c.name : "Clienta eliminada"),
      h("div", {}, h("div", {}, a.serviceName, " · ", longDate(a.start.slice(0, 10)), " ", timeOf(a), " · ", a.durationMin, " min"),
        a.notes && h("div", { class: "muted" }, a.notes),
        a.advance ? h("div", { class: "muted" }, "Anticipo recibido: " + L.formatMXN(a.advance)) : null,
        a.status === "cobrada" && h("div", { class: "note ok", style: "margin-top:8px" }, "Cobrada: " + L.formatMXN(a.total) + " (" + a.method + ")")),
      h("div", { class: "row" },
        a.status === "pendiente" && h("button", { class: "btn", onclick: () => openSheet(() => chargeForm(a.id)) }, "Cobrar"),
        a.status === "pendiente" && h("button", { class: "btn sec", onclick: () => openSheet(() => apptForm({}, a)) }, "Editar cita"),
        wa && a.status === "pendiente" && h("a", { class: "btn sec", href: wa, target: "_blank", rel: "noopener", style: "text-decoration:none;display:inline-flex;align-items:center" }, "Confirmar por WhatsApp"),
        a.status === "pendiente" && h("button", { class: "btn danger", onclick: () => openSheet(() => confirmCancel(a.id)) }, "Cancelar cita"),
        h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function confirmCancel(id) {
    const a = S.appts.find((x) => x.id === id);
    return h("div", { class: "stack" }, h("h2", {}, "¿Cancelar esta cita?"), h("p", { class: "muted" }, "La cita queda en el historial como cancelada y no cuenta como visita."),
      h("div", { class: "row" },
        h("button", { class: "btn danger", onclick: async () => { if (await run(Store.save("appointments", { ...a, status: "cancelada" }), "Cita cancelada")) closeSheet(); } }, "Sí, cancelar cita"),
        h("button", { class: "btn ghost", onclick: () => openSheet(() => apptDetail(id)) }, "Volver")));
  }

  /* ---------- pantallas pendientes (tareas 7 y 8) ---------- */
  function screenClientas() { return h("div", {}, "Clientas"); }
  function screenCobros() { return h("div", {}, "Cobros"); }
  function screenPromos() { return h("div", {}, "Promociones"); }
  function screenResumen() { return h("div", {}, "Resumen"); }
  function chargeForm() { return h("div", {}, "Cobrar"); }

  /* ---------- arranque ---------- */
  function demoDb() {
    const cols = {}, subs = {};
    let n = 0;
    const notify = (c) => (subs[c] || []).forEach((cb) => cb({ docs: Object.entries(cols[c] || {}).map(([id, b]) => ({ id, data: () => b })) }));
    return { collection: (c) => ({
      doc: (id) => { id = id || "d" + ++n; return { id, set: async (b) => { (cols[c] = cols[c] || {})[id] = JSON.parse(JSON.stringify(b)); notify(c); }, delete: async () => { delete (cols[c] || {})[id]; notify(c); } }; },
      onSnapshot: (cb) => { (subs[c] = subs[c] || []).push(cb); setTimeout(() => notify(c), 0); return () => {}; },
    }) };
  }
  async function boot() {
    render();
    let db = null;
    if (location.hash === "#demo") db = demoDb();
    else { try { db = typeof claude !== "undefined" ? await claude.use("db") : null; } catch (_) { db = null; } }
    Store.init(db);
    S.loading = false;
    if (!db) return render();
    const map = { clients: "clients", services: "services", appointments: "appts", promos: "promos", settings: "settings" };
    for (const [col, key] of Object.entries(map)) {
      Store.subscribe(col, (docs) => {
        S[key] = key === "settings" ? Object.fromEntries(docs.map((d) => [d.id, d])) : docs;
        render();
      });
    }
    Store.seedDefaults().catch(() => {});
    render();
  }
  boot();
})();
