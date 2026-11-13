# Refactor plan artifact

JSON is the canonical handoff format. A Markdown summary may accompany it, but downstream automation must consume the JSON artifact.

## Shape

```json
{
  "schemaVersion": "refactor-plan/v1",
  "planId": "rp-20261113-example",
  "generatedAt": "2026-11-13T08:00:00.000Z",
  "repository": {
    "root": "/absolute/or/runner-visible/path",
    "revision": "optional immutable revision",
    "dirty": false
  },
  "sourceCandidates": [
    {
      "candidateId": "candidate-001",
      "case": {
        "id": "001",
        "title": "Long Method",
        "intent": "Identify functions whose size hides distinct responsibilities or stages."
      },
      "location": {
        "file": "src/example.ts",
        "line": 42,
        "symbol": "execute"
      },
      "evidence": "Function spans 96 lines and mixes parsing with persistence.",
      "confidence": "medium",
      "relatedTechniques": [
        {
          "id": "037",
          "title": "Split Phase",
          "intent": "Separate processing stages with distinct contracts."
        }
      ]
    }
  ],
  "disposition": {
    "decision": "proceed",
    "reasons": ["The parsing and persistence phases change independently."],
    "missingContext": []
  },
  "status": "awaiting-approval",
  "approval": {
    "type": "human",
    "approvedBy": null,
    "approvedAt": null,
    "approvedStepIds": []
  },
  "objective": "Separate parsing from persistence without changing observable behavior.",
  "scope": {
    "includedPaths": ["src/example.ts", "test/example.test.ts"],
    "excludedPaths": ["migrations", "public contracts"]
  },
  "preservationEnvelope": [
    {
      "category": "errors",
      "invariant": "Keep error types, messages, and timing unchanged.",
      "evidence": "Existing integration assertions and caller handling."
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
    "Run the focused test before changes and record its result."
  ],
  "steps": [
    {
      "id": "S1",
      "title": "Characterize failure ordering",
      "files": ["test/example.test.ts"],
      "transformation": "Add a focused assertion for current failure ordering.",
      "preconditions": ["Existing baseline failures are recorded."],
      "reversible": true,
      "verification": ["Run the focused integration test and observe the new assertion pass."],
      "rollback": "Revert only the test change from S1."
    }
  ],
  "finalVerification": [
    "Run repository-required lint, tests, and build for the affected scope."
  ],
  "risks": [
    {
      "risk": "Side-effect ordering may drift.",
      "mitigation": "Characterize ordering before extracting phases.",
      "residual": "External integrations may not be reproducible locally."
    }
  ],
  "stopConditions": [
    "A selected step requires a public contract, schema, dependency, configuration, or behavior change.",
    "The repository revision or relevant working diff no longer matches the reviewed plan."
  ],
  "authorization": {
    "prohibitedOperations": ["push", "merge", "deploy"]
  }
}
```

## Rules

- `schemaVersion` is exactly `refactor-plan/v1`.
- `sourceCandidates` contains the evidence needed to understand the plan without access to the scanner catalog.
- `decision` is `proceed`, `reject`, or `needs-context`.
- A `proceed` plan has a non-empty objective, included scope, preservation envelope, baseline checks, steps, final verification, risks, and stop conditions.
- Step IDs are unique and ordered. Each step is independently reviewable and reversible.
- A `reject` plan explains why work is not justified and has no implementation steps.
- A `needs-context` plan lists the unresolved facts and has no implementation steps.
- The planning workflow always writes `status: awaiting-approval`, human approval fields as `null`, and `approvedStepIds` as an empty array.
- A human may change `status` to `approved` or `rejected`. `approved` also requires non-empty `approvedBy`, `approvedAt`, and `approvedStepIds` fields.
- `changeBoundaries` records `preserve` for public API, database schema, configuration, dependencies, and runtime behavior. Work outside those boundaries is a stop condition, not an implied plan extension.
- `authorization.prohibitedOperations` includes `push`, `merge`, and `deploy`; planning never grants those permissions.
- Approval is invalid if the repository revision or relevant diff changed after review; the apply workflow must detect that condition and return the plan to planning.
