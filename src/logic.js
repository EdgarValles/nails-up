// lógica pura de Nails Up
(function (root) {
  const api = {};

  api.formatMXN = (amount) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount);

  api.normalizePhone = (raw) => {
    let d = String(raw == null ? "" : raw).replace(/\D/g, "");
    if (d.length === 12 && d.startsWith("52")) d = d.slice(2);
    return d.length === 10 ? d : "";
  };

  api.whatsappLink = (phone, text) => {
    const p = api.normalizePhone(phone);
    return p ? "https://wa.me/52" + p + "?text=" + encodeURIComponent(text) : "";
  };

  const toMin = (iso) => Date.parse(iso + ":00Z") / 60000;
  api.appointmentsOverlap = (a, b) => {
    const a0 = toMin(a.start), b0 = toMin(b.start);
    return a0 < b0 + b.durationMin && b0 < a0 + a.durationMin;
  };

  // acomoda las citas de un día en la cuadrícula de horas: posición y alto en minutos, y carriles para las que se empalman
  api.layoutDay = (appointments) => {
    const minOfDay = (a) => Number(a.start.slice(11, 13)) * 60 + Number(a.start.slice(14, 16));
    const list = appointments.filter((a) => a.status !== "cancelada")
      .map((a) => { const s = minOfDay(a); return { appt: a, s, e: s + (Number(a.durationMin) || 30) }; })
      .sort((x, y) => x.s - y.s || x.e - y.e);
    let startMin = 9 * 60, endMin = 20 * 60;
    for (const x of list) {
      startMin = Math.min(startMin, Math.floor(x.s / 60) * 60);
      endMin = Math.max(endMin, Math.ceil(x.e / 60) * 60);
    }
    const items = [];
    let cluster = [], laneEnds = [], clusterEnd = -1;
    const close = () => { for (const it of cluster) it.lanes = laneEnds.length; cluster = []; laneEnds = []; };
    for (const x of list) {
      if (x.s >= clusterEnd) close();
      let lane = laneEnds.findIndex((end) => end <= x.s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(x.e); } else laneEnds[lane] = x.e;
      clusterEnd = Math.max(clusterEnd, x.e);
      const it = { appt: x.appt, top: x.s - startMin, height: Math.max(20, x.e - x.s), lane, lanes: 1 };
      cluster.push(it); items.push(it);
    }
    close();
    return { startMin, endMin, items };
  };

  api.dateKey = (d) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
  const round2 = (n) => Math.round(n * 100) / 100;

  api.paidVisitCount = (clientId, appointments) =>
    appointments.filter((a) => a.clientId === clientId && a.status === "cobrada").length;

  api.suggestDiscount = ({ client, paidVisits, promos, settings, today, subtotal }) => {
    const candidates = [];
    if (settings.loyaltyEvery > 0 && (paidVisits + 1) % settings.loyaltyEvery === 0) {
      candidates.push({ kind: "lealtad", label: "Lealtad: visita " + (paidVisits + 1), percent: settings.loyaltyPercent });
    }
    const month = today.slice(5, 7);
    for (const p of promos) {
      if (!p.active) continue;
      if (p.type === "temporada" && p.startDate <= today && today <= p.endDate) {
        candidates.push({ kind: "temporada", label: p.name, percent: p.percent });
      } else if (p.type === "cumpleanos" && client.birthday && client.birthday.slice(0, 2) === month) {
        candidates.push({ kind: "cumpleanos", label: p.name, percent: p.percent });
      }
    }
    if (!candidates.length) return { kind: "ninguno", label: "Sin descuento", amount: 0 };
    const best = candidates.reduce((a, b) => (b.percent > a.percent ? b : a));
    return { kind: best.kind, label: best.label, amount: round2((subtotal * best.percent) / 100) };
  };

  api.computeCharge = ({ subtotal, discountAmount, advance }) => {
    const total = Math.max(0, round2(subtotal - discountAmount));
    return { total, balance: Math.max(0, round2(total - advance)) };
  };

  const dayNumber = (key) => Date.parse(key + "T00:00:00Z") / 86400000;
  const dmy = (key) => key.slice(8, 10) + "/" + key.slice(5, 7) + "/" + key.slice(0, 4);

  api.inactiveClients = (clients, appointments, today, weeks) => {
    const out = [];
    for (const client of clients) {
      const paid = appointments.filter((a) => a.clientId === client.id && a.status === "cobrada");
      if (!paid.length) continue;
      const lastVisit = paid.map((a) => a.start.slice(0, 10)).sort().pop();
      const weeksAway = Math.floor((dayNumber(today) - dayNumber(lastVisit)) / 7);
      if (weeksAway >= weeks) out.push({ client, lastVisit, weeksAway });
    }
    return out.sort((x, y) => y.weeksAway - x.weeksAway);
  };

  api.reactivationMessage = (client) =>
    "Hola " + String(client.name || "").split(" ")[0] + ", hace tiempo que no te vemos en Nails Up. ¿Quieres agendar tu próxima cita?";

  api.promoText = (promo, businessName) => {
    const vigencia = promo.endDate ? " Vigente hasta el " + dmy(promo.endDate) + "." : "";
    return promo.name + " en " + businessName + ": " + promo.percent + "% de descuento." + vigencia + " Escríbenos para agendar.";
  };

  api.findClientByPhone = (clients, rawPhone) => {
    const p = api.normalizePhone(rawPhone);
    return p ? clients.find((c) => api.normalizePhone(c.phone) === p) : undefined;
  };

  // las canceladas de antes de guardar el tipo cuentan como cancelación con aviso
  api.cancelKind = (a) => (a.status !== "cancelada" ? null : a.cancelKind === "no_llego" ? "no_llego" : "aviso");

  api.cancelStats = (clientId, appointments) => {
    const r = { aviso: 0, noLlego: 0 };
    for (const a of appointments) {
      if (a.clientId !== clientId) continue;
      const k = api.cancelKind(a);
      if (k === "aviso") r.aviso++;
      else if (k === "no_llego") r.noLlego++;
    }
    return r;
  };

  // aviso cuando hay 2 o más cancelaciones entre sus últimas 5 citas cerradas (cobradas o canceladas)
  api.cancelTendency = (clientId, appointments) => {
    const recientes = appointments
      .filter((a) => a.clientId === clientId && (a.status === "cobrada" || a.status === "cancelada"))
      .sort((a, b) => (a.start < b.start ? 1 : a.start > b.start ? -1 : 0))
      .slice(0, 5);
    const canceladas = recientes.filter((a) => a.status === "cancelada");
    if (canceladas.length < 2) return null;
    return { total: recientes.length, canceladas: canceladas.length, noLlego: canceladas.filter((a) => api.cancelKind(a) === "no_llego").length };
  };

  api.canDeleteClient = (clientId, appointments) => {
    const suyas = appointments.filter((a) => a.clientId === clientId);
    const pendientes = suyas.filter((a) => a.status === "pendiente").length;
    return pendientes ? { ok: false, pendientes } : { ok: true, historial: suyas.length };
  };

  api.canDeleteAppointment = (a) => a.status !== "cobrada";

  /* ---------- varios servicios por cita ---------- */
  // una línea es una copia del servicio del catálogo: si el catálogo cambia, la cita conserva lo suyo
  api.serviceLine = (svc) => ({
    serviceId: svc.id, name: svc.name, color: svc.color,
    price: Number(svc.price) || 0, durationMin: Number(svc.durationMin) || 0,
  });

  // las citas de antes tienen un solo servicio en serviceId/serviceName/serviceColor/price
  api.apptServices = (a) => {
    if (Array.isArray(a.services) && a.services.length) return a.services.map((l) => ({ ...l }));
    if (!a.serviceId && !a.serviceName) return [];
    return [{ serviceId: a.serviceId, name: a.serviceName || "Servicio", color: a.serviceColor, price: Number(a.price) || 0, durationMin: Number(a.durationMin) || 0 }];
  };

  api.servicesTotals = (lines) => lines.reduce(
    (t, l) => ({ price: round2(t.price + (Number(l.price) || 0)), durationMin: t.durationMin + (Number(l.durationMin) || 0) }),
    { price: 0, durationMin: 0 });

  api.servicesSummary = (lines) => (!lines.length ? "" : lines[0].name + (lines.length > 1 ? " + " + (lines.length - 1) : ""));

  // además de la lista, los campos de antes como resumen, para lo que aún los lea
  api.withServices = (appt, lines) => {
    const first = lines[0] || {};
    return { ...appt, services: lines, serviceId: first.serviceId, serviceColor: first.color, serviceName: api.servicesSummary(lines), price: api.servicesTotals(lines).price };
  };

  api.formatDuration = (min) => {
    const h = Math.floor(min / 60), m = min % 60;
    return !h ? m + " min" : h + " h" + (m ? " " + m + " min" : "");
  };

  root.NailsLogic = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
