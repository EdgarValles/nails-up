// Servidor de prueba: la misma API pero con almacén en memoria (puerto 3100)
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app.js");
const cols = {};
let n = 0;
const store = {
  async list(c) { return Object.entries(cols[c] || {}).map(([id, b]) => ({ id, ...b })); },
  async put(c, id, b) { (cols[c] = cols[c] || {})[id] = b; },
  async add(c, b) { const id = "g" + ++n; (cols[c] = cols[c] || {})[id] = b; return id; },
  async remove(c, id) { delete (cols[c] || {})[id]; },
};
createApp(store).listen(3100, "127.0.0.1", () => console.log("listo"));
