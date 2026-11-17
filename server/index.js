// Arranque del portal: MongoDB + servidor en 127.0.0.1
const fs = require("node:fs");
const path = require("node:path");
const { createApp } = require("./app.js");
const { createAuthStore } = require("./auth-store.js");
const { createMongoStore, redactUri } = require("./mongo-store.js");

async function start({ db, env = {}, csp }) {
  const authStore = createAuthStore(db);
  await authStore.ensureIndexes();
  if (!(await authStore.getUser())) {
    throw new Error("Crea la usuaria con: node server/cli.js crear-usuaria");
  }
  const publicOrigin = env.PUBLIC_ORIGIN || "";
  const app = createApp(createMongoStore(db), { authStore, publicOrigin, csp });
  const port = env.PORT !== undefined && env.PORT !== "" ? Number(env.PORT) : 3000;
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1");
    server.once("error", reject);
    server.once("listening", () => {
      server.off("error", reject);
      console.log("Portal listo en " + (publicOrigin || "http://localhost:" + server.address().port));
      resolve(server);
    });
  });
}

function loadCsp(dir = path.join(__dirname, "..", "dist")) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "csp.json"), "utf8"));
  } catch (e) {
    if (e.code === "ENOENT") throw new Error("Falta la página construida. Corre npm run build y vuelve a intentar.");
    throw e;
  }
}

async function main() {
  const { MongoClient } = require("mongodb");
  const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
  const dbName = process.env.MONGODB_DB || "nailsup";
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    try {
      await client.connect();
      await client.db(dbName).command({ ping: 1 });
    } catch {
      throw new Error("No se pudo conectar a MongoDB en " + redactUri(uri) + ". Revisa que esté encendido.");
    }
    const csp = loadCsp();
    await start({ db: client.db(dbName), env: process.env, csp });
  } catch (e) {
    console.error(e.message);
    await client.close().catch(() => {});
    process.exit(1);
  }
}

if (require.main === module) main();

module.exports = { start, loadCsp };
