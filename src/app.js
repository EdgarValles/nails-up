// pantallas de Nails Up
(function () {
  const L = NailsLogic;
  const root = document.getElementById("app");
  const TONES = ["#D6459A", "#8E6BD1", "#B8924A", "#2F9C95", "#E0707A", "#5B6FD6"];
  const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  const ICONS = {
    agenda: ["M7 3v3M17 3v3M4 9.5h16", "M5.5 5.5h13a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19V7a1.5 1.5 0 0 1 1.5-1.5z"],
    clientas: ["M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M4.5 20c1.4-3.4 4.3-5 7.5-5s6.1 1.6 7.5 5"],
    servicios: ["M10 3h4v4h-4z", "M8.5 7h7l1.5 3.5V19a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-8.5z"],
    cobros: ["M3.5 6.5h17v11h-17z", "M12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z", "M7 9.5v.01M17 14.5v.01"],
    promos: ["M3.5 12V4.5a1 1 0 0 1 1-1H12l8.5 8.5-8.5 8.5z", "M8 8v.01"],
    resumen: ["M5 20v-8M12 20V5M19 20v-5M3 20h18"],
    salir: ["M14 4h3.5A1.5 1.5 0 0 1 19 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14", "M9.5 16.5 5 12l4.5-4.5M5 12h10"],
    mas: ["M12 5v14M5 12h14"],
    antes: ["M14.5 6l-6 6 6 6"],
    despues: ["M9.5 6l6 6-6 6"],
    buscar: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4"],
  };
  const SECCIONES = [["agenda", "Agenda"], ["clientas", "Clientas"], ["servicios", "Servicios"], ["cobros", "Cobros"], ["promos", "Promociones"], ["resumen", "Reportes"]];

  const S = {
    tab: "agenda", view: "dia", date: L.dateKey(new Date()),
    clients: [], services: [], appts: [], promos: [], settings: {}, blocks: [],
    sheet: null, toast: "", error: "", loading: true, clientTab: "clientas", clientQuery: "",
  };

  /* ---------- utilidades ---------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
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
  function icon(name) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("class", "ico");
    for (const d of ICONS[name]) { const p = document.createElementNS(NS, "path"); p.setAttribute("d", d); svg.append(p); }
    return svg;
  }
  const initials = (name) => String(name || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const STATUS = { pendiente: "Pendiente", cobrada: "Cobrada", cancelada: "Cancelada" };
  const chip = (status) => h("span", { class: "chip " + status }, STATUS[status] || status);
  const pageHead = (title, ...actions) => h("div", { class: "page-head" }, h("h1", {}, title), h("div", { class: "actions" }, actions));
  const nowMin = () => { const p = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Mexico_City", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date()).split(":"); return Number(p[0]) * 60 + Number(p[1]); };
  const todayKey = () => L.dateKey(new Date());
  const addDays = (key, n) => new Date(Date.parse(key + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);
  const weekday = (key) => new Date(key + "T00:00:00Z").getUTCDay();
  const dmy = (key) => key.slice(8, 10) + "/" + key.slice(5, 7) + "/" + key.slice(0, 4);
  const longDate = (key) => DIAS[weekday(key)] + " " + Number(key.slice(8, 10)) + "/" + key.slice(5, 7);
  const fullDate = (key) => DIAS[weekday(key)] + " " + Number(key.slice(8, 10)) + " de " + MESES[Number(key.slice(5, 7)) - 1];
  const hhmm = (min) => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
  const endOf = (a) => { const m = Number(a.start.slice(11, 13)) * 60 + Number(a.start.slice(14, 16)) + (Number(a.durationMin) || 30); return hhmm(m % 1440); };
  const timeOf = (a) => a.start.slice(11, 16);
  // "Manicure en gel + 2": funciona igual con citas viejas de un solo servicio
  const resumen = (a) => L.servicesSummary(L.apptServices(a)) || "Servicio";
  const byStart = (a, b) => a.start.localeCompare(b.start);
  const clientOf = (id) => S.clients.find((c) => c.id === id);
  const serviceOf = (id) => S.services.find((s) => s.id === id);
  const apptsOn = (key) => S.appts.filter((a) => a.start.slice(0, 10) === key).sort(byStart);
  const settings = () => ({ loyaltyEvery: 6, loyaltyPercent: 15, inactiveWeeks: 5, ...(S.settings.main || {}) });
  const hoursSetting = () => { const x = settings().hours; return Array.isArray(x) && x.length === 7 ? x : L.DEFAULT_HOURS; };
  const minOf = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
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
  // con msg (el aviso del formulario abierto) el error se ve dentro de la hoja; sin él, arriba de la pantalla
  function showError(e, msg) {
    const text = e && e.message ? e.message : "No se pudo guardar. Intenta de nuevo.";
    if (msg) msg.replaceChildren(h("div", { class: "note", role: "alert" }, text));
    else { S.error = text; render(); }
  }
  async function run(promise, okMsg, msg) {
    try { await promise; if (okMsg) toast(okMsg); return true; }
    catch (e) { showError(e, msg); return false; }
  }
  // botón que se bloquea mientras el servidor responde: un segundo clic no hace nada
  function busyBtn(attrs, label, handler, busyLabel = "Guardando…") {
    const kids = () => (Array.isArray(label) ? label : [label]);
    let busy = false;
    const btn = h("button", { ...attrs, onclick: async () => {
      if (busy) return;
      busy = true; btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.replaceChildren(busyLabel);
      try { await handler(); }
      finally { busy = false; btn.disabled = false; btn.removeAttribute("aria-busy"); btn.replaceChildren(...kids()); }
    } }, ...kids());
    return btn;
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
    const screens = { agenda: screenAgenda, clientas: screenClientas, servicios: screenServicios, cobros: screenCobros, promos: screenPromos, resumen: screenResumen };
    root.append(nav(),
      h("main", { class: "main" },
        h("div", { class: "topbar" }, h("span", { class: "brand" }, "Nails Up"),
          S.server && h("button", { class: "btn small ghost", onclick: logout }, icon("salir"), "Salir")),
        S.error && h("div", { class: "note", role: "alert" }, S.error + " ", h("button", { class: "btn small ghost", onclick: () => { S.error = ""; render(); } }, "Cerrar")),
        screens[S.tab]()));
    if (S.tab === "agenda") root.append(h("button", { class: "fab", "aria-label": "Nueva cita", onclick: () => openSheet(() => apptForm({ date: S.date })) }, icon("mas")));
    if (S.sheet) root.append(S.sheet);
    if (S.toast) root.append(h("div", { class: "toast", role: "status" }, S.toast));
    if (keep) { const el = root.querySelector('[data-keep="' + keep + '"]'); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch (_) {} } }
  }
  function nav() {
    const short = { promos: "Promos" };
    return h("nav", { class: "nav", "aria-label": "Secciones" },
      h("span", { class: "brand" }, "Nails Up"),
      h("ul", {}, SECCIONES.map(([id, label]) => h("li", {}, h("button", { "data-tab": id, "aria-current": S.tab === id ? "page" : null, onclick: () => { S.tab = id; render(); } },
        icon(id), h("span", { class: "lbl-largo" }, label), h("span", { class: "lbl-corto" }, short[id] || label))))),
      S.server && h("button", { class: "salir btn ghost", onclick: logout }, icon("salir"), "Salir"));
  }
  // la línea de "ahora" se mueve sola cada minuto sin volver a pintar la pantalla
  setInterval(() => {
    const line = root.querySelector(".now");
    if (line) line.style.setProperty("--t", String(nowMin() - Number(line.dataset.start)));
  }, 60000);

  /* ---------- agenda ---------- */
  function screenAgenda() {
    const isWeek = S.view === "semana";
    const step = isWeek ? 7 : 1;
    const start = isWeek ? addDays(S.date, -((weekday(S.date) + 6) % 7)) : S.date;
    const monday = addDays(S.date, -((weekday(S.date) + 6) % 7));
    const title = isWeek ? Number(start.slice(8, 10)) + " " + MESES[Number(start.slice(5, 7)) - 1].slice(0, 3) + " – " + Number(addDays(start, 6).slice(8, 10)) + " " + MESES[Number(addDays(start, 6).slice(5, 7)) - 1].slice(0, 3)
      : fullDate(S.date);
    return h("div", {},
      h("div", { class: "page-head" },
        h("div", { class: "datenav" },
          h("button", { class: "iconbtn", "aria-label": isWeek ? "Semana anterior" : "Día anterior", onclick: () => { S.date = addDays(S.date, -step); render(); } }, icon("antes")),
          h("button", { class: "btn small sec", onclick: () => { S.date = todayKey(); render(); } }, "Hoy"),
          h("button", { class: "iconbtn", "aria-label": isWeek ? "Semana siguiente" : "Día siguiente", onclick: () => { S.date = addDays(S.date, step); render(); } }, icon("despues")),
          h("h1", { "aria-live": "polite" }, title)),
        h("div", { class: "actions" },
          h("div", { class: "seg", role: "group", "aria-label": "Vista" },
            h("button", { "aria-pressed": String(!isWeek), onclick: () => { S.view = "dia"; render(); } }, "Día"),
            h("button", { "aria-pressed": String(isWeek), onclick: () => { S.view = "semana"; render(); } }, "Semana")),
          remindersButton(),
          h("button", { class: "btn small sec", onclick: () => openSheet(() => blockForm(S.date)) }, "Bloquear horario"),
          h("button", { class: "btn solo-ancho", onclick: () => openSheet(() => apptForm({ date: S.date })) }, icon("mas"), "Nueva cita"))),
      !isWeek && dayStrip(monday),
      h("div", { class: "agenda-wrap" },
        calendar(isWeek ? [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(start, i)) : [S.date]),
        !isWeek && dayPanel(S.date)));
  }
  // tira de la semana para el celular: cambia de día con un toque
  function dayStrip(monday) {
    return h("div", { class: "strip", role: "group", "aria-label": "Días de la semana" }, [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = addDays(monday, i), list = apptsOn(d).filter((a) => a.status !== "cancelada");
      return h("button", { class: d === todayKey() ? "hoy" : "", "aria-current": d === S.date ? "date" : null, "aria-label": fullDate(d) + ", " + list.length + " citas", onclick: () => { S.date = d; render(); } },
        h("span", { class: "dn" }, DIAS[weekday(d)].slice(0, 3)), h("span", { class: "num" }, Number(d.slice(8, 10))),
        h("span", { class: "marks" }, list.slice(0, 4).map((a) => h("i", { style: "--c:" + (a.serviceColor || TONES[0]) }))));
    }));
  }
  // cuadrícula de horas: una columna por día, cada cita mide lo que dura
  function calendar(days) {
    const hrs = hoursSetting(), range = L.agendaRange(hrs);
    const layouts = days.map((d) => L.layoutDay(apptsOn(d), range));
    const startMin = Math.min(...layouts.map((l) => l.startMin)), endMin = Math.max(...layouts.map((l) => l.endMin));
    const week = days.length > 1, today = todayKey();
    const hours = [];
    for (let m = startMin; m < endMin; m += 60) hours.push(h("span", { style: "top:calc(" + (m - startMin) + " * var(--ppm))" }, hhmm(m)));
    const cols = days.map((d, i) => {
      const lay = layouts[i];
      const col = h("div", { class: "col libre", "aria-label": "Agenda del " + fullDate(d), onclick: (e) => {
        if (e.target !== col) return;
        const y = e.offsetY / parseFloat(getComputedStyle(col).getPropertyValue("--ppm") || "1.2");
        const m = Math.max(startMin, Math.min(endMin - 30, startMin + Math.floor(y / 30) * 30));
        openSheet(() => apptForm({ date: d, time: hhmm(m) }));
      } },
        offHours(d, hrs, startMin, endMin),
        L.blocksOn(S.blocks, d).map((b) => blockTile(b, startMin, endMin)),
        lay.items.map((it) => apptBlock(it.appt, it.top + lay.startMin - startMin, it.height, it.lane, it.lanes)));
      if (d === today) {
        const n = nowMin();
        if (n >= startMin && n <= endMin) col.append(h("div", { class: "now", "data-start": String(startMin), style: "--t:" + (n - startMin) }));
      }
      return col;
    });
    return h("section", { class: "cal" + (week ? " semana" : ""), style: "--cols:" + days.length + ";--span:" + (endMin - startMin), "aria-label": week ? "Agenda de la semana" : "Agenda del día" },
      week && h("div", { class: "cal-head" }, h("span", {}), days.map((d) => h("button", { class: d === today ? "hoy" : "", "aria-label": "Ver " + fullDate(d), onclick: () => { S.date = d; S.view = "dia"; render(); } },
        h("span", { class: "dn" }, DIAS[weekday(d)].slice(0, 3)), h("span", { class: "num" }, Number(d.slice(8, 10))),
        !L.dayHours(hrs, d).open && h("span", { class: "descanso" }, "Descanso")))),
      h("div", { class: "cal-body" }, h("div", { class: "hours" }, hours), cols));
  }
  /* ---------- recordatorios de mañana ---------- */
  const tomorrowPending = () => apptsOn(addDays(todayKey(), 1)).filter((a) => a.status === "pendiente");
  function remindersButton() {
    const faltan = tomorrowPending().filter((a) => !a.remindedAt).length;
    return h("button", { class: "btn small sec", onclick: () => openSheet(remindersSheet) }, "Recordatorios" + (faltan ? " · " + faltan : ""));
  }
  function remindersSheet() {
    const manana = addDays(todayKey(), 1);
    const list = tomorrowPending();
    function fila(a) {
      const c = clientOf(a.clientId);
      const link = c && L.whatsappLink(c.phone, L.reminderMessage(c.name, timeOf(a)));
      const row = h("div", { class: "item recordatorio", style: "cursor:default" },
        h("span", {}, h("div", { class: "name" }, timeOf(a) + " · " + (c ? c.name : "Clienta eliminada")),
          h("div", { class: "muted small" }, resumen(a) + (a.remindedAt ? " · Recordada" : ""))),
        link ? h("a", { class: "btn small " + (a.remindedAt ? "ghost" : "sec"), href: link, target: "_blank", rel: "noopener",
          onclick: async () => {
            // relee del servidor: si en otro aparato la movieron o cancelaron, no se regresa a como estaba
            try { await Store.refresh("appointments"); } catch (_) {}
            const fresh = S.appts.find((x) => x.id === a.id);
            if (!fresh || fresh.status !== "pendiente") return msg.replaceChildren(h("div", { class: "note" }, "Esta cita cambió en otro aparato; cierra y vuelve a abrir los recordatorios."));
            const doc = { ...fresh, remindedAt: todayKey() };
            if (await run(Store.save("appointments", doc), "", msg)) row.replaceWith(fila(doc));
          } }, a.remindedAt ? "Enviar de nuevo" : "Enviar WhatsApp")
          : h("span", { class: "muted small" }, "Sin teléfono"));
      return row;
    }
    const msg = h("div", { "aria-live": "polite" });
    return h("div", { class: "stack" }, h("h2", {}, "Citas de mañana"), h("p", { class: "muted", style: "margin:0" }, fullDate(manana).replace(/^./, (x) => x.toUpperCase())),
      list.length ? h("div", { class: "list" }, list.map(fila)) : h("p", { class: "muted" }, "No hay citas pendientes para mañana."),
      msg, h("div", { class: "row" }, h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  // sombreado fuera de horario (no recibe toques: tocar ahí sigue creando cita)
  function offHours(d, hrs, startMin, endMin) {
    const dh = L.dayHours(hrs, d);
    const zona = (top, height, txt) => height > 0 && h("div", { class: "fuera", "aria-hidden": "true", style: "--t:" + top + ";--h:" + height }, txt || null);
    if (!dh.open) return [zona(0, endMin - startMin, "Descanso")];
    return [zona(0, minOf(dh.start) - startMin), zona(minOf(dh.end) - startMin, endMin - minOf(dh.end))];
  }
  function blockTile(b, startMin, endMin) {
    const top = b.allDay ? 0 : Math.max(0, minOf(b.start) - startMin);
    const bottom = b.allDay ? endMin - startMin : Math.min(endMin - startMin, minOf(b.end) - startMin);
    if (bottom <= top) return null;
    return h("button", { class: "bloqueo" + (bottom - top <= 30 ? " corto" : ""), style: "--t:" + top + ";--h:" + (bottom - top),
      "aria-label": "Bloqueo " + b.reason + (b.allDay ? ", todo el día" : ", " + b.start + " a " + b.end), onclick: () => openSheet(() => blockDetail(b.id)) },
      h("span", { class: "quien" }, b.reason), !b.allDay && h("span", { class: "t" }, b.start + "–" + b.end));
  }
  function blockForm(date) {
    const msg = h("div", { "aria-live": "polite" });
    const motivo = h("input", { id: "b-reason", autocomplete: "off", value: "Comida" });
    const fecha = h("input", { id: "b-date", type: "date", value: date });
    const todo = h("input", { id: "b-all", type: "checkbox" });
    const de = h("input", { id: "b-from", type: "time", value: "14:00" }), a = h("input", { id: "b-to", type: "time", value: "15:00" });
    const hasta = h("input", { id: "b-until", type: "date", value: date });
    const horas = h("div", { class: "grid2" }, h("label", {}, "De", de), h("label", {}, "A", a));
    const dias = h("label", { hidden: true }, "Hasta el día", hasta);
    todo.addEventListener("change", () => { horas.hidden = todo.checked; dias.hidden = !todo.checked; if (todo.checked && hasta.value < fecha.value) hasta.value = fecha.value; });
    let docId = "";
    async function guardar() {
      msg.replaceChildren();
      const reason = motivo.value.trim();
      if (!reason) return msg.append(h("div", { class: "note" }, "Escribe el motivo."));
      if (!fecha.value) return msg.append(h("div", { class: "note" }, "Elige la fecha."));
      let doc;
      if (todo.checked) {
        if (!hasta.value || hasta.value < fecha.value) return msg.append(h("div", { class: "note" }, "La fecha final no puede ser antes de la inicial."));
        doc = { date: fecha.value, endDate: hasta.value, allDay: true, start: "", end: "", reason };
      } else {
        if (!de.value || !a.value || a.value <= de.value) return msg.append(h("div", { class: "note" }, "La hora final debe ser después de la inicial."));
        doc = { date: fecha.value, endDate: fecha.value, allDay: false, start: de.value, end: a.value, reason };
      }
      if (!docId) docId = Store.newId("blocks");
      if (await run(Store.save("blocks", { id: docId, ...doc }), "Horario bloqueado", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "Bloquear horario"),
      h("label", {}, "Motivo", motivo), h("label", {}, "Fecha", fecha),
      h("label", { class: "check" }, todo, "Todo el día"), horas, dias,
      msg, h("div", { class: "row" }, busyBtn({ class: "btn" }, "Bloquear", guardar), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function blockDetail(id) {
    const b = S.blocks.find((x) => x.id === id);
    if (!b) return h("div", {}, h("p", {}, "Este bloqueo ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const msg = h("div", { "aria-live": "polite" });
    const cuando = b.allDay ? (b.endDate && b.endDate !== b.date ? "Del " + dmy(b.date) + " al " + dmy(b.endDate) + ", todo el día" : dmy(b.date) + ", todo el día") : dmy(b.date) + " de " + b.start + " a " + b.end;
    return h("div", { class: "stack" }, h("h2", {}, b.reason), h("p", { class: "muted" }, cuando),
      msg, h("div", { class: "row" },
        busyBtn({ class: "btn danger" }, "Eliminar bloqueo", async () => { if (await run(Store.remove("blocks", id), "Bloqueo eliminado", msg)) closeSheet(); }, "Eliminando…"),
        h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function apptBlock(a, top, height, lane, lanes) {
    const c = clientOf(a.clientId);
    const color = a.serviceColor || (serviceOf(a.serviceId) || {}).color || TONES[0];
    const name = c ? c.name : "Clienta eliminada";
    return h("button", { class: "appt " + a.status + (height <= 30 ? " corto" : "") + (lanes > 1 ? " angosto" : ""), style: "--c:" + color + ";--t:" + top + ";--h:" + height + ";--lane:" + lane + ";--lanes:" + lanes,
      "aria-label": timeOf(a) + " a " + endOf(a) + ", " + name + ", " + resumen(a) + ", " + (STATUS[a.status] || a.status),
      onclick: () => openSheet(() => apptDetail(a.id)) },
      h("span", { class: "t" }, timeOf(a), h("span", { class: "fin" }, "–" + endOf(a))),
      h("span", { class: "quien" }, name),
      height >= 45 && h("span", { class: "que" }, resumen(a)),
      a.status !== "pendiente" && chip(a.status));
  }
  // panel del día: cuánto hay, cuánto se cobró y quién sigue
  function dayPanel(key) {
    const list = apptsOn(key).filter((a) => a.status !== "cancelada");
    const cobradas = list.filter((a) => a.status === "cobrada");
    const pend = list.filter((a) => a.status === "pendiente");
    const total = cobradas.reduce((n, a) => n + (a.total || 0), 0);
    const isToday = key === todayKey(), n = nowMin();
    const next = pend.filter((a) => !isToday || Number(a.start.slice(11, 13)) * 60 + Number(a.start.slice(14, 16)) + (Number(a.durationMin) || 30) > n).slice(0, 5);
    return h("aside", { class: "panel", "aria-label": "Resumen del día" },
      h("h2", {}, isToday ? "Hoy" : fullDate(key).replace(/^./, (x) => x.toUpperCase())),
      h("div", { class: "kpis" },
        h("div", { class: "kpi" }, h("b", {}, list.length), h("span", {}, list.length === 1 ? "cita" : "citas")),
        h("div", { class: "kpi" }, h("b", {}, L.formatMXN(total).replace(/\.00$/, "")), h("span", {}, "cobrado")),
        h("div", { class: "kpi" }, h("b", {}, pend.length), h("span", {}, "por cobrar"))),
      h("div", { class: "next" }, h("h3", {}, isToday ? "Siguientes" : "Pendientes"),
        next.length ? next.map((a) => { const c = clientOf(a.clientId); return h("button", { onclick: () => openSheet(() => apptDetail(a.id)) },
          h("span", { class: "t" }, timeOf(a)), h("span", {}, h("div", {}, c ? c.name : "Clienta eliminada"), h("div", { class: "muted small" }, resumen(a)))); })
          : h("p", { class: "muted small", style: "margin:4px 0 0" }, list.length ? "No quedan citas pendientes." : "Sin citas. Toca un horario libre para agendar.")));
  }
  // renglón de cita para listas (por cobrar, historial)
  function apptRow(a) {
    const c = clientOf(a.clientId);
    return h("button", { class: "item row-appt", style: "--c:" + (a.serviceColor || TONES[0]), onclick: () => openSheet(() => apptDetail(a.id)) },
      h("span", { class: "t" }, dmy(a.start.slice(0, 10)).slice(0, 5), h("br"), timeOf(a)),
      h("span", { class: "bar" }),
      h("span", {}, h("div", { class: "name" }, c ? c.name : "Clienta eliminada"), h("div", { class: "muted small" }, resumen(a))),
      chip(a.status));
  }

  /* ---------- lista de servicios de una cita (al agendar y al cobrar) ---------- */
  function servicesEditor({ lines, editablePrice, onChange }) {
    const list = lines.map((l) => ({ ...l }));
    const box = h("div", { class: "svc-lines" });
    const add = h("select", { "aria-label": "Agregar servicio" });
    const changed = () => onChange(list.map((l) => ({ ...l })));
    const fillAdd = () => add.replaceChildren(h("option", { value: "" }, "Agregar servicio"),
      ...S.services.filter((v) => v.active !== false).sort((a, b) => a.name.localeCompare(b.name))
        .map((v) => h("option", { value: v.id }, v.name + (v.price ? " · " + L.formatMXN(v.price) : ""))));
    function paintLines() {
      box.replaceChildren(...(list.length ? list.map((l, i) => {
        const unit = !!l.unitLabel, max = Number(l.maxUnits) || 99;
        const t = L.lineTotal(l);
        const sub = h("span", { class: "muted small" }), total = h("span", { class: "svc-price" });
        // al escribir el precio solo se repinta esta línea, para no perder el cursor
        const pintaLinea = () => {
          const x = L.lineTotal(list[i]);
          sub.textContent = (unit ? L.unitText(x.qty, l.unitLabel) + " × " + L.formatMXN(list[i].price) + " · " : "") + L.formatDuration(x.durationMin);
          total.textContent = x.price ? L.formatMXN(x.price) : "";
        };
        pintaLinea();
        const precio = editablePrice && h("input", { class: "svc-price", type: "number", min: "0", inputmode: "decimal", placeholder: "0",
          "aria-label": (unit ? "Precio por " + l.unitLabel + " de " : "Precio de ") + l.name, value: l.price || "",
          oninput: (e) => { list[i].price = num(e.target.value); pintaLinea(); changed(); } });
        const plural = unit ? L.unitText(2, l.unitLabel).slice(2) : "";
        const paso = (d) => { list[i].qty = Math.min(max, Math.max(1, t.qty + d)); paintLines(); changed(); };
        const cant = unit && h("div", { class: "qty", role: "group", "aria-label": "Cantidad de " + plural },
          h("button", { type: "button", class: "iconbtn", "aria-label": "Menos " + plural, disabled: t.qty <= 1, onclick: () => paso(-1) }, "−"),
          h("span", { class: "qty-n" }, String(t.qty)),
          h("button", { type: "button", class: "iconbtn", "aria-label": "Más " + plural, disabled: t.qty >= max, onclick: () => paso(1) }, "+"));
        const enColumna = editablePrice && !unit ? precio : total;
        return h("div", { class: "svc-line" },
          h("span", { class: "dotc", style: "background:" + (l.color || TONES[0]) }),
          h("span", { class: "svc-name" }, h("span", {}, l.name), sub),
          enColumna,
          h("button", { type: "button", class: "btn small ghost", "aria-label": "Quitar " + l.name, onclick: () => { list.splice(i, 1); paintLines(); changed(); } }, "Quitar"),
          unit && h("div", { class: "svc-extra" }, cant, editablePrice && h("label", { class: "svc-precio-lbl" }, "Precio por " + l.unitLabel, precio)));
      }) : [h("p", { class: "muted small" }, "Sin servicios todavía.")]));
    }
    add.addEventListener("change", () => {
      const v = serviceOf(add.value);
      add.value = "";
      if (!v) return;
      list.push(L.serviceLine(v)); paintLines(); changed();
    });
    fillAdd(); paintLines();
    return { el: h("div", { class: "stack svc-editor" }, box, add), getLines: () => list.map((l) => ({ ...l })) };
  }

  /* ---------- formulario de cita ---------- */
  function apptForm(init, existing) {
    if (init && init.clientId && !existing) init = { ...init };
    const f = existing ? { ...existing, date: existing.start.slice(0, 10), time: existing.start.slice(11, 16) } : { date: init.date, time: init.time || "10:00", clientId: init.clientId || "", serviceId: "", notes: "", advance: "", durationMin: "" };
    let warn = "";
    const clientSel = h("select", { id: "f-client" }, h("option", { value: "" }, "Elige una clienta"),
      S.clients.slice().sort((a, b) => a.name.localeCompare(b.name)).map((c) => h("option", { value: c.id, selected: c.id === f.clientId }, c.name)),
      h("option", { value: "__new" }, "+ Nueva clienta"));
    const newBox = h("div", { class: "grid2", hidden: true },
      h("label", {}, "Nombre", h("input", { id: "f-nn", autocomplete: "off" })),
      h("label", {}, "Teléfono", h("input", { id: "f-np", inputmode: "tel", autocomplete: "off" })));
    clientSel.addEventListener("change", () => { newBox.hidden = clientSel.value !== "__new"; });
    // aviso informativo de clientas que cancelan seguido; no impide guardar
    const tendBox = h("div", { "aria-live": "polite" });
    const pintaTendencia = () => {
      const c = !existing && clientOf(clientSel.value);
      const t = c && L.cancelTendency(c.id, S.appts);
      tendBox.replaceChildren(t ? h("div", { class: "note" }, c.name.split(" ")[0] + " canceló " + t.canceladas + " de sus últimas " + t.total + " citas" + (t.noLlego ? " (" + t.noLlego + " sin llegar)." : ".")) : "");
    };
    clientSel.addEventListener("change", pintaTendencia);
    pintaTendencia();
    const lines0 = existing ? L.apptServices(existing) : (init && init.lines) || [];
    const dur = h("input", { id: "f-dur", type: "number", min: "5", step: "5", value: f.durationMin });
    // la duración es la suma de los servicios hasta que la cambias a mano
    let durManual = !!existing && Number(existing.durationMin) !== L.servicesTotals(lines0).durationMin;
    const sugerido = h("span", { class: "muted small", "aria-live": "polite" });
    const usarSugerido = h("button", { type: "button", class: "btn small ghost", hidden: !durManual }, "Usar sugerido");
    let sumaDur = 0;
    dur.addEventListener("input", () => { durManual = true; usarSugerido.hidden = false; });
    usarSugerido.addEventListener("click", () => { durManual = false; usarSugerido.hidden = true; dur.value = sumaDur || ""; });
    const estimado = h("div", { class: "muted small", "aria-live": "polite" });
    const pintaEstimado = (lines) => {
      const t = L.servicesTotals(lines);
      estimado.textContent = lines.length ? "Total estimado: " + (t.price ? L.formatMXN(t.price) + " · " : "") + L.formatDuration(t.durationMin) : "";
      sumaDur = t.durationMin;
      sugerido.textContent = lines.length ? "Sugerido: " + L.formatDuration(t.durationMin) + ", según los servicios" : "";
      if (!durManual) dur.value = lines.length ? t.durationMin : "";
    };
    const editor = servicesEditor({ lines: lines0, editablePrice: false, onChange: pintaEstimado });
    pintaEstimado(lines0);
    const msg = h("div", { "aria-live": "polite" });

    // ids fijos para este formulario: un reintento sobrescribe en lugar de duplicar
    let saving = false, idClienta = "", idCita = existing ? existing.id : "";
    async function save(force) {
      if (saving) return;
      saving = true;
      try { await saveAppt(force); } finally { saving = false; }
    }
    async function saveAppt(force) {
      msg.replaceChildren();
      let clientId = clientSel.value;
      const lines = editor.getLines();
      const date = root.querySelector("#f-date").value, time = root.querySelector("#f-time").value;
      if (!clientId) return msg.append(h("div", { class: "note" }, "Elige una clienta o crea una nueva."));
      if (!lines.length) return msg.append(h("div", { class: "note" }, "Agrega al menos un servicio."));
      if (!date || !time) return msg.append(h("div", { class: "note" }, "Indica fecha y hora."));
      if (clientId === "__new") {
        const name = root.querySelector("#f-nn").value.trim(), phone = root.querySelector("#f-np").value;
        if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la clienta."));
        if (!idClienta) idClienta = Store.newId("clients");
        const dup = L.findClientByPhone(S.clients.filter((x) => x.id !== idClienta), phone);
        if (dup) return msg.append(h("div", { class: "note" }, "Ya existe " + dup.name + " con ese teléfono. Elígela en la lista."));
        if (!clientOf(idClienta)) {
          try { await Store.save("clients", { id: idClienta, name, phone, canal: "whatsapp", birthday: "", notes: "" }); }
          catch (e) { return showError(e, msg); }
        }
        clientId = idClienta;
      }
      const appt = L.withServices({
        ...(existing || {}), id: idCita || (idCita = Store.newId("appointments")),
        clientId, start: date + "T" + time, durationMin: Number(dur.value) || L.servicesTotals(lines).durationMin || 30,
        notes: root.querySelector("#f-notes").value.trim(), advance: num(root.querySelector("#f-adv").value),
        status: existing ? existing.status : "pendiente",
      }, lines);
      if (existing && existing.start !== appt.start) delete appt.remindedAt;
      if (!force) {
        const avisos = [];
        const clash = S.appts.find((o) => o.id !== appt.id && o.status !== "cancelada" && L.appointmentsOverlap(o, appt));
        if (clash) {
          const who = clientOf(clash.clientId);
          avisos.push("Se empalma con la cita de " + (who ? who.name : "otra clienta") + " a las " + timeOf(clash) + ".");
        }
        avisos.push(...L.scheduleWarnings(appt, { hours: hoursSetting(), blocks: S.blocks }));
        if (avisos.length) return msg.append(h("div", { class: "note stack" }, avisos.map((t) => h("div", {}, t)),
          h("div", {}, busyBtn({ class: "btn small ghost" }, "Guardar de todos modos", () => save(true)))));
      }
      if (await run(Store.save("appointments", appt), "Cita guardada", msg)) { S.date = date; closeSheet(); }
    }
    return h("div", { class: "stack" }, h("h2", {}, existing ? "Editar cita" : "Nueva cita"),
      h("label", {}, "Clienta", clientSel), tendBox, newBox,
      h("div", { class: "stack campo" }, h("span", { class: "lbl" }, "Servicios"), editor.el, estimado),
      h("div", { class: "grid2" }, h("label", {}, "Fecha", h("input", { id: "f-date", type: "date", value: f.date }), !existing && init && init.hint && h("span", { class: "muted small", style: "font-weight:400" }, init.hint)), h("label", {}, "Hora", h("input", { id: "f-time", type: "time", value: f.time }))),
      h("label", {}, "Anticipo recibido", h("input", { id: "f-adv", type: "number", min: "0", inputmode: "decimal", value: f.advance || "" })),
      h("div", { class: "stack campo" }, h("label", {}, "Duración (min)", dur), h("div", { class: "row sugerido" }, sugerido, usarSugerido)),
      h("label", {}, "Notas del diseño", h("textarea", { id: "f-notes" }, f.notes || "")),
      msg,
      h("div", { class: "row" }, busyBtn({ class: "btn" }, "Guardar cita", () => save(false)), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }

  /* ---------- detalle de cita ---------- */
  function apptDetail(id) {
    const a = S.appts.find((x) => x.id === id);
    if (!a) return h("div", {}, h("p", {}, "Esta cita ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const c = clientOf(a.clientId);
    const wa = c ? L.whatsappLink(c.phone, "Hola " + c.name.split(" ")[0] + ", te confirmo tu cita en Nails Up el " + dmy(a.start.slice(0, 10)) + " a las " + timeOf(a) + ".") : "";
    const pend = a.status === "pendiente";
    const fila = (k, v) => h("div", {}, h("dt", {}, k), h("dd", {}, v));
    return h("div", { class: "stack detalle" },
      h("div", { class: "row between" }, h("h2", {}, c ? c.name : "Clienta eliminada"), chip(a.status)),
      h("dl", { class: "dl" },
        fila("Servicios", h("div", { class: "svc-detalle" }, L.apptServices(a).map((l) => h("div", { class: "row between" },
          h("span", {}, h("span", { class: "dotc", style: "background:" + (l.color || TONES[0]) }), l.name + (l.unitLabel ? " · " + L.unitText(L.lineTotal(l).qty, l.unitLabel) : "")),
          L.lineTotal(l).price ? h("span", {}, L.formatMXN(L.lineTotal(l).price)) : null)))),
        fila("Fecha", fullDate(a.start.slice(0, 10)).replace(/^./, (x) => x.toUpperCase())),
        fila("Hora", timeOf(a) + " a " + endOf(a) + " (" + a.durationMin + " min)"),
        a.status === "cobrada" ? fila("Cobrado", L.formatMXN(a.total) + " · " + a.method) : null,
        a.advance ? fila(a.advanceKept === true ? "Anticipo retenido" : a.advanceKept === false ? "Anticipo devuelto" : "Anticipo", L.formatMXN(a.advance)) : null,
        a.notes ? fila("Notas", a.notes) : null,
        L.cancelKind(a) ? fila("Cancelación", L.cancelKind(a) === "no_llego" ? "No llegó" : "Canceló con aviso") : null,
        L.cancelKind(a) && a.cancelReason ? fila("Motivo", a.cancelReason) : null),
      pend && h("button", { class: "btn", onclick: () => openSheet(() => chargeForm(a.id)) }, icon("cobros"), "Cobrar"),
      pend && h("div", { class: "grid2" },
        h("button", { class: "btn sec", onclick: () => openSheet(() => apptForm({}, a)) }, "Editar cita"),
        wa ? h("a", { class: "btn sec", href: wa, target: "_blank", rel: "noopener" }, "Confirmar por WhatsApp") : h("span", {})),
      h("div", { class: "row between" },
        pend ? h("button", { class: "btn small ghost peligro", onclick: () => openSheet(() => confirmCancel(a.id)) }, "Cancelar cita") : h("span", {}),
        h("button", { class: "btn small ghost", onclick: closeSheet }, "Cerrar")),
      L.canDeleteAppointment(a) && h("div", { class: "zona-borrar" },
        h("button", { class: "btn small ghost peligro", onclick: () => openSheet(() => confirmDeleteAppt(a.id)) }, "Eliminar cita")));
  }
  // solo para errores de captura: una cancelación real se registra con Cancelar cita
  function confirmDeleteAppt(id) {
    const msg = h("div", { "aria-live": "polite" });
    async function eliminar() {
      const a = S.appts.find((x) => x.id === id);
      if (!a || !L.canDeleteAppointment(a)) return msg.replaceChildren(h("div", { class: "note" }, "Esta cita ya fue cobrada y no se puede eliminar."));
      if (await run(Store.remove("appointments", id), "Cita eliminada", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "¿Eliminar esta cita?"),
      h("p", { class: "muted" }, "Solo para citas capturadas por error. Si la clienta canceló, usa Cancelar cita para que quede en su historial."),
      msg, h("div", { class: "row" },
        busyBtn({ class: "btn danger" }, "Sí, eliminar", eliminar, "Eliminando…"),
        h("button", { class: "btn ghost", onclick: () => openSheet(() => apptDetail(id)) }, "Volver")));
  }
  function confirmCancel(id) {
    const msg = h("div", { "aria-live": "polite" });
    const opcion = (value, text) => h("label", { class: "check" }, h("input", { type: "radio", name: "cancel-kind", value }), text);
    const motivo = h("textarea", { id: "cancel-reason" });
    const a0 = S.appts.find((x) => x.id === id);
    const anticipo = a0 && Number(a0.advance) > 0 ? Number(a0.advance) : 0;
    const opcionAnt = (value, text) => h("label", { class: "check" }, h("input", { type: "radio", name: "advance-kept", value }), text);
    async function cancelar() {
      msg.replaceChildren();
      const sel = root.querySelector('input[name="cancel-kind"]:checked');
      if (!sel) return msg.append(h("div", { class: "note" }, "Elige qué pasó: si avisó o si no llegó."));
      const ant = root.querySelector('input[name="advance-kept"]:checked');
      if (anticipo && !ant) return msg.append(h("div", { class: "note" }, "Elige qué pasó con el anticipo."));
      const fresh = S.appts.find((x) => x.id === id);
      if (!fresh || fresh.status !== "pendiente") return msg.append(h("div", { class: "note" }, "Esta cita ya fue cobrada o cancelada."));
      const doc = { ...fresh, status: "cancelada", cancelKind: sel.value, cancelReason: motivo.value.trim(), cancelledAt: todayKey() };
      if (Number(fresh.advance) > 0 && ant) doc.advanceKept = ant.value === "si";
      if (await run(Store.save("appointments", doc), "Cita cancelada", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "¿Cancelar esta cita?"), h("p", { class: "muted" }, "La cita queda en el historial como cancelada y no cuenta como visita."),
      h("fieldset", { class: "stack opciones" }, h("legend", {}, "¿Qué pasó?"), opcion("aviso", "Avisó que no viene"), opcion("no_llego", "No llegó")),
      h("label", {}, "Motivo (opcional)", motivo),
      anticipo > 0 && h("fieldset", { class: "stack opciones" }, h("legend", {}, "¿Qué pasó con el anticipo de " + L.formatMXN(anticipo) + "?"),
        opcionAnt("si", "Me lo quedo"), opcionAnt("no", "Lo devolví")),
      msg, h("div", { class: "row" },
        busyBtn({ class: "btn danger" }, "Sí, cancelar cita", cancelar),
        h("button", { class: "btn ghost", onclick: () => openSheet(() => apptDetail(id)) }, "Volver")));
  }

  /* ---------- clientas y servicios ---------- */
  function screenClientas() {
    return h("div", {},
      pageHead("Clientas", h("button", { class: "btn", onclick: () => openSheet(() => clientForm()) }, icon("mas"), "Nueva clienta")),
      clientList());
  }
  function screenServicios() {
    const tab = S.servTab || "servicios";
    return h("div", {},
      pageHead("Servicios y precios",
        h("div", { class: "seg", role: "group", "aria-label": "Sección" },
          h("button", { "aria-pressed": String(tab === "servicios"), onclick: () => { S.servTab = "servicios"; render(); } }, "Servicios"),
          h("button", { "aria-pressed": String(tab === "horario"), onclick: () => { S.servTab = "horario"; render(); } }, "Horario")),
        tab === "servicios" && h("button", { class: "btn", onclick: () => openSheet(() => serviceForm()) }, icon("mas"), "Nuevo servicio")),
      tab === "servicios" ? serviceList() : hoursSummary());
  }
  // resumen del horario en la pestaña; se edita en una hoja para que un repintado no borre lo escrito
  function hoursSummary() {
    const cur = hoursSetting();
    return h("div", { class: "card stack" }, h("h3", {}, "Horario de trabajo"),
      h("div", { class: "tabla" }, [1, 2, 3, 4, 5, 6, 0].map((d) => h("div", { class: "tabla-fila" },
        h("span", {}, DIAS[d].replace(/^./, (c) => c.toUpperCase())), h("span", {}),
        h("span", { class: cur[d].open ? "num" : "muted" }, cur[d].open ? cur[d].start + " a " + cur[d].end : "Descanso")))),
      h("div", {}, h("button", { class: "btn", onclick: () => openSheet(hoursForm) }, "Editar horario")));
  }
  // horario por día de la semana (empieza en lunes); se guarda en la configuración
  function hoursForm() {
    const cur = hoursSetting();
    const orden = [1, 2, 3, 4, 5, 6, 0];
    const filas = orden.map((d) => {
      const x = cur[d];
      const abierto = h("input", { type: "checkbox", checked: !!x.open, "aria-label": "Abierto el " + DIAS[d] });
      const de = h("input", { type: "time", value: x.start, "aria-label": "Abre el " + DIAS[d] }), a = h("input", { type: "time", value: x.end, "aria-label": "Cierra el " + DIAS[d] });
      return { d, abierto, de, a, el: h("div", { class: "hora-dia" }, h("label", { class: "check" }, abierto, DIAS[d].replace(/^./, (c) => c.toUpperCase())), de, a) };
    });
    const msg = h("div", { "aria-live": "polite" });
    async function guardar() {
      msg.replaceChildren();
      const hours = [0, 1, 2, 3, 4, 5, 6].map(() => null);
      for (const f of filas) {
        if (f.abierto.checked && (!f.de.value || !f.a.value || f.a.value <= f.de.value)) return msg.append(h("div", { class: "note" }, "Revisa el horario del " + DIAS[f.d] + ": la hora de inicio debe ser antes que la de cierre."));
        hours[f.d] = { open: f.abierto.checked, start: f.de.value || "08:00", end: f.a.value || "18:00" };
      }
      if (await run(Store.save("settings", { ...settings(), hours, id: "main" }), "Horario guardado", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "Horario de trabajo"),
      h("p", { class: "muted small", style: "margin:0" }, "Fuera de este horario la agenda se ve sombreada y te avisa al agendar, pero sí te deja guardar."),
      h("div", { class: "horario" }, filas.map((f) => f.el)), msg,
      h("div", { class: "row" }, busyBtn({ class: "btn" }, "Guardar horario", guardar), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function clientList() {
    const q = S.clientQuery.trim().toLowerCase();
    const qd = L.normalizePhone(S.clientQuery);
    const list = S.clients.filter((c) => !q || c.name.toLowerCase().includes(q) || (qd && L.normalizePhone(c.phone) === qd) || String(c.phone || "").includes(q))
      .sort((a, b) => a.name.localeCompare(b.name));
    return h("div", { class: "stack" },
      h("div", { class: "search" }, icon("buscar"), h("input", { type: "search", placeholder: "Buscar por nombre o teléfono", "aria-label": "Buscar clienta", "data-keep": "q", value: S.clientQuery, oninput: (e) => { S.clientQuery = e.target.value; render(); } })),
      list.length ? h("div", { class: "list" }, list.map((c) => { const v = L.paidVisitCount(c.id, S.appts); return h("button", { class: "item", onclick: () => openSheet(() => clientCard(c.id)) },
        h("span", { class: "who" }, h("span", { class: "avatar", "aria-hidden": "true" }, initials(c.name)), h("span", {}, h("div", { class: "name" }, c.name), h("div", { class: "muted small" }, c.phone || "Sin teléfono"))),
        h("span", { class: "muted small" }, v === 1 ? "1 visita" : v + " visitas")); }))
        : h("div", { class: "empty" }, h("p", {}, S.clients.length ? "No hay clientas con esa búsqueda." : "Aún no hay clientas. Agrega la primera."), !S.clients.length && h("button", { class: "btn", onclick: () => openSheet(() => clientForm()) }, "Nueva clienta")));
  }
  function clientCard(id) {
    const c = clientOf(id);
    if (!c) return h("div", {}, h("p", {}, "Esta clienta ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const visits = L.paidVisitCount(c.id, S.appts);
    const hist = S.appts.filter((a) => a.clientId === c.id).sort((a, b) => byStart(b, a));
    const wa = L.whatsappLink(c.phone, "Hola " + c.name.split(" ")[0] + ", ");
    const st = settings();
    const cs = L.cancelStats(c.id, S.appts);
    return h("div", { class: "stack" }, h("h2", {}, c.name),
      h("div", { class: "muted" }, c.phone || "Sin teléfono", c.birthday ? " · cumpleaños " + c.birthday.slice(3, 5) + "/" + c.birthday.slice(0, 2) : "", " · ", visits, " visitas cobradas",
        cs.aviso ? " · " + cs.aviso + (cs.aviso === 1 ? " cancelación" : " cancelaciones") : "",
        cs.noLlego ? " · " + cs.noLlego + " no llegó" : ""),
      st.loyaltyEvery > 0 && h("div", { class: "note ok" }, "Le faltan " + (st.loyaltyEvery - (visits % st.loyaltyEvery)) + " visitas para su descuento de lealtad."),
      c.notes && h("div", {}, c.notes),
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => openSheet(() => apptForm({ date: todayKey() , clientId: c.id }, null, c.id)) }, "Nueva cita"),
        h("button", { class: "btn sec", onclick: () => openSheet(() => clientForm(c.id)) }, "Editar clienta"),
        wa && h("a", { class: "btn sec", href: wa, target: "_blank", rel: "noopener", style: "text-decoration:none;display:inline-flex;align-items:center" }, "Abrir WhatsApp"),
        h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")),
      h("h3", {}, "Historial"),
      hist.length ? h("div", { class: "list" }, hist.map((a) => h("div", { class: "item", style: "cursor:default" },
        h("span", {}, h("div", { class: "name" }, resumen(a)), h("div", { class: "muted small" }, dmy(a.start.slice(0, 10)) + " " + timeOf(a)),
          L.cancelKind(a) && a.cancelReason ? h("div", { class: "muted small" }, a.cancelReason) : null,
          L.cancelKind(a) && Number(a.advance) > 0 && typeof a.advanceKept === "boolean" ? h("div", { class: "muted small" }, (a.advanceKept ? "Anticipo retenido " : "Anticipo devuelto ") + L.formatMXN(a.advance)) : null),
        h("span", { class: "tag" }, a.status === "cobrada" ? L.formatMXN(a.total) : L.cancelKind(a) === "no_llego" ? "No llegó" : L.cancelKind(a) ? "Canceló" : a.status))))
        : h("p", { class: "muted" }, "Todavía no tiene citas."),
      h("div", { class: "zona-borrar" },
        h("button", { class: "btn small ghost peligro", onclick: () => openSheet(() => confirmDeleteClient(c.id)) }, "Eliminar clienta")));
  }
  // sus citas se conservan (muestran "Clienta eliminada"); con citas pendientes no se deja borrar
  function confirmDeleteClient(id) {
    const c = clientOf(id);
    const volver = () => openSheet(() => clientCard(id));
    if (!c) return h("div", {}, h("p", {}, "Esta clienta ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const r = L.canDeleteClient(id, S.appts);
    if (!r.ok) return h("div", { class: "stack" }, h("h2", {}, "No se puede eliminar a " + c.name),
      h("p", {}, r.pendientes === 1 ? "Tiene 1 cita pendiente; cobra o cancela esa cita primero." : "Tiene " + r.pendientes + " citas pendientes; cobra o cancela esas citas primero."),
      h("div", { class: "row" }, h("button", { class: "btn ghost", onclick: volver }, "Volver")));
    const msg = h("div", { "aria-live": "polite" });
    async function eliminar() {
      const ahora = L.canDeleteClient(id, S.appts);
      if (!ahora.ok) return msg.replaceChildren(h("div", { class: "note" }, "Tiene citas pendientes; cobra o cancela esas citas primero."));
      if (await run(Store.remove("clients", id), "Clienta eliminada", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, "¿Eliminar a " + c.name + "?"),
      h("p", { class: "muted" }, r.historial === 0 ? "No tiene citas." : r.historial === 1 ? "Su cita del historial se conserva." : "Sus " + r.historial + " citas del historial se conservan."),
      msg, h("div", { class: "row" },
        busyBtn({ class: "btn danger" }, "Sí, eliminar", eliminar, "Eliminando…"),
        h("button", { class: "btn ghost", onclick: volver }, "No")));
  }
  function clientForm(id) {
    const c = id ? clientOf(id) : { name: "", phone: "", birthday: "", canal: "whatsapp", notes: "" };
    const msg = h("div", { "aria-live": "polite" });
    const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
    const mes = h("select", { id: "c-mes" }, h("option", { value: "" }, "Mes"), meses.map((m, i) => h("option", { value: String(i + 1).padStart(2, "0"), selected: c.birthday && c.birthday.slice(0, 2) === String(i + 1).padStart(2, "0") }, m)));
    const dia = h("input", { id: "c-dia", type: "number", min: "1", max: "31", inputmode: "numeric", placeholder: "Día", value: c.birthday ? Number(c.birthday.slice(3, 5)) : "" });
    let docId = id || "";
    async function save() {
      msg.replaceChildren();
      if (!docId) docId = Store.newId("clients");
      const name = root.querySelector("#c-name").value.trim(), phone = root.querySelector("#c-phone").value.trim();
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la clienta."));
      if (phone && !L.normalizePhone(phone)) return msg.append(h("div", { class: "note" }, "El teléfono debe tener 10 dígitos."));
      const dup = phone && L.findClientByPhone(S.clients.filter((x) => x.id !== docId), phone);
      if (dup) return msg.append(h("div", { class: "note" }, "Ya existe " + dup.name + " con ese teléfono. ", h("button", { class: "btn small ghost", onclick: () => openSheet(() => clientCard(dup.id)) }, "Abrir su ficha")));
      let birthday = "";
      const m = mes.value, d = Number(dia.value);
      if (m && d >= 1 && d <= 31) birthday = m + "-" + String(d).padStart(2, "0");
      const doc = { ...(id ? c : {}), id: docId, name, phone, birthday, canal: root.querySelector("#c-canal").value, notes: root.querySelector("#c-notes").value.trim() };
      if (await run(Store.save("clients", doc), "Clienta guardada", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar clienta" : "Nueva clienta"),
      h("label", {}, "Nombre", h("input", { id: "c-name", autocomplete: "off", value: c.name })),
      h("label", {}, "Teléfono", h("input", { id: "c-phone", inputmode: "tel", autocomplete: "off", value: c.phone })),
      h("div", { class: "grid2" }, h("label", {}, "Mes de cumpleaños", mes), h("label", {}, "Día", dia)),
      h("label", {}, "Cómo llegó", h("select", { id: "c-canal" }, [["whatsapp", "WhatsApp"], ["facebook", "Facebook"], ["otro", "Otro"]].map(([v, t]) => h("option", { value: v, selected: c.canal === v }, t)))),
      h("label", {}, "Notas", h("textarea", { id: "c-notes" }, c.notes || "")),
      msg, h("div", { class: "row" }, busyBtn({ class: "btn" }, "Guardar clienta", save), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function serviceList() {
    if (!S.services.length) return h("div", { class: "empty" }, h("p", {}, "Aún no hay servicios. Agrega el primero."), h("button", { class: "btn", onclick: () => openSheet(() => serviceForm()) }, "Nuevo servicio"));
    return h("div", { class: "list" }, S.services.slice().sort((a, b) => a.name.localeCompare(b.name)).map((v) => h("button", { class: "item", onclick: () => openSheet(() => serviceForm(v.id)) },
      h("span", {}, h("div", { class: "name" }, h("span", { class: "dotc", style: "background:" + (v.color || TONES[0]) }), v.name), h("div", { class: "muted small" }, v.durationMin + " min" + (v.perUnit ? " por " + v.unitLabel : ""))),
      h("span", { class: "side-r" }, v.active === false && h("span", { class: "tag" }, "Inactivo"), v.price ? h("span", { class: "name" }, L.formatMXN(v.price) + (v.perUnit ? " por " + v.unitLabel : "")) : h("span", { class: "muted small" }, "Sin precio")))));
  }
  function serviceForm(id) {
    const v = id ? serviceOf(id) : { name: "", price: "", durationMin: 45, color: TONES[S.services.length % TONES.length], active: true };
    let color = v.color, active = v.active !== false;
    const msg = h("div", { "aria-live": "polite" });
    const palette = h("div", { class: "colors", role: "group", "aria-label": "Color del esmalte" });
    const paint2 = () => palette.replaceChildren(...TONES.map((t) => h("button", { style: "background:" + t, "aria-label": "Color " + t, "aria-pressed": String(t === color), onclick: () => { color = t; paint2(); } })));
    paint2();
    // cómo se cobra: único (una vez) o por unidad (por ejemplo, por uña)
    const opcionCobro = (value, text) => h("label", { class: "check" }, h("input", { type: "radio", name: "s-cobro", value, checked: (value === "unidad") === !!v.perUnit }), text);
    const unidad = h("input", { id: "s-unit", autocomplete: "off", placeholder: "uña", value: v.unitLabel || "" });
    const maximo = h("input", { id: "s-max", type: "number", min: "2", max: "99", step: "1", inputmode: "numeric", value: v.maxUnits || 10 });
    const camposUnidad = h("div", { class: "grid2", hidden: !v.perUnit }, h("label", {}, "Unidad", unidad), h("label", {}, "Máximo", maximo));
    const lblPrecio = h("span", {}), lblDur = h("span", {});
    const porUnidad = () => !!root.querySelector('input[name="s-cobro"][value="unidad"]:checked');
    const pintaEtiquetas = () => {
      const u = unidad.value.trim() || "unidad";
      const pu = camposUnidad.hidden ? false : true;
      lblPrecio.textContent = pu ? "Precio por " + u : "Precio";
      lblDur.textContent = pu ? "Duración por " + u + " (min)" : "Duración (min)";
    };
    unidad.addEventListener("input", pintaEtiquetas);
    let docId = id || "";
    async function save() {
      msg.replaceChildren();
      if (!docId) docId = Store.newId("services");
      const name = root.querySelector("#s-name").value.trim();
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre del servicio."));
      const doc = { ...(id ? v : {}), id: docId, name, price: num(root.querySelector("#s-price").value), durationMin: Number(root.querySelector("#s-dur").value) || 30, color, active: root.querySelector("#s-active").checked };
      const rw = Math.floor(Number(root.querySelector("#s-return").value));
      if (rw > 0) doc.returnWeeks = rw; else delete doc.returnWeeks;
      if (porUnidad()) {
        const u = unidad.value.trim(), mx = Number(maximo.value);
        if (!u) return msg.append(h("div", { class: "note" }, "Escribe la unidad (por ejemplo, uña)."));
        if (!Number.isInteger(mx) || mx < 2 || mx > 99) return msg.append(h("div", { class: "note" }, "El máximo debe ser un número de 2 a 99."));
        Object.assign(doc, { perUnit: true, unitLabel: u, maxUnits: mx });
      } else { delete doc.perUnit; delete doc.unitLabel; delete doc.maxUnits; }
      if (await run(Store.save("services", doc), "Servicio guardado", msg)) closeSheet();
    }
    lblPrecio.textContent = v.perUnit ? "Precio por " + v.unitLabel : "Precio";
    lblDur.textContent = v.perUnit ? "Duración por " + v.unitLabel + " (min)" : "Duración (min)";
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar servicio" : "Nuevo servicio"),
      h("label", {}, "Nombre", h("input", { id: "s-name", autocomplete: "off", value: v.name })),
      h("fieldset", { class: "stack opciones", onchange: () => { camposUnidad.hidden = !porUnidad(); pintaEtiquetas(); } }, h("legend", {}, "Cómo se cobra"), opcionCobro("unico", "Único"), opcionCobro("unidad", "Por unidad")),
      camposUnidad,
      h("div", { class: "grid2" }, h("label", {}, lblPrecio, h("input", { id: "s-price", type: "number", min: "0", inputmode: "decimal", value: v.price || "" })), h("label", {}, lblDur, h("input", { id: "s-dur", type: "number", min: "1", step: "1", value: v.durationMin }))),
      h("label", {}, "Vuelve cada (semanas)", h("input", { id: "s-return", type: "number", min: "1", step: "1", inputmode: "numeric", placeholder: "Opcional", value: v.returnWeeks || "" })),
      h("div", {}, h("div", { class: "small", style: "font-weight:600;margin-bottom:6px" }, "Color en la agenda"), palette),
      h("label", { class: "check" }, h("input", { id: "s-active", type: "checkbox", checked: active }), "Disponible para nuevas citas"),
      msg, h("div", { class: "row" }, busyBtn({ class: "btn" }, "Guardar servicio", save), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }

  function screenCobros() { return h("div", {}, "Cobros"); }
  function screenPromos() { return h("div", {}, "Promociones"); }
  function screenResumen() { return h("div", {}, "Resumen"); }
  function chargeForm() { return h("div", {}, "Cobrar"); }

  /* ---------- cobros ---------- */
  // después de cobrar: ofrecer la siguiente cita con la misma clienta, servicios y hora
  function chargedSheet(doc) {
    const c = clientOf(doc.clientId);
    const cobradas = L.apptServices(doc);
    const weeks = L.suggestedWeeks(cobradas, S.services);
    const siguiente = () => {
      const lines = cobradas.map((l) => { const v = serviceOf(l.serviceId); return v ? L.serviceLine(v) : l; });
      openSheet(() => apptForm({ date: L.nextVisitDate({ today: todayKey(), weeks, hours: hoursSetting() }), time: timeOf(doc), clientId: doc.clientId, lines,
        hint: "Sugerida: en " + weeks + (weeks === 1 ? " semana" : " semanas") }));
    };
    return h("div", { class: "stack" }, h("h2", {}, "Cobrado"),
      h("p", { class: "big", style: "margin:0" }, L.formatMXN(doc.total)),
      c && h("p", { class: "muted", style: "margin:0" }, c.name),
      h("div", { class: "row" }, c && h("button", { class: "btn", onclick: siguiente }, "Agendar siguiente cita"), h("button", { class: "btn ghost", onclick: closeSheet }, "Listo")));
  }
  function chargeForm(id) {
    const a0 = S.appts.find((x) => x.id === id);
    if (!a0) return h("div", {}, h("p", {}, "Esta cita ya no existe."), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar"));
    const c = clientOf(a0.clientId) || { id: a0.clientId, name: "Clienta" };
    const visits = L.paidVisitCount(a0.clientId, S.appts);
    let quitado = false;
    // lo agendado, con precios editables: aquí se agrega lo que pidió en el momento
    let lines = L.apptServices(a0);
    const editor = servicesEditor({ lines, editablePrice: true, onChange: (l) => { lines = l; recalc(); } });
    const adv = h("input", { id: "p-adv", type: "number", min: "0", inputmode: "decimal", value: a0.advance || "" });
    const method = h("select", { id: "p-method" }, h("option", { value: "efectivo" }, "Efectivo"), h("option", { value: "transferencia" }, "Transferencia"));
    const info = h("div", { class: "stack", "aria-live": "polite" });
    const msg = h("div", { "aria-live": "polite" });
    let cur = { discount: { kind: "ninguno", label: "Sin descuento", amount: 0 }, total: 0, balance: 0 };
    function recalc() {
      const subtotal = L.servicesTotals(lines).price;
      const sug = L.suggestDiscount({ client: c, paidVisits: visits, promos: S.promos, settings: settings(), today: todayKey(), subtotal });
      const discount = quitado ? { kind: "ninguno", label: "Sin descuento", amount: 0 } : sug;
      const ch = L.computeCharge({ subtotal, discountAmount: discount.amount, advance: num(adv.value) });
      cur = { discount, ...ch };
      info.replaceChildren(
        sug.kind === "ninguno" ? "" : h("div", { class: "note ok" }, quitado ? "Descuento quitado (" + sug.label + ")" : "Descuento sugerido: " + sug.label + " (−" + L.formatMXN(sug.amount) + ") ",
          h("button", { class: "btn small ghost", onclick: () => { quitado = !quitado; recalc(); } }, quitado ? "Aplicar descuento" : "Quitar descuento")),
        h("div", { class: "row between muted" }, h("span", {}, "Subtotal"), h("span", {}, L.formatMXN(subtotal))),
        h("div", { class: "row between" }, h("span", {}, "Total"), h("span", { class: "big" }, L.formatMXN(ch.total))),
        h("div", { class: "row between muted" }, h("span", {}, "Saldo por cobrar tras el anticipo"), h("span", {}, L.formatMXN(ch.balance))));
    }
    adv.addEventListener("input", recalc);
    recalc();
    async function cobrar() {
      msg.replaceChildren();
      const fresh = S.appts.find((x) => x.id === id);
      if (!fresh || fresh.status !== "pendiente") return msg.append(h("div", { class: "note" }, "Esta cita ya fue cobrada o cancelada."));
      if (!lines.length) return msg.append(h("div", { class: "note" }, "Agrega al menos un servicio."));
      const subtotal = L.servicesTotals(lines).price;
      if (!subtotal) return msg.append(h("div", { class: "note" }, "El total de los servicios es $0; escribe los precios."));
      const doc = L.withServices({ ...fresh, status: "cobrada", subtotal, advance: num(adv.value), total: cur.total, balance: cur.balance, method: method.value, discountKind: cur.discount.kind, discountAmount: cur.discount.amount, paidAt: todayKey() }, lines);
      if (await run(Store.save("appointments", doc), "Cobrado", msg)) openSheet(() => chargedSheet(doc));
    }
    return h("div", { class: "stack" }, h("h2", {}, "Cobrar a " + c.name), h("div", { class: "muted" }, visits, " visitas cobradas"),
      h("div", { class: "stack campo" }, h("span", { class: "lbl" }, "Servicios"), editor.el),
      h("label", {}, "Anticipo recibido", adv),
      h("label", {}, "Método de pago", method), info, msg,
      h("div", { class: "row" }, busyBtn({ class: "btn" }, "Cobrar", cobrar), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function screenCobros() {
    const now = todayKey();
    const pend = S.appts.filter((a) => a.status === "pendiente" && a.start.slice(0, 10) <= now).sort(byStart);
    const done = S.appts.filter((a) => a.status === "cobrada").sort((a, b) => byStart(b, a)).slice(0, 20);
    return h("div", {}, pageHead("Cobros"),
      h("h2", { class: "section-title" }, "Por cobrar"),
      pend.length ? h("div", { class: "list" }, pend.map(apptRow)) : h("div", { class: "empty" }, h("p", {}, "No hay citas por cobrar. Las citas de hoy y de días pasados aparecen aquí.")),
      h("h2", { class: "section-title" }, "Cobros recientes"),
      done.length ? h("div", { class: "list" }, done.map((a) => { const c = clientOf(a.clientId); return h("button", { class: "item", onclick: () => openSheet(() => apptDetail(a.id)) },
        h("span", {}, h("div", { class: "name" }, c ? c.name : "Clienta eliminada"), h("div", { class: "muted small" }, resumen(a) + " · " + dmy(a.paidAt || a.start.slice(0, 10)) + " · " + a.method + (a.discountAmount ? " · descuento " + L.formatMXN(a.discountAmount) : ""))),
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
    return h("div", {},
      pageHead("Promociones",
        h("div", { class: "seg", role: "group", "aria-label": "Sección" },
          h("button", { "aria-pressed": String(tab === "promos"), onclick: () => { S.promoTab = "promos"; render(); } }, "Descuentos"),
          h("button", { "aria-pressed": String(tab === "captacion"), onclick: () => { S.promoTab = "captacion"; render(); } }, "Captación")),
        tab === "promos" && h("button", { class: "btn", onclick: () => openSheet(() => promoForm()) }, icon("mas"), "Nueva promoción")),
      tab === "promos" ? promoList() : outreach());
  }
  function saveSettings(patch, okMsg) { return run(Store.save("settings", { ...settings(), ...patch, id: "main" }), okMsg); }
  function promoList() {
    const st = settings();
    const loy = h("div", { class: "card stack" }, h("h3", {}, "Lealtad"), h("p", { class: "muted small", style: "margin:0" }, "Descuento automático en cierta visita cobrada de cada clienta."),
      h("div", { class: "grid2" },
        h("label", {}, "Cada cuántas visitas", h("input", { id: "l-every", type: "number", min: "0", value: st.loyaltyEvery })),
        h("label", {}, "Descuento (%)", h("input", { id: "l-pct", type: "number", min: "0", max: "100", value: st.loyaltyPercent }))),
      h("div", {}, busyBtn({ class: "btn sec" }, "Guardar lealtad", () => saveSettings({ loyaltyEvery: Math.max(0, Math.floor(Number(root.querySelector("#l-every").value) || 0)), loyaltyPercent: Math.min(100, Math.max(0, Number(root.querySelector("#l-pct").value) || 0)) }, "Lealtad guardada"))));
    const rows = S.promos.slice().sort((a, b) => a.name.localeCompare(b.name));
    return h("div", { class: "stack" }, loy,
      rows.length ? h("div", { class: "stack" }, rows.map((p) => h("div", { class: "card stack" },
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
    let docId = id || "";
    async function save() {
      msg.replaceChildren();
      if (!docId) docId = Store.newId("promos");
      const name = root.querySelector("#pr-name").value.trim(), percent = Number(root.querySelector("#pr-pct").value), type = tipo.value;
      const from = root.querySelector("#pr-from").value, to = root.querySelector("#pr-to").value;
      if (!name) return msg.append(h("div", { class: "note" }, "Escribe el nombre de la promoción."));
      if (!(percent > 0 && percent <= 100)) return msg.append(h("div", { class: "note" }, "El descuento debe estar entre 1 y 100."));
      if (type === "temporada" && (!from || !to || to < from)) return msg.append(h("div", { class: "note" }, "Indica las fechas; la fecha final no puede ser antes de la inicial."));
      const doc = { ...(id ? p : {}), id: docId, name, type, percent, active: root.querySelector("#pr-act").checked, ...(type === "temporada" ? { startDate: from, endDate: to } : { startDate: "", endDate: "" }) };
      if (await run(Store.save("promos", doc), "Promoción guardada", msg)) closeSheet();
    }
    return h("div", { class: "stack" }, h("h2", {}, id ? "Editar promoción" : "Nueva promoción"),
      h("label", {}, "Nombre", h("input", { id: "pr-name", autocomplete: "off", value: p.name })),
      h("div", { class: "grid2" }, h("label", {}, "Tipo", tipo), h("label", {}, "Descuento (%)", h("input", { id: "pr-pct", type: "number", min: "1", max: "100", value: p.percent }))),
      fechas,
      h("label", { class: "check" }, h("input", { id: "pr-act", type: "checkbox", checked: p.active !== false }), "Promoción activa"),
      msg, h("div", { class: "row" }, busyBtn({ class: "btn" }, "Guardar promoción", save), h("button", { class: "btn ghost", onclick: closeSheet }, "Cerrar")));
  }
  function outreach() {
    const st = settings();
    const list = L.inactiveClients(S.clients, S.appts, todayKey(), st.inactiveWeeks);
    return h("div", { class: "stack" },
      h("div", { class: "card stack" }, h("h3", {}, "Clientas que no han vuelto"),
        h("div", { class: "row" }, h("label", { style: "flex:1" }, "Semanas sin venir", h("input", { id: "o-weeks", type: "number", min: "1", value: st.inactiveWeeks })),
          busyBtn({ class: "btn sec" }, "Guardar plazo", () => saveSettings({ inactiveWeeks: Math.max(1, Math.floor(Number(root.querySelector("#o-weeks").value) || 5)) }, "Plazo guardado")))),
      list.length ? h("div", { class: "list" }, list.map(({ client, weeksAway }) => { const link = L.whatsappLink(client.phone, L.reactivationMessage(client)); return h("div", { class: "item", style: "cursor:default" },
        h("span", {}, h("div", { class: "name" }, client.name), h("div", { class: "muted small" }, weeksAway + " semanas sin venir")),
        link ? h("a", { class: "btn small", href: link, target: "_blank", rel: "noopener", style: "text-decoration:none;display:inline-flex;align-items:center" }, "Escribir por WhatsApp") : h("span", { class: "muted small" }, "Sin teléfono")); }))
        : h("div", { class: "empty" }, h("p", {}, "Nadie lleva " + st.inactiveWeeks + " semanas o más sin venir.")));
  }

  /* ---------- resumen ---------- */
  const mesNombre = (m) => (MESES[Number(m.slice(5, 7)) - 1] + " de " + m.slice(0, 4)).replace(/^./, (x) => x.toUpperCase());
  const mesMover = (m, n) => { const d = new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1 + n, 1)); return d.toISOString().slice(0, 7); };
  const METODOS = { efectivo: "Efectivo", transferencia: "Transferencia", retenidos: "Anticipos retenidos" };
  function screenResumen() {
    const t = todayKey();
    const month = S.reportMonth || t.slice(0, 7);
    const r = L.monthReport({ appts: S.appts, clients: S.clients, month });
    const pendientes = apptsOn(t).filter((a) => a.status === "pendiente").length;
    const activas = S.promos.filter(promoActiveToday);
    const stat = (label, value, extra) => h("div", { class: "card stat" }, h("span", { class: "muted small" }, label), h("span", { class: "big" }, value), extra || null);
    const prev = MESES[Number(mesMover(month, -1).slice(5, 7)) - 1];
    const cambio = r.changePct === null ? "—" : (r.changePct >= 0 ? "+" : "−") + Math.abs(r.changePct) + "% que " + prev;
    const tabla = (titulo, filas, nota) => h("section", { class: "card stack" }, h("h3", {}, titulo), nota ? h("p", { class: "muted small", style: "margin:0" }, nota) : null,
      h("div", { class: "tabla" }, filas));
    const fila = (a, b, c) => h("div", { class: "tabla-fila" }, h("span", {}, a), h("span", { class: "muted small" }, b || ""), h("span", { class: "num" }, c));
    const pct = (n, p) => n + " (" + p + "%)";
    return h("div", { class: "stack" }, pageHead("Reportes"),
      h("div", { class: "stats" },
        stat("Ingresos de hoy", L.formatMXN(L.incomeOn(S.appts, t))),
        stat("Citas pendientes hoy", String(pendientes))),
      h("div", { class: "mesnav" },
        h("button", { class: "iconbtn", "aria-label": "Mes anterior", onclick: () => { S.reportMonth = mesMover(month, -1); render(); } }, icon("antes")),
        h("h2", { "aria-live": "polite" }, mesNombre(month)),
        h("button", { class: "iconbtn", "aria-label": "Mes siguiente", onclick: () => { S.reportMonth = mesMover(month, 1); render(); } }, icon("despues"))),
      h("div", { class: "stats" },
        stat("Ingresos del mes", L.formatMXN(r.income), h("span", { class: "muted small" }, cambio)),
        stat("Citas cobradas", String(r.paidCount)),
        stat("Ticket promedio", L.formatMXN(r.avgTicket))),
      r.paidCount || r.retained.count ? h("div", { class: "reportes" },
        r.byService.length ? tabla("Ventas por servicio", r.byService.map((x) => fila(x.name, x.unitLabel ? L.unitText(x.count, x.unitLabel) : x.count === 1 ? "1 vez" : x.count + " veces", L.formatMXN(x.amount))), "Montos antes de descuentos") : null,
        tabla("Por método de pago", r.byMethod.map((x) => fila(METODOS[x.method] || x.method, "", L.formatMXN(x.amount)))),
        r.topClients.length ? tabla("Mejores clientas", r.topClients.map((x) => fila(x.name, x.visits === 1 ? "1 visita" : x.visits + " visitas", L.formatMXN(x.amount)))) : null,
        tabla("Cancelaciones", [
          fila("Canceló con aviso", "", pct(r.cancel.aviso, r.cancel.avisoPct)),
          fila("No llegó", "", pct(r.cancel.noLlego, r.cancel.noLlegoPct)),
          fila("Citas cerradas", "", String(r.cancel.closed)),
        ]),
        r.retained.count ? tabla("Anticipos retenidos", [fila(r.retained.count === 1 ? "1 anticipo" : r.retained.count + " anticipos", "", L.formatMXN(r.retained.amount))]) : null)
        : h("p", { class: "muted" }, "Sin cobros este mes."),
      h("h2", { class: "section-title" }, "Promociones activas hoy"),
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
  async function logout() {
    try { await fetch("/api/auth/logout", { method: "POST" }); } catch (_) {}
    location.assign("/login");
  }
  async function boot() {
    render();
    let db = null;
    if (location.hash === "#demo") { db = demoDb(); window.__demoDb = db; }
    else { try { db = typeof claude !== "undefined" ? await claude.use("db") : null; } catch (_) { db = null; } }
    if (!db && typeof claude === "undefined" && (location.protocol === "http:" || location.protocol === "https:")) {
      // modo servidor: el servidor de este proyecto guarda los datos en MongoDB
      db = createApiDb("");
      S.server = true;
      try {
        const r = await fetch("/api/settings");
        if (r.status === 401) { location.assign("/login"); return; }
        if (!r.ok) throw new Error();
      } catch (_) { S.error = "No se pudo conectar con el servidor. Intenta de nuevo."; }
    }
    Store.init(db);
    S.loading = false;
    if (!db) return render();
    const map = { clients: "clients", services: "services", appointments: "appts", promos: "promos", settings: "settings", blocks: "blocks" };
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
