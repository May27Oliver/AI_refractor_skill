#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.join(repositoryRoot, "skills");
const errors = [];

async function filesBelow(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await filesBelow(target));
    else if (entry.isFile()) result.push(target);
  }
  return result;
}

function privacyIssues(source) {
  const issues = [];
  if (/^\s+author\s*:/m.test(source)) issues.push("author metadata");
  if (/\/(?:Users|home)\/[^/\s]+\//.test(source) || /[A-Za-z]:\\Users\\[^\\\s]+\\/.test(source)) {
    issues.push("user-specific home path");
  }
  if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(source)) issues.push("email address");
  return issues;
}

function frontmatter(markdown) {
  const match = markdown.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) return null;
  const values = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([a-z][a-z0-9-]*):\s*(.+)$/);
    if (field) values[field[1]] = field[2].replace(/^['"]|['"]$/g, "");
  }
  return values;
}

const entries = await fs.readdir(root, { withFileTypes: true });
for (const entry of entries.filter((item) => item.isDirectory()).sort((a, b) => a.name.localeCompare(b.name))) {
  const manifestPath = path.join(root, entry.name, "SKILL.md");
  let markdown;
  try {
    markdown = await fs.readFile(manifestPath, "utf8");
  } catch (error) {
    errors.push(`${entry.name}: missing readable SKILL.md (${error.message})`);
    continue;
  }
  const metadata = frontmatter(markdown);
  if (!metadata) {
    errors.push(`${entry.name}: invalid or missing YAML frontmatter`);
    continue;
  }
  if (metadata.name !== entry.name) errors.push(`${entry.name}: frontmatter name must match directory`);
  if (!metadata.description) errors.push(`${entry.name}: description is required`);
  if (!metadata.compatibility) errors.push(`${entry.name}: compatibility is required for this script-backed portable bundle`);
  if (/\/Users\/|[A-Za-z]:\\Users\\/.test(markdown)) errors.push(`${entry.name}: SKILL.md contains a user-specific absolute path`);

  for (const match of markdown.matchAll(/\[[^\]]+\]\((?!https?:|#)([^)]+)\)/g)) {
    const reference = match[1].split("#")[0];
    const target = path.resolve(path.dirname(manifestPath), reference);
    try {
      await fs.access(target);
    } catch {
      errors.push(`${entry.name}: missing referenced file ${reference}`);
    }
  }
}

for (const file of await filesBelow(repositoryRoot)) {
  const relative = path.relative(repositoryRoot, file);
  const source = await fs.readFile(file, "utf8");
  for (const issue of privacyIssues(source)) errors.push(`${relative}: contains ${issue}`);
}

if (errors.length) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Validated ${entries.filter((item) => item.isDirectory()).length} portable skills.\n`);
}
