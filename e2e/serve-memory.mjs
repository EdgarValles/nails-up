// Servidor de prueba: el mismo portal pero con almacén y acceso en memoria (puerto 3100)
// La usuaria entra con la contraseña "portal-de-prueba-1". Requiere `npm run build` antes.
import fs from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { createApp } = require("../server/app.js");
const { createAuthStore } = require("../server/auth-store.js");
const { hashPassword } = require("../server/password.js");
const { fakeMongo } = require("../test/helpers/fake-mongo.js");

const cols = {};
let n = 0;
const store = {
  async list(c) { return Object.entries(cols[c] || {}).map(([id, b]) => ({ id, ...b })); },
  async put(c, id, b) { (cols[c] = cols[c] || {})[id] = b; },
  async add(c, b) { const id = "g" + ++n; (cols[c] = cols[c] || {})[id] = b; return id; },
  async remove(c, id) { delete (cols[c] || {})[id]; },
};
const authStore = createAuthStore(fakeMongo());
await authStore.createUser(await hashPassword("portal-de-prueba-1"));
const csp = JSON.parse(fs.readFileSync(new URL("../dist/csp.json", import.meta.url), "utf8"));
createApp(store, { authStore, csp, log: () => {} }).listen(3100, "127.0.0.1", () => console.log("listo"));
