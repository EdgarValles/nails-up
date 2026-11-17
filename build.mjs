// Junta src/* en un solo dist/index.html
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => fs.readFileSync(path.join(root, "src", f), "utf8");
const parts = {
  "/*STYLES*/": read("styles.css"),
  "/*LOGIC*/": read("logic.js"),
  "/*DATA*/": read("data.js"),
  "/*APP*/": read("app.js"),
};
let html = read("index.template.html");
for (const [marker, code] of Object.entries(parts)) html = html.split(marker).join(code);
fs.mkdirSync(path.join(root, "dist"), { recursive: true });
fs.writeFileSync(path.join(root, "dist/index.html"), html);
