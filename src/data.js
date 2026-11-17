// capa de datos: Store
(function (root) {
  const Store = { ready: false };
  root.Store = Store;
  if (typeof module !== "undefined") module.exports = Store;
})(globalThis);
