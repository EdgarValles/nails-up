// Portal de Nails Up: páginas y API detrás de una sesión, en localhost o detrás de Caddy
const express = require("express");
const path = require("node:path");
const { createAuth } = require("./auth.js");
const { buildCsp, securityHeaders } = require("./security.js");

const COLLECTIONS = new Set(["clients", "services", "appointments", "promos", "settings"]);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const DIST = path.join(__dirname, "..", "dist");
const SAFE_METHODS = new Set(["GET", "HEAD"]);

function createApp(store, { authStore, publicOrigin = "", csp, now = Date.now, log } = {}) {
  if (!authStore) throw new Error("Falta authStore.");
  if (!csp || !csp["index.html"] || !csp["login.html"]) throw new Error("Falta csp.json; corre npm run build.");
  const https = publicOrigin.startsWith("https:");
  const pub = publicOrigin ? new URL(publicOrigin) : null;
  const pageCsp = { "index.html": buildCsp(csp["index.html"]), "login.html": buildCsp(csp["login.html"]) };
  const auth = createAuth({ authStore, now, secure: https, ...(log ? { log } : {}) });

  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");

  // Primero: toda respuesta, incluso 403, 404 y errores, lleva los encabezados de seguridad
  app.use(securityHeaders({ https }));

  // Solo se acepta tráfico dirigido a localhost o al dominio público, y con Origin propio
  app.use((req, res, next) => {
    const port = req.socket.localPort;
    const hosts = ["localhost:" + port, "127.0.0.1:" + port];
    const origins = hosts.map((h) => "http://" + h);
    if (pub) { hosts.push(pub.host); origins.push(pub.origin); }
    const deny = () => res.status(403).json({ error: "Acceso no permitido." });
    if (!hosts.includes(req.headers.host)) return deny();
    const origin = req.headers.origin;
    if (origin ? !origins.includes(origin) : !SAFE_METHODS.has(req.method)) return deny();
    next();
  });

  const noStore = (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); };
  const page = (name) => (_req, res, next) => {
    res.set({ "Content-Security-Policy": pageCsp[name], "Cache-Control": "no-store" });
    res.sendFile(path.join(DIST, name), { cacheControl: false }, (err) => err && next(err));
  };

  app.get("/", noStore, auth.requireSession, page("index.html"));
  // Con sesión válida no tiene caso ver el login; si no se puede verificar, se muestra el login
  app.get("/login", noStore, async (req, res, next) => {
    let session = null;
    try { session = await auth.currentSession(req); } catch { /* se muestra el login */ }
    if (session) return res.redirect(302, "/");
    next();
  }, page("login.html"));

  app.use("/api", noStore);
  app.use("/api/auth", auth.router);

  const api = express.Router();
  api.param("col", (req, res, next, col) => (COLLECTIONS.has(col) ? next() : res.status(400).json({ error: "Colección no válida." })));
  api.param("id", (req, res, next, id) => (ID_RE.test(id) ? next() : res.status(400).json({ error: "Id no válido." })));
  const needJson = (req, res, next) => (req.is("application/json") ? next() : res.status(415).json({ error: "El contenido debe ser JSON." }));
  const body = express.json({ limit: "256kb", type: "application/json" });
  const clean = (b) => { const { id, _id, ...rest } = b; return rest; };
  const isObj = (b) => b && typeof b === "object" && !Array.isArray(b);
  const fail = (res) => res.status(500).json({ error: "No se pudo guardar. Intenta de nuevo." });

  api.get("/:col", async (req, res) => {
    try { res.json(await store.list(req.params.col)); } catch { res.status(500).json({ error: "No se pudo leer. Intenta de nuevo." }); }
  });
  api.put("/:col/:id", needJson, body, async (req, res) => {
    if (!isObj(req.body)) return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON." });
    try { await store.put(req.params.col, req.params.id, clean(req.body)); res.status(204).end(); } catch { fail(res); }
  });
  api.post("/:col", needJson, body, async (req, res) => {
    if (!isObj(req.body)) return res.status(400).json({ error: "El cuerpo debe ser un objeto JSON." });
    try { res.status(201).json({ id: await store.add(req.params.col, clean(req.body)) }); } catch { fail(res); }
  });
  api.delete("/:col/:id", async (req, res) => {
    try { await store.remove(req.params.col, req.params.id); res.status(204).end(); } catch { fail(res); }
  });
  app.use("/api", auth.requireSession, api);

  // errores de cuerpo (demasiado grande o JSON roto)
  app.use((err, _req, res, _next) => {
    if (err && err.type === "entity.too.large") return res.status(413).json({ error: "El registro es demasiado grande." });
    if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON no válido." });
    res.status(500).json({ error: "Error inesperado." });
  });
  return app;
}

module.exports = { createApp, COLLECTIONS, ID_RE };
