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
