---
name: refactor-plan
description: Evaluate evidence-backed refactoring candidates and produce a bounded, behavior-preserving implementation plan for human approval. Use after a scan or code review identifies a concrete candidate; do not use to modify product code.
compatibility: Requires filesystem access to the target repository. The optional plan validator requires Node.js 20.11 or newer.
metadata:
  version: "0.6.0"
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
4. Build a structural baseline for every affected symbol: map cohesive responsibilities, evidence, independent reasons to change, current metrics when available, and nearby symbols that could receive transferred complexity. Inventory behavior-bearing helpers and algorithms separately, including every occurrence, future owner, consumer interface, and executable preservation test. Treat scanner metrics as leads; record parameter counts from an AST-capable tool or explicit manual declaration inspection.
5. Define the target structure before edit steps. Each target unit must own one cohesive responsibility at one level of abstraction and a concrete callable interface. Inventory existing modules that already own overlapping behavior or knowledge; prefer reuse or an explicit single-owner move over a parallel abstraction.
6. Apply a structured deletion test: name the fallback if the target is deleted, where complexity would go, and whether existing modules already replace it. A target has not earned a seam when deletion can reuse existing modules without leaking meaningful implementation knowledge.
7. Model current and proposed dependency graphs as explicit owned edges, method-carried infrastructure dependencies, knowledge owners, and interface surface. Constructor edge counts are one signal, not total coupling; a lower fan-out cannot compensate for duplicated queries, mappings, filters, or invariants. Make each target's declared dependencies exactly match its outgoing target-graph edges. State the Case 007 threshold and either eliminate every target candidate or list evidence-backed reviewed residuals. Register transaction, lock-order, compensation, and every inventoried helper/algorithm with exactly one target owner, even when multiple target interfaces consume one pure implementation.
8. For every target, enumerate realistic change scenarios and the owned behavior each affects. If scenarios affect disjoint subsets, use a coordinator with cohesive collaborators or justify a different ownership model; a transaction boundary alone is not one reason to change.
9. When introducing a repository or adapter, follow repository-local registration/export and transaction conventions, and preserve one source of truth for filters, locks, queries, and mappings. Do not reimplement existing persistence knowledge to improve dependency metrics.
10. For each Data Clump candidate, record the repeated occurrences, consumers, shared invariant, and disposition. A parameter object is warranted only when the values recur together and have one domain meaning.
11. Define the preservation envelope. Include only relevant observable contracts: public API, serialized data, errors, authorization, transactions, events, side-effect order, timing, concurrency, and material performance.
12. Select the smallest technique that reaches the target structure. Reject an extraction that merely moves a mixed block into a new long helper or shallow provider.
13. Split the work into reversible steps. Every step must identify affected files, its intended structural outcome, preconditions, focused verification, and rollback. Separate prerequisite behavior tests from structural edits.
14. Define behavior and structural acceptance. Re-scan the original and every touched or newly extracted symbol. Use metrics as signals, while requiring that peak complexity is not merely transferred and the responsibility map matches the target.
15. Require a composed verification that instantiates the real provider graph and exercises the unchanged public entry point. It must reference every inventoried preservation test; phase-sensitive behavior needs a changed-between-phases scenario that proves revalidation rather than optimistic-state reuse. Isolated tests for extracted units do not prove the assembled workflow.
16. Define an iterative convergence policy. Each structural step is one bounded pass; apply continues through approved passes until all structural acceptance criteria hold, then stops. Set a hard iteration cap and return to planning when approved passes are exhausted without convergence.
17. Emit the canonical `refactor-plan/v6` artifact from [references/plan-contract.md](references/plan-contract.md). Adapt human-facing prose to the repository language; keep schema keys and enum values in English.

## Human gate

Always emit top-level `status: awaiting-approval` with an empty human approval record. The existence of a candidate or plan never authorizes implementation. A person must change the artifact to `approved`, identify the approver and time, and select approved step IDs before an apply workflow can consume it.

Do not push, merge, deploy, change public behavior, or expand the candidate scope while planning.

## Completion

Planning is complete when every candidate has an evidence-backed disposition and every `proceed` plan is self-contained, bounded, reversible, awaiting human approval, and has checkable behavior, structural acceptance, and an iterative convergence policy. From this skill's root, validate a saved JSON artifact with:

```bash
node scripts/validate-plan.mjs <plan.json>
```
