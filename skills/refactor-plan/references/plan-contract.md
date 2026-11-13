# Refactor plan artifact

JSON is the canonical handoff format. A Markdown summary may accompany it, but downstream automation must consume the JSON artifact.

## Shape

```json
{
  "schemaVersion": "refactor-plan/v6",
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
  "structuralBaseline": [
    {
      "file": "src/example.ts",
      "symbol": "execute",
      "responsibilities": [
        {
          "name": "parse input",
          "evidence": "Lines 42-70 normalize and validate source data.",
          "reasonToChange": "Input grammar or validation rules change."
        },
        {
          "name": "persist result",
          "evidence": "Lines 71-120 open a transaction and write records.",
          "reasonToChange": "Persistence schema or transaction policy changes."
        }
      ],
      "metrics": {
        "lineCount": 96,
        "branchCount": 18,
        "cognitiveComplexity": 24
      }
    }
  ],
  "targetStructure": [
    {
      "name": "execute",
      "kind": "coordinator",
      "isNew": false,
      "responsibility": "Coordinate the parse and persist phases.",
      "reasonToChange": "Workflow ordering changes.",
      "owns": ["phase ordering", "result handoff"],
      "excludes": ["input grammar", "database writes"],
      "interface": {
        "entryPoints": [{
          "name": "execute",
          "parameters": ["source: Source"],
          "returns": "Promise<Result>",
          "invariants": ["The public result is unchanged."],
          "ordering": ["Parsing completes before persistence."],
          "errors": ["Existing validation and persistence errors propagate unchanged."]
        }]
      },
      "implementationDepth": {
        "movedBehavior": ["Own phase ordering and result handoff."],
        "ownedDependencies": ["resultRepository"],
        "deletionTest": {
          "deletionFallback": "Callers coordinate parsing and persistence directly.",
          "complexityDestination": "Workflow ordering and error propagation spread to every caller.",
          "existingReplacementAssessment": "No existing module owns the use-case ordering."
        },
        "passThroughRisk": "The module makes the transaction and handoff decisions instead of forwarding calls."
      },
      "existingModuleAnalysis": {
        "alternatives": [{"name": "resultRepository", "overlap": "Persistence only.", "reuseOption": "Reuse it for writes.", "disposition": "reuse", "evidence": "It remains the persistence source of truth."}],
        "searchEvidence": "Inspected adjacent modules and repository registrations.",
        "selectedApproach": "Reuse resultRepository and retain workflow coordination here.",
        "localityImprovement": "No persistence knowledge is copied into the coordinator."
      },
      "knowledgeOverlap": {
        "existingOwners": [{"module": "resultRepository", "knowledge": ["persistence mapping"], "disposition": "reuse", "evidence": "The target calls the existing repository."}],
        "introducedDuplicates": [],
        "singleSourceOwners": [{"knowledge": "workflow ordering", "owner": "execute"}, {"knowledge": "persistence mapping", "owner": "resultRepository"}]
      },
      "changeScenarios": [{"scenario": "Workflow ordering changes.", "affectedOwnedBehavior": ["phase ordering", "result handoff"], "affectsWholeModule": true}],
      "cohesion": {"disposition": "cohesive", "justification": "All owned behavior changes with the use-case sequence."},
      "exclusiveOwnershipKeys": ["phase-ordering"]
    },
    {
      "name": "parseInput",
      "kind": "module",
      "isNew": true,
      "responsibility": "Validate and normalize input without side effects.",
      "reasonToChange": "Input grammar or validation rules change.",
      "owns": ["input validation", "normalized value construction"],
      "excludes": ["transactions", "persistence"],
      "interface": {
        "entryPoints": [{
          "name": "parseInput",
          "parameters": ["source: Source"],
          "returns": "NormalizedInput",
          "invariants": ["Equivalent source values normalize identically."],
          "ordering": ["Validation precedes normalized value construction."],
          "errors": ["Invalid source raises the existing validation error."]
        }]
      },
      "implementationDepth": {
        "movedBehavior": ["Validate grammar and construct normalized values."],
        "ownedDependencies": [],
        "deletionTest": {
          "deletionFallback": "Callers implement grammar validation and normalization.",
          "complexityDestination": "Grammar and normalization knowledge spreads across callers.",
          "existingReplacementAssessment": "No existing parser owns these rules."
        },
        "passThroughRisk": "The module contains the rules rather than delegating them unchanged."
      },
      "existingModuleAnalysis": {
        "alternatives": [],
        "searchEvidence": "Inspected adjacent parser and validation modules; none owns this grammar.",
        "selectedApproach": "Extract the currently embedded parser.",
        "localityImprovement": "Grammar and normalization gain one owner."
      },
      "knowledgeOverlap": {
        "existingOwners": [],
        "introducedDuplicates": [],
        "singleSourceOwners": [{"knowledge": "input grammar and normalization", "owner": "parseInput"}]
      },
      "changeScenarios": [{"scenario": "Input grammar changes.", "affectedOwnedBehavior": ["input validation", "normalized value construction"], "affectsWholeModule": true}],
      "cohesion": {"disposition": "cohesive", "justification": "Validation and normalization implement one grammar contract."},
      "exclusiveOwnershipKeys": ["input-validation-algorithm"]
    }
  ],
  "dependencyGraph": {
    "baseline": {
      "nodes": ["execute", "resultRepository"],
      "edges": [
        {"from": "execute", "to": "resultRepository", "ownership": "persistence"}
      ],
      "maxFanOut": 1,
      "methodCarriedInfrastructure": [],
      "knowledgeOwners": [{"knowledge": "persistence mapping", "owners": ["resultRepository"]}],
      "interfaceEntryPoints": 1
    },
    "target": {
      "nodes": ["execute", "parseInput", "resultRepository"],
      "edges": [
        {"from": "execute", "to": "resultRepository", "ownership": "persistence"}
      ],
      "maxFanOut": 1,
      "methodCarriedInfrastructure": [],
      "knowledgeOwners": [{"knowledge": "persistence mapping", "owners": ["resultRepository"]}, {"knowledge": "input grammar", "owners": ["parseInput"]}],
      "interfaceEntryPoints": 2
    },
    "introducedKnowledgeDuplicates": [],
    "assessment": {
      "constructorEdges": "The target preserves constructor edges and peak fan-out.",
      "methodCarriedInfrastructure": "No infrastructure dependency is hidden in method parameters.",
      "knowledgeLocality": "Persistence remains in resultRepository and grammar moves to one parser owner.",
      "interfaceSurface": "One internal parser entry point is added while the public surface stays stable."
    }
  },
  "structuralThresholds": {
    "case007": {
      "parameterCount": 6,
      "completionTarget": "eliminate",
      "residualCandidates": []
    }
  },
  "exclusiveOwnership": [
    {
      "key": "phase-ordering",
      "owner": "execute",
      "invariant": "Parsing completes before persistence.",
      "evidence": "execute is the only target that orders these phases."
    },
    {
      "key": "input-validation-algorithm",
      "owner": "parseInput",
      "invariant": "Optimistic and transaction-authoritative validation use one algorithm.",
      "evidence": "Both consumers import the pure parseInput implementation."
    }
  ],
  "baselineBehaviorInventory": [
    {
      "key": "input-validation-algorithm",
      "behavior": "The same validation algorithm checks optimistic input and transaction-locked input.",
      "occurrenceSites": [
        {"location": "src/example.ts:45", "consumer": "stageInput"},
        {"location": "src/example.ts:88", "consumer": "validateLockedInput"}
      ],
      "targetOwner": "parseInput",
      "consumerInterfaces": ["stageInput(source)", "validateLockedInput(source)"],
      "phaseSensitive": true,
      "preservationTest": {
        "id": "locked-input-changed-between-phases",
        "scenario": "Change the authoritative required input after optimistic staging but before transaction validation.",
        "assertion": "The public operation rejects before persistence and compensates staged resources.",
        "changedBetweenPhases": "The transaction-visible required fields differ from the optimistic required fields."
      }
    }
  ],
  "structuralAcceptance": [
    {
      "criterion": "No touched or newly extracted symbol combines parsing and persistence responsibilities.",
      "verification": "Inspect the post-change responsibility map and re-scan every touched or newly extracted symbol.",
      "failureStatus": "structural-goal-not-met"
    },
    {
      "criterion": "Peak per-symbol complexity decreases rather than moving to a helper.",
      "verification": "Compare before/after metrics for the original symbol and all extraction targets.",
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
      "structuralOutcome": "No production structure changes; the behavior boundary needed by later extraction becomes executable.",
      "preconditions": ["Existing baseline failures are recorded."],
      "reversible": true,
      "verification": ["Run the focused integration test and observe the new assertion pass."],
      "rollback": "Revert only the test change from S1."
    }
  ],
  "finalVerification": [
    "Run repository-required lint, tests, and build for the affected scope."
  ],
  "composedVerification": {
    "publicEntryPoint": "execute(source)",
    "providerGraph": "Instantiate execute with the production resultRepository adapter.",
    "command": "npm test -- execute.integration.test.ts",
    "assertions": ["Public results, errors, and persistence ordering match the baseline."],
    "behaviorTestIds": ["locked-input-changed-between-phases"]
  },
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

When cases 007 or 014 are present, add authoritative evidence:

```json
{
  "sourceCandidates": [{
    "candidateId": "candidate-007",
    "case": {"id": "007", "title": "Long Parameter List", "intent": "Find fragile declarations."},
    "location": {"file": "src/example.ts", "line": 10, "symbol": "execute"},
    "evidence": "The declaration has seven parameters.",
    "confidence": "high",
    "relatedTechniques": [],
    "measurement": {
      "value": 7,
      "unit": "parameters",
      "method": "ast",
      "evidence": "TypeScript AST parameter node count."
    }
  }],
  "dataClumpAnalysis": [{
    "candidateId": "candidate-014",
    "values": ["startDate", "endDate"],
    "occurrences": [
      {"location": "src/a.ts:20", "consumer": "pricePeriod"},
      {"location": "src/b.ts:40", "consumer": "validatePeriod"}
    ],
    "invariant": "startDate is never later than endDate.",
    "disposition": "confirmed",
    "rationale": "The pair recurs across consumers with one date-range meaning."
  }]
}
```

## Rules

- `schemaVersion` is exactly `refactor-plan/v6`.
- `sourceCandidates` contains the evidence needed to understand the plan without access to the scanner catalog.
- `decision` is `proceed`, `reject`, or `needs-context`.
- A `proceed` plan has a non-empty objective, included scope, preservation envelope, baseline checks, steps, final verification, risks, and stop conditions.
- A `proceed` plan has a structural baseline, target structure, and structural acceptance criteria. Every baseline responsibility records evidence and an independent reason to change.
- Target units state a kind, whether they are new, one cohesive responsibility, concrete interface, structured deletion fallback, existing-module alternatives, knowledge ownership, and change scenarios. A technical container such as a transaction callback is not sufficient responsibility evidence.
- A partial change scenario requires a coordinator with named cohesive collaborators; a singular label cannot hide independently changing behavior.
- `dependencyGraph` covers constructor edges, method-carried infrastructure, knowledge owners, and interface surface. Peak fan-out may not increase; total edge changes require an explicit trade-off assessment and cannot excuse duplicated knowledge.
- Each target's `implementationDepth.ownedDependencies` exactly matches its outgoing target-graph edges. `structuralThresholds.case007` must agree with those counts: an elimination target has no target at or above the threshold; reviewed residuals name and justify every remaining hotspot.
- `exclusiveOwnership` registers invariants that cannot have competing owners. Every registry key is assigned through exactly one target's `exclusiveOwnershipKeys` and the registered owner must match that target.
- `baselineBehaviorInventory` maps every behavior-bearing helper or algorithm to its occurrence sites, unique target owner, consumer interfaces, and executable preservation test. Its key must exist in `exclusiveOwnership`; shared pure behavior may have several consumers but only one algorithm owner.
- Phase-sensitive inventory entries record at least two occurrence sites and consumer interfaces and describe the changed-between-phases mutation. `composedVerification.behaviorTestIds` references every inventory preservation-test ID exactly once so optimistic and authoritative phases cannot silently diverge.
- `introducedDuplicates` and `introducedKnowledgeDuplicates` are empty. Reuse an existing owner or explicitly move the single source of truth.
- A new repository or adapter records repository-local instruction, registration/export module, transaction-manager policy, filters/locks owner, and a `reuse-existing | move-single-source` duplication strategy.
- Every case `007` candidate records an authoritative `measurement` with `value`, `unit: parameters`, `method: ast | manual-declaration`, and evidence. Scanner comma heuristics are not authoritative.
- Every case `014` candidate has one `dataClumpAnalysis` entry recording its values, at least two occurrences and consumers, shared invariant, rationale, and confirmed/rejected disposition.
- `composedVerification` exercises the unchanged public entry point through the real assembled provider/module graph. Isolated extracted-unit tests are insufficient.
- Every implementation step declares its intended `structuralOutcome`.
- Structural acceptance rechecks every touched or newly extracted symbol and fails with `structural-goal-not-met` when complexity was only transferred or responsibilities remain mixed.
- `convergencePolicy` makes apply iterative but bounded: re-scan after each approved structural step, stop when every structural criterion holds, and return to planning when the cap or approved steps are exhausted.
- Step IDs are unique and ordered. Each step is independently reviewable and reversible.
- A `reject` plan explains why work is not justified and has no implementation steps.
- A `needs-context` plan lists the unresolved facts and has no implementation steps.
- The planning workflow always writes `status: awaiting-approval`, human approval fields as `null`, and `approvedStepIds` as an empty array.
- A human may change `status` to `approved` or `rejected`. `approved` also requires non-empty `approvedBy`, `approvedAt`, and `approvedStepIds` fields.
- `changeBoundaries` records `preserve` for public API, database schema, configuration, dependencies, and runtime behavior. Work outside those boundaries is a stop condition, not an implied plan extension.
- `authorization.prohibitedOperations` includes `push`, `merge`, and `deploy`; planning never grants those permissions.
- Approval is invalid if the repository revision or relevant diff changed after review; the apply workflow must detect that condition and return the plan to planning.
