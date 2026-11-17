// capa de datos: Store sobre la capacidad db del artifact
(function (root) {
  let db = null;
  const state = {}; // colección -> { docs, listeners, first: Promise, unsub }

  const Store = { ready: false };

  Store.init = (dbOrNull) => {
    db = dbOrNull || null;
    Store.ready = !!db;
    for (const k of Object.keys(state)) delete state[k];
  };

  function open(name) {
    if (state[name]) return state[name];
    const s = (state[name] = { docs: [], listeners: new Set(), unsub: null });
    s.first = new Promise((resolve) => {
      if (!db) return resolve([]);
      s.unsub = db.collection(name).onSnapshot(
        (snap) => {
          s.docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          s.listeners.forEach((cb) => cb(s.docs));
          if (!(snap.metadata && snap.metadata.fromCache)) resolve(s.docs);
        },
        () => resolve(s.docs)
      );
    });
    return s;
  }

  Store.subscribe = (name, cb) => {
    const s = open(name);
    s.listeners.add(cb);
    if (s.docs.length) cb(s.docs);
    return () => s.listeners.delete(cb);
  };

  const needDb = () => {
    if (!db) throw new Error("No hay conexión con la base de datos");
  };

  Store.save = async (name, doc) => {
    needDb();
    const { id, ...body } = doc;
    const ref = db.collection(name).doc(id);
    await ref.set(body);
    return ref.id;
  };

  Store.remove = async (name, id) => {
    needDb();
    await db.collection(name).doc(id).delete();
  };

  Store.defaults = {
    settings: { loyaltyEvery: 6, loyaltyPercent: 15, inactiveWeeks: 5 },
    services: [
      { name: "Manicure en gel", price: 0, durationMin: 45, color: "#D6459A", active: true },
      { name: "Diseño de uñas", price: 0, durationMin: 30, color: "#8E6BD1", active: true },
      { name: "Retoque", price: 0, durationMin: 30, color: "#B8924A", active: true },
    ],
  };

  Store.seedDefaults = async () => {
    needDb();
    const sSet = open("settings"); await sSet.first; const settings = sSet.docs;
    if (!settings.some((d) => d.id === "main")) {
      await Store.save("settings", { id: "main", ...Store.defaults.settings });
    }
    const sSrv = open("services"); await sSrv.first; const services = sSrv.docs;
    if (!services.length) {
      for (const s of Store.defaults.services) await Store.save("services", s);
    }
  };

  root.Store = Store;
  if (typeof module !== "undefined") module.exports = Store;
})(globalThis);
