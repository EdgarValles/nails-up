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
    if (init && init.clientId && !existing) init = { ...init };
    const f = existing ? { ...existing, date: existing.start.slice(0, 10), time: existing.start.slice(11, 16) } : { date: init.date, time: "10:00", clientId: init.clientId || "", serviceId: "", notes: "", advance: "", durationMin: "" };
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

  /* ---------- clientas y servicios ---------- */
  function screenClientas() {
    const tab = S.clientTab;
    return h("div", { class: "stack" },
      h("div", { class: "row between" },
        h("div", { class: "seg", role: "group", "aria-label": "Sección" },
          h("button", { "aria-pressed": String(tab === "clientas"), onclick: () => { S.clientTab = "clientas"; render(); } }, "Clientas"),
          h("button", { "aria-pressed": String(tab === "servicios"), onclick: () => { S.clientTab = "servicios"; render(); } }, "Servicios")),
        tab === "clientas"
          ? h("button", { class: "btn", onclick: () => openSheet(() => clientForm()) }, "Nueva clienta")
          : h("button", { class: "btn", onclick: () => openSheet(() => serviceForm()) }, "Nuevo servicio")),
      tab === "clientas" ? clientList() : serviceList());
  }
  function clientList() {
    const q = S.clientQuery.trim().toLowerCase();
    const qd = L.normalizePhone(S.clientQuery);
    const list = S.clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && L.normalizePhone(c.phone) === qd) || String(c.phone || "").includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    return h("div", { class: "stack" },
      h("input", { type: "search", placeholder: "Buscar por nombre o teléfono", "aria-label": "Buscar clienta", "data-keep": "q", value: S.clientQuery, oninput: (e) => { S.clientQuery = e.target.value; render(); } }),
      list.length ? h("div", { class: "list" }, list.map((c) => h("button", { class: "item", onclick: () => openSheet(() => clientCard(c.id)) },
        h("span", {}, h("div", { class: "name" }, c.name), h("div", { class: "muted small" }, c.phone || "Sin teléfono")),
        h("span", { class: "tag" }, L.paidVisitCount(c.id, S.appts) + " visitas"))))
        : h("div", { class: "empty" }, h("p", {}, S.clients.length ? "No hay clientas con esa búsqueda." : "Aún no hay clientas. Agrega la primera."), !S.clients.length && h("button", { class: "btn", onclick: () => openSheet(() => clientForm()) }, "Nueva clienta")));
  }
  function clientCard(id) {
    const c = clientOf(id);
    if (!c) return h("div", {}, h("p", {}, "Esta clienta ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const visits = L.paidVisitCount(c.id, S.appts);
    const hist = S.appts.filter((a) => a.clientId === c.id).sort((a, b) => byStart(b, a));
    const wa = L.whatsappLink(c.phone, "Hola " + c.name.split(" ")[0] + ", ");
    const st = settings();
    return h("div", { class: "stack" }, h("h2", {}, c.name),
      h("div", { class: "muted" }, c.phone || "Sin teléfono", c.birthday ? " · cumpleaños " + c.birthday.slice(3, 5) + "/" + c.birthday.slice(0, 2) : "", " · ", visits, " visitas cobradas"),
      st.loyaltyEvery > 0 && h("div", { class: "note ok" }, "Le faltan " + (st.loyaltyEvery - (visits % st.loyaltyEvery)) + " visitas para su descuento de lealtad."),
      c.notes && h("div", {}, c.notes),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => openSheet(() => apptForm({ date: todayKey() , clientId: c.id }, null, c.id)) }, "Nueva cita"),
        h("button", { class: "btn sec", onclick: () => openSheet(() => clientForm(c.id)) }, "Editar clienta"),
        wa && h("a", { class: "btn sec", href: wa, target: "_blank", rel: "noopener", style: "text-decoration:none;display:inline-flex;align-items:center" }, "Abrir WhatsApp"),
        h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")),
      h("h3", {}, "Historial"),
      hist.length ? h("div", { class: "list" }, hist.map((a) => h("div", { class: "item", style: "cursor:default" },
        h("span", {}, h("div", { class: "name" }, a.serviceName), h("div", { class: "muted small" }, dmy(a.start.slice(0, 10)) + " " + timeOf(a))),
        h("span", { class: "tag" }, a.status === "cobrada" ? L.formatMXN(a.total) : a.status))))
        : h("p", { class: "muted" }, "Todavía no tiene citas."));
  }
  function clientForm(id) {
    const c = id ? clientOf(id) : { name: "", phone: "", birthday: "", canal: "whatsapp", notes: "" };
    const msg = h("div", { "aria-live": "polite" });
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mes = h("select", { id: "c-mes" }, h("option", { value: "" }, "Mes"), meses.map((m, i) => h("option", { value: String(i + 1).padStart(2, "0"), selected: c.birthday && c.birthday.slice(0, 2) === String(i + 1).padStart(2, "0") }, m)));
    const dia = h("input", { id: "c-dia", type: "number", min: "1", max: "31", inputmode: "numeric", placeholder: "Día", value: c.birthday ? Number(c.birthday.slice(3, 5)) : "" });
    async function save() {
      msg.replaceChildren();
      const name = root.querySelector("#c-name").value.trim(), phone = root.querySelector("#c-phone").value.trim();
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la clienta."));
      if (phone && !L.normalizePhone(phone)) return msg.append(h("div", { class: "note" }, "El teléfono debe tener 10 dígitos."));
      const dup = phone && L.findClientByPhone(S.clients.filter((x) => x.id !== id), phone);
      if (dup) return msg.append(h("div", { class: "note" }, "Ya existe " + dup.name + " con ese teléfono. ", h("button", { class: "btn small ghost", onclick: () => openSheet(() => clientCard(dup.id)) }, "Abrir su ficha")));
      let birthday = "";
      const m = mes.value, d = Number(dia.value);
      if (m && d >= 1 && d <= 31) birthday = m + "-" + String(d).padStart(2, "0");
      const doc = { ...(id ? c : {}), id, name, phone, birthday, canal: root.querySelector("#c-canal").value, notes: root.querySelector("#c-notes").value.trim() };
      if (await run(Store.save("clients", doc), "Clienta guardada")) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar clienta" : "Nueva clienta"),
      h("label", {}, "Nombre", h("input", { id: "c-name", autocomplete: "off", value: c.name })),
      h("label", {}, "Teléfono", h("input", { id: "c-phone", inputmode: "tel", autocomplete: "off", value: c.phone })),
      h("div", { class: "grid2" }, h("label", {}, "Mes de cumpleaños", mes), h("label", {}, "Día", dia)),
      h("label", {}, "Cómo llegó", h("select", { id: "c-canal" }, [["whatsapp", "WhatsApp"], ["facebook", "Facebook"], ["otro", "Otro"]].map(([v, t]) => h("option", { value: v, selected: c.canal === v }, t)))),
      h("label", {}, "Notas", h("textarea", { id: "c-notes" }, c.notes || "")),
      msg, h("div", { class: "row" }, h("button", { class: "btn", onclick: save }, "Guardar clienta"), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function serviceList() {
    if (!S.services.length) return h("div", { class: "empty" }, h("p", {}, "Aún no hay servicios. Agrega el primero."), h("button", { class: "btn", onclick: () => openSheet(() => serviceForm()) }, "Nuevo servicio"));
    return h("div", { class: "list" }, S.services.slice().sort((a, b) => a.name.localeCompare(b.name)).map((v) => h("button", { class: "item", onclick: () => openSheet(() => serviceForm(v.id)) },
      h("span", {}, h("div", { class: "name" }, h("span", { class: "dotc", style: "background:" + (v.color || TONES[0]) }), v.name), h("div", { class: "muted small" }, v.durationMin + " min")),
      h("span", {}, v.active === false && h("span", { class: "tag" }, "Inactivo "), v.price ? L.formatMXN(v.price) : h("span", { class: "muted small" }, "Sin precio")))));
  }
  function serviceForm(id) {
    const v = id ? serviceOf(id) : { name: "", price: "", durationMin: 45, color: TONES[S.services.length % TONES.length], active: true };
    let color = v.color, active = v.active !== false;
    const msg = h("div", { "aria-live": "polite" });
    const palette = h("div", { class: "colors", role: "group", "aria-label": "Color del esmalte" });
    const paint2 = () => palette.replaceChildren(...TONES.map((t) => h("button", { style: "background:" + t, "aria-label": "Color " + t, "aria-pressed": String(t === color), onclick: () => { color = t; paint2(); } })));
    paint2();
    async function save() {
      msg.replaceChildren();
      const name = root.querySelector("#s-name").value.trim();
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre del servicio."));
      const doc = { ...(id ? v : {}), id, name, price: num(root.querySelector("#s-price").value), durationMin: Number(root.querySelector("#s-dur").value) || 30, color, active: root.querySelector("#s-active").checked };
      if (await run(Store.save("services", doc), "Servicio guardado")) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar servicio" : "Nuevo servicio"),
      h("label", {}, "Nombre", h("input", { id: "s-name", autocomplete: "off", value: v.name })),
      h("div", { class: "grid2" }, h("label", {}, "Precio", h("input", { id: "s-price", type: "number", min: "0", inputmode: "decimal", value: v.price || "" })), h("label", {}, "Duración (min)", h("input", { id: "s-dur", type: "number", min: "5", step: "5", value: v.durationMin }))),
      h("div", {}, h("div", { class: "small", style: "font-weight:600;margin-bottom:6px" }, "Color en la agenda"), palette),
      h("label", { class: "row", style: "display:flex;gap:10px" }, h("input", { id: "s-active", type: "checkbox", style: "width:22px;min-height:22px", checked: active }), "Disponible para nuevas citas"),
      msg, h("div", { class: "row" }, h("button", { class: "btn", onclick: save }, "Guardar servicio"), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }

  function screenCobros() { return h("div", {}, "Cobros"); }
  function screenPromos() { return h("div", {}, "Promociones"); }
  function screenResumen() { return h("div", {}, "Resumen"); }
  function chargeForm() { return h("div", {}, "Cobrar"); }

  /* ---------- cobros ---------- */
  function chargeForm(id) {
    const a0 = S.appts.find((x) => x.id === id);
    if (!a0) return h("div", {}, h("p", {}, "Esta cita ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const c = clientOf(a0.clientId) || { id: a0.clientId, name: "Clienta" };
    const visits = L.paidVisitCount(a0.clientId, S.appts);
    let quitado = false;
    const sub = h("input", { id: "p-sub", type: "number", min: "0", inputmode: "decimal", value: a0.price || "" });
    const adv = h("input", { id: "p-adv", type: "number", min: "0", inputmode: "decimal", value: a0.advance || "" });
    const method = h("select", { id: "p-method" }, h("option", { value: "efectivo" }, "Efectivo"), h("option", { value: "transferencia" }, "Transferencia"));
    const info = h("div", { class: "stack", "aria-live": "polite" });
    const msg = h("div", { "aria-live": "polite" });
    let cur = { discount: { kind: "ninguno", label: "Sin descuento", amount: 0 }, total: 0, balance: 0 };
    function recalc() {
      const subtotal = num(sub.value);
      const sug = L.suggestDiscount({ client: c, paidVisits: visits, promos: S.promos, settings: settings(), today: todayKey(), subtotal });
      const discount = quitado ? { kind: "ninguno", label: "Sin descuento", amount: 0 } : sug;
      const ch = L.computeCharge({ subtotal, discountAmount: discount.amount, advance: num(adv.value) });
      cur = { discount, ...ch };
      info.replaceChildren(
        sug.kind !== "ninguno" && h("div", { class: "note ok" }, quitado ? "Descuento quitado (" + sug.label + ")" : "Descuento sugerido: " + sug.label + " (−" + L.formatMXN(sug.amount) + ") ",
          h("button", { class: "btn small ghost", onclick: () => { quitado = !quitado; recalc(); } }, quitado ? "Aplicar descuento" : "Quitar descuento")),
        h("div", { class: "row between" }, h("span", {}, "Total"), h("span", { class: "big" }, L.formatMXN(ch.total))),
        h("div", { class: "row between muted" }, h("span", {}, "Saldo por cobrar tras el anticipo"), h("span", {}, L.formatMXN(ch.balance))));
    }
    sub.addEventListener("input", recalc); adv.addEventListener("input", recalc);
    recalc();
    async function cobrar() {
      msg.replaceChildren();
      const fresh = S.appts.find((x) => x.id === id);
      if (!fresh || fresh.status !== "pendiente") return msg.append(h("div", { class: "note" }, "Esta cita ya fue cobrada o cancelada."));
      if (!num(sub.value)) return msg.append(h("div", { class: "note" }, "Escribe el precio del servicio."));
      const doc = { ...fresh, status: "cobrada", subtotal: num(sub.value), advance: num(adv.value), total: cur.total, balance: cur.balance, method: method.value, discountKind: cur.discount.kind, discountAmount: cur.discount.amount, paidAt: todayKey() };
      if (await run(Store.save("appointments", doc), "Cobrado")) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "Cobrar a " + c.name), h("div", { class: "muted" }, a0.serviceName, " · ", visits, " visitas cobradas"),
      h("div", { class: "grid2" }, h("label", {}, "Precio del servicio", sub), h("label", {}, "Anticipo recibido", adv)),
      h("label", {}, "Método de pago", method), info, msg,
      h("div", { class: "row" }, h("button", { class: "btn", onclick: cobrar }, "Cobrar"), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function screenCobros() {
    const now = todayKey();
    const pend = S.appts.filter((a) => a.status === "pendiente" && a.start.slice(0, 10) <= now).sort(byStart);
    const done = S.appts.filter((a) => a.status === "cobrada").sort((a, b) => byStart(b, a)).slice(0, 20);
    return h("div", { class: "stack" }, h("h1", {}, "Cobros"),
      h("h3", {}, "Por cobrar"),
      pend.length ? h("div", { class: "list" }, pend.map(swatch)) : h("div", { class: "empty" }, h("p", {}, "No hay citas por cobrar. Las citas de hoy y de días pasados aparecen aquí.")),
      h("h3", {}, "Cobros recientes"),
      done.length ? h("div", { class: "list" }, done.map((a) => { const c = clientOf(a.clientId); return h("button", { class: "item", onclick: () => openSheet(() => apptDetail(a.id)) },
        h("span", {}, h("div", { class: "name" }, c ? c.name : "Clienta eliminada"), h("div", { class: "muted small" }, a.serviceName + " · " + dmy(a.paidAt || a.start.slice(0, 10)) + " · " + a.method + (a.discountAmount ? " · descuento " + L.formatMXN(a.discountAmount) : ""))),
        h("span", { class: "name" }, L.formatMXN(a.total))); }))
        : h("p", { class: "muted" }, "Todavía no hay cobros registrados."));
  }

  /* ---------- promociones y captación ---------- */
  function promoActiveToday(p) {
    const t = todayKey();
    return p.active && (p.type === "cumpleanos" || (p.startDate <= t && t <= p.endDate));
  }
  function screenPromos() {
    const tab = S.promoTab || "promos";
    return h("div", { class: "stack" },
      h("div", { class: "row between" },
        h("div", { class: "seg", role: "group", "aria-label": "Sección" },
          h("button", { "aria-pressed": String(tab === "promos"), onclick: () => { S.promoTab = "promos"; render(); } }, "Promociones"),
          h("button", { "aria-pressed": String(tab === "captacion"), onclick: () => { S.promoTab = "captacion"; render(); } }, "Captación")),
        tab === "promos" && h("button", { class: "btn", onclick: () => openSheet(() => promoForm()) }, "Nueva promoción")),
      tab === "promos" ? promoList() : outreach());
  }
  function saveSettings(patch, okMsg) { return run(Store.save("settings", { ...settings(), ...patch, id: "main" }), okMsg); }
  function promoList() {
    const st = settings();
    const loy = h("div", { class: "card stack" }, h("h3", {}, "Lealtad"), h("p", { class: "muted small", style: "margin:0" }, "Descuento automático en cierta visita cobrada de cada clienta."),
      h("div", { class: "grid2" },
        h("label", {}, "Cada cuántas visitas", h("input", { id: "l-every", type: "number", min: "0", value: st.loyaltyEvery })),
        h("label", {}, "Descuento (%)", h("input", { id: "l-pct", type: "number", min: "0", max: "100", value: st.loyaltyPercent }))),
      h("div", {}, h("button", { class: "btn sec", onclick: () => saveSettings({ loyaltyEvery: Math.max(0, Math.floor(Number(root.querySelector("#l-every").value) || 0)), loyaltyPercent: Math.min(100, Math.max(0, Number(root.querySelector("#l-pct").value) || 0)) }, "Lealtad guardada") }, "Guardar lealtad")));
    const rows = S.promos.slice().sort((a, b) => a.name.localeCompare(b.name));
    return h("div", { class: "stack" }, loy,
      rows.length ? h("div", { class: "list" }, rows.map((p) => h("div", { class: "card stack" },
        h("div", { class: "row between" }, h("div", {}, h("div", { class: "name", style: "font-weight:650" }, p.name), h("div", { class: "muted small" }, p.percent + "% · " + (p.type === "cumpleanos" ? "mes de cumpleaños" : dmy(p.startDate) + " al " + dmy(p.endDate)))),
          h("span", { class: "tag" }, promoActiveToday(p) ? "Activa hoy" : p.active ? "Programada" : "Apagada")),
        h("div", { class: "row" },
          h("button", { class: "btn small sec", onclick: () => openSheet(() => promoForm(p.id)) }, "Editar"),
          p.active && h("button", { class: "btn small ghost", onclick: async () => { try { await navigator.clipboard.writeText(L.promoText(p, "Nails Up")); toast("Texto copiado"); } catch (_) { openSheet(() => h("div", { class: "stack" }, h("h2", {}, "Texto de la promoción"), h("textarea", { readonly: true }, L.promoText(p, "Nails Up")), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"))); } } }, "Copiar texto")))))
        : h("div", { class: "empty" }, h("p", {}, "Aún no hay promociones de temporada ni de cumpleaños."), h("button", { class: "btn", onclick: () => openSheet(() => promoForm()) }, "Nueva promoción")));
  }
  function promoForm(id) {
    const p = id ? S.promos.find((x) => x.id === id) : { name: "", type: "temporada", percent: 10, startDate: todayKey(), endDate: addDays(todayKey(), 14), active: true };
    const msg = h("div", { "aria-live": "polite" });
    const tipo = h("select", { id: "pr-type" }, h("option", { value: "temporada", selected: p.type === "temporada" }, "Temporada (con fechas)"), h("option", { value: "cumpleanos", selected: p.type === "cumpleanos" }, "Cumpleaños"));
    const fechas = h("div", { class: "grid2", hidden: p.type === "cumpleanos" }, h("label", {}, "Desde", h("input", { id: "pr-from", type: "date", value: p.startDate || "" })), h("label", {}, "Hasta", h("input", { id: "pr-to", type: "date", value: p.endDate || "" })));
    tipo.addEventListener("change", () => { fechas.hidden = tipo.value === "cumpleanos"; });
    async function save() {
      msg.replaceChildren();
      const name = root.querySelector("#pr-name").value.trim(), percent = Number(root.querySelector("#pr-pct").value), type = tipo.value;
      const from = root.querySelector("#pr-from").value, to = root.querySelector("#pr-to").value;
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la promoción."));
      if (!(percent > 0 && percent <= 100)) return msg.append(h("div", { class: "note" }, "El descuento debe estar entre 1 y 100."));
      if (type === "temporada" && (!from || !to || to < from)) return msg.append(h("div", { class: "note" }, "Indica las fechas; la fecha final no puede ser antes de la inicial."));
      const doc = { ...(id ? p : {}), id, name, type, percent, active: root.querySelector("#pr-act").checked, ...(type === "temporada" ? { startDate: from, endDate: to } : { startDate: "", endDate: "" }) };
      if (await run(Store.save("promos", doc), "Promoción guardada")) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar promoción" : "Nueva promoción"),
      h("label", {}, "Nombre", h("input", { id: "pr-name", autocomplete: "off", value: p.name })),
      h("div", { class: "grid2" }, h("label", {}, "Tipo", tipo), h("label", {}, "Descuento (%)", h("input", { id: "pr-pct", type: "number", min: "1", max: "100", value: p.percent }))),
      fechas,
      h("label", { class: "row", style: "display:flex;gap:10px" }, h("input", { id: "pr-act", type: "checkbox", style: "width:22px;min-height:22px", checked: p.active !== false }), "Promoción activa"),
      msg, h("div", { class: "row" }, h("button", { class: "btn", onclick: save }, "Guardar promoción"), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function outreach() {
    const st = settings();
    const list = L.inactiveClients(S.clients, S.appts, todayKey(), st.inactiveWeeks);
    return h("div", { class: "stack" },
      h("div", { class: "card stack" }, h("h3", {}, "Clientas que no han vuelto"),
        h("div", { class: "row" }, h("label", { style: "flex:1" }, "Semanas sin venir", h("input", { id: "o-weeks", type: "number", min: "1", value: st.inactiveWeeks })),
          h("button", { class: "btn sec", onclick: () => saveSettings({ inactiveWeeks: Math.max(1, Math.floor(Number(root.querySelector("#o-weeks").value) || 5)) }, "Plazo guardado") }, "Guardar plazo"))),
      list.length ? h("div", { class: "list" }, list.map(({ client, weeksAway }) => { const link = L.whatsappLink(client.phone, L.reactivationMessage(client)); return h("div", { class: "item", style: "cursor:default" },
        h("span", {}, h("div", { class: "name" }, client.name), h("div", { class: "muted small" }, weeksAway + " semanas sin venir")),
        link ? h("a", { class: "btn small", href: link, target: "_blank", rel: "noopener", style: "text-decoration:none;display:inline-flex;align-items:center" }, "Escribir por WhatsApp") : h("span", { class: "muted small" }, "Sin teléfono")); }))
        : h("div", { class: "empty" }, h("p", {}, "Nadie lleva " + st.inactiveWeeks + " semanas o más sin venir.")));
  }

  /* ---------- resumen ---------- */
  function screenResumen() {
    const t = todayKey(), month = t.slice(0, 7);
    const paid = S.appts.filter((a) => a.status === "cobrada");
    const day = (a) => a.paidAt || a.start.slice(0, 10);
    const sum = (arr) => arr.reduce((n, a) => n + (a.total || 0), 0);
    const pendientes = apptsOn(t).filter((a) => a.status === "pendiente").length;
    const activas = S.promos.filter(promoActiveToday);
    return h("div", { class: "stack" }, h("h1", {}, "Resumen"),
      h("div", { class: "stats" },
        h("div", { class: "card stat" }, h("span", { class: "muted small" }, "Ingresos de hoy"), h("span", { class: "big" }, L.formatMXN(sum(paid.filter((a) => day(a) === t))))),
        h("div", { class: "card stat" }, h("span", { class: "muted small" }, "Ingresos del mes"), h("span", { class: "big" }, L.formatMXN(sum(paid.filter((a) => day(a).startsWith(month)))))),
        h("div", { class: "card stat" }, h("span", { class: "muted small" }, "Citas pendientes hoy"), h("span", { class: "big" }, pendientes))),
      h("h3", {}, "Promociones activas hoy"),
      activas.length ? h("div", { class: "list" }, activas.map((p) => h("div", { class: "item", style: "cursor:default" }, h("span", { class: "name" }, p.name), h("span", { class: "tag" }, p.percent + "%"))))
        : h("p", { class: "muted" }, "No hay promociones activas hoy."));
  }

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
    if (location.hash === "#demo") { db = demoDb(); window.__demoDb = db; }
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
