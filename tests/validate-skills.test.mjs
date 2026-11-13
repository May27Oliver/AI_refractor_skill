import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

test("portable validator has no third-party runtime dependencies", async () => {
  const source = await readFile(path.resolve(import.meta.dirname, "validate-skills.mjs"), "utf8");
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.every((specifier) => specifier.startsWith("node:")));
});

test("portable validator ignores repository metadata", async () => {
  const validator = path.resolve(import.meta.dirname, "validate-skills.mjs");
  const result = await execFileAsync(process.execPath, [validator]);
  assert.match(result.stdout, /Validated 3 portable skills/);
});
