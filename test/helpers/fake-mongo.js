// Mongo falso en memoria: solo lo que usa el almacén de acceso
function fakeMongo() {
  const cols = {};
  const db = { indexes: [] };
  const match = (doc, filter) => Object.keys(filter).every((k) => doc[k] === filter[k]);
  db.collection = (name) => {
    const docs = (cols[name] = cols[name] || []);
    return {
      async findOne(filter) {
        const d = docs.find((x) => match(x, filter));
        return d ? { ...d } : null;
      },
      async insertOne(doc) {
        if (docs.some((x) => x._id === doc._id)) throw Object.assign(new Error("duplicado"), { code: 11000 });
        docs.push({ ...doc });
      },
      async updateOne(filter, { $set }) {
        const d = docs.find((x) => match(x, filter));
        if (d) Object.assign(d, $set);
      },
      async deleteOne(filter) {
        const i = docs.findIndex((x) => match(x, filter));
        if (i >= 0) docs.splice(i, 1);
      },
      async deleteMany(filter) {
        let n = 0;
        for (let i = docs.length - 1; i >= 0; i--) {
          if (match(docs[i], filter)) { docs.splice(i, 1); n++; }
        }
        return { deletedCount: n };
      },
      async createIndex(spec, opts) {
        db.indexes.push({ collection: name, spec, opts });
      },
    };
  };
  return db;
}

module.exports = { fakeMongo };
