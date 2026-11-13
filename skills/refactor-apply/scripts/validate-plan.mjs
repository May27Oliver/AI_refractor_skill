#!/usr/bin/env node

import { promises as fs } from "node:fs";
import process from "node:process";

const BOUNDARIES = ["publicApi", "databaseSchema", "configuration", "dependencies", "runtimeBehavior"];
const REQUIRED_PROHIBITED_OPERATIONS = ["push", "merge", "deploy"];

function usage() {
  return "Usage: node scripts/validate-plan.mjs <plan.json> [--json]\n";
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function stringArray(value, { nonEmpty = false } = {}) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(nonEmptyString);
}

function isSafeRelativePath(value) {
  if (!nonEmptyString(value) || value.startsWith("/") || /^[A-Za-z]:[\\/]/.test(value)) return false;
  return !value.replaceAll("\\", "/").split("/").includes("..");
}

function pathIsWithin(file, root) {
  const normalizedFile = file.replaceAll("\\", "/").replace(/^\.\//, "");
  const normalizedRoot = root.replaceAll("\\", "/").replace(/^\.\//, "").replace(/\/$/, "");
  return normalizedFile === normalizedRoot || normalizedFile.startsWith(`${normalizedRoot}/`);
}

function validateChecks(checks, location, errors, { baseline = false } = {}) {
  if (!Array.isArray(checks) || checks.length === 0) {
    errors.push(`${location} must be a non-empty array`);
    return;
  }
  checks.forEach((check, index) => {
    const current = `${location}[${index}]`;
    if (nonEmptyString(check)) return;
    if (!isRecord(check)) {
      errors.push(`${current} must be a non-empty string or object`);
      return;
    }
    if (!nonEmptyString(check.command)) errors.push(`${current}.command must be a non-empty string`);
    if (baseline) {
      if (!new Set(["passed", "failed", "not-run"]).has(check.result)) {
        errors.push(`${current}.result must be passed, failed, or not-run`);
      }
      if ((check.result === "failed" || check.result === "not-run") && !nonEmptyString(check.notes)) {
        errors.push(`${current}.notes is required for failed or not-run baselines`);
      }
    } else if (!nonEmptyString(check.expected)) {
      errors.push(`${current}.expected must be a non-empty string`);
    }
  });
}

export function validatePlan(plan) {
  const errors = [];
  if (!isRecord(plan)) return ["plan must be a JSON object"];

  if (plan.schemaVersion !== "refactor-plan/v1") errors.push("schemaVersion must be 'refactor-plan/v1'");
  if (!nonEmptyString(plan.planId)) errors.push("planId must be a non-empty string");
  if (!nonEmptyString(plan.generatedAt) || Number.isNaN(Date.parse(plan.generatedAt))) {
    errors.push("generatedAt must be an ISO-compatible timestamp");
  }
  if (plan.status !== "approved") errors.push("status must be 'approved'");
  if (!nonEmptyString(plan.objective)) errors.push("objective must be a non-empty string");

  if (!isRecord(plan.repository)) {
    errors.push("repository must be an object");
  } else {
    if (!nonEmptyString(plan.repository.root)) errors.push("repository.root must be a non-empty string");
    if (plan.repository.revision !== undefined && !nonEmptyString(plan.repository.revision)) {
      errors.push("repository.revision must be a non-empty string when present");
    }
    if (typeof plan.repository.dirty !== "boolean") errors.push("repository.dirty must be a boolean");
  }

  if (!Array.isArray(plan.sourceCandidates) || plan.sourceCandidates.length === 0) {
    errors.push("sourceCandidates must be a non-empty array");
  } else {
    plan.sourceCandidates.forEach((source, index) => {
      const current = `sourceCandidates[${index}]`;
      if (!isRecord(source)) {
        errors.push(`${current} must be an object`);
        return;
      }
      if (!nonEmptyString(source.candidateId)) errors.push(`${current}.candidateId must be a non-empty string`);
      if (!isRecord(source.case) || !nonEmptyString(source.case.id) || !nonEmptyString(source.case.title) || !nonEmptyString(source.case.intent)) {
        errors.push(`${current}.case requires id, title, and intent`);
      }
      if (!isRecord(source.location) || !isSafeRelativePath(source.location.file) || !Number.isInteger(source.location.line) || source.location.line < 1) {
        errors.push(`${current}.location requires a safe relative file and positive integer line`);
      }
      if (!nonEmptyString(source.evidence)) errors.push(`${current}.evidence must be a non-empty string`);
      if (!new Set(["high", "medium", "low"]).has(source.confidence)) errors.push(`${current}.confidence must be high, medium, or low`);
      if (!Array.isArray(source.relatedTechniques)) errors.push(`${current}.relatedTechniques must be an array`);
      else source.relatedTechniques.forEach((technique, techniqueIndex) => {
        if (!isRecord(technique) || !nonEmptyString(technique.id) || !nonEmptyString(technique.title) || !nonEmptyString(technique.intent)) {
          errors.push(`${current}.relatedTechniques[${techniqueIndex}] requires id, title, and intent`);
        }
      });
    });
  }

  if (!isRecord(plan.disposition)) {
    errors.push("disposition must be an object");
  } else {
    if (plan.disposition.decision !== "proceed") errors.push("disposition.decision must be 'proceed' for apply");
    if (!stringArray(plan.disposition.reasons, { nonEmpty: true })) errors.push("disposition.reasons must be a non-empty string array");
    if (!stringArray(plan.disposition.missingContext) || plan.disposition.missingContext.length > 0) {
      errors.push("disposition.missingContext must be an empty string array for apply");
    }
  }

  if (!isRecord(plan.approval)) {
    errors.push("approval must be an object");
  } else {
    if (plan.approval.type !== "human") errors.push("approval.type must be 'human'");
    if (!nonEmptyString(plan.approval.approvedBy)) errors.push("approval.approvedBy must be a non-empty string");
    if (!nonEmptyString(plan.approval.approvedAt) || Number.isNaN(Date.parse(plan.approval.approvedAt))) {
      errors.push("approval.approvedAt must be an ISO-compatible timestamp");
    }
    if (!stringArray(plan.approval.approvedStepIds, { nonEmpty: true })) {
      errors.push("approval.approvedStepIds must be a non-empty string array");
    }
  }

  let includedPaths = [];
  let excludedPaths = [];
  if (!isRecord(plan.scope)) {
    errors.push("scope must be an object");
  } else {
    includedPaths = plan.scope.includedPaths ?? [];
    excludedPaths = plan.scope.excludedPaths ?? [];
    if (!stringArray(includedPaths, { nonEmpty: true }) || !includedPaths.every(isSafeRelativePath)) {
      errors.push("scope.includedPaths must be non-empty safe repository-relative paths");
    }
    if (!stringArray(excludedPaths) || !excludedPaths.every(isSafeRelativePath)) {
      errors.push("scope.excludedPaths must be safe repository-relative paths");
    }
  }

  if (!Array.isArray(plan.preservationEnvelope) || plan.preservationEnvelope.length === 0) {
    errors.push("preservationEnvelope must be a non-empty array");
  } else {
    plan.preservationEnvelope.forEach((item, index) => {
      if (!isRecord(item) || !nonEmptyString(item.category) || !nonEmptyString(item.invariant) || !nonEmptyString(item.evidence)) {
        errors.push(`preservationEnvelope[${index}] requires category, invariant, and evidence`);
      }
    });
  }

  if (!isRecord(plan.changeBoundaries)) {
    errors.push("changeBoundaries must be an object");
  } else {
    BOUNDARIES.forEach((boundary) => {
      if (plan.changeBoundaries[boundary] !== "preserve") errors.push(`changeBoundaries.${boundary} must be 'preserve'`);
    });
  }

  validateChecks(plan.baselineChecks, "baselineChecks", errors, { baseline: true });
  validateChecks(plan.finalVerification, "finalVerification", errors);

  const stepIds = new Set();
  const dependencyGraph = new Map();
  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    errors.push("steps must be a non-empty array");
  } else {
    plan.steps.forEach((step, index) => {
      const current = `steps[${index}]`;
      if (!isRecord(step)) {
        errors.push(`${current} must be an object`);
        return;
      }
      if (!nonEmptyString(step.id)) errors.push(`${current}.id must be a non-empty string`);
      else if (stepIds.has(step.id)) errors.push(`${current}.id must be unique`);
      else stepIds.add(step.id);
      if (!nonEmptyString(step.title)) errors.push(`${current}.title must be a non-empty string`);
      if (!nonEmptyString(step.transformation)) errors.push(`${current}.transformation must be a non-empty string`);
      if (!stringArray(step.preconditions, { nonEmpty: true })) errors.push(`${current}.preconditions must be a non-empty string array`);
      if (step.reversible !== true) errors.push(`${current}.reversible must be true`);
      if (!nonEmptyString(step.rollback)) errors.push(`${current}.rollback must be a non-empty string`);
      if (!stringArray(step.files, { nonEmpty: true }) || !step.files.every(isSafeRelativePath)) {
        errors.push(`${current}.files must be non-empty safe repository-relative paths`);
      } else if (includedPaths.length && step.files.some((file) => !includedPaths.some((root) => pathIsWithin(file, root)))) {
        errors.push(`${current}.files contains a path outside scope.includedPaths`);
      } else if (excludedPaths.length && step.files.some((file) => excludedPaths.some((root) => pathIsWithin(file, root)))) {
        errors.push(`${current}.files contains a path inside scope.excludedPaths`);
      }
      const dependsOn = step.dependsOn ?? [];
      if (!stringArray(dependsOn)) errors.push(`${current}.dependsOn must be a string array`);
      dependencyGraph.set(step.id, Array.isArray(dependsOn) ? dependsOn : []);
      validateChecks(step.verification, `${current}.verification`, errors);
    });
  }

  for (const [stepId, dependencies] of dependencyGraph) {
    dependencies.forEach((dependency) => {
      if (!stepIds.has(dependency)) errors.push(`step '${stepId}' depends on unknown step '${dependency}'`);
      if (dependency === stepId) errors.push(`step '${stepId}' may not depend on itself`);
    });
  }
  const visiting = new Set();
  const visited = new Set();
  function visit(stepId) {
    if (visiting.has(stepId)) {
      errors.push(`step dependency cycle includes '${stepId}'`);
      return;
    }
    if (visited.has(stepId) || !dependencyGraph.has(stepId)) return;
    visiting.add(stepId);
    dependencyGraph.get(stepId).forEach(visit);
    visiting.delete(stepId);
    visited.add(stepId);
  }
  stepIds.forEach(visit);

  if (isRecord(plan.approval) && Array.isArray(plan.approval.approvedStepIds)) {
    plan.approval.approvedStepIds.forEach((stepId) => {
      if (!stepIds.has(stepId)) errors.push(`approval references unknown step '${stepId}'`);
    });
  }

  if (!Array.isArray(plan.risks) || plan.risks.length === 0) {
    errors.push("risks must be a non-empty array");
  } else {
    plan.risks.forEach((risk, index) => {
      if (nonEmptyString(risk)) return;
      if (!isRecord(risk) || !nonEmptyString(risk.risk) || !nonEmptyString(risk.mitigation) || !nonEmptyString(risk.residual)) {
        errors.push(`risks[${index}] must be a string or an object with risk, mitigation, and residual`);
      }
    });
  }
  if (!stringArray(plan.stopConditions, { nonEmpty: true })) errors.push("stopConditions must be a non-empty string array");

  const prohibited = plan.authorization?.prohibitedOperations;
  if (!stringArray(prohibited)) {
    errors.push("authorization.prohibitedOperations must be a string array");
  } else {
    REQUIRED_PROHIBITED_OPERATIONS.forEach((operation) => {
      if (!prohibited.includes(operation)) errors.push(`authorization.prohibitedOperations must include '${operation}'`);
    });
  }

  return [...new Set(errors)];
}

async function main() {
  const args = process.argv.slice(2);
  const jsonOutput = args.includes("--json");
  const positional = args.filter((arg) => arg !== "--json");
  if (positional.length !== 1 || positional[0] === "--help" || positional[0] === "-h") {
    process.stdout.write(usage());
    process.exitCode = positional.length === 1 ? 0 : 2;
    return;
  }

  let plan;
  try {
    plan = JSON.parse(await fs.readFile(positional[0], "utf8"));
  } catch (error) {
    const result = { valid: false, errors: [`Could not read valid JSON: ${error.message}`] };
    process.stdout.write(jsonOutput ? `${JSON.stringify(result, null, 2)}\n` : `Invalid plan\n- ${result.errors[0]}\n`);
    process.exitCode = 1;
    return;
  }

  const errors = validatePlan(plan);
  const result = { valid: errors.length === 0, errors };
  if (jsonOutput) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else if (result.valid) process.stdout.write(`Valid approved refactoring plan: ${plan.planId}\n`);
  else process.stdout.write(`Invalid plan\n${errors.map((error) => `- ${error}`).join("\n")}\n`);
  if (!result.valid) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) main();
