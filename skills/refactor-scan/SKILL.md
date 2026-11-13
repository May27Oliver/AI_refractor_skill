---
name: refactor-scan
description: Scan a bounded JavaScript or TypeScript code scope for evidence-backed refactoring candidates. Use for scheduled or ad-hoc refactoring discovery without changing product code. Do not use to plan or implement refactors.
compatibility: Requires Node.js 20.11 or newer, filesystem access, and JavaScript or TypeScript source files.
metadata:
  version: "0.2.0"
---

# Refactor Scan

Run a bounded, read-only discovery pass. A code smell is a candidate signal, not an instruction to refactor.

## Workflow

1. Read the repository-local agent instructions recognized by the host and applicable to the target scope.
2. Choose one named pack or a small set of case IDs. Prefer a rotating pack for scheduled runs.
3. Resolve this skill's root directory, then run `scripts/refactor-scan.mjs` from that root against one package, feature, or recent-change file set.
4. Inspect only the highest-ranked results up to the requested review budget. Confirm the reported location, callers, tests, and likely false positives.
5. Report confirmed candidates and rejected false positives. Do not modify product code or create implementation tickets during this skill.

Use the script rather than loading the full 100-case catalog into context:

```bash
node <skill-root>/scripts/refactor-scan.mjs <scope> --pack complexity --max-candidates 10
node <skill-root>/scripts/refactor-scan.mjs --list
node <skill-root>/scripts/refactor-scan.mjs --describe 001,026,076
```

Read [references/report-contract.md](references/report-contract.md) only when another process will consume the JSON output or a candidate is being handed to `refactor-plan`.

## Bounds

- Default to one pack and one bounded source scope per run.
- Treat heuristic results as leads. Never claim that a smell exists solely because a threshold fired.
- Cap detailed inspection and final candidates separately; a useful default is 5 inspections and 3 confirmed candidates.
- Preserve the user's existing worktree. The scanner itself is read-only.
- Techniques and principles are catalog entries for planning, not repository-wide detection targets.
- If the script marks a case `manual` or `contextual`, inspect it only when the user or schedule selected that theme; do not invent automated evidence.
- Use `--format json` for cross-agent handoff. The JSON must remain self-contained; a downstream agent must not need this skill's catalog.
- Use `--language en` or `--language zh-TW` for human-readable output according to repository conventions.

## Completion

A run is complete when the selected scope and cases were scanned, the top results were confirmed or rejected, and every reported candidate includes evidence, confidence, likely techniques, and known verification gaps.
