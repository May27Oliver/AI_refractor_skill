#!/usr/bin/env node

import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { caseById, cases, packs, selectCases } from "./catalog.mjs";

const SOURCE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".next", ".turbo", ".claude", "coverage", "dist", "node_modules",
]);

function parseArgs(argv) {
  const options = {
    target: ".",
    caseIds: [],
    pack: null,
    format: "markdown",
    language: "en",
    maxCandidates: 10,
    list: false,
    describe: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list") options.list = true;
    else if (arg === "--cases") options.caseIds.push(...readCsv(argv[++index], "--cases"));
    else if (arg === "--pack") options.pack = argv[++index];
    else if (arg === "--format") options.format = argv[++index];
    else if (arg === "--language") options.language = argv[++index];
    else if (arg === "--max-candidates") options.maxCandidates = readPositiveInt(argv[++index], arg);
    else if (arg === "--describe") options.describe = readCsv(argv[++index], "--describe");
    else if (arg === "--help" || arg === "-h") printHelpAndExit();
    else if (arg.startsWith("-")) throw new Error(`Unknown option: ${arg}`);
    else options.target = arg;
  }

  if (!new Set(["markdown", "json"]).has(options.format)) {
    throw new Error("--format must be markdown or json");
  }
  if (!new Set(["en", "zh-TW"]).has(options.language)) {
    throw new Error("--language must be en or zh-TW");
  }
  return options;
}

function readCsv(value, option) {
  if (!value) throw new Error(`${option} requires a comma-separated value`);
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function readPositiveInt(value, option) {
  const result = Number(value);
  if (!Number.isInteger(result) || result < 1) throw new Error(`${option} must be a positive integer`);
  return result;
}

function printHelpAndExit() {
  process.stdout.write(`Usage: refactor-scan.mjs [scope] [options]

Options:
  --pack <name>             Select a rotating topic pack
  --cases <ids>             Select comma-separated case IDs
  --max-candidates <count>  Cap scanner output (default: 10)
  --format markdown|json    Output format (default: markdown)
  --language en|zh-TW       Markdown language (default: en)
  --list                    List all 100 catalog entries and packs
  --describe <ids>          Print selected entries and related cases
`);
  process.exit(0);
}

async function collectFiles(target) {
  const resolved = path.resolve(target);
  const stat = await fs.stat(resolved);
  if (stat.isFile()) return SOURCE_EXTENSIONS.has(path.extname(resolved)) ? [resolved] : [];

  const files = [];
  async function visit(directory) {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) await visit(absolute);
      else if (entry.isFile() && SOURCE_EXTENSIONS.has(path.extname(entry.name))) files.push(absolute);
    }
  }
  await visit(resolved);
  return files.sort();
}

function sanitizeLines(source) {
  let inBlockComment = false;
  let inTemplate = false;
  return source.split(/\r?\n/).map((line) => {
    let result = "";
    let quote = null;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const next = line[index + 1];
      if (inBlockComment) {
        if (char === "*" && next === "/") {
          inBlockComment = false;
          index += 1;
        }
        result += " ";
        continue;
      }
      if (inTemplate) {
        if (char === "`" && line[index - 1] !== "\\") inTemplate = false;
        result += " ";
        continue;
      }
      if (quote) {
        if (char === quote && line[index - 1] !== "\\") quote = null;
        result += " ";
        continue;
      }
      if (char === "/" && next === "*") {
        inBlockComment = true;
        result += "  ";
        index += 1;
      } else if (char === "/" && next === "/") {
        result += " ".repeat(line.length - index);
        break;
      } else if (char === "`" ) {
        inTemplate = true;
        result += " ";
      } else if (char === "\"" || char === "'") {
        quote = char;
        result += " ";
      } else {
        result += char;
      }
    }
    return result;
  });
}

function braceDelta(line) {
  let delta = 0;
  for (const char of line) {
    if (char === "{") delta += 1;
    else if (char === "}") delta -= 1;
  }
  return delta;
}

function functionStart(line) {
  const arrow = line.match(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=.*(?:async\s*)?\([^)]*\)\s*(?::[^=]+)?=>\s*\{/);
  if (arrow) return arrow[1];
  const declared = line.match(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/);
  if (declared) return declared[1];
  const method = line.match(/^\s*(?:(?:public|private|protected|static|readonly|abstract|override)\s+)*(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^;]*\)\s*(?::[^={]+)?\s*\{/);
  if (method && !new Set(["if", "for", "while", "switch", "catch", "with"]).has(method[1])) return method[1];
  return null;
}

function plausibleBlockDeclaration(line, kind) {
  if (!line.trim()) return false;
  if (kind === "class") return /\bclass\s+[A-Za-z_$][\w$]*/.test(line);
  if (/\bfunction\s+[A-Za-z_$][\w$]*/.test(line)) return true;
  if (/^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=/.test(line)) return true;
  return /^\s*(?:(?:public|private|protected|static|readonly|abstract|override)\s+)*(?:async\s+)?[A-Za-z_$][\w$]*\s*\(/.test(line);
}

function blockStart(lines, start, kind) {
  if (!plausibleBlockDeclaration(lines[start], kind)) return null;
  let declaration = "";
  const lastLine = Math.min(lines.length, start + 16);
  for (let cursor = start; cursor < lastLine; cursor += 1) {
    declaration += `${lines[cursor]} `;
    if (declaration.length > 4_000) return null;
    const name = kind === "function"
      ? functionStart(declaration)
      : declaration.match(/\bclass\s+([A-Za-z_$][\w$]*)[^\{]*\{/)?.[1];
    if (name) return name;
    if (/;\s*$/.test(lines[cursor]) && !declaration.includes("=>")) return null;
  }
  return null;
}

function extractBlocks(lines, kind) {
  const blocks = [];
  for (let start = 0; start < lines.length; start += 1) {
    const name = blockStart(lines, start, kind);
    if (!name) continue;

    let balance = 0;
    let opened = false;
    let maxDepth = 0;
    let branches = 0;
    let cognitive = 0;
    let end = start;
    for (; end < lines.length; end += 1) {
      const line = lines[end];
      const depthBefore = balance;
      const delta = braceDelta(line);
      if (delta > 0) opened = true;
      balance += delta;
      maxDepth = Math.max(maxDepth, balance);
      const controlCount = (line.match(/\b(?:if|else\s+if|for|while|case|catch)\b|&&|\|\||\?/g) ?? []).length;
      branches += controlCount;
      if (controlCount) cognitive += controlCount * Math.max(1, depthBefore);
      if (opened && balance <= 0) break;
    }
    if (opened) blocks.push({ name, start: start + 1, end: end + 1, maxDepth, branches, cognitive });
  }
  return blocks;
}

function parameterCount(line) {
  const match = line.match(/\(([^()]*)\)/);
  if (!match || !match[1].trim()) return 0;
  return match[1].split(",").length;
}

function candidate(caseId, file, line, symbol, evidence, confidence, score) {
  const definition = caseById.get(caseId);
  return {
    caseId,
    caseTitle: definition.title,
    caseTitleZh: definition.titleZh,
    file,
    line,
    symbol: symbol || undefined,
    evidence,
    confidence,
    score,
    related: definition.related,
  };
}

function portableCandidate(item) {
  const definition = caseById.get(item.caseId);
  const identity = [item.caseId, item.file, item.line, item.symbol ?? ""].join("|");
  const digest = createHash("sha256").update(identity).digest("hex").slice(0, 16);
  return {
    candidateId: `RF-${digest}`,
    case: { ...definition },
    location: {
      file: item.file,
      line: item.line,
      ...(item.symbol ? { symbol: item.symbol } : {}),
    },
    evidence: {
      summary: item.evidence,
      detector: "heuristic",
      confidence: item.confidence,
    },
    planningOptions: item.related.map((id) => ({ ...caseById.get(id) })),
    review: {
      status: "unreviewed",
      maintenanceImpact: null,
      falsePositiveCheck: null,
      behaviorRisks: [],
      testProtection: null,
    },
  };
}

function scanFile(file, source, selectedIds) {
  const relative = path.relative(process.cwd(), file) || path.basename(file);
  const lines = sanitizeLines(source);
  const functions = extractBlocks(lines, "function");
  const classes = extractBlocks(lines, "class");
  const results = [];

  for (const fn of functions) {
    const length = fn.end - fn.start + 1;
    if (selectedIds.has("001") && length >= 60) {
      results.push(candidate("001", relative, fn.start, fn.name, `Function spans ${length} lines (threshold: 60).`, "medium", length));
    }
    if (selectedIds.has("004") && fn.maxDepth >= 5) {
      results.push(candidate("004", relative, fn.start, fn.name, `Approximate block nesting depth is ${fn.maxDepth} (threshold: 5).`, "medium", fn.maxDepth * 10));
    }
    if (selectedIds.has("007")) {
      const count = parameterCount(lines[fn.start - 1]);
      if (count >= 6) results.push(candidate("007", relative, fn.start, fn.name, `Declaration has approximately ${count} parameters (threshold: 6).`, "medium", count * 10));
    }
    if (selectedIds.has("088") && fn.branches >= 11) {
      results.push(candidate("088", relative, fn.start, fn.name, `Approximate branch count is ${fn.branches} (review threshold: 11).`, "medium", fn.branches * 10));
    }
    if (selectedIds.has("089") && fn.cognitive >= 16) {
      results.push(candidate("089", relative, fn.start, fn.name, `Approximate nesting-weighted complexity is ${fn.cognitive} (review threshold: 16).`, "low", fn.cognitive));
    }
  }

  if (selectedIds.has("006")) {
    for (const item of classes) {
      const length = item.end - item.start + 1;
      if (length >= 300) results.push(candidate("006", relative, item.start, item.name, `Class spans ${length} lines (threshold: 300).`, "low", length));
    }
  }

  if (selectedIds.has("003")) {
    lines.forEach((line, index) => {
      const match = line.match(/\b(?:const|let|var)\s+([A-Za-z_$])\b/);
      if (match && !new Set(["i", "j", "k", "x", "y"]).has(match[1])) {
        results.push(candidate("003", relative, index + 1, match[1], `Single-character variable name '${match[1]}' requires contextual review.`, "low", 5));
      }
    });
  }

  if (selectedIds.has("005")) {
    lines.forEach((line, index) => {
      if (/\b(?:const|enum)\b/.test(line) || /^\s*(?:import|export)\b/.test(line)) return;
      const numbers = [...line.matchAll(/(?<![\w.])-?\d+(?:\.\d+)?(?![\w.])/g)]
        .map((match) => match[0])
        .filter((number) => !new Set(["-1", "0", "1", "2", "100"]).has(number));
      if (numbers.length) results.push(candidate("005", relative, index + 1, null, `Unexplained numeric literal(s): ${[...new Set(numbers)].join(", ")}.`, "low", numbers.length));
    });
  }

  if (selectedIds.has("012")) {
    let depth = 0;
    lines.forEach((line, index) => {
      if (depth === 0 && /^\s*(?:export\s+)?(?:let|var)\s+[A-Za-z_$]/.test(line)) {
        results.push(candidate("012", relative, index + 1, null, "Mutable module-level binding; confirm whether shared mutation crosses boundaries.", "medium", 20));
      }
      depth += braceDelta(line);
    });
  }

  if (selectedIds.has("016")) {
    lines.forEach((line, index) => {
      if (!/\bswitch\s*\(/.test(line)) return;
      let casesCount = 0;
      let balance = 0;
      for (let cursor = index; cursor < lines.length; cursor += 1) {
        balance += braceDelta(lines[cursor]);
        casesCount += (lines[cursor].match(/\bcase\b/g) ?? []).length;
        if (cursor > index && balance <= 0) break;
      }
      if (casesCount >= 5) results.push(candidate("016", relative, index + 1, null, `Switch has ${casesCount} cases; inspect repetition across the codebase before choosing a replacement.`, "low", casesCount * 5));
    });
  }

  if (selectedIds.has("018")) {
    lines.forEach((line, index) => {
      const chain = line.match(/(?:\.[A-Za-z_$][\w$]*(?:\([^)]*\))?){4,}/)?.[0];
      if (chain) results.push(candidate("018", relative, index + 1, null, `Call/property chain contains at least four hops: ${chain.slice(0, 120)}.`, "low", chain.length));
    });
  }

  if (selectedIds.has("071")) {
    const emptyCatch = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g;
    for (const match of source.matchAll(emptyCatch)) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      results.push(candidate("071", relative, line, null, "Empty catch block discards an exception without an observable handling policy.", "high", 100));
    }
  }

  return { relative, source, lines, functions, results };
}

function detectDeadCode(scannedFiles, selectedIds) {
  if (!selectedIds.has("008")) return [];
  const corpus = scannedFiles.map((file) => file.source).join("\n");
  const results = [];
  for (const file of scannedFiles) {
    for (const fn of file.functions) {
      const declaration = file.lines[fn.start - 1];
      if (/\bexport\b|@\w+/.test(declaration)) continue;
      const occurrences = corpus.match(new RegExp(`\\b${escapeRegExp(fn.name)}\\b`, "g"))?.length ?? 0;
      if (occurrences === 1) {
        results.push(candidate("008", file.relative, fn.start, fn.name, "Symbol appears only at its declaration in the scanned scope; dynamic or framework use must be checked.", "low", 10));
      }
    }
  }
  return results;
}

function detectDuplicates(scannedFiles, selectedIds) {
  if (!selectedIds.has("002")) return [];
  const windows = new Map();
  const windowSize = 8;
  for (const file of scannedFiles) {
    const normalized = file.lines.map((line) => line.trim()).filter((line) => line && !/^(?:[{}]|import\b|export\s+\{)/.test(line));
    for (let index = 0; index <= normalized.length - windowSize; index += 1) {
      const block = normalized.slice(index, index + windowSize).join("\n");
      if (block.length < 160) continue;
      const locations = windows.get(block) ?? [];
      locations.push({ file: file.relative, line: index + 1 });
      windows.set(block, locations);
    }
  }
  const results = [];
  for (const locations of windows.values()) {
    const distinctFiles = new Set(locations.map((item) => item.file));
    if (locations.length < 2 || distinctFiles.size < 2) continue;
    const first = locations[0];
    results.push(candidate("002", first.file, first.line, null, `Similar normalized ${windowSize}-line block appears in ${distinctFiles.size} files.`, "medium", distinctFiles.size * 20));
  }
  return results;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function renderList() {
  const packLines = Object.entries(packs).map(([name, ids]) => `- ${name}: ${ids.join(", ")}`).join("\n");
  const caseLines = cases.map((item) => `${item.id}\t${item.kind}\t${item.scanMode}\t${item.title}\t${item.titleZh}`).join("\n");
  return `Packs:\n${packLines}\n\nID\tKind\tScan mode\tEnglish\t繁中\n${caseLines}\n`;
}

function renderDescriptions(ids) {
  const selected = selectCases(ids);
  const expandedIds = new Set(selected.flatMap((item) => [item.id, ...item.related]));
  return [...expandedIds].map((id) => {
    const item = caseById.get(id);
    return `## ${item.id} ${item.title}（${item.titleZh}）\n\n- Kind: ${item.kind}\n- Scan mode: ${item.scanMode}\n- Intent: ${item.intent}\n- Related: ${item.related.join(", ") || "none"}`;
  }).join("\n\n");
}

function takeRoundRobin(candidates, caseOrder, limit) {
  const groups = new Map(caseOrder.map((id) => [id, []]));
  for (const item of candidates) {
    if (!groups.has(item.caseId)) groups.set(item.caseId, []);
    groups.get(item.caseId).push(item);
  }
  for (const group of groups.values()) {
    group.sort((left, right) => right.score - left.score || left.file.localeCompare(right.file) || left.line - right.line);
  }

  const result = [];
  while (result.length < limit) {
    let added = false;
    for (const id of groups.keys()) {
      const next = groups.get(id).shift();
      if (!next) continue;
      result.push(next);
      added = true;
      if (result.length === limit) break;
    }
    if (!added) break;
  }
  return result;
}

function renderMarkdownZhTw(report) {
  const lines = [
    "# 重構候選掃描",
    "",
    `- 範圍：${report.scope}`,
    `- 掃描檔案：${report.filesScanned}`,
    `- 選定案例：${report.selectedCases.map((item) => item.id).join(", ")}`,
    `- 自動偵測：${report.heuristicCases.join(", ") || "無"}`,
  ];
  if (report.unscannedCases.length) lines.push(`- 需人工或外部工具：${report.unscannedCases.map((item) => `${item.id} ${item.titleZh}`).join("、")}`);
  lines.push("", "## 候選項", "");
  if (!report.candidates.length) lines.push("本次啟發式掃描未產生候選；這不代表範圍內沒有重構機會。");
  report.candidates.forEach((item, index) => {
    lines.push(
      `### ${index + 1}. ${item.case.id} ${item.case.titleZh}`,
      "",
      `- Candidate ID：${item.candidateId}`,
      `- 位置：${item.location.file}:${item.location.line}${item.location.symbol ? `（${item.location.symbol}）` : ""}`,
      `- 證據：${item.evidence.summary}`,
      `- 信心：${item.evidence.confidence}`,
      `- Plan 可評估：${item.planningOptions.map((option) => option.id).join(", ") || "無"}`,
      "",
    );
  });
  lines.push("原始結果僅是候選訊號；進入 plan 前仍須確認維護影響、誤判與行為風險。", "");
  return lines.join("\n");
}

function renderMarkdownEn(report) {
  const lines = [
    "# Refactoring candidate scan",
    "",
    `- Scope: ${report.scope}`,
    `- Files scanned: ${report.filesScanned}`,
    `- Selected cases: ${report.selectedCases.map((item) => item.id).join(", ")}`,
    `- Heuristic cases: ${report.heuristicCases.join(", ") || "none"}`,
  ];
  if (report.unscannedCases.length) lines.push(`- Manual or external review: ${report.unscannedCases.map((item) => `${item.id} ${item.title}`).join(", ")}`);
  lines.push("", "## Candidates", "");
  if (!report.candidates.length) lines.push("This heuristic scan produced no candidates; that does not prove the scope has no refactoring opportunities.");
  report.candidates.forEach((item, index) => {
    lines.push(
      `### ${index + 1}. ${item.case.id} ${item.case.title}`,
      "",
      `- Candidate ID: ${item.candidateId}`,
      `- Location: ${item.location.file}:${item.location.line}${item.location.symbol ? ` (${item.location.symbol})` : ""}`,
      `- Evidence: ${item.evidence.summary}`,
      `- Confidence: ${item.evidence.confidence}`,
      `- Planning options: ${item.planningOptions.map((option) => option.id).join(", ") || "none"}`,
      "",
    );
  });
  lines.push("Raw results are candidate signals. Confirm maintenance impact, false positives, and behavior risks before planning.", "");
  return lines.join("\n");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.list) {
    process.stdout.write(renderList());
    return;
  }
  if (options.describe) {
    process.stdout.write(`${renderDescriptions(options.describe)}\n`);
    return;
  }

  const packIds = options.pack
    ? packs[options.pack] ?? (() => { throw new Error(`Unknown pack: ${options.pack}`); })()
    : [];
  const requestedIds = [...new Set([...packIds, ...options.caseIds])];
  const selectedCases = selectCases(requestedIds.length ? requestedIds : packs.complexity);
  const heuristicCases = selectedCases.filter((item) => item.scanMode === "heuristic").map((item) => item.id);
  const selectedIds = new Set(heuristicCases);
  const files = await collectFiles(options.target);
  const scannedFiles = [];
  for (const file of files) {
    const source = await fs.readFile(file, "utf8");
    if (source.length > 750_000) continue;
    scannedFiles.push(scanFile(file, source, selectedIds));
  }

  const candidates = scannedFiles.flatMap((item) => item.results);
  candidates.push(...detectDeadCode(scannedFiles, selectedIds));
  candidates.push(...detectDuplicates(scannedFiles, selectedIds));
  const boundedCandidates = takeRoundRobin(candidates, heuristicCases, options.maxCandidates);

  const report = {
    schemaVersion: "1.0.0",
    producer: { name: "refactor-scan", version: "0.2.0" },
    scope: path.relative(process.cwd(), path.resolve(options.target)) || ".",
    generatedAt: new Date().toISOString(),
    filesScanned: scannedFiles.length,
    selectedCases,
    heuristicCases,
    unscannedCases: selectedCases.filter((item) => item.scanMode !== "heuristic"),
    candidates: boundedCandidates.map(portableCandidate),
  };

  const markdown = options.language === "zh-TW" ? renderMarkdownZhTw(report) : renderMarkdownEn(report);
  process.stdout.write(options.format === "json" ? `${JSON.stringify(report, null, 2)}\n` : markdown);
}

main().catch((error) => {
  process.stderr.write(`refactor-scan: ${error.message}\n`);
  process.exitCode = 1;
});
