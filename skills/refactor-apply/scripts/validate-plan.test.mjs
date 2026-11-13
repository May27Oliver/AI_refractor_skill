import assert from "node:assert/strict";
import test from "node:test";
import { validatePlan } from "./validate-plan.mjs";

function validPlan() {
  return {
    schemaVersion: "refactor-plan/v1",
    planId: "refactor-test-001",
    generatedAt: "2026-11-13T09:00:00.000Z",
    repository: { root: "/repo", revision: "abc123", dirty: false },
    sourceCandidates: [{
      candidateId: "candidate-001",
      case: { id: "001", title: "Long Method", intent: "Identify mixed responsibilities." },
      location: { file: "src/example.ts", line: 1, symbol: "example" },
      evidence: "Function contains two distinct phases.",
      confidence: "medium",
      relatedTechniques: [{ id: "026", title: "Extract Function", intent: "Extract a coherent operation." }],
    }],
    disposition: { decision: "proceed", reasons: ["Evidence supports a bounded change."], missingContext: [] },
    status: "approved",
    approval: {
      type: "human",
      approvedBy: "reviewer",
      approvedAt: "2026-11-13T10:00:00.000Z",
      approvedStepIds: ["step-1"],
    },
    objective: "Improve structure while preserving behavior.",
    scope: { includedPaths: ["src"], excludedPaths: ["src/generated"] },
    preservationEnvelope: [{ category: "public-api", invariant: "Contract is unchanged.", evidence: "Contract tests." }],
    changeBoundaries: {
      publicApi: "preserve",
      databaseSchema: "preserve",
      configuration: "preserve",
      dependencies: "preserve",
      runtimeBehavior: "preserve",
    },
    baselineChecks: [{ command: "test command", result: "passed", notes: "Clean baseline." }],
    steps: [{
      id: "step-1",
      title: "Extract helper",
      files: ["src/example.ts"],
      transformation: "Extract one pure helper.",
      preconditions: ["Focused baseline matches."],
      reversible: true,
      dependsOn: [],
      verification: [{ command: "focused test", expected: "Passes unchanged." }],
      rollback: "Revert the helper extraction.",
    }],
    finalVerification: [{ command: "full test", expected: "No new failures." }],
    risks: ["Incorrect extraction could reorder effects."],
    stopConditions: ["A contract change is required."],
    authorization: { prohibitedOperations: ["push", "merge", "deploy"] },
  };
}

test("accepts a self-contained approved plan", () => {
  assert.deepEqual(validatePlan(validPlan()), []);
});

test("rejects a plan that lacks human approval", () => {
  const plan = validPlan();
  plan.status = "awaiting-approval";
  plan.approval = {};
  assert.ok(validatePlan(plan).some((error) => error.includes("status must be 'approved'")));
  assert.ok(validatePlan(plan).some((error) => error.includes("approval.type")));
});

test("rejects scope escape and boundary changes", () => {
  const plan = validPlan();
  plan.steps[0].files = ["../outside.ts"];
  plan.changeBoundaries.publicApi = "change";
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("safe repository-relative paths")));
  assert.ok(errors.some((error) => error.includes("publicApi")));
});

test("rejects unknown approval IDs and dependency cycles", () => {
  const plan = validPlan();
  plan.approval.approvedStepIds = ["missing"];
  plan.steps.push({
    id: "step-2",
    title: "Second step",
    files: ["src/second.ts"],
    transformation: "Move helper.",
    preconditions: ["Step 1 is verified."],
    reversible: true,
    dependsOn: ["step-3"],
    verification: [{ command: "focused test", expected: "Passes." }],
    rollback: "Revert step 2.",
  }, {
    id: "step-3",
    title: "Third step",
    files: ["src/third.ts"],
    transformation: "Rename helper.",
    preconditions: ["Step 2 is verified."],
    reversible: true,
    dependsOn: ["step-2"],
    verification: [{ command: "focused test", expected: "Passes." }],
    rollback: "Revert step 3.",
  });
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("unknown step 'missing'")));
  assert.ok(errors.some((error) => error.includes("dependency cycle")));
});
