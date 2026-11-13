---
name: refactor-apply
description: Apply a human-approved refactoring plan in small, behavior-preserving steps. Use only when the user explicitly asks to implement an approved plan artifact; do not use for scan candidates, unapproved plans, feature changes, or bug fixes.
compatibility: Requires Node.js 20.11 or newer, filesystem and command execution access, and an Agent Skills-compatible host.
metadata:
  version: "0.1.0"
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
4. Re-run applicable baseline checks. Record pre-existing failures rather than attributing them to this refactor.
5. Select the first approved step whose dependencies are satisfied. Do not widen its file list or combine it with another structural change.

## Apply one reversible step

For each approved step, in dependency order:

1. Make the smallest structural change described by the step.
2. Preserve every declared invariant, including API and data shapes, errors, authorization, transactions, event and side-effect ordering, and relevant performance characteristics.
3. Inspect the diff. Revert or stop if it touches files outside the step or contains unrelated cleanup.
4. Run the step's verification commands and compare their actual results with the baseline.
5. Continue only after the step is independently reviewable and its verification establishes the stated outcome.

Do not repair unrelated failures, opportunistically clean nearby code, or convert a structural refactor into a behavior change.

## Mandatory stop conditions

Stop and report the decision needed when implementation requires any of the following unless the approved plan explicitly includes it as a preserved, authorized operation:

- a public API, serialization, error, authorization, transaction, event, side-effect, or runtime behavior change;
- a database schema, migration, configuration, environment variable, dependency, generated artifact, or deployment change;
- files outside the approved scope;
- an unlisted refactoring technique or architectural layer;
- suppressing, weakening, deleting, or rewriting a meaningful test to obtain a pass;
- proceeding without a required verification environment or trustworthy baseline.

Never push, merge, publish, deploy, or communicate externally unless the user separately and explicitly requests that action.

## Completion

Run the plan's final verification, inspect the complete diff, and report in the user's language and the repository's terminology:

- implemented step IDs and modified files;
- behavior-preservation evidence;
- commands and actual pass, fail, or not-run results;
- pre-existing failures and remaining risks;
- skipped or blocked steps and the exact reason;
- confirmation that no push, merge, publish, or deploy occurred.

Do not mark the refactor complete when required verification failed or was unavailable.
