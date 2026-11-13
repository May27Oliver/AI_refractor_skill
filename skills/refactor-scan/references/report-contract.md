# Candidate report contract

Use JSON output for scheduled handoff:

```bash
node <skill-root>/scripts/refactor-scan.mjs <scope> \
  --pack complexity \
  --format json \
  --max-candidates 10
```

The report uses `schemaVersion: "1.0.0"`. Each candidate is self-contained and contains:

- `candidateId`: deterministic identity derived from case and source location.
- `case`: catalog ID, names, kind, scan mode, and intent.
- `location`: file, line, and optional symbol.
- `evidence`: observed summary, detector type, confidence, and available per-symbol metrics; never a refactoring conclusion.
- `planningOptions`: complete related technique/principle definitions, not only IDs.
- `review`: empty handoff fields for confirmation, maintenance impact, false-positive checks, risks, and test protection.

Before handing a candidate to planning, fill its `review` fields:

```yaml
status: confirmed | rejected | needs-context
maintenanceImpact: <why this matters now>
falsePositiveCheck: <what was checked>
behaviorRisks: <API, data, error, transaction, event, performance>
testProtection: <existing coverage and gaps>
responsibilityMap:
  - responsibility: <cohesive job performed by the symbol>
    evidence: <statements, collaborators, or side effects proving it>
    reasonToChange: <independent reason this job could change>
complexityTransferCheck: <which existing or newly extracted symbols must be rescanned>
verificationGaps: <behavior or structural claims not yet established>
```

Do not turn raw scanner output directly into an implementation ticket. Planning must first confirm the maintenance impact, responsibility map, preservation boundary, and the symbols that could receive transferred complexity.
