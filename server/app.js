// API local de Nails Up: expone el almacén por HTTP, solo para esta computadora
const express = require("express");
const path = require("node:path");

const COLLECTIONS = new Set(["clients", "services", "appointments", "promos", "settings"]);
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

function createApp(store) {
  const app = express();
  app.disable("x-powered-by");

  // Solo se acepta tráfico dirigido a localhost y sin Origin ajeno
  app.use((req, res, next) => {
    const port = req.socket.localPort;
    const hosts = ["localhost:" + port, "127.0.0.1:" + port];
    if (!hosts.includes(req.headers.host)) return res.status(403).json({ error: "Acceso no permitido." });
    const origin = req.headers.origin;
    if (origin && !hosts.map((h) => "http://" + h).includes(origin)) return res.status(403).json({ error: "Acceso no permitido." });
    next();
  });

  app.get("/", (_req, res) => res.sendFile(path.join(__dirname, "..", "dist", "index.html")));

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
  app.use("/api", api);

  // errores de cuerpo (demasiado grande o JSON roto)
  app.use((err, _req, res, _next) => {
    if (err && err.type === "entity.too.large") return res.status(413).json({ error: "El registro es demasiado grande." });
    if (err && err.type === "entity.parse.failed") return res.status(400).json({ error: "JSON no válido." });
    res.status(500).json({ error: "Error inesperado." });
  });
  return app;
}

module.exports = { createApp, COLLECTIONS, ID_RE };
