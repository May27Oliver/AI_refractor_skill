import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const validator = path.resolve(import.meta.dirname, "validate-plan.mjs");

function validPlan() {
  return {
    schemaVersion: "refactor-plan/v1",
    planId: "rp-test",
    generatedAt: "2026-11-13T08:00:00.000Z",
    repository: { root: "/repo", revision: "abc", dirty: false },
    sourceCandidates: [{
      candidateId: "c1",
      case: { id: "001", title: "Long Method", intent: "Find mixed responsibilities." },
      location: { file: "src/example.ts", line: 10 },
      evidence: "Function spans 90 lines.",
      confidence: "medium",
      relatedTechniques: [],
    }],
    disposition: { decision: "proceed", reasons: ["Confirmed mixed responsibilities."], missingContext: [] },
    status: "awaiting-approval",
    approval: { type: "human", approvedBy: null, approvedAt: null, approvedStepIds: [] },
    objective: "Separate parsing from persistence without changing behavior.",
    scope: { includedPaths: ["src/example.ts"], excludedPaths: ["migrations"] },
    preservationEnvelope: [{ category: "api", invariant: "Keep the API stable.", evidence: "Caller contract." }],
    changeBoundaries: {
      publicApi: "preserve",
      databaseSchema: "preserve",
      configuration: "preserve",
      dependencies: "preserve",
      runtimeBehavior: "preserve",
    },
    baselineChecks: ["Run test."],
    steps: [{
      id: "S1",
      title: "Extract parsing phase",
      files: ["src/example.ts"],
      transformation: "Extract parsing into a private pure helper.",
      preconditions: ["Baseline passes."],
      reversible: true,
      verification: ["Run focused test."],
      rollback: "Revert S1.",
    }],
    finalVerification: ["Run suite."],
    risks: [{ risk: "Ordering drift.", mitigation: "Characterize order.", residual: "None known." }],
    stopConditions: ["A public contract change is required."],
    authorization: { prohibitedOperations: ["push", "merge", "deploy"] },
  };
}

async function runValidator(document) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-plan-"));
  const file = path.join(directory, "plan.json");
  await fs.writeFile(file, JSON.stringify(document));
  try {
    return await execFileAsync(process.execPath, [validator, file]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("accepts a complete awaiting-approval plan", async () => {
  const result = await runValidator(validPlan());
  assert.match(result.stdout, /Plan is valid/);
});

test("rejects approval without approver identity", async () => {
  const document = validPlan();
  document.status = "approved";
  document.approval.approvedStepIds = ["S1"];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /approval\.approvedBy/);
    assert.match(error.stderr, /approval\.approvedAt/);
    return true;
  });
});

test("accepts a human-approved subset of known steps", async () => {
  const document = validPlan();
  document.status = "approved";
  document.approval = {
    type: "human",
    approvedBy: "test-reviewer",
    approvedAt: "2026-11-13T09:00:00.000Z",
    approvedStepIds: ["S1"],
  };
  const result = await runValidator(document);
  assert.match(result.stdout, /Plan is valid/);
});

test("rejects implementation steps for a rejected candidate", async () => {
  const document = validPlan();
  document.disposition.decision = "reject";
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /reject plans must not contain implementation steps/);
    return true;
  });
});
