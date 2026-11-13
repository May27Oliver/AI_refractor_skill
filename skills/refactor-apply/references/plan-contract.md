# Portable refactoring plan contract

`refactor-apply` accepts a UTF-8 JSON artifact. Schema keys remain English so different agents can exchange the artifact; human-facing values may use the repository's language.

## Required shape

```json
{
  "schemaVersion": "refactor-plan/v1",
  "planId": "refactor-2026-001",
  "generatedAt": "2026-11-13T09:00:00.000Z",
  "repository": {
    "root": "/runner-visible/repository",
    "revision": "reviewed revision or worktree identifier",
    "dirty": false
  },
  "sourceCandidates": [
    {
      "candidateId": "candidate-001",
      "case": {
        "id": "001",
        "title": "Long Method",
        "intent": "Identify functions whose size hides distinct responsibilities."
      },
      "location": { "file": "src/example.ts", "line": 12, "symbol": "calculate" },
      "evidence": "Function spans 80 lines and mixes two phases.",
      "confidence": "medium",
      "relatedTechniques": [
        { "id": "026", "title": "Extract Function", "intent": "Extract a coherent named operation." }
      ]
    }
  ],
  "disposition": {
    "decision": "proceed",
    "reasons": ["The boundary is cohesive and protected by tests."],
    "missingContext": []
  },
  "status": "approved",
  "approval": {
    "type": "human",
    "approvedBy": "reviewer identity",
    "approvedAt": "2026-11-13T10:00:00.000Z",
    "approvedStepIds": ["step-1"]
  },
  "objective": "Improve structure without changing observable behavior.",
  "scope": {
    "includedPaths": ["src/example.ts"],
    "excludedPaths": ["migrations", "generated"]
  },
  "preservationEnvelope": [
    {
      "category": "public-api",
      "invariant": "Function signature and returned JSON shape remain unchanged.",
      "evidence": "Existing contract test and caller inspection."
    }
  ],
  "changeBoundaries": {
    "publicApi": "preserve",
    "databaseSchema": "preserve",
    "configuration": "preserve",
    "dependencies": "preserve",
    "runtimeBehavior": "preserve"
  },
  "baselineChecks": [
    {
      "command": "project-specific test command",
      "result": "passed",
      "notes": "Recorded before approval."
    }
  ],
  "steps": [
    {
      "id": "step-1",
      "title": "Extract the calculation phase",
      "files": ["src/example.ts", "src/example.test.ts"],
      "transformation": "Extract a pure helper while preserving call order.",
      "preconditions": ["The focused baseline matches the approved record."],
      "reversible": true,
      "dependsOn": [],
      "verification": [
        {
          "command": "project-specific focused test command",
          "expected": "Existing cases pass without snapshot or contract changes."
        }
      ],
      "rollback": "Revert only the helper extraction from step-1."
    }
  ],
  "finalVerification": [
    {
      "command": "project-specific lint and test command",
      "expected": "No new failures."
    }
  ],
  "risks": ["Side-effect order could change during extraction."],
  "stopConditions": ["A public contract must change."],
  "authorization": {
    "prohibitedOperations": ["push", "merge", "deploy"]
  }
}
```

## Approval semantics

- Planning produces `status: "awaiting-approval"` with null approval identity fields and no approved step IDs.
- A human review changes the durable record to `approved`, records their identity and timestamp, and lists exact approved step IDs.
- The applying agent must also have explicit implementation authorization in the current request or durable task record. It must not write its own approval fields.
- Editing plan scope, invariants, transformations, or steps after approval invalidates that approval and requires another human review.

## Path and step rules

- Paths are repository-relative and may not contain `..` segments.
- Every step file must be inside one of `scope.includedPaths` and outside `scope.excludedPaths`.
- Step IDs are unique. Dependencies name existing steps and may not form a cycle.
- Every approved step is reversible and has at least one verification command with an expected result.
- Every step declares preconditions and a bounded rollback instruction.
- An approved plan declares all five change boundaries as `preserve`. Work that intentionally changes one of them is not a behavior-preserving refactor and needs a different workflow.
- Baseline failures use `result: "failed"` with notes. Missing environments use `not-run`; neither may be silently represented as a pass.

The validator checks structure and internal consistency. It cannot prove human identity, authorization, safe commands, or behavioral equivalence; the applying agent must verify those separately.

For compatibility with planning agents, baseline, step-verification, and final-verification entries may use a non-empty instruction string as shorthand for the object form. Risk entries may be strings or `{ "risk", "mitigation", "residual" }` objects. The object forms carry stronger evidence and are preferred.
