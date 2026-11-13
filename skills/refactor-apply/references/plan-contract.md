# Portable refactoring plan contract

`refactor-apply` accepts a UTF-8 `refactor-plan/v6` JSON artifact. Schema keys remain English so different agents can exchange the artifact; human-facing values may use the repository's language.

## Required shape

```json
{
  "schemaVersion": "refactor-plan/v6",
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
  "structuralBaseline": [
    {
      "file": "src/example.ts",
      "symbol": "calculate",
      "responsibilities": [
        {
          "name": "calculate result",
          "evidence": "The method mixes validation and persistence.",
          "reasonToChange": "Calculation rules change independently from persistence."
        }
      ],
      "metrics": { "lineCount": 80, "branchCount": 14, "cognitiveComplexity": 18 }
    }
  ],
  "targetStructure": [
    {
      "name": "calculate",
      "kind": "coordinator",
      "isNew": false,
      "responsibility": "Coordinate calculation and persistence phases.",
      "reasonToChange": "Workflow ordering changes.",
      "owns": ["phase ordering"],
      "excludes": ["validation rules", "database writes"],
      "interface": {
        "entryPoints": [{
          "name": "calculate",
          "parameters": ["input: Input"],
          "returns": "Promise<Result>",
          "invariants": ["Public result semantics remain unchanged."],
          "ordering": ["Validation precedes persistence."],
          "errors": ["Existing validation and persistence errors propagate unchanged."]
        }]
      },
      "implementationDepth": {
        "movedBehavior": ["Own validation and persistence ordering."],
        "ownedDependencies": ["repository"],
        "deletionTest": {
          "deletionFallback": "Callers coordinate validation and persistence directly.",
          "complexityDestination": "Workflow ordering and error propagation spread to callers.",
          "existingReplacementAssessment": "No existing module owns the use-case ordering."
        },
        "passThroughRisk": "It owns decisions rather than forwarding calls."
      },
      "existingModuleAnalysis": {
        "alternatives": [{"name": "repository", "overlap": "Persistence only.", "reuseOption": "Reuse it for writes.", "disposition": "reuse", "evidence": "It remains the persistence source of truth."}],
        "searchEvidence": "Inspected adjacent modules and repository registrations.",
        "selectedApproach": "Reuse repository and retain workflow coordination here.",
        "localityImprovement": "No persistence mapping is copied into the coordinator."
      },
      "knowledgeOverlap": {
        "existingOwners": [{"module": "repository", "knowledge": ["persistence mapping"], "disposition": "reuse", "evidence": "The target calls the existing repository."}],
        "introducedDuplicates": [],
        "singleSourceOwners": [{"knowledge": "workflow ordering", "owner": "calculate"}, {"knowledge": "persistence mapping", "owner": "repository"}]
      },
      "changeScenarios": [{"scenario": "Workflow ordering changes.", "affectedOwnedBehavior": ["phase ordering"], "affectsWholeModule": true}],
      "cohesion": {"disposition": "cohesive", "justification": "All owned behavior changes with the use-case sequence."},
      "exclusiveOwnershipKeys": ["phase-ordering"]
    }
  ],
  "dependencyGraph": {
    "baseline": {
      "nodes": ["calculate", "repository"],
      "edges": [{"from": "calculate", "to": "repository", "ownership": "persistence"}],
      "maxFanOut": 1,
      "methodCarriedInfrastructure": [],
      "knowledgeOwners": [{"knowledge": "persistence mapping", "owners": ["repository"]}],
      "interfaceEntryPoints": 1
    },
    "target": {
      "nodes": ["calculate", "repository"],
      "edges": [{"from": "calculate", "to": "repository", "ownership": "persistence"}],
      "maxFanOut": 1,
      "methodCarriedInfrastructure": [],
      "knowledgeOwners": [{"knowledge": "persistence mapping", "owners": ["repository"]}],
      "interfaceEntryPoints": 1
    },
    "introducedKnowledgeDuplicates": [],
    "assessment": {
      "constructorEdges": "Constructor edges and peak fan-out remain stable.",
      "methodCarriedInfrastructure": "No infrastructure dependency is hidden in method parameters.",
      "knowledgeLocality": "Persistence mapping remains in repository.",
      "interfaceSurface": "The public interface remains one entry point."
    }
  },
  "structuralThresholds": {
    "case007": {"parameterCount": 6, "completionTarget": "eliminate", "residualCandidates": []}
  },
  "exclusiveOwnership": [
    {"key": "phase-ordering", "owner": "calculate", "invariant": "Parsing completes before persistence.", "evidence": "calculate exclusively orders the phases."}
  ],
  "baselineBehaviorInventory": [
    {
      "key": "phase-ordering",
      "behavior": "Parsing completes before persistence.",
      "occurrenceSites": [{"location": "src/example.ts:20", "consumer": "calculate"}],
      "targetOwner": "calculate",
      "consumerInterfaces": ["calculate(input)"],
      "phaseSensitive": false,
      "preservationTest": {
        "id": "phase-ordering-public-seam",
        "scenario": "Execute the complete public workflow.",
        "assertion": "Persistence never runs before validation."
      }
    }
  ],
  "structuralAcceptance": [
    {
      "criterion": "Peak complexity decreases and no helper inherits the original mixed responsibilities.",
      "verification": "Re-scan every touched and newly extracted symbol and inspect its responsibility map.",
      "failureStatus": "structural-goal-not-met"
    }
  ],
  "convergencePolicy": {
    "mode": "iterative",
    "maxIterations": 5,
    "rescanAfterEachStep": true,
    "completionCondition": "all-structural-acceptance",
    "onUnmet": "return-to-planning"
  },
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
      "structuralOutcome": "Calculation rules have one cohesive owner and persistence remains outside it.",
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
  "composedVerification": {
    "publicEntryPoint": "calculate(input)",
    "providerGraph": "Instantiate the production calculate provider with its repository adapter.",
    "command": "project-specific integration test command",
    "assertions": ["Public results, errors, and collaborator ordering match the baseline."],
    "behaviorTestIds": ["phase-ordering-public-seam"]
  },
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
- Every step declares a checkable `structuralOutcome`.
- `structuralBaseline` maps current responsibilities and independent reasons to change; each `targetStructure` entry defines a concrete interface and implementation-depth evidence; `structuralAcceptance` rechecks all touched and newly extracted symbols.
- `dependencyGraph` records constructor edges, method-carried infrastructure, knowledge owners, and interface surface. Apply rejects increased peak fan-out or introduced duplicate knowledge; total edge trade-offs require explicit assessment.
- Target dependency declarations must exactly match outgoing target-graph edges. The Case 007 threshold must agree with actual target fan-out, or every residual hotspot must have an explicit reviewed disposition.
- Every `exclusiveOwnership` key must be assigned exactly once through the matching target's `exclusiveOwnershipKeys`; transaction, lock-order, compensation, and similar invariants cannot have competing owners.
- `baselineBehaviorInventory` maps behavior-bearing helpers and algorithms to occurrence sites, one target owner, consumer interfaces, and preservation tests. Inventory keys must use the same unique owner registered in `exclusiveOwnership`.
- Phase-sensitive inventory entries record at least two occurrence sites and consumer interfaces and state what changes between optimistic and authoritative phases. `composedVerification.behaviorTestIds` must reference every inventory preservation test exactly once.
- Every target records existing-module alternatives, structured deletion fallback, single-source knowledge owners, and change scenarios. A partial scenario requires a coordinator with named cohesive collaborators.
- New repositories/adapters must conform to repository-local registration/export and transaction-manager rules, and must reuse existing knowledge or move its single source rather than duplicate it.
- Case 007 parameter counts come from an AST or explicit declaration inspection. Case 014 requires repeated occurrences, consumers, and a shared invariant rather than a cosmetic parameter object.
- `composedVerification` must exercise the unchanged public entry point through the real assembled provider graph; isolated extracted-unit tests are not enough.
- Passing behavior tests is necessary but not sufficient. Complexity transfer or a remaining mixed-responsibility symbol produces `structural-goal-not-met` and returns the work to planning.
- Apply iterates only through approved steps, re-scans after each pass, stops as soon as all structural acceptance holds, and returns to planning when `maxIterations` or approved work is exhausted.
- An approved plan declares all five change boundaries as `preserve`. Work that intentionally changes one of them is not a behavior-preserving refactor and needs a different workflow.
- Baseline failures use `result: "failed"` with notes. Missing environments use `not-run`; neither may be silently represented as a pass.

The validator checks structure and internal consistency. It cannot prove human identity, authorization, safe commands, or behavioral equivalence; the applying agent must verify those separately.

For compatibility with planning agents, baseline, step-verification, and final-verification entries may use a non-empty instruction string as shorthand for the object form. Risk entries may be strings or `{ "risk", "mitigation", "residual" }` objects. The object forms carry stronger evidence and are preferred.
