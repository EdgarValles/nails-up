// Arranque del portal local: MongoDB + servidor en 127.0.0.1
const { MongoClient } = require("mongodb");
const { createApp } = require("./app.js");
const { createMongoStore, redactUri } = require("./mongo-store.js");

const uri = process.env.MONGODB_URI || "mongodb://localhost:27017";
const dbName = process.env.MONGODB_DB || "nailsup";
const port = Number(process.env.PORT) || 3000;

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    await client.db(dbName).command({ ping: 1 });
  } catch {
    console.error("No se pudo conectar a MongoDB en " + redactUri(uri) + ". Revisa que esté encendido.");
    process.exit(1);
  }
  const app = createApp(createMongoStore(client.db(dbName)));
  app.listen(port, "127.0.0.1", () => console.log("Portal listo en http://localhost:" + port));
}
main();
