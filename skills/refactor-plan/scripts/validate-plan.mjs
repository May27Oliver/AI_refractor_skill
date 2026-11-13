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

function stringArray(value, { nonEmpty = false } = {}) {
  return Array.isArray(value) && (!nonEmpty || value.length > 0) && value.every(nonEmptyString);
}

function validateInterface(item, path, errors) {
  if (!nonEmptyArray(item?.interface?.entryPoints)) {
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

  if (!new Set(["facade", "module", "coordinator", "repository", "adapter"]).has(item?.kind)) {
    errors.push(`${path}.kind must be facade, module, coordinator, repository, or adapter`);
  }
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
  if (!nonEmptyArray(overlap?.singleSourceOwners)) errors.push(`${path}.knowledgeOverlap.singleSourceOwners must be a non-empty array`);
  overlap?.singleSourceOwners?.forEach((owner, index) => {
    if (!nonEmptyString(owner?.knowledge) || !nonEmptyString(owner?.owner)) errors.push(`${path}.knowledgeOverlap.singleSourceOwners[${index}] requires knowledge and owner`);
  });

  if (!nonEmptyArray(item?.changeScenarios)) errors.push(`${path}.changeScenarios must be a non-empty array`);
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
  if (!graph || typeof graph !== "object" || Array.isArray(graph)) return;
  for (const phase of ["baseline", "target"]) {
    const current = `dependencyGraph.${phase}`;
    if (!stringArray(graph?.[phase]?.nodes, { nonEmpty: true })) errors.push(`${current}.nodes must be a non-empty string array`);
    if (!Array.isArray(graph?.[phase]?.edges)) {
      errors.push(`${current}.edges must be an array`);
      continue;
    }
    graph[phase].edges.forEach((edge, index) => {
      if (!nonEmptyString(edge?.from) || !nonEmptyString(edge?.to) || !nonEmptyString(edge?.ownership)) {
        errors.push(`${current}.edges[${index}] requires from, to, and ownership`);
      }
      if (stringArray(graph?.[phase]?.nodes) && (!graph[phase].nodes.includes(edge?.from) || !graph[phase].nodes.includes(edge?.to))) {
        errors.push(`${current}.edges[${index}] endpoints must exist in ${current}.nodes`);
      }
    });
    if (!Number.isInteger(graph?.[phase]?.maxFanOut) || graph[phase].maxFanOut < 0) {
      errors.push(`${current}.maxFanOut must be a non-negative integer`);
    }
    if (Array.isArray(graph?.[phase]?.edges) && Number.isInteger(graph?.[phase]?.maxFanOut)) {
      const fanOut = new Map();
      graph[phase].edges.forEach((edge) => fanOut.set(edge?.from, (fanOut.get(edge?.from) ?? 0) + 1));
      const actualMax = Math.max(0, ...fanOut.values());
      if (graph[phase].maxFanOut !== actualMax) errors.push(`${current}.maxFanOut must equal the maximum fan-out computed from edges (${actualMax})`);
    }
  }
  if (Number.isInteger(graph?.baseline?.maxFanOut) && Number.isInteger(graph?.target?.maxFanOut) && graph.target.maxFanOut > graph.baseline.maxFanOut) {
    errors.push("dependencyGraph.target.maxFanOut must not exceed dependencyGraph.baseline.maxFanOut");
  }
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

function validateBaselineBehaviorInventory(document, errors) {
  const inventory = document?.baselineBehaviorInventory;
  if (!nonEmptyArray(inventory)) {
    errors.push("baselineBehaviorInventory must be a non-empty array");
    return;
  }
  const targets = new Set((document?.targetStructure ?? []).map((target) => target?.name).filter(nonEmptyString));
  const registry = new Map((document?.exclusiveOwnership ?? []).map((entry) => [entry?.key, entry]));
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
    if (!nonEmptyArray(item?.occurrenceSites)) errors.push(`${current}.occurrenceSites must be a non-empty array`);
    item?.occurrenceSites?.forEach((occurrence, occurrenceIndex) => {
      if (!nonEmptyString(occurrence?.location) || !nonEmptyString(occurrence?.consumer)) {
        errors.push(`${current}.occurrenceSites[${occurrenceIndex}] requires location and consumer`);
      }
    });
    if (!stringArray(item?.consumerInterfaces, { nonEmpty: true })) errors.push(`${current}.consumerInterfaces must be a non-empty string array`);
    if (typeof item?.phaseSensitive !== "boolean") errors.push(`${current}.phaseSensitive must be a boolean`);
    const test = item?.preservationTest;
    for (const field of ["id", "scenario", "assertion"]) {
      if (!nonEmptyString(test?.[field])) errors.push(`${current}.preservationTest.${field} must be a non-empty string`);
    }
    if (testIds.has(test?.id)) errors.push(`${current}.preservationTest.id must be unique`);
    testIds.add(test?.id);
    if (item?.phaseSensitive === true && !nonEmptyString(test?.changedBetweenPhases)) {
      errors.push(`${current}.preservationTest.changedBetweenPhases must describe the phase mutation for phase-sensitive behavior`);
    }
    if (item?.phaseSensitive === true && ((item?.occurrenceSites?.length ?? 0) < 2 || (item?.consumerInterfaces?.length ?? 0) < 2)) {
      errors.push(`${current} phase-sensitive behavior must record at least two occurrence sites and consumer interfaces`);
    }
    const ownership = registry.get(item?.key);
    if (!ownership || ownership?.owner !== item?.targetOwner) {
      errors.push(`${current}.key must map to exclusiveOwnership with owner ${item?.targetOwner ?? "<missing>"}`);
    }
  });
  const referenced = document?.composedVerification?.behaviorTestIds;
  if (!stringArray(referenced, { nonEmpty: true })) {
    errors.push("composedVerification.behaviorTestIds must be a non-empty string array");
    return;
  }
  const referencedSet = new Set(referenced);
  if (referenced.length !== referencedSet.size) errors.push("composedVerification.behaviorTestIds must not contain duplicates");
  const missing = [...testIds].filter((id) => !referencedSet.has(id));
  const unknown = [...referencedSet].filter((id) => !testIds.has(id));
  if (missing.length || unknown.length) {
    errors.push(`composedVerification.behaviorTestIds must exactly match baseline behavior preservation tests (missing: ${missing.join(", ") || "none"}; unknown: ${unknown.join(", ") || "none"})`);
  }
}

function validateStructuralConsistency(document, errors) {
  const targets = Array.isArray(document?.targetStructure) ? document.targetStructure : [];
  const edges = Array.isArray(document?.dependencyGraph?.target?.edges)
    ? document.dependencyGraph.target.edges
    : [];
  const targetNames = new Set(targets.map((target) => target?.name).filter(nonEmptyString));
  const fanOut = new Map();

  for (const target of targets) {
    const outgoing = edges.filter((edge) => edge?.from === target?.name).map((edge) => edge?.to);
    fanOut.set(target?.name, outgoing.length);
    const declared = target?.implementationDepth?.ownedDependencies;
    if (stringArray(declared)) {
      const actualSet = new Set(outgoing);
      const declaredSet = new Set(declared);
      if (declared.length !== declaredSet.size) {
        errors.push(`targetStructure ${target.name} implementationDepth.ownedDependencies must not contain duplicates`);
      }
      const missing = outgoing.filter((dependency) => !declaredSet.has(dependency));
      const extra = declared.filter((dependency) => !actualSet.has(dependency));
      if (missing.length || extra.length) {
        errors.push(`targetStructure ${target.name} implementationDepth.ownedDependencies must exactly match dependencyGraph.target outgoing edges (missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"})`);
      }
    }
  }

  const case007 = document?.structuralThresholds?.case007;
  if (!Number.isInteger(case007?.parameterCount) || case007.parameterCount < 1) {
    errors.push("structuralThresholds.case007.parameterCount must be a positive integer");
  }
  if (!new Set(["eliminate", "allow-reviewed-residuals"]).has(case007?.completionTarget)) {
    errors.push("structuralThresholds.case007.completionTarget must be eliminate or allow-reviewed-residuals");
  }
  if (!Array.isArray(case007?.residualCandidates)) {
    errors.push("structuralThresholds.case007.residualCandidates must be an array");
  }
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
  if (case007?.completionTarget === "eliminate" && case007?.residualCandidates?.length) {
    errors.push("structuralThresholds.case007.residualCandidates must be empty when completionTarget is eliminate");
  }
  if (Number.isInteger(case007?.parameterCount)) {
    for (const [symbol, count] of fanOut) {
      if (count < case007.parameterCount) continue;
      const residual = residualBySymbol.get(symbol);
      if (case007.completionTarget === "eliminate") {
        errors.push(`target ${symbol} has ${count} constructor dependencies and contradicts the case 007 eliminate target (${case007.parameterCount})`);
      } else if (!residual || residual.measuredParameters !== count) {
        errors.push(`target ${symbol} requires a matching reviewed case 007 residual measured at ${count} parameters`);
      }
    }
    for (const [symbol, residual] of residualBySymbol) {
      const count = fanOut.get(symbol);
      if (!targetNames.has(symbol) || count === undefined || count < case007.parameterCount || residual.measuredParameters !== count) {
        errors.push(`case 007 residual ${symbol} must match a target constructor at or above the configured threshold`);
      }
    }
  }

  if (!nonEmptyArray(document?.exclusiveOwnership)) {
    errors.push("exclusiveOwnership must be a non-empty array");
    return;
  }
  const registry = new Map();
  document.exclusiveOwnership.forEach((entry, index) => {
    const current = `exclusiveOwnership[${index}]`;
    for (const field of ["key", "owner", "invariant", "evidence"]) {
      if (!nonEmptyString(entry?.[field])) errors.push(`${current}.${field} must be a non-empty string`);
    }
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
    if (owners.length !== 1 || owners[0] !== entry.owner) {
      errors.push(`exclusive ownership ${key} must be assigned exactly once to ${entry.owner}`);
    }
  }
}

function validate(document) {
  const errors = [];
  const requireString = (value, path) => {
    if (!nonEmptyString(value)) errors.push(`${path} must be a non-empty string`);
  };
  const requireArray = (value, path) => {
    if (!Array.isArray(value)) errors.push(`${path} must be an array`);
  };

  if (document?.schemaVersion !== "refactor-plan/v6") errors.push("schemaVersion must equal refactor-plan/v6");
  requireString(document?.planId, "planId");
  requireString(document?.generatedAt, "generatedAt");
  requireString(document?.repository?.root, "repository.root");
  requireString(document?.objective, "objective");
  requireArray(document?.structuralBaseline, "structuralBaseline");
  document?.structuralBaseline?.forEach((item, index) => {
    requireString(item?.file, `structuralBaseline[${index}].file`);
    requireString(item?.symbol, `structuralBaseline[${index}].symbol`);
    if (!nonEmptyArray(item?.responsibilities)) {
      errors.push(`structuralBaseline[${index}].responsibilities must be a non-empty array`);
    }
    item?.responsibilities?.forEach((responsibility, responsibilityIndex) => {
      const path = `structuralBaseline[${index}].responsibilities[${responsibilityIndex}]`;
      requireString(responsibility?.name, `${path}.name`);
      requireString(responsibility?.evidence, `${path}.evidence`);
      requireString(responsibility?.reasonToChange, `${path}.reasonToChange`);
    });
  });
  requireArray(document?.targetStructure, "targetStructure");
  document?.targetStructure?.forEach((item, index) => {
    requireString(item?.name, `targetStructure[${index}].name`);
    requireString(item?.responsibility, `targetStructure[${index}].responsibility`);
    requireString(item?.reasonToChange, `targetStructure[${index}].reasonToChange`);
    if (!nonEmptyArray(item?.owns)) errors.push(`targetStructure[${index}].owns must be a non-empty array`);
    if (!Array.isArray(item?.excludes)) errors.push(`targetStructure[${index}].excludes must be an array`);
    validateInterface(item, `targetStructure[${index}]`, errors);
  });
  if (Array.isArray(document?.targetStructure) && Number.isInteger(document?.dependencyGraph?.target?.interfaceEntryPoints)) {
    const targetEntryPoints = document.targetStructure.reduce((count, item) => count + (item?.interface?.entryPoints?.length ?? 0), 0);
    if (document.dependencyGraph.target.interfaceEntryPoints !== targetEntryPoints) errors.push(`dependencyGraph.target.interfaceEntryPoints must equal targetStructure entry point count (${targetEntryPoints})`);
  }
  validateDependencyGraph(document?.dependencyGraph, errors);
  validateStructuralConsistency(document, errors);
  validateBaselineBehaviorInventory(document, errors);
  requireArray(document?.structuralAcceptance, "structuralAcceptance");
  document?.structuralAcceptance?.forEach((item, index) => {
    requireString(item?.criterion, `structuralAcceptance[${index}].criterion`);
    requireString(item?.verification, `structuralAcceptance[${index}].verification`);
    if (item?.failureStatus !== "structural-goal-not-met") {
      errors.push(`structuralAcceptance[${index}].failureStatus must equal structural-goal-not-met`);
    }
  });
  const convergence = document?.convergencePolicy;
  if (!convergence || typeof convergence !== "object" || Array.isArray(convergence)) {
    errors.push("convergencePolicy must be an object");
  } else {
    if (convergence.mode !== "iterative") errors.push("convergencePolicy.mode must equal iterative");
    if (!Number.isInteger(convergence.maxIterations) || convergence.maxIterations < 1) {
      errors.push("convergencePolicy.maxIterations must be a positive integer");
    }
    if (convergence.rescanAfterEachStep !== true) {
      errors.push("convergencePolicy.rescanAfterEachStep must equal true");
    }
    if (convergence.completionCondition !== "all-structural-acceptance") {
      errors.push("convergencePolicy.completionCondition must equal all-structural-acceptance");
    }
    if (convergence.onUnmet !== "return-to-planning") {
      errors.push("convergencePolicy.onUnmet must equal return-to-planning");
    }
  }
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
      if (candidate?.case?.id === "007") {
        const measurement = candidate?.measurement;
        if (!Number.isInteger(measurement?.value) || measurement.value < 0) errors.push(`sourceCandidates[${index}].measurement.value must be a non-negative integer`);
        if (measurement?.unit !== "parameters") errors.push(`sourceCandidates[${index}].measurement.unit must equal parameters`);
        if (!["ast", "manual-declaration"].includes(measurement?.method)) errors.push(`sourceCandidates[${index}].measurement.method must be ast or manual-declaration`);
        requireString(measurement?.evidence, `sourceCandidates[${index}].measurement.evidence`);
      }
    });
  }

  const dataClumpCandidates = (document?.sourceCandidates ?? []).filter((candidate) => candidate?.case?.id === "014");
  if (dataClumpCandidates.length) {
    if (!Array.isArray(document?.dataClumpAnalysis) || document.dataClumpAnalysis.length !== dataClumpCandidates.length) {
      errors.push("dataClumpAnalysis must contain one entry for every case 014 candidate");
    }
    document?.dataClumpAnalysis?.forEach((analysis, index) => {
      const path = `dataClumpAnalysis[${index}]`;
      requireString(analysis?.candidateId, `${path}.candidateId`);
      if (!stringArray(analysis?.values, { nonEmpty: true })) errors.push(`${path}.values must be a non-empty string array`);
      if (!new Set(["confirmed", "rejected"]).has(analysis?.disposition)) errors.push(`${path}.disposition must be confirmed or rejected`);
      requireString(analysis?.invariant, `${path}.invariant`);
      requireString(analysis?.rationale, `${path}.rationale`);
      if (!nonEmptyArray(analysis?.occurrences)) errors.push(`${path}.occurrences must contain at least two entries`);
      if (analysis?.disposition === "confirmed" && (analysis?.occurrences?.length ?? 0) < 2) errors.push(`${path}.confirmed data clump requires at least two occurrences`);
      analysis?.occurrences?.forEach((occurrence, occurrenceIndex) => {
        requireString(occurrence?.location, `${path}.occurrences[${occurrenceIndex}].location`);
        requireString(occurrence?.consumer, `${path}.occurrences[${occurrenceIndex}].consumer`);
      });
    });
    const expectedIds = new Set(dataClumpCandidates.map((candidate) => candidate.candidateId));
    const actualIds = new Set((document?.dataClumpAnalysis ?? []).map((analysis) => analysis?.candidateId));
    if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) errors.push("dataClumpAnalysis candidateIds must match case 014 sourceCandidates exactly");
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
  if (decision === "proceed") {
    requireString(document?.composedVerification?.publicEntryPoint, "composedVerification.publicEntryPoint");
    requireString(document?.composedVerification?.providerGraph, "composedVerification.providerGraph");
    requireString(document?.composedVerification?.command, "composedVerification.command");
    if (!stringArray(document?.composedVerification?.assertions, { nonEmpty: true })) errors.push("composedVerification.assertions must be a non-empty string array");
  }
  requireArray(document?.stopConditions, "stopConditions");
  requireArray(document?.authorization?.prohibitedOperations, "authorization.prohibitedOperations");
  for (const operation of ["push", "merge", "deploy"]) {
    if (!document?.authorization?.prohibitedOperations?.includes(operation)) errors.push(`authorization.prohibitedOperations must include ${operation}`);
  }

  if (decision === "proceed") {
    if (!nonEmptyArray(document?.scope?.includedPaths)) errors.push("a proceed plan requires scope.includedPaths");
    if (!nonEmptyArray(document?.structuralBaseline)) errors.push("a proceed plan requires structuralBaseline");
    if (!nonEmptyArray(document?.targetStructure)) errors.push("a proceed plan requires targetStructure");
    if (!document?.dependencyGraph) errors.push("a proceed plan requires dependencyGraph");
    if (!document?.composedVerification) errors.push("a proceed plan requires composedVerification");
    if (!nonEmptyArray(document?.structuralAcceptance)) errors.push("a proceed plan requires structuralAcceptance");
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
    requireString(step?.structuralOutcome, `steps[${index}].structuralOutcome`);
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
