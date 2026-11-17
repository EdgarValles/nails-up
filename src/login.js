// formulario de acceso de Nails Up
(function () {
  const form = document.getElementById("login-form");
  const pw = document.getElementById("pw");
  const go = document.getElementById("go");
  const msg = document.getElementById("msg");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    go.disabled = true;
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pw.value }),
      });
      if (res.status === 204) { location.assign("/"); return; }
      let body = {};
      try { body = await res.json(); } catch (_) {}
      msg.textContent = body.error || "No se pudo iniciar sesión. Intenta de nuevo.";
    } catch (_) {
      msg.textContent = "No hay conexión con el servidor.";
    }
    go.disabled = false;
  });
})();
