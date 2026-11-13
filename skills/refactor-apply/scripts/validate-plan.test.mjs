import assert from "node:assert/strict";
import test from "node:test";
import { validatePlan } from "./validate-plan.mjs";

function validPlan() {
  return {
    schemaVersion: "refactor-plan/v6",
    planId: "refactor-test-001",
    generatedAt: "2026-11-13T09:00:00.000Z",
    repository: { root: "/repo", revision: "abc123", dirty: false },
    sourceCandidates: [{
      candidateId: "candidate-001",
      case: { id: "001", title: "Long Method", intent: "Identify mixed responsibilities." },
      location: { file: "src/example.ts", line: 1, symbol: "example" },
      evidence: "Function contains two distinct phases.",
      confidence: "medium",
      relatedTechniques: [{ id: "026", title: "Extract Function", intent: "Extract a coherent operation." }],
    }],
    disposition: { decision: "proceed", reasons: ["Evidence supports a bounded change."], missingContext: [] },
    status: "approved",
    approval: {
      type: "human",
      approvedBy: "reviewer",
      approvedAt: "2026-11-13T10:00:00.000Z",
      approvedStepIds: ["step-1"],
    },
    objective: "Improve structure while preserving behavior.",
    structuralBaseline: [{
      file: "src/example.ts",
      symbol: "example",
      responsibilities: [{
        name: "parse input",
        evidence: "The first block validates input.",
        reasonToChange: "Input rules change.",
      }, {
        name: "persist result",
        evidence: "The second block writes records.",
        reasonToChange: "Persistence rules change.",
      }],
      metrics: { lineCount: 80, branchCount: 14, cognitiveComplexity: 18 },
    }],
    targetStructure: [{
      name: "example",
      kind: "coordinator",
      isNew: false,
      responsibility: "Coordinate parsing and persistence phases.",
      reasonToChange: "Workflow ordering changes.",
      owns: ["phase ordering"],
      excludes: ["input rules", "database writes"],
      exclusiveOwnershipKeys: ["phase-ordering"],
      interface: { entryPoints: [{
        name: "example",
        parameters: ["input: Input"],
        returns: "Promise<Result>",
        invariants: ["Input meaning is unchanged."],
        ordering: ["Parse before persistence."],
        errors: ["Existing errors propagate unchanged."],
      }] },
      implementationDepth: {
        movedBehavior: ["Parse and persist the result."],
        ownedDependencies: ["repository"],
        deletionTest: {
          deletionFallback: "Callers would coordinate parsing and persistence directly.",
          complexityDestination: "Phase ordering and error propagation return to every caller.",
          existingReplacementAssessment: "No existing module owns this workflow ordering.",
        },
        passThroughRisk: "It owns validation and transaction ordering.",
      },
      existingModuleAnalysis: {
        alternatives: [{ name: "repository", overlap: "Persistence only.", reuseOption: "Reuse it for writes.", disposition: "reuse", evidence: "It already owns persistence mapping." }],
        searchEvidence: "Inspected the repository and adjacent workflow modules.",
        selectedApproach: "Keep repository and retain workflow coordination here.",
        localityImprovement: "Phase ordering remains at one use-case seam without duplicating persistence knowledge.",
      },
      knowledgeOverlap: {
        existingOwners: [{ module: "repository", knowledge: ["persistence mapping"], disposition: "reuse", evidence: "The target continues to call it." }],
        introducedDuplicates: [],
        singleSourceOwners: [{ knowledge: "persistence mapping", owner: "repository" }, { knowledge: "phase ordering", owner: "example" }],
      },
      changeScenarios: [{ scenario: "Workflow ordering changes.", affectedOwnedBehavior: ["phase ordering"], affectsWholeModule: true }],
      cohesion: { disposition: "cohesive", justification: "The module owns only workflow ordering." },
    }],
    dependencyGraph: {
      baseline: {
        nodes: ["caller", "example", "repository"],
        edges: [
          { from: "caller", to: "example", ownership: "use case" },
          { from: "example", to: "repository", ownership: "persistence" },
        ],
        maxFanOut: 1,
        methodCarriedInfrastructure: [],
        knowledgeOwners: [{ knowledge: "persistence mapping", owners: ["repository"] }],
        interfaceEntryPoints: 1,
      },
      target: {
        nodes: ["caller", "example", "repository"],
        edges: [
          { from: "caller", to: "example", ownership: "use case" },
          { from: "example", to: "repository", ownership: "persistence" },
        ],
        maxFanOut: 1,
        methodCarriedInfrastructure: [],
        knowledgeOwners: [{ knowledge: "persistence mapping", owners: ["repository"] }],
        interfaceEntryPoints: 1,
      },
      introducedKnowledgeDuplicates: [],
      assessment: {
        constructorEdges: "Constructor edges remain stable.",
        methodCarriedInfrastructure: "No infrastructure dependencies are moved through method parameters.",
        knowledgeLocality: "Persistence mapping remains owned only by repository.",
        interfaceSurface: "The public interface surface stays at one entry point.",
      },
    },
    structuralThresholds: {
      case007: { parameterCount: 6, completionTarget: "eliminate", residualCandidates: [] },
    },
    exclusiveOwnership: [{
      key: "phase-ordering",
      owner: "example",
      invariant: "Parsing completes before persistence.",
      evidence: "The example coordinator owns the ordered calls.",
    }],
    baselineBehaviorInventory: [{
      key: "phase-ordering",
      behavior: "Parsing completes before persistence.",
      occurrenceSites: [{ location: "src/example.ts:10", consumer: "example" }],
      targetOwner: "example",
      consumerInterfaces: ["example(input)"],
      phaseSensitive: false,
      preservationTest: {
        id: "phase-ordering-public-seam",
        scenario: "Execute a valid calculation through the public seam.",
        assertion: "Persistence observes the parsed result and never runs first."
      }
    }],
    structuralAcceptance: [{
      criterion: "No helper combines parsing and persistence.",
      verification: "Re-scan all touched and new symbols.",
      failureStatus: "structural-goal-not-met",
    }],
    convergencePolicy: {
      mode: "iterative",
      maxIterations: 5,
      rescanAfterEachStep: true,
      completionCondition: "all-structural-acceptance",
      onUnmet: "return-to-planning",
    },
    scope: { includedPaths: ["src"], excludedPaths: ["src/generated"] },
    preservationEnvelope: [{ category: "public-api", invariant: "Contract is unchanged.", evidence: "Contract tests." }],
    changeBoundaries: {
      publicApi: "preserve",
      databaseSchema: "preserve",
      configuration: "preserve",
      dependencies: "preserve",
      runtimeBehavior: "preserve",
    },
    baselineChecks: [{ command: "test command", result: "passed", notes: "Clean baseline." }],
    steps: [{
      id: "step-1",
      title: "Extract helper",
      files: ["src/example.ts"],
      transformation: "Extract one pure helper.",
      structuralOutcome: "Parsing has one cohesive owner and persistence remains outside it.",
      preconditions: ["Focused baseline matches."],
      reversible: true,
      dependsOn: [],
      verification: [{ command: "focused test", expected: "Passes unchanged." }],
      rollback: "Revert the helper extraction.",
    }],
    finalVerification: [{ command: "full test", expected: "No new failures." }],
    composedVerification: {
      publicEntryPoint: "example(input)",
      providerGraph: "Instantiate the production graph with its repository adapter.",
      command: "npm test -- example.integration.test.ts",
      assertions: ["Public results and effect order remain unchanged."],
      behaviorTestIds: ["phase-ordering-public-seam"],
    },
    risks: ["Incorrect extraction could reorder effects."],
    stopConditions: ["A contract change is required."],
    authorization: { prohibitedOperations: ["push", "merge", "deploy"] },
  };
}

test("accepts a self-contained approved plan", () => {
  assert.deepEqual(validatePlan(validPlan()), []);
});

test("rejects a plan that lacks human approval", () => {
  const plan = validPlan();
  plan.status = "awaiting-approval";
  plan.approval = {};
  assert.ok(validatePlan(plan).some((error) => error.includes("status must be 'approved'")));
  assert.ok(validatePlan(plan).some((error) => error.includes("approval.type")));
});

test("rejects scope escape and boundary changes", () => {
  const plan = validPlan();
  plan.steps[0].files = ["../outside.ts"];
  plan.changeBoundaries.publicApi = "change";
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("safe repository-relative paths")));
  assert.ok(errors.some((error) => error.includes("publicApi")));
});

test("rejects unknown approval IDs and dependency cycles", () => {
  const plan = validPlan();
  plan.approval.approvedStepIds = ["missing"];
  plan.steps.push({
    id: "step-2",
    title: "Second step",
    files: ["src/second.ts"],
    transformation: "Move helper.",
    structuralOutcome: "The helper owns one cohesive responsibility.",
    preconditions: ["Step 1 is verified."],
    reversible: true,
    dependsOn: ["step-3"],
    verification: [{ command: "focused test", expected: "Passes." }],
    rollback: "Revert step 2.",
  }, {
    id: "step-3",
    title: "Third step",
    files: ["src/third.ts"],
    transformation: "Rename helper.",
    structuralOutcome: "The renamed helper retains one cohesive responsibility.",
    preconditions: ["Step 2 is verified."],
    reversible: true,
    dependsOn: ["step-2"],
    verification: [{ command: "focused test", expected: "Passes." }],
    rollback: "Revert step 3.",
  });
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("unknown step 'missing'")));
  assert.ok(errors.some((error) => error.includes("dependency cycle")));
});

test("rejects plans that cannot detect complexity transfer", () => {
  const plan = validPlan();
  plan.structuralAcceptance = [];
  plan.steps[0].structuralOutcome = "";
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("structuralAcceptance")));
  assert.ok(errors.some((error) => error.includes("structuralOutcome")));
});

test("rejects single-pass or unbounded apply policies", () => {
  const plan = validPlan();
  plan.convergencePolicy.mode = "single-pass";
  plan.convergencePolicy.maxIterations = 0;
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("mode must be 'iterative'")));
  assert.ok(errors.some((error) => error.includes("maxIterations must be a positive integer")));
});

test("rejects approved plans that increase fan-out or omit composed verification", () => {
  const plan = validPlan();
  plan.dependencyGraph.target.edges.push({ from: "example", to: "logger", ownership: "logging" });
  plan.dependencyGraph.target.maxFanOut = 2;
  delete plan.composedVerification;
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("maxFanOut must not exceed")));
  assert.ok(errors.some((error) => error.includes("composedVerification.publicEntryPoint")));
});

test("rejects approved plans with shallow target contracts", () => {
  const plan = validPlan();
  delete plan.targetStructure[0].interface;
  delete plan.targetStructure[0].implementationDepth;
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("interface.entryPoints")));
  assert.ok(errors.some((error) => error.includes("implementationDepth.deletionTest")));
});

test("rejects duplicated knowledge and unstructured deletion claims", () => {
  const plan = validPlan();
  plan.targetStructure[0].knowledgeOverlap.introducedDuplicates = ["repository query mapping"];
  plan.targetStructure[0].implementationDepth.deletionTest = "Deleting it makes callers more complex.";
  plan.dependencyGraph.introducedKnowledgeDuplicates = ["repository query mapping"];
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("introducedDuplicates must be empty")));
  assert.ok(errors.some((error) => error.includes("deletionTest.deletionFallback")));
  assert.ok(errors.some((error) => error.includes("introducedKnowledgeDuplicates must be empty")));
});

test("requires reuse analysis and repository conformance", () => {
  const plan = validPlan();
  plan.targetStructure[0].kind = "adapter";
  plan.targetStructure[0].isNew = true;
  delete plan.targetStructure[0].existingModuleAnalysis;
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("existingModuleAnalysis.alternatives")));
  assert.ok(errors.some((error) => error.includes("repositoryConformance.registrationModule")));
  assert.ok(errors.some((error) => error.includes("repositoryConformance.duplicationStrategy")));
});

test("accepts a conformant new repository with one knowledge owner", () => {
  const plan = validPlan();
  const target = plan.targetStructure[0];
  target.kind = "repository";
  target.isNew = true;
  target.repositoryConformance = {
    instructionSource: "server/AGENTS.md",
    registrationModule: "MysqlModule",
    exportModule: "MysqlModule",
    transactionManagerPolicy: "Every operation uses the supplied EntityManager.",
    filtersAndLocksSource: "Move the existing query implementation so this becomes its single owner.",
    duplicationStrategy: "move-single-source",
  };
  assert.deepEqual(validatePlan(plan), []);
});

test("rejects cohesive labels for modules with partial change scenarios", () => {
  const plan = validPlan();
  plan.targetStructure[0].changeScenarios.push({
    scenario: "Persistence schema changes.",
    affectedOwnedBehavior: ["database writes"],
    affectsWholeModule: false,
  });
  plan.targetStructure[0].cohesion = { disposition: "cohesive", justification: "One class." };
  const errors = validatePlan(plan);
  assert.ok(errors.some((error) => error.includes("coordinator-with-collaborators when a change scenario affects only part")));
});

test("rejects target dependencies that do not match graph edges", () => {
  const plan = validPlan();
  plan.targetStructure[0].implementationDepth.ownedDependencies.push("logger");
  assert.ok(validatePlan(plan).some((error) => error.includes("must exactly match dependencyGraph.target outgoing edges")));
});

test("rejects an approved case 007 elimination plan with a threshold hotspot", () => {
  const plan = validPlan();
  const dependencies = ["repository", "logger", "clock", "metrics", "queue", "storage"];
  plan.dependencyGraph.target.nodes.push(...dependencies.slice(1));
  plan.dependencyGraph.target.edges = dependencies.map((to) => ({ from: "example", to, ownership: to }));
  plan.dependencyGraph.target.maxFanOut = 6;
  plan.targetStructure[0].implementationDepth.ownedDependencies = dependencies;
  assert.ok(validatePlan(plan).some((error) => error.includes("contradicts the case 007 eliminate target")));
});

test("rejects missing exclusive ownership assignments", () => {
  const plan = validPlan();
  plan.targetStructure[0].exclusiveOwnershipKeys = [];
  assert.ok(validatePlan(plan).some((error) => error.includes("exclusive ownership phase-ordering must be assigned exactly once")));
});

test("rejects an inventoried helper without its exclusive owner", () => {
  const plan = validPlan();
  plan.baselineBehaviorInventory[0].key = "shared-input-validator";
  assert.ok(validatePlan(plan).some((error) => error.includes("must map to exclusiveOwnership")));
});

test("requires a phase-mutation test for phase-sensitive behavior", () => {
  const plan = validPlan();
  plan.baselineBehaviorInventory[0].phaseSensitive = true;
  assert.ok(validatePlan(plan).some((error) => error.includes("changedBetweenPhases must describe the phase mutation")));
});

test("accepts one algorithm owner shared by two phase consumers", () => {
  const plan = validPlan();
  const behavior = plan.baselineBehaviorInventory[0];
  behavior.phaseSensitive = true;
  behavior.occurrenceSites.push({ location: "src/example.ts:40", consumer: "validateLockedInput" });
  behavior.consumerInterfaces.push("validateLockedInput(input)");
  behavior.preservationTest.changedBetweenPhases = "The locked input differs from the optimistic input.";
  assert.deepEqual(validatePlan(plan), []);
});

test("requires composed verification to reference every inventoried behavior test", () => {
  const plan = validPlan();
  plan.composedVerification.behaviorTestIds = ["unknown-test"];
  assert.ok(validatePlan(plan).some((error) => error.includes("must exactly match baseline behavior preservation tests")));
});
