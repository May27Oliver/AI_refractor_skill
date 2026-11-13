---
name: refactor-apply
description: Apply a human-approved refactoring plan in small, behavior-preserving steps. Use only when the user explicitly asks to implement an approved plan artifact; do not use for scan candidates, unapproved plans, feature changes, or bug fixes.
compatibility: Requires Node.js 20.11 or newer, filesystem and command execution access, and an Agent Skills-compatible host.
metadata:
  version: "0.6.0"
---

# Refactor Apply

Implement only an explicitly human-approved, self-contained refactoring plan. Approval is an authorization boundary, not an inference.

This skill requires filesystem and command execution access. Its bundled validator requires Node.js 20 or newer.

## Entry gate

Before reading product code:

1. Require a plan artifact that follows [the plan contract](references/plan-contract.md).
2. Require explicit human approval in the current request or its durable task record. A plan marked `approved` is supporting evidence, not sufficient authorization by itself.
3. Run `node scripts/validate-plan.mjs <plan.json>` from this skill directory.
4. Stop without editing when approval is absent, validation fails, approved step IDs are ambiguous, or the artifact is not self-contained.

Raw scan candidates and `awaiting-approval` plans are never implementation authorization.

## Preflight

1. Resolve the target repository and read the repository-local agent instructions recognized by the host, including more specific instructions near affected files.
2. Inspect the current worktree and preserve unrelated user changes. Stop when an approved file overlaps changes that cannot be separated safely.
3. Confirm every approved path, behavior invariant, risk, baseline result, and verification command against the repository.
4. Confirm the structural baseline, target responsibility map, acceptance criteria, and every symbol that must be checked for complexity transfer.
5. Confirm existing-module reuse decisions, structured deletion fallbacks, knowledge single owners, repository conformance, change-scenario cohesion, and the complete dependency graph including method-carried infrastructure. Reconcile every target's declared dependencies with its graph edges, enforce the declared Case 007 threshold or reviewed residuals, and verify each exclusive invariant and inventoried baseline helper/algorithm has exactly one registered owner.
6. Re-run applicable behavior and structural baselines. Record pre-existing failures rather than attributing them to this refactor.
7. Select the first approved step whose dependencies are satisfied. Do not widen its file list or combine it with another structural change.

## Apply one reversible step

For each approved step, in dependency order:

1. Make the smallest structural change described by the step.
2. Preserve every declared invariant, including API and data shapes, errors, authorization, transactions, event and side-effect ordering, and relevant performance characteristics.
3. Inspect the diff. Revert or stop if it touches files outside the step or contains unrelated cleanup.
4. Compare the actual responsibility boundary with the step's `structuralOutcome`. Extracting a mixed block into a new helper does not satisfy the step.
5. Run the step's behavior and structural verification, including every referenced baseline-behavior preservation test, and compare their actual results with the baseline. A phase-sensitive inventory item must exercise its changed-between-phases scenario through the composed public seam.
6. Re-scan the changed symbol and every touched or newly extracted symbol. Continue only when behavior is preserved and complexity was reduced rather than transferred.

Do not repair unrelated failures, opportunistically clean nearby code, or convert a structural refactor into a behavior change.

## Convergence loop

Treat each approved structural step as one bounded iteration, not as the whole refactor:

1. Apply one approved step and run its behavior checks.
2. Rebuild the responsibility map and re-scan the original, touched, and newly extracted symbols.
3. If every structural acceptance criterion holds, stop structural editing and run final verification; do not execute extra approved steps merely because they exist.
4. If criteria remain unmet and another approved step is ready, continue with that step.
5. If approved steps are exhausted or `convergencePolicy.maxIterations` is reached, report `structural-goal-not-met` and return to planning.

The loop never repeats, invents, or expands a step. New work requires a revised plan and human approval.

## Mandatory stop conditions

Stop and report the decision needed when implementation requires any of the following unless the approved plan explicitly includes it as a preserved, authorized operation:

- a public API, serialization, error, authorization, transaction, event, side-effect, or runtime behavior change;
- a database schema, migration, configuration, environment variable, dependency, generated artifact, or deployment change;
- files outside the approved scope;
- an unlisted refactoring technique or architectural layer;
- suppressing, weakening, deleting, or rewriting a meaningful test to obtain a pass;
- proceeding without a required verification environment or trustworthy baseline;
- a touched or newly extracted symbol still combines responsibilities that the approved target separates;
- peak per-symbol complexity merely moves to another symbol or structural acceptance cannot be established;
- a new module duplicates existing queries, mappings, filters, locks, or invariants instead of reusing or moving their single source of truth;
- a repository/adapter violates repository-local registration, export, or transaction-manager conventions;
- the actual deletion fallback shows that an extracted seam is replaceable by existing modules without redistributing meaningful complexity.

Never push, merge, publish, deploy, or communicate externally unless the user separately and explicitly requests that action.

## Completion

Run the plan's final behavior verification, re-scan every touched or newly extracted symbol, inspect the complete diff, and evaluate every structural acceptance criterion. Report in the user's language and the repository's terminology:

- implemented step IDs and modified files;
- behavior-preservation evidence;
- commands and actual pass, fail, or not-run results;
- pre-existing failures and remaining risks;
- before/after responsibility maps and per-symbol structural evidence;
- skipped or blocked steps and the exact reason;
- confirmation that no push, merge, publish, or deploy occurred.

Do not mark the refactor complete when required verification failed or was unavailable. When behavior passes but any structural criterion fails, report `structural-goal-not-met`, leave the work incomplete, and return it to planning instead of claiming success.
