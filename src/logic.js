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

  root.NailsLogic = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
