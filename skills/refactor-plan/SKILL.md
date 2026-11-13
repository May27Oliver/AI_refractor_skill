---
name: refactor-plan
description: Evaluate evidence-backed refactoring candidates and produce a bounded, behavior-preserving implementation plan for human approval. Use after a scan or code review identifies a concrete candidate; do not use to modify product code.
compatibility: Requires filesystem access to the target repository. The optional plan validator requires Node.js 20.11 or newer.
metadata:
  version: "0.1.0"
---

# Refactor Plan

Turn confirmed evidence into a reviewable plan. Planning may create or update the requested plan artifact, but it must not edit product code, tests, configuration, migrations, or dependencies.

## Inputs

Require a self-contained candidate report or equivalent evidence with a location, observed fact, confidence, and maintenance impact. A scanner result is a lead, not proof that a refactor is warranted.

If essential evidence is absent, inspect the target and its callers, tests, registrations, and runtime entry points. End with `needs-context` when the missing fact cannot be established without guessing.

## Workflow

1. Identify the repository and read the repository-local agent instructions recognized by the host, including more specific instructions near the target.
2. Establish the current state: revision when available, relevant existing changes, applicable specifications, and baseline checks. Preserve unrelated user work.
3. Triage each candidate:
   - confirm the reported location and observation;
   - check likely false positives, framework conventions, generated code, and dynamic use;
   - state the maintenance cost that makes work worthwhile now;
   - choose `proceed`, `reject`, or `needs-context` with evidence.
4. For `proceed`, define the preservation envelope before proposing edits. Include only relevant observable contracts: public API, serialized data, errors, authorization, transactions, events, side-effect order, timing, concurrency, and material performance.
5. Select the smallest technique that addresses the confirmed problem. Prefer removal or direct restructuring over a new abstraction unless current variation justifies a seam.
6. Split the work into reversible steps. Every step must identify affected files, preconditions, a focused verification, and a rollback statement. Separate prerequisite behavior tests from structural edits.
7. Define baseline, per-step, and final validation using commands and assertions available in the repository. Record existing failures separately.
8. Emit the canonical plan artifact from [references/plan-contract.md](references/plan-contract.md). Adapt human-facing prose to the repository language; keep schema keys and enum values in English.

## Human gate

Always emit top-level `status: awaiting-approval` with an empty human approval record. The existence of a candidate or plan never authorizes implementation. A person must change the artifact to `approved`, identify the approver and time, and select approved step IDs before an apply workflow can consume it.

Do not push, merge, deploy, change public behavior, or expand the candidate scope while planning.

## Completion

Planning is complete when every candidate has an evidence-backed disposition and every `proceed` plan is self-contained, bounded, verifiable, reversible, and awaiting human approval. From this skill's root, validate a saved JSON artifact with:

```bash
node scripts/validate-plan.mjs <plan.json>
```
