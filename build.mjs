// Junta src/* en dist/index.html y dist/login.html, y calcula los hashes CSP
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");
const styles = read("styles.css");
const foto = fs.readFileSync(path.join(root, "src", "img", "acceso.jpg")).toString("base64");
const fotoAcceso = "\n.login-foto { background-image: url(data:image/jpeg;base64," + foto + "); }\n";
const pages = {
  "index.html": {
    template: "index.template.html",
    parts: {
      "/*STYLES*/": styles,
      "/*LOGIC*/": read("logic.js"),
      "/*APIDB*/": read("api-db.js"),
      "/*DATA*/": read("data.js"),
      "/*APP*/": read("app.js"),
    },
  },
  "login.html": {
    template: "login.template.html",
    // la foto del salón va incrustada: la CSP solo permite imágenes propias o data:
    parts: { "/*STYLES*/": styles + fotoAcceso, "/*LOGIN*/": read("login.js") },
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
