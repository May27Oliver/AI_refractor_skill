import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";
import { cases, packs, selectCases } from "./catalog.mjs";

const execFileAsync = promisify(execFile);
const scanner = path.resolve(import.meta.dirname, "refactor-scan.mjs");

test("catalog contains exactly 100 unique cases", () => {
  assert.equal(cases.length, 100);
  assert.equal(new Set(cases.map((item) => item.id)).size, 100);
  assert.deepEqual(cases.map((item) => item.id), Array.from({ length: 100 }, (_, index) => String(index + 1).padStart(3, "0")));
  assert.ok(cases.every((item) => typeof item.intent === "string" && item.intent.length > 20));
});

test("packs only reference known cases", () => {
  const known = new Set(cases.map((item) => item.id));
  for (const ids of Object.values(packs)) {
    ids.forEach((id) => assert.ok(known.has(id), `unknown pack case ${id}`));
  }
});

test("selectCases normalizes numeric-looking IDs", () => {
  assert.equal(selectCases(["1"])[0].id, "001");
});

test("scanner emits bounded JSON candidates and separates contextual cases", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-scan-"));
  try {
    const body = Array.from({ length: 64 }, (_, index) => `  total += ${index + 3};`).join("\n");
    await fs.writeFile(path.join(directory, "sample.ts"), `
export function calculate(a, b, c, d, e, f) {
  let total = 0;
${body}
  return total;
}

try {
  calculate(1, 2, 3, 4, 5, 6);
} catch (error) {}
`);

    const { stdout } = await execFileAsync(process.execPath, [
      scanner,
      directory,
      "--cases", "001,007,071,076",
      "--format", "json",
      "--max-candidates", "3",
    ]);
    const report = JSON.parse(stdout);
    assert.equal(report.candidates.length, 3);
    assert.equal(report.schemaVersion, "1.0.0");
    assert.ok(report.candidates.some((item) => item.case.id === "001"));
    assert.ok(report.candidates.some((item) => item.case.id === "007"));
    assert.ok(report.candidates.some((item) => item.case.id === "071"));
    assert.ok(report.candidates.every((item) => item.candidateId.startsWith("RF-")));
    assert.ok(report.candidates.every((item) => item.case.intent));
    assert.ok(report.candidates.every((item) => Array.isArray(item.planningOptions)));
    assert.deepEqual(report.unscannedCases.map((item) => item.id), ["076"]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("scanner detects multiline TypeScript function declarations", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-scan-multiline-"));
  try {
    const body = Array.from({ length: 64 }, (_, index) => `  total += ${index + 3};`).join("\n");
    await fs.writeFile(path.join(directory, "multiline.ts"), `
export function calculate(
  first: number,
  second: number,
): number {
  let total = first + second;
${body}
  return total;
}
`);

    const { stdout } = await execFileAsync(process.execPath, [
      scanner,
      directory,
      "--cases", "001,088,089",
      "--format", "json",
      "--max-candidates", "5",
    ]);
    const report = JSON.parse(stdout);
    const longMethods = report.candidates.filter((item) => item.case.id === "001" && item.location.symbol === "calculate");
    assert.equal(longMethods.length, 1);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("scanner detects multiline methods with inline object parameter types", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-scan-inline-type-"));
  try {
    const body = Array.from({ length: 64 }, (_, index) => `    total += ${index + 3};`).join("\n");
    await fs.writeFile(path.join(directory, "service.ts"), `
class ExampleService {
  private async commit(
    input: {
      first: number;
      second: number;
    },
  ) {
    let total = input.first + input.second;
${body}
    return total;
  }
}
`);

    const { stdout } = await execFileAsync(process.execPath, [
      scanner,
      directory,
      "--cases", "001,088,089",
      "--format", "json",
      "--max-candidates", "10",
    ]);
    const report = JSON.parse(stdout);
    const candidate = report.candidates.find(
      (item) => item.case.id === "001" && item.location.symbol === "commit",
    );
    assert.ok(candidate);
    assert.equal(candidate.evidence.metrics.lineStart, 3);
    assert.ok(candidate.evidence.metrics.lineCount >= 60);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("long-parameter scan ignores trailing commas and nested TypeScript type commas", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-scan-parameters-"));
  try {
    await fs.writeFile(path.join(directory, "service.ts"), `
declare const TOKEN: symbol;
declare function Inject(token: symbol): ParameterDecorator;

class ExampleService {
  constructor(
    first: string,
    second: number,
    third: boolean,
    @Inject(TOKEN) fourth: object,
    fifth: Date,
  ) {
    return first;
  }

  private storeSignatures(
    first: string,
    second: Map<number, Buffer>,
    third: Array<Record<string, number>>,
    fourth: boolean,
    fifth: Date,
  ) {
    return first;
  }

  private repeatedResult(
    first: string,
    second: { left: number; pair: [number, number] },
    third: (left: number, right: number) => boolean,
    fourth: Promise<Map<string, Array<number>>>,
    fifth: Date,
  ) {
    return first;
  }

  private actualLongList(
    first: string,
    second: Map<number, Buffer>,
    third: { left: number; right: number },
    fourth: (left: number, right: number) => boolean,
    fifth: [number, number],
    sixth: Date,
  ) {
    return first;
  }
}
`);

    const { stdout } = await execFileAsync(process.execPath, [
      scanner,
      directory,
      "--cases", "007",
      "--format", "json",
      "--max-candidates", "10",
    ]);
    const report = JSON.parse(stdout);
    assert.deepEqual(
      report.candidates.map((item) => item.location.symbol),
      ["actualLongList"],
    );
    assert.equal(
      report.candidates[0].evidence.summary,
      "Declaration has 6 parameters (threshold: 6).",
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test("scanner does not treat local call assignments as functions", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-scan-local-call-"));
  try {
    await fs.writeFile(path.join(directory, "service.ts"), `
class ExampleService {
  run() {
    const manager = this.getManager();
    const result = values.map((value) => {
      return value + 1;
    });
    return { manager, result };
  }
}
`);

    const { stdout } = await execFileAsync(process.execPath, [
      scanner,
      directory,
      "--cases", "001,007,088,089",
      "--format", "json",
      "--max-candidates", "10",
    ]);
    const report = JSON.parse(stdout);
    assert.ok(report.candidates.every((item) => item.location.symbol !== "manager"));
    assert.ok(report.candidates.every((item) => item.location.symbol !== "result"));
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
});
