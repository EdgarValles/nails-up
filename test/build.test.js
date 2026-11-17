const test = require("node:test");
const assert = require("node:assert");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

test("build inlines logic, data, styles and app into dist/index.html", () => {
  const root = path.join(__dirname, "..");
  execFileSync("node", ["build.mjs"], { cwd: root });
  const html = fs.readFileSync(path.join(root, "dist/index.html"), "utf8");
  assert.ok(html.includes("NailsLogic"));
  assert.ok(html.includes("Store"));
  assert.ok(html.includes("<style>"));
  assert.ok(!html.includes("<script src="));
  assert.ok(!html.includes('<link rel="stylesheet"'));
});

const crypto = require("node:crypto");
const root = path.join(__dirname, "..");
const sha = (s) => "'sha256-" + crypto.createHash("sha256").update(s, "utf8").digest("base64") + "'";

test("build genera login.html sin scripts externos ni style inline", () => {
  execFileSync("node", ["build.mjs"], { cwd: root });
  const html = fs.readFileSync(path.join(root, "dist/login.html"), "utf8");
  assert.ok(html.includes("<form"));
  assert.ok(html.includes('type="password"'));
  assert.ok(!html.includes("<script src="));
  assert.ok(!html.includes('style="'));
});

test("build escribe dist/csp.json con los hashes de cada pagina", () => {
  execFileSync("node", ["build.mjs"], { cwd: root });
  const csp = JSON.parse(fs.readFileSync(path.join(root, "dist/csp.json"), "utf8"));
  assert.strictEqual(csp["index.html"].script.length, 4);
  assert.strictEqual(csp["index.html"].style.length, 1);
  assert.ok(csp["login.html"].script.length >= 1);
  assert.ok(csp["login.html"].style.length >= 1);
  for (const page of ["index.html", "login.html"]) {
    const html = fs.readFileSync(path.join(root, "dist", page), "utf8");
    for (const [tag, key] of [["script", "script"], ["style", "style"]]) {
      const blocks = [...html.matchAll(new RegExp(`<${tag}>([^]*?)</${tag}>`, "g"))];
      assert.ok(blocks.length > 0);
      for (const b of blocks) assert.ok(csp[page][key].includes(sha(b[1])), page + " " + tag);
    }
  }
});

test("app.js no usa setAttribute style (CSP)", () => {
  const app = fs.readFileSync(path.join(root, "src/app.js"), "utf8");
  assert.ok(!app.includes('setAttribute("style"'));
});
