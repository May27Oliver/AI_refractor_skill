# Refactor Agent Skills

Portable Agent Skills for a human-gated refactoring workflow:

1. `refactor-scan` finds evidence-backed candidates without changing product code.
2. `refactor-plan` turns confirmed candidates into behavior-preserving plans.
3. `refactor-apply` implements only an explicitly approved plan.

Each directory under `skills/` is a standalone Agent Skills bundle. Host-specific metadata may enhance presentation, but required workflow and safety rules live in `SKILL.md`.

## Local installation

The linker defaults to a dry run and targets both Codex (`~/.agents/skills`) and Claude Code (`~/.claude/skills`):

```bash
node install/link-skills.mjs
node install/link-skills.mjs --apply
```

Select one host or skill when needed:

```bash
node install/link-skills.mjs --agent codex --skill refactor-scan
node install/link-skills.mjs --agent claude-code --skill refactor-plan --apply
```

The linker never replaces an existing file, directory, or different symbolic link. A conflict aborts the entire apply operation before any links are created.

## Validation

```bash
npm test
npm run validate
```

The runtime and tests use only Node.js built-in modules.
