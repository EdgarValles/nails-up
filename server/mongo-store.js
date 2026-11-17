// Almacén de Nails Up sobre MongoDB
const crypto = require("node:crypto");

function createMongoStore(db) {
  const strip = ({ id, _id, ...rest }) => rest;
  return {
    async list(col) {
      const docs = await db.collection(col).find({}).toArray();
      return docs.map(({ _id, ...rest }) => ({ id: String(_id), ...rest }));
    },
    async put(col, id, body) {
      await db.collection(col).replaceOne({ _id: id }, { _id: id, ...strip(body) }, { upsert: true });
    },
    async add(col, body) {
      const id = crypto.randomBytes(12).toString("hex");
      await db.collection(col).insertOne({ _id: id, ...strip(body) });
      return id;
    },
    async remove(col, id) {
      await db.collection(col).deleteOne({ _id: id });
    },
  };
}

// Quita usuario y contraseña de una dirección de MongoDB antes de mostrarla
function redactUri(uri) {
  return String(uri).replace(/^(mongodb(?:\+srv)?:\/\/)[^@/]*@/, "$1");
}

module.exports = { createMongoStore, redactUri };
