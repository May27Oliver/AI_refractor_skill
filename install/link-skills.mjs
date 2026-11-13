#!/usr/bin/env node

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const AGENTS = {
  codex: [".agents", "skills"],
  "claude-code": [".claude", "skills"],
};

export function parseArgs(argv) {
  const options = {
    agents: ["codex", "claude-code"],
    apply: false,
    format: "text",
    home: os.homedir(),
    skills: null,
    sourceRoot: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "skills"),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--agent") {
      const value = requiredValue(argv[++index], arg);
      options.agents = value === "all" ? Object.keys(AGENTS) : [value];
    } else if (arg === "--skill") {
      options.skills = requiredValue(argv[++index], arg).split(",").map((item) => item.trim()).filter(Boolean);
    } else if (arg === "--apply") {
      options.apply = true;
    } else if (arg === "--dry-run") {
      options.apply = false;
    } else if (arg === "--format") {
      options.format = requiredValue(argv[++index], arg);
    } else if (arg === "--home") {
      options.home = path.resolve(requiredValue(argv[++index], arg));
    } else if (arg === "--source-root") {
      options.sourceRoot = path.resolve(requiredValue(argv[++index], arg));
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      return null;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  for (const agent of options.agents) {
    if (!AGENTS[agent]) throw new Error(`Unknown agent: ${agent}`);
  }
  if (!new Set(["text", "json"]).has(options.format)) {
    throw new Error("--format must be text or json");
  }
  if (options.skills) options.skills.forEach(validateSkillName);
  return options;
}

function requiredValue(value, option) {
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value`);
  return value;
}

function validateSkillName(name) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) {
    throw new Error(`Invalid skill name: ${name}`);
  }
}

function printHelp() {
  process.stdout.write(`Usage: node install/link-skills.mjs [options]

Safely link portable skills into user-scoped agent directories. The default is
a dry run for both Codex and Claude Code.

Options:
  --agent codex|claude-code|all  Target agent (default: all)
  --skill name[,name]            Link only selected skills (default: all)
  --apply                        Create directories and symbolic links
  --dry-run                      Report actions without changing files (default)
  --format text|json             Output format (default: text)
  --home <path>                  Override the user home (useful for testing)
  --source-root <path>           Override the canonical skills directory
  --help                         Show this help
`);
}

async function pathState(target) {
  try {
    const stat = await fs.lstat(target);
    if (!stat.isSymbolicLink()) return { kind: "conflict", detail: "target already exists and is not a symbolic link" };
    const rawLink = await fs.readlink(target);
    return { kind: "symlink", resolved: path.resolve(path.dirname(target), rawLink) };
  } catch (error) {
    if (error.code === "ENOENT") return { kind: "absent" };
    throw error;
  }
}

async function discoverSkills(sourceRoot, selectedNames) {
  const entries = await fs.readdir(sourceRoot, { withFileTypes: true });
  const available = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const requested = selectedNames ?? available;
  if (!requested.length) throw new Error(`No skill directories found in ${sourceRoot}`);

  const skills = [];
  for (const name of requested) {
    validateSkillName(name);
    if (!available.includes(name)) throw new Error(`Unknown skill in source root: ${name}`);
    const source = path.join(sourceRoot, name);
    const manifest = path.join(source, "SKILL.md");
    try {
      const stat = await fs.stat(manifest);
      if (!stat.isFile()) throw new Error("not a regular file");
    } catch (error) {
      throw new Error(`Skill ${name} has no readable SKILL.md: ${error.message}`);
    }
    skills.push({ name, source: await fs.realpath(source) });
  }
  return skills;
}

export async function buildPlan(options) {
  const skills = await discoverSkills(options.sourceRoot, options.skills);
  const actions = [];
  for (const agent of options.agents) {
    const installRoot = path.join(options.home, ...AGENTS[agent]);
    for (const skill of skills) {
      const target = path.join(installRoot, skill.name);
      const state = await pathState(target);
      let status = "link";
      let reason;
      if (state.kind === "conflict") {
        status = "conflict";
        reason = state.detail;
      } else if (state.kind === "symlink") {
        if (state.resolved === skill.source) status = "already-linked";
        else {
          status = "conflict";
          reason = `target links to ${state.resolved}`;
        }
      }
      actions.push({ agent, skill: skill.name, source: skill.source, target, status, ...(reason ? { reason } : {}) });
    }
  }
  return actions;
}

export async function applyPlan(actions) {
  const conflicts = actions.filter((action) => action.status === "conflict");
  if (conflicts.length) return { applied: false, conflicts };

  for (const action of actions) {
    if (action.status !== "link") continue;
    await fs.mkdir(path.dirname(action.target), { recursive: true });
    await fs.symlink(action.source, action.target, process.platform === "win32" ? "junction" : "dir");
    action.status = "linked";
  }
  return { applied: true, conflicts: [] };
}

function renderText(actions, applyRequested) {
  const mode = applyRequested ? "apply" : "dry-run";
  const lines = [`mode: ${mode}`];
  for (const action of actions) {
    const detail = action.reason ? ` (${action.reason})` : "";
    lines.push(`${action.status}\t${action.agent}\t${action.skill}\t${action.target}${detail}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!options) return;
  const actions = await buildPlan(options);
  const conflicts = actions.filter((action) => action.status === "conflict");

  if (options.apply && !conflicts.length) await applyPlan(actions);

  const report = {
    mode: options.apply ? "apply" : "dry-run",
    applied: options.apply && !conflicts.length,
    actions,
  };
  process.stdout.write(options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : renderText(actions, options.apply));
  if (conflicts.length) process.exitCode = 2;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`link-skills: ${error.message}\n`);
    process.exitCode = 1;
  });
}
