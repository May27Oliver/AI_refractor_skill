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

function validateInterface(item, path, errors) {
  if (!Array.isArray(item?.interface?.entryPoints) || item.interface.entryPoints.length === 0) {
    errors.push(`${path}.interface.entryPoints must be a non-empty array`);
  }
  item?.interface?.entryPoints?.forEach((entry, index) => {
    const current = `${path}.interface.entryPoints[${index}]`;
    if (!nonEmptyString(entry?.name)) errors.push(`${current}.name must be a non-empty string`);
    if (!stringArray(entry?.parameters)) errors.push(`${current}.parameters must be a string array`);
    if (!nonEmptyString(entry?.returns)) errors.push(`${current}.returns must be a non-empty string`);
    for (const field of ["invariants", "ordering", "errors"]) {
      if (!stringArray(entry?.[field], { nonEmpty: true })) errors.push(`${current}.${field} must be a non-empty string array`);
    }
  });
  const depth = item?.implementationDepth;
  if (!stringArray(depth?.movedBehavior, { nonEmpty: true })) errors.push(`${path}.implementationDepth.movedBehavior must be a non-empty string array`);
  if (!stringArray(depth?.ownedDependencies)) errors.push(`${path}.implementationDepth.ownedDependencies must be a string array`);
  if (!nonEmptyString(depth?.deletionTest?.deletionFallback)) errors.push(`${path}.implementationDepth.deletionTest.deletionFallback must be a non-empty string`);
  if (!nonEmptyString(depth?.deletionTest?.complexityDestination)) errors.push(`${path}.implementationDepth.deletionTest.complexityDestination must be a non-empty string`);
  if (!nonEmptyString(depth?.deletionTest?.existingReplacementAssessment)) errors.push(`${path}.implementationDepth.deletionTest.existingReplacementAssessment must be a non-empty string`);
  if (!nonEmptyString(depth?.passThroughRisk)) errors.push(`${path}.implementationDepth.passThroughRisk must be a non-empty string`);

  if (!new Set(["facade", "module", "coordinator", "repository", "adapter"]).has(item?.kind)) errors.push(`${path}.kind must be facade, module, coordinator, repository, or adapter`);
  if (typeof item?.isNew !== "boolean") errors.push(`${path}.isNew must be a boolean`);

  const existing = item?.existingModuleAnalysis;
  if (!Array.isArray(existing?.alternatives)) errors.push(`${path}.existingModuleAnalysis.alternatives must be an array`);
  existing?.alternatives?.forEach((alternative, index) => {
    const current = `${path}.existingModuleAnalysis.alternatives[${index}]`;
    for (const field of ["name", "overlap", "reuseOption", "disposition", "evidence"]) {
      if (!nonEmptyString(alternative?.[field])) errors.push(`${current}.${field} must be a non-empty string`);
    }
  });
  if (!nonEmptyString(existing?.searchEvidence)) errors.push(`${path}.existingModuleAnalysis.searchEvidence must be a non-empty string`);
  if (!nonEmptyString(existing?.selectedApproach)) errors.push(`${path}.existingModuleAnalysis.selectedApproach must be a non-empty string`);
  if (!nonEmptyString(existing?.localityImprovement)) errors.push(`${path}.existingModuleAnalysis.localityImprovement must be a non-empty string`);

  const overlap = item?.knowledgeOverlap;
  if (!Array.isArray(overlap?.existingOwners)) errors.push(`${path}.knowledgeOverlap.existingOwners must be an array`);
  overlap?.existingOwners?.forEach((owner, index) => {
    const current = `${path}.knowledgeOverlap.existingOwners[${index}]`;
    if (!nonEmptyString(owner?.module)) errors.push(`${current}.module must be a non-empty string`);
    if (!stringArray(owner?.knowledge, { nonEmpty: true })) errors.push(`${current}.knowledge must be a non-empty string array`);
    if (!new Set(["reuse", "move-single-owner", "no-overlap"]).has(owner?.disposition)) errors.push(`${current}.disposition must be reuse, move-single-owner, or no-overlap`);
    if (!nonEmptyString(owner?.evidence)) errors.push(`${current}.evidence must be a non-empty string`);
  });
  if (!stringArray(overlap?.introducedDuplicates)) errors.push(`${path}.knowledgeOverlap.introducedDuplicates must be a string array`);
  else if (overlap.introducedDuplicates.length > 0) errors.push(`${path}.knowledgeOverlap.introducedDuplicates must be empty; a refactor may not create duplicate knowledge owners`);
  if (!Array.isArray(overlap?.singleSourceOwners) || overlap.singleSourceOwners.length === 0) errors.push(`${path}.knowledgeOverlap.singleSourceOwners must be a non-empty array`);
  overlap?.singleSourceOwners?.forEach((owner, index) => {
    if (!nonEmptyString(owner?.knowledge) || !nonEmptyString(owner?.owner)) errors.push(`${path}.knowledgeOverlap.singleSourceOwners[${index}] requires knowledge and owner`);
  });

  if (!Array.isArray(item?.changeScenarios) || item.changeScenarios.length === 0) errors.push(`${path}.changeScenarios must be a non-empty array`);
  item?.changeScenarios?.forEach((scenario, index) => {
    const current = `${path}.changeScenarios[${index}]`;
    if (!nonEmptyString(scenario?.scenario)) errors.push(`${current}.scenario must be a non-empty string`);
    if (!stringArray(scenario?.affectedOwnedBehavior, { nonEmpty: true })) errors.push(`${current}.affectedOwnedBehavior must be a non-empty string array`);
    else if (Array.isArray(item?.owns) && scenario.affectedOwnedBehavior.some((behavior) => !item.owns.includes(behavior))) errors.push(`${current}.affectedOwnedBehavior must reference values declared in ${path}.owns`);
    if (typeof scenario?.affectsWholeModule !== "boolean") errors.push(`${current}.affectsWholeModule must be a boolean`);
  });
  if (!new Set(["cohesive", "coordinator-with-collaborators"]).has(item?.cohesion?.disposition)) errors.push(`${path}.cohesion.disposition must be cohesive or coordinator-with-collaborators`);
  if (!nonEmptyString(item?.cohesion?.justification)) errors.push(`${path}.cohesion.justification must be a non-empty string`);
  const hasPartialScenario = item?.changeScenarios?.some((scenario) => scenario?.affectsWholeModule === false);
  if (hasPartialScenario && item?.cohesion?.disposition !== "coordinator-with-collaborators") errors.push(`${path}.cohesion.disposition must be coordinator-with-collaborators when a change scenario affects only part of the module`);
  if (item?.cohesion?.disposition === "coordinator-with-collaborators" && !stringArray(item?.cohesion?.collaborators, { nonEmpty: true })) errors.push(`${path}.cohesion.collaborators must be a non-empty string array for a coordinator`);

  if (item?.isNew === true && new Set(["repository", "adapter"]).has(item?.kind)) {
    const conformance = item?.repositoryConformance;
    for (const field of ["instructionSource", "registrationModule", "exportModule", "transactionManagerPolicy", "filtersAndLocksSource"]) {
      if (!nonEmptyString(conformance?.[field])) errors.push(`${path}.repositoryConformance.${field} must be a non-empty string`);
    }
    if (!new Set(["reuse-existing", "move-single-source"]).has(conformance?.duplicationStrategy)) errors.push(`${path}.repositoryConformance.duplicationStrategy must be reuse-existing or move-single-source`);
  }
}

function validateDependencyGraph(graph, errors) {
  if (!isRecord(graph)) {
    errors.push("dependencyGraph must be an object");
    return;
  }
  for (const phase of ["baseline", "target"]) {
    const current = `dependencyGraph.${phase}`;
    if (!stringArray(graph?.[phase]?.nodes, { nonEmpty: true })) errors.push(`${current}.nodes must be a non-empty string array`);
    if (!Array.isArray(graph?.[phase]?.edges)) {
      errors.push(`${current}.edges must be an array`);
      continue;
    }
    graph[phase].edges.forEach((edge, index) => {
      if (!nonEmptyString(edge?.from) || !nonEmptyString(edge?.to) || !nonEmptyString(edge?.ownership)) errors.push(`${current}.edges[${index}] requires from, to, and ownership`);
      if (stringArray(graph?.[phase]?.nodes) && (!graph[phase].nodes.includes(edge?.from) || !graph[phase].nodes.includes(edge?.to))) errors.push(`${current}.edges[${index}] endpoints must exist in ${current}.nodes`);
    });
    if (!Number.isInteger(graph?.[phase]?.maxFanOut) || graph[phase].maxFanOut < 0) errors.push(`${current}.maxFanOut must be a non-negative integer`);
    if (Array.isArray(graph?.[phase]?.edges) && Number.isInteger(graph?.[phase]?.maxFanOut)) {
      const fanOut = new Map();
      graph[phase].edges.forEach((edge) => fanOut.set(edge?.from, (fanOut.get(edge?.from) ?? 0) + 1));
      const actualMax = Math.max(0, ...fanOut.values());
      if (graph[phase].maxFanOut !== actualMax) errors.push(`${current}.maxFanOut must equal the maximum fan-out computed from edges (${actualMax})`);
    }
  }
  if (Number.isInteger(graph?.baseline?.maxFanOut) && Number.isInteger(graph?.target?.maxFanOut) && graph.target.maxFanOut > graph.baseline.maxFanOut) errors.push("dependencyGraph.target.maxFanOut must not exceed dependencyGraph.baseline.maxFanOut");
  for (const phase of ["baseline", "target"]) {
    const current = `dependencyGraph.${phase}`;
    if (!Array.isArray(graph?.[phase]?.methodCarriedInfrastructure)) errors.push(`${current}.methodCarriedInfrastructure must be an array`);
    graph?.[phase]?.methodCarriedInfrastructure?.forEach((item, index) => {
      if (!nonEmptyString(item?.carrier) || !nonEmptyString(item?.dependency) || !nonEmptyString(item?.purpose)) errors.push(`${current}.methodCarriedInfrastructure[${index}] requires carrier, dependency, and purpose`);
    });
    if (!Array.isArray(graph?.[phase]?.knowledgeOwners)) errors.push(`${current}.knowledgeOwners must be an array`);
    graph?.[phase]?.knowledgeOwners?.forEach((item, index) => {
      if (!nonEmptyString(item?.knowledge) || !stringArray(item?.owners, { nonEmpty: true })) errors.push(`${current}.knowledgeOwners[${index}] requires knowledge and non-empty owners`);
    });
    if (!Number.isInteger(graph?.[phase]?.interfaceEntryPoints) || graph[phase].interfaceEntryPoints < 0) errors.push(`${current}.interfaceEntryPoints must be a non-negative integer`);
  }
  if (!stringArray(graph?.introducedKnowledgeDuplicates)) errors.push("dependencyGraph.introducedKnowledgeDuplicates must be a string array");
  else if (graph.introducedKnowledgeDuplicates.length > 0) errors.push("dependencyGraph.introducedKnowledgeDuplicates must be empty");
  for (const field of ["constructorEdges", "methodCarriedInfrastructure", "knowledgeLocality", "interfaceSurface"]) {
    if (!nonEmptyString(graph?.assessment?.[field])) errors.push(`dependencyGraph.assessment.${field} must be a non-empty string`);
  }
}

function validateBaselineBehaviorInventory(plan, errors) {
  const inventory = plan?.baselineBehaviorInventory;
  if (!Array.isArray(inventory) || inventory.length === 0) {
    errors.push("baselineBehaviorInventory must be a non-empty array");
    return;
  }
  const targets = new Set((plan?.targetStructure ?? []).map((target) => target?.name).filter(nonEmptyString));
  const registry = new Map((plan?.exclusiveOwnership ?? []).map((entry) => [entry?.key, entry]));
  const behaviorKeys = new Set();
  const testIds = new Set();
  inventory.forEach((item, index) => {
    const current = `baselineBehaviorInventory[${index}]`;
    for (const field of ["key", "behavior", "targetOwner"]) {
      if (!nonEmptyString(item?.[field])) errors.push(`${current}.${field} must be a non-empty string`);
    }
    if (behaviorKeys.has(item?.key)) errors.push(`${current}.key must be unique`);
    behaviorKeys.add(item?.key);
    if (!targets.has(item?.targetOwner)) errors.push(`${current}.targetOwner must name a targetStructure module`);
    if (!Array.isArray(item?.occurrenceSites) || item.occurrenceSites.length === 0) errors.push(`${current}.occurrenceSites must be a non-empty array`);
    item?.occurrenceSites?.forEach((occurrence, occurrenceIndex) => {
      if (!nonEmptyString(occurrence?.location) || !nonEmptyString(occurrence?.consumer)) errors.push(`${current}.occurrenceSites[${occurrenceIndex}] requires location and consumer`);
    });
    if (!stringArray(item?.consumerInterfaces, { nonEmpty: true })) errors.push(`${current}.consumerInterfaces must be a non-empty string array`);
    if (typeof item?.phaseSensitive !== "boolean") errors.push(`${current}.phaseSensitive must be a boolean`);
    const test = item?.preservationTest;
    for (const field of ["id", "scenario", "assertion"]) {
      if (!nonEmptyString(test?.[field])) errors.push(`${current}.preservationTest.${field} must be a non-empty string`);
    }
    if (testIds.has(test?.id)) errors.push(`${current}.preservationTest.id must be unique`);
    testIds.add(test?.id);
    if (item?.phaseSensitive === true && !nonEmptyString(test?.changedBetweenPhases)) errors.push(`${current}.preservationTest.changedBetweenPhases must describe the phase mutation for phase-sensitive behavior`);
    if (item?.phaseSensitive === true && ((item?.occurrenceSites?.length ?? 0) < 2 || (item?.consumerInterfaces?.length ?? 0) < 2)) errors.push(`${current} phase-sensitive behavior must record at least two occurrence sites and consumer interfaces`);
    const ownership = registry.get(item?.key);
    if (!ownership || ownership?.owner !== item?.targetOwner) errors.push(`${current}.key must map to exclusiveOwnership with owner ${item?.targetOwner ?? "<missing>"}`);
  });
  const referenced = plan?.composedVerification?.behaviorTestIds;
  if (!stringArray(referenced, { nonEmpty: true })) {
    errors.push("composedVerification.behaviorTestIds must be a non-empty string array");
    return;
  }
  const referencedSet = new Set(referenced);
  if (referenced.length !== referencedSet.size) errors.push("composedVerification.behaviorTestIds must not contain duplicates");
  const missing = [...testIds].filter((id) => !referencedSet.has(id));
  const unknown = [...referencedSet].filter((id) => !testIds.has(id));
  if (missing.length || unknown.length) errors.push(`composedVerification.behaviorTestIds must exactly match baseline behavior preservation tests (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`);
}

function validateStructuralConsistency(plan, errors) {
  const targets = Array.isArray(plan?.targetStructure) ? plan.targetStructure : [];
  const edges = Array.isArray(plan?.dependencyGraph?.target?.edges) ? plan.dependencyGraph.target.edges : [];
  const targetNames = new Set(targets.map((target) => target?.name).filter(nonEmptyString));
  const fanOut = new Map();

  for (const target of targets) {
    const outgoing = edges.filter((edge) => edge?.from === target?.name).map((edge) => edge?.to);
    fanOut.set(target?.name, outgoing.length);
    const declared = target?.implementationDepth?.ownedDependencies;
    if (stringArray(declared)) {
      const actualSet = new Set(outgoing);
      const declaredSet = new Set(declared);
      if (declared.length !== declaredSet.size) errors.push(`targetStructure ${target.name} implementationDepth.ownedDependencies must not contain duplicates`);
      const missing = outgoing.filter((dependency) => !declaredSet.has(dependency));
      const extra = declared.filter((dependency) => !actualSet.has(dependency));
      if (missing.length || extra.length) errors.push(`targetStructure ${target.name} implementationDepth.ownedDependencies must exactly match dependencyGraph.target outgoing edges (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
    }
  }

  const case007 = plan?.structuralThresholds?.case007;
  if (!Number.isInteger(case007?.parameterCount) || case007.parameterCount < 1) errors.push("structuralThresholds.case007.parameterCount must be a positive integer");
  if (!new Set(["eliminate", "allow-reviewed-residuals"]).has(case007?.completionTarget)) errors.push("structuralThresholds.case007.completionTarget must be eliminate or allow-reviewed-residuals");
  if (!Array.isArray(case007?.residualCandidates)) errors.push("structuralThresholds.case007.residualCandidates must be an array");
  const residualBySymbol = new Map();
  case007?.residualCandidates?.forEach((candidate, index) => {
    const current = `structuralThresholds.case007.residualCandidates[${index}]`;
    if (!nonEmptyString(candidate?.symbol)) errors.push(`${current}.symbol must be a non-empty string`);
    if (!Number.isInteger(candidate?.measuredParameters) || candidate.measuredParameters < 0) errors.push(`${current}.measuredParameters must be a non-negative integer`);
    if (candidate?.disposition !== "accepted-contextual") errors.push(`${current}.disposition must equal accepted-contextual`);
    if (!nonEmptyString(candidate?.justification)) errors.push(`${current}.justification must be a non-empty string`);
    if (residualBySymbol.has(candidate?.symbol)) errors.push(`${current}.symbol must be unique`);
    residualBySymbol.set(candidate?.symbol, candidate);
  });
  if (case007?.completionTarget === "eliminate" && case007?.residualCandidates?.length) errors.push("structuralThresholds.case007.residualCandidates must be empty when completionTarget is eliminate");
  if (Number.isInteger(case007?.parameterCount)) {
    for (const [symbol, count] of fanOut) {
      if (count < case007.parameterCount) continue;
      const residual = residualBySymbol.get(symbol);
      if (case007.completionTarget === "eliminate") errors.push(`target ${symbol} has ${count} constructor dependencies and contradicts the case 007 eliminate target (${case007.parameterCount})`);
      else if (!residual || residual.measuredParameters !== count) errors.push(`target ${symbol} requires a matching reviewed case 007 residual measured at ${count} parameters`);
    }
    for (const [symbol, residual] of residualBySymbol) {
      const count = fanOut.get(symbol);
      if (!targetNames.has(symbol) || count === undefined || count < case007.parameterCount || residual.measuredParameters !== count) errors.push(`case 007 residual ${symbol} must match a target constructor at or above the configured threshold`);
    }
  }

  if (!Array.isArray(plan?.exclusiveOwnership) || plan.exclusiveOwnership.length === 0) {
    errors.push("exclusiveOwnership must be a non-empty array");
    return;
  }
  const registry = new Map();
  plan.exclusiveOwnership.forEach((entry, index) => {
    const current = `exclusiveOwnership[${index}]`;
    for (const field of ["key", "owner", "invariant", "evidence"]) if (!nonEmptyString(entry?.[field])) errors.push(`${current}.${field} must be a non-empty string`);
    if (registry.has(entry?.key)) errors.push(`${current}.key must be unique`);
    registry.set(entry?.key, entry);
    if (!targetNames.has(entry?.owner)) errors.push(`${current}.owner must name a targetStructure module`);
  });
  const assignments = new Map();
  targets.forEach((target, index) => {
    const keys = target?.exclusiveOwnershipKeys;
    if (!stringArray(keys)) {
      errors.push(`targetStructure[${index}].exclusiveOwnershipKeys must be a string array`);
      return;
    }
    for (const key of keys) {
      if (!registry.has(key)) errors.push(`targetStructure[${index}].exclusiveOwnershipKeys references unknown key ${key}`);
      const owners = assignments.get(key) ?? [];
      owners.push(target.name);
      assignments.set(key, owners);
    }
  });
  for (const [key, entry] of registry) {
    const owners = assignments.get(key) ?? [];
    if (owners.length !== 1 || owners[0] !== entry.owner) errors.push(`exclusive ownership ${key} must be assigned exactly once to ${entry.owner}`);
  }
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

  if (plan.schemaVersion !== "refactor-plan/v6") errors.push("schemaVersion must be 'refactor-plan/v6'");
  if (!nonEmptyString(plan.planId)) errors.push("planId must be a non-empty string");
  if (!nonEmptyString(plan.generatedAt) || Number.isNaN(Date.parse(plan.generatedAt))) {
    errors.push("generatedAt must be an ISO-compatible timestamp");
  }
  if (plan.status !== "approved") errors.push("status must be 'approved'");
  if (!nonEmptyString(plan.objective)) errors.push("objective must be a non-empty string");

  if (!Array.isArray(plan.structuralBaseline) || plan.structuralBaseline.length === 0) {
    errors.push("structuralBaseline must be a non-empty array");
  } else {
    plan.structuralBaseline.forEach((item, index) => {
      const current = `structuralBaseline[${index}]`;
      if (!isRecord(item) || !isSafeRelativePath(item.file) || !nonEmptyString(item.symbol)) {
        errors.push(`${current} requires a safe relative file and symbol`);
        return;
      }
      if (!Array.isArray(item.responsibilities) || item.responsibilities.length === 0) {
        errors.push(`${current}.responsibilities must be a non-empty array`);
      } else {
        item.responsibilities.forEach((responsibility, responsibilityIndex) => {
          if (!isRecord(responsibility) || !nonEmptyString(responsibility.name) || !nonEmptyString(responsibility.evidence) || !nonEmptyString(responsibility.reasonToChange)) {
            errors.push(`${current}.responsibilities[${responsibilityIndex}] requires name, evidence, and reasonToChange`);
          }
        });
      }
    });
  }

  if (!Array.isArray(plan.targetStructure) || plan.targetStructure.length === 0) {
    errors.push("targetStructure must be a non-empty array");
  } else {
    plan.targetStructure.forEach((item, index) => {
      const current = `targetStructure[${index}]`;
      if (!isRecord(item) || !nonEmptyString(item.name) || !nonEmptyString(item.responsibility) || !nonEmptyString(item.reasonToChange)) {
        errors.push(`${current} requires name, responsibility, and reasonToChange`);
        return;
      }
      if (!stringArray(item.owns, { nonEmpty: true })) errors.push(`${current}.owns must be a non-empty string array`);
      if (!stringArray(item.excludes)) errors.push(`${current}.excludes must be a string array`);
      validateInterface(item, current, errors);
    });
    if (Number.isInteger(plan?.dependencyGraph?.target?.interfaceEntryPoints)) {
      const targetEntryPoints = plan.targetStructure.reduce((count, item) => count + (item?.interface?.entryPoints?.length ?? 0), 0);
      if (plan.dependencyGraph.target.interfaceEntryPoints !== targetEntryPoints) errors.push(`dependencyGraph.target.interfaceEntryPoints must equal targetStructure entry point count (${targetEntryPoints})`);
    }
  }
  validateDependencyGraph(plan.dependencyGraph, errors);
  validateStructuralConsistency(plan, errors);
  validateBaselineBehaviorInventory(plan, errors);

  if (!Array.isArray(plan.structuralAcceptance) || plan.structuralAcceptance.length === 0) {
    errors.push("structuralAcceptance must be a non-empty array");
  } else {
    plan.structuralAcceptance.forEach((item, index) => {
      const current = `structuralAcceptance[${index}]`;
      if (!isRecord(item) || !nonEmptyString(item.criterion) || !nonEmptyString(item.verification)) {
        errors.push(`${current} requires criterion and verification`);
      }
      if (item?.failureStatus !== "structural-goal-not-met") {
        errors.push(`${current}.failureStatus must be 'structural-goal-not-met'`);
      }
    });
  }

  if (!isRecord(plan.convergencePolicy)) {
    errors.push("convergencePolicy must be an object");
  } else {
    if (plan.convergencePolicy.mode !== "iterative") errors.push("convergencePolicy.mode must be 'iterative'");
    if (!Number.isInteger(plan.convergencePolicy.maxIterations) || plan.convergencePolicy.maxIterations < 1) {
      errors.push("convergencePolicy.maxIterations must be a positive integer");
    }
    if (plan.convergencePolicy.rescanAfterEachStep !== true) {
      errors.push("convergencePolicy.rescanAfterEachStep must be true");
    }
    if (plan.convergencePolicy.completionCondition !== "all-structural-acceptance") {
      errors.push("convergencePolicy.completionCondition must be 'all-structural-acceptance'");
    }
    if (plan.convergencePolicy.onUnmet !== "return-to-planning") {
      errors.push("convergencePolicy.onUnmet must be 'return-to-planning'");
    }
  }

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
      if (source?.case?.id === "007") {
        if (!Number.isInteger(source?.measurement?.value) || source.measurement.value < 0) errors.push(`${current}.measurement.value must be a non-negative integer`);
        if (source?.measurement?.unit !== "parameters") errors.push(`${current}.measurement.unit must be parameters`);
        if (!["ast", "manual-declaration"].includes(source?.measurement?.method)) errors.push(`${current}.measurement.method must be ast or manual-declaration`);
        if (!nonEmptyString(source?.measurement?.evidence)) errors.push(`${current}.measurement.evidence must be a non-empty string`);
      }
      if (!Array.isArray(source.relatedTechniques)) errors.push(`${current}.relatedTechniques must be an array`);
      else source.relatedTechniques.forEach((technique, techniqueIndex) => {
        if (!isRecord(technique) || !nonEmptyString(technique.id) || !nonEmptyString(technique.title) || !nonEmptyString(technique.intent)) {
          errors.push(`${current}.relatedTechniques[${techniqueIndex}] requires id, title, and intent`);
        }
      });
    });
  }

  const dataClumpCandidates = (plan.sourceCandidates ?? []).filter((candidate) => candidate?.case?.id === "014");
  if (dataClumpCandidates.length) {
    if (!Array.isArray(plan.dataClumpAnalysis) || plan.dataClumpAnalysis.length !== dataClumpCandidates.length) errors.push("dataClumpAnalysis must contain one entry for every case 014 candidate");
    plan.dataClumpAnalysis?.forEach((analysis, index) => {
      const current = `dataClumpAnalysis[${index}]`;
      if (!nonEmptyString(analysis?.candidateId)) errors.push(`${current}.candidateId must be a non-empty string`);
      if (!stringArray(analysis?.values, { nonEmpty: true })) errors.push(`${current}.values must be a non-empty string array`);
      if (!new Set(["confirmed", "rejected"]).has(analysis?.disposition)) errors.push(`${current}.disposition must be confirmed or rejected`);
      if (!nonEmptyString(analysis?.invariant)) errors.push(`${current}.invariant must be a non-empty string`);
      if (!nonEmptyString(analysis?.rationale)) errors.push(`${current}.rationale must be a non-empty string`);
      if (!Array.isArray(analysis?.occurrences) || analysis.occurrences.length < 2) errors.push(`${current}.occurrences must contain at least two entries`);
      analysis?.occurrences?.forEach((occurrence, occurrenceIndex) => {
        if (!nonEmptyString(occurrence?.location) || !nonEmptyString(occurrence?.consumer)) errors.push(`${current}.occurrences[${occurrenceIndex}] requires location and consumer`);
      });
    });
    const expectedIds = new Set(dataClumpCandidates.map((candidate) => candidate.candidateId));
    const actualIds = new Set((plan.dataClumpAnalysis ?? []).map((analysis) => analysis?.candidateId));
    if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) errors.push("dataClumpAnalysis candidateIds must match case 014 sourceCandidates exactly");
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
  if (!nonEmptyString(plan.composedVerification?.publicEntryPoint)) errors.push("composedVerification.publicEntryPoint must be a non-empty string");
  if (!nonEmptyString(plan.composedVerification?.providerGraph)) errors.push("composedVerification.providerGraph must be a non-empty string");
  if (!nonEmptyString(plan.composedVerification?.command)) errors.push("composedVerification.command must be a non-empty string");
  if (!stringArray(plan.composedVerification?.assertions, { nonEmpty: true })) errors.push("composedVerification.assertions must be a non-empty string array");

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
      if (!nonEmptyString(step.structuralOutcome)) errors.push(`${current}.structuralOutcome must be a non-empty string`);
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
