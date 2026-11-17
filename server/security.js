// Encabezados de seguridad y la política CSP de cada página
const API_CSP = "default-src 'none'; frame-ancestors 'none'";

// pageHashes: { script: ["'sha256-…'"], style: [...] } tal como sale de dist/csp.json
function buildCsp(pageHashes) {
  const list = (a) => (Array.isArray(a) ? a.join(" ") : "");
  return [
    "default-src 'none'",
    "script-src " + list(pageHashes && pageHashes.script),
    "style-src " + list(pageHashes && pageHashes.style),
    "connect-src 'self'",
    "img-src 'self' data:",
    "form-action 'self'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join("; ");
}

// Va primero en la cadena: toda respuesta (incluidos 403, 404 y errores) lleva estos encabezados
function securityHeaders({ https = false } = {}) {
  return (_req, res, next) => {
    res.set({
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
      "Content-Security-Policy": API_CSP,
    });
    if (https) res.set("Strict-Transport-Security", "max-age=31536000");
    next();
  };
}

module.exports = { buildCsp, securityHeaders, API_CSP };
