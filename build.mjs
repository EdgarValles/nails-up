// Junta src/* en dist/index.html y dist/login.html, y calcula los hashes CSP
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");
const styles = read("styles.css");
// las imágenes van incrustadas: la CSP solo permite imágenes propias o data:
const img = (f, type) => "data:" + type + ";base64," + fs.readFileSync(path.join(root, "src", "img", f)).toString("base64");
const icono = '<link rel="icon" type="image/png" href="' + img("icono.png", "image/png") + '">';
const marca = "\n.brand::before { background-image: url(" + img("icono.png", "image/png") + "); }\n";
const fotoAcceso = marca + ".login-foto { background-image: url(" + img("acceso.jpg", "image/jpeg") + "); }\n" +
  ".login-logo { background-image: url(" + img("logo.png", "image/png") + "); }\n";
const pages = {
  "index.html": {
    template: "index.template.html",
    parts: {
      "/*STYLES*/": styles + marca,
      "<!--ICONO-->": icono,
      "/*LOGIC*/": read("logic.js"),
      "/*APIDB*/": read("api-db.js"),
      "/*DATA*/": read("data.js"),
      "/*APP*/": read("app.js"),
    },
  },
  "login.html": {
    template: "login.template.html",
    parts: { "/*STYLES*/": styles + fotoAcceso, "<!--ICONO-->": icono, "/*LOGIN*/": read("login.js") },
  },
};
const sha = (s) => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";
const hashes = (html, tag) =>
  [...html.matchAll(new RegExp(`<${tag}>([^]*?)</${tag}>`, "g"))].map((m) => sha(m[1]));

fs.mkdirSync(path.join(root, "dist"), { recursive: true });
const csp = {};
for (const [out, { template, parts }] of Object.entries(pages)) {
  let html = read(template);
  for (const [marker, code] of Object.entries(parts)) html = html.split(marker).join(code);
  fs.writeFileSync(path.join(root, "dist", out), html);
  csp[out] = { script: hashes(html, "script"), style: hashes(html, "style") };
}
fs.writeFileSync(path.join(root, "dist/csp.json"), JSON.stringify(csp, null, 2));
