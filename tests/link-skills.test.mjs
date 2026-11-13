import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const installer = path.resolve(import.meta.dirname, "..", "install", "link-skills.mjs");

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "portable-skills-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const sourceRoot = path.join(root, "source");
  const home = path.join(root, "home");
  await fs.mkdir(path.join(sourceRoot, "refactor-scan"), { recursive: true });
  await fs.mkdir(path.join(sourceRoot, "refactor-plan"), { recursive: true });
  await fs.writeFile(path.join(sourceRoot, "refactor-scan", "SKILL.md"), "---\nname: refactor-scan\ndescription: scan\n---\n");
  await fs.writeFile(path.join(sourceRoot, "refactor-plan", "SKILL.md"), "---\nname: refactor-plan\ndescription: plan\n---\n");
  return { root, sourceRoot, home };
}

async function run(args, expectedFailure = false) {
  try {
    return await execFileAsync(process.execPath, [installer, ...args]);
  } catch (error) {
    if (!expectedFailure) throw error;
    return error;
  }
}

test("dry run reports both agents without creating install roots", async (t) => {
  const { sourceRoot, home } = await fixture(t);
  const { stdout } = await run(["--source-root", sourceRoot, "--home", home, "--format", "json"]);
  const report = JSON.parse(stdout);
  assert.equal(report.applied, false);
  assert.equal(report.actions.length, 4);
  assert.ok(report.actions.every((action) => action.status === "link"));
  await assert.rejects(fs.stat(path.join(home, ".agents")), { code: "ENOENT" });
  await assert.rejects(fs.stat(path.join(home, ".claude")), { code: "ENOENT" });
});

test("apply creates user-scoped links for Codex and Claude Code", async (t) => {
  const { sourceRoot, home } = await fixture(t);
  const { stdout } = await run(["--source-root", sourceRoot, "--home", home, "--apply", "--format", "json"]);
  const report = JSON.parse(stdout);
  assert.equal(report.applied, true);
  assert.ok(report.actions.every((action) => action.status === "linked"));
  for (const relative of [
    [".agents", "skills", "refactor-scan"],
    [".agents", "skills", "refactor-plan"],
    [".claude", "skills", "refactor-scan"],
    [".claude", "skills", "refactor-plan"],
  ]) {
    assert.equal((await fs.lstat(path.join(home, ...relative))).isSymbolicLink(), true);
  }
});

test("existing correct links are idempotent", async (t) => {
  const { sourceRoot, home } = await fixture(t);
  const args = ["--source-root", sourceRoot, "--home", home, "--agent", "codex", "--skill", "refactor-scan", "--apply", "--format", "json"];
  await run(args);
  const { stdout } = await run(args);
  const report = JSON.parse(stdout);
  assert.equal(report.applied, true);
  assert.equal(report.actions[0].status, "already-linked");
});

test("any conflict aborts the entire plan without partial links", async (t) => {
  const { sourceRoot, home } = await fixture(t);
  const conflict = path.join(home, ".agents", "skills", "refactor-plan");
  await fs.mkdir(conflict, { recursive: true });
  const result = await run([
    "--source-root", sourceRoot,
    "--home", home,
    "--agent", "codex",
    "--apply",
    "--format", "json",
  ], true);
  assert.equal(result.code, 2);
  const report = JSON.parse(result.stdout);
  assert.equal(report.applied, false);
  assert.ok(report.actions.some((action) => action.status === "conflict"));
  await assert.rejects(fs.lstat(path.join(home, ".agents", "skills", "refactor-scan")), { code: "ENOENT" });
});
