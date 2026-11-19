// adaptador: imita la capacidad db usando la API del servidor local
(function (root) {
  const NET_ERR = "No hay conexión con el servidor. Revisa tu internet e intenta de nuevo.";

  function createApiDb(baseUrl, fetchFn, { onUnauthorized } = {}) {
    const onUnauth = onUnauthorized || (() => root.location.assign("/login"));
    const doFetch = fetchFn || ((...a) => root.fetch(...a));
    const subs = {}; // colección -> Set de { next, error }

    async function request(url, opts) {
      let res;
      try { res = await doFetch(baseUrl + url, opts); } catch (_) { throw new Error(NET_ERR); }
      if (!res.ok) {
        if (res.status === 401) { try { onUnauth(); } catch (_) {} }
        let msg = "No se pudo completar la operación. Intenta de nuevo.";
        try { const j = await res.json(); if (j && j.error) msg = j.error; } catch (_) {}
        throw new Error(msg);
      }
      return res;
    }
    async function refresh(col) {
      const set = subs[col];
      if (!set || !set.size) return;
      let rows;
      try { rows = await (await request("/api/" + col)).json(); }
      catch (e) { set.forEach((s) => s.error && s.error(e)); return; }
      const docs = rows.map(({ id, ...body }) => ({ id, data: () => body }));
      set.forEach((s) => s.next({ docs, metadata: { fromCache: false } }));
    }
    const randomId = () => {
      const a = "abcdefghijklmnopqrstuvwxyz0123456789";
      const bytes = new Uint8Array(20);
      (root.crypto || require("node:crypto").webcrypto).getRandomValues(bytes);
      return Array.from(bytes, (b) => a[b % a.length]).join("");
    };

    return {
      collection(col) {
        return {
          doc(id) {
            id = id || randomId();
            return {
              id,
              async set(body) {
                await request("/api/" + col + "/" + id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                await refresh(col);
              },
              async delete() {
                await request("/api/" + col + "/" + id, { method: "DELETE" });
                await refresh(col);
              },
            };
          },
          // vuelve a leer del servidor: lo que cambió en otro aparato llega antes de escribir encima
          refresh: () => refresh(col),
          onSnapshot(next, error) {
            const entry = { next, error };
            (subs[col] = subs[col] || new Set()).add(entry);
            refresh(col);
            return () => subs[col].delete(entry);
          },
        };
      },
    };
  }

  root.createApiDb = createApiDb;
  if (typeof module !== "undefined") module.exports = { createApiDb };
})(globalThis);
