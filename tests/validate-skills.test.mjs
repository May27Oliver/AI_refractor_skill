import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("portable validator has no third-party runtime dependencies", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "validate-skills.mjs"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("node:")));
});
