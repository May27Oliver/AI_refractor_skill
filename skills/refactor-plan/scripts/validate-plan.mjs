#!/usr/bin/env node

import { promises as fs } from "node:fs";
import process from "node:process";

const file = process.argv[2];
if (!file || process.argv.length !== 3) {
  process.stderr.write("Usage: validate-plan.mjs <plan.json>\n");
  process.exit(2);
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function nonEmptyArray(value) {
  return Array.isArray(value) && value.length > 0;
}

function validate(document) {
  const errors = [];
  const requireString = (value, path) => {
    if (!nonEmptyString(value)) errors.push(`${path} must be a non-empty string`);
  };
  const requireArray = (value, path) => {
    if (!Array.isArray(value)) errors.push(`${path} must be an array`);
  };

  if (document?.schemaVersion !== "refactor-plan/v1") errors.push("schemaVersion must equal refactor-plan/v1");
  requireString(document?.planId, "planId");
  requireString(document?.generatedAt, "generatedAt");
  requireString(document?.repository?.root, "repository.root");
  requireString(document?.objective, "objective");
  requireArray(document?.sourceCandidates, "sourceCandidates");
  if (!nonEmptyArray(document?.sourceCandidates)) errors.push("sourceCandidates must be a non-empty array");
  if (Array.isArray(document?.sourceCandidates)) {
    document.sourceCandidates.forEach((candidate, index) => {
      requireString(candidate?.candidateId, `sourceCandidates[${index}].candidateId`);
      requireString(candidate?.case?.id, `sourceCandidates[${index}].case.id`);
      requireString(candidate?.case?.title, `sourceCandidates[${index}].case.title`);
      requireString(candidate?.case?.intent, `sourceCandidates[${index}].case.intent`);
      requireString(candidate?.location?.file, `sourceCandidates[${index}].location.file`);
      requireString(candidate?.evidence, `sourceCandidates[${index}].evidence`);
      if (!new Set(["high", "medium", "low"]).has(candidate?.confidence)) {
        errors.push(`sourceCandidates[${index}].confidence must be high, medium, or low`);
      }
    });
  }

  const decision = document?.disposition?.decision;
  if (!new Set(["proceed", "reject", "needs-context"]).has(decision)) {
    errors.push("disposition.decision must be proceed, reject, or needs-context");
  }
  if (!nonEmptyArray(document?.disposition?.reasons)) errors.push("disposition.reasons must be a non-empty array");

  requireArray(document?.scope?.includedPaths, "scope.includedPaths");
  requireArray(document?.scope?.excludedPaths, "scope.excludedPaths");
  requireArray(document?.preservationEnvelope, "preservationEnvelope");
  document?.preservationEnvelope?.forEach((item, index) => {
    requireString(item?.category, `preservationEnvelope[${index}].category`);
    requireString(item?.invariant, `preservationEnvelope[${index}].invariant`);
    requireString(item?.evidence, `preservationEnvelope[${index}].evidence`);
  });
  for (const key of ["publicApi", "databaseSchema", "configuration", "dependencies", "runtimeBehavior"]) {
    if (document?.changeBoundaries?.[key] !== "preserve") errors.push(`changeBoundaries.${key} must equal preserve`);
  }
  requireArray(document?.baselineChecks, "baselineChecks");
  requireArray(document?.steps, "steps");
  requireArray(document?.risks, "risks");
  requireArray(document?.finalVerification, "finalVerification");
  requireArray(document?.stopConditions, "stopConditions");
  requireArray(document?.authorization?.prohibitedOperations, "authorization.prohibitedOperations");
  for (const operation of ["push", "merge", "deploy"]) {
    if (!document?.authorization?.prohibitedOperations?.includes(operation)) errors.push(`authorization.prohibitedOperations must include ${operation}`);
  }

  if (decision === "proceed") {
    if (!nonEmptyArray(document?.scope?.includedPaths)) errors.push("a proceed plan requires scope.includedPaths");
    if (!nonEmptyArray(document?.preservationEnvelope)) errors.push("a proceed plan requires preservationEnvelope");
    if (!nonEmptyArray(document?.baselineChecks)) errors.push("a proceed plan requires baselineChecks");
    if (!nonEmptyArray(document?.steps)) errors.push("a proceed plan requires steps");
    if (!nonEmptyArray(document?.risks)) errors.push("a proceed plan requires risks");
    if (!nonEmptyArray(document?.finalVerification)) errors.push("a proceed plan requires finalVerification");
    if (!nonEmptyArray(document?.stopConditions)) errors.push("a proceed plan requires stopConditions");
  } else if (Array.isArray(document?.steps) && document.steps.length > 0) {
    errors.push(`${decision ?? "non-proceed"} plans must not contain implementation steps`);
  }
  if (decision === "needs-context" && !nonEmptyArray(document?.disposition?.missingContext)) {
    errors.push("a needs-context plan requires disposition.missingContext");
  }

  const stepIds = Array.isArray(document?.steps) ? document.steps.map((step) => step?.id) : [];
  if (new Set(stepIds).size !== stepIds.length) errors.push("step IDs must be unique");
  document?.steps?.forEach((step, index) => {
    requireString(step?.id, `steps[${index}].id`);
    requireString(step?.title, `steps[${index}].title`);
    if (!nonEmptyArray(step?.files)) errors.push(`steps[${index}].files must be a non-empty array`);
    requireString(step?.transformation, `steps[${index}].transformation`);
    if (!nonEmptyArray(step?.preconditions)) errors.push(`steps[${index}].preconditions must be a non-empty array`);
    if (step?.reversible !== true) errors.push(`steps[${index}].reversible must equal true`);
    if (!nonEmptyArray(step?.verification)) errors.push(`steps[${index}].verification must be a non-empty array`);
    requireString(step?.rollback, `steps[${index}].rollback`);
  });

  const status = document?.status;
  if (!new Set(["awaiting-approval", "approved", "rejected"]).has(status)) {
    errors.push("status must be awaiting-approval, approved, or rejected");
  }
  if (document?.approval?.type !== "human") errors.push("approval.type must equal human");
  requireArray(document?.approval?.approvedStepIds, "approval.approvedStepIds");
  if (status === "awaiting-approval") {
    if (document?.approval?.approvedBy !== null) errors.push("awaiting-approval requires approval.approvedBy to be null");
    if (document?.approval?.approvedAt !== null) errors.push("awaiting-approval requires approval.approvedAt to be null");
    if (document?.approval?.approvedStepIds?.length) errors.push("awaiting-approval requires empty approval.approvedStepIds");
  }
  if (status === "approved") {
    requireString(document?.approval?.approvedBy, "approval.approvedBy");
    requireString(document?.approval?.approvedAt, "approval.approvedAt");
    if (!nonEmptyArray(document?.approval?.approvedStepIds)) errors.push("approved plans require approval.approvedStepIds");
    for (const id of document?.approval?.approvedStepIds ?? []) {
      if (!stepIds.includes(id)) errors.push(`approval references unknown step ID: ${id}`);
    }
    if (decision !== "proceed") errors.push("only a proceed plan can be approved");
  }
  return errors;
}

try {
  const document = JSON.parse(await fs.readFile(file, "utf8"));
  const errors = validate(document);
  if (errors.length) {
    process.stderr.write(`${errors.map((error) => `- ${error}`).join("\n")}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Plan is valid.\n");
  }
} catch (error) {
  process.stderr.write(`Cannot validate plan: ${error.message}\n`);
  process.exitCode = 1;
}
