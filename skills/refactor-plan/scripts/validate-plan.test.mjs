import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const validator = path.resolve(import.meta.dirname, "validate-plan.mjs");

function validPlan() {
  return {
    schemaVersion: "refactor-plan/v6",
    planId: "rp-test",
    generatedAt: "2026-11-13T08:00:00.000Z",
    repository: { root: "/repo", revision: "abc", dirty: false },
    sourceCandidates: [{
      candidateId: "c1",
      case: { id: "001", title: "Long Method", intent: "Find mixed responsibilities." },
      location: { file: "src/example.ts", line: 10 },
      evidence: "Function spans 90 lines.",
      confidence: "medium",
      relatedTechniques: [],
    }],
    disposition: { decision: "proceed", reasons: ["Confirmed mixed responsibilities."], missingContext: [] },
    status: "awaiting-approval",
    approval: { type: "human", approvedBy: null, approvedAt: null, approvedStepIds: [] },
    objective: "Separate parsing from persistence without changing behavior.",
    structuralBaseline: [{
      file: "src/example.ts",
      symbol: "calculate",
      responsibilities: [{
        name: "parse input",
        evidence: "The first block validates input.",
        reasonToChange: "Input rules change.",
      }, {
        name: "persist result",
        evidence: "The second block writes records.",
        reasonToChange: "Persistence rules change.",
      }],
      metrics: { lineCount: 90, branchCount: 14, cognitiveComplexity: 20 },
    }],
    targetStructure: [{
      name: "calculate",
      kind: "coordinator",
      isNew: false,
      responsibility: "Coordinate parsing and persistence phases.",
      reasonToChange: "Workflow ordering changes.",
      owns: ["phase ordering"],
      excludes: ["input rules", "database writes"],
      exclusiveOwnershipKeys: ["phase-ordering"],
      interface: { entryPoints: [{
        name: "calculate",
        parameters: ["input: Input"],
        returns: "Promise<Result>",
        invariants: ["Input meaning is unchanged."],
        ordering: ["Parse before persistence."],
        errors: ["Existing validation errors propagate unchanged."],
      }] },
      implementationDepth: {
        movedBehavior: ["Parse and persist a complete result."],
        ownedDependencies: ["repository"],
        deletionTest: {
          deletionFallback: "Callers would coordinate parsing and persistence directly.",
          complexityDestination: "Phase ordering and error propagation return to every caller.",
          existingReplacementAssessment: "No existing module owns this workflow ordering.",
        },
        passThroughRisk: "The entry point owns validation and transaction ordering rather than forwarding.",
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
        singleSourceOwners: [{ knowledge: "persistence mapping", owner: "repository" }, { knowledge: "phase ordering", owner: "calculate" }],
      },
      changeScenarios: [{ scenario: "Workflow ordering changes.", affectedOwnedBehavior: ["phase ordering"], affectsWholeModule: true }],
      cohesion: { disposition: "cohesive", justification: "The module owns only workflow ordering." },
    }],
    dependencyGraph: {
      baseline: {
        nodes: ["caller", "calculate", "repository"],
        edges: [
          { from: "caller", to: "calculate", ownership: "use case" },
          { from: "calculate", to: "repository", ownership: "persistence" },
        ],
        maxFanOut: 1,
        methodCarriedInfrastructure: [],
        knowledgeOwners: [{ knowledge: "persistence mapping", owners: ["repository"] }],
        interfaceEntryPoints: 1,
      },
      target: {
        nodes: ["caller", "calculate", "repository"],
        edges: [
          { from: "caller", to: "calculate", ownership: "use case" },
          { from: "calculate", to: "repository", ownership: "persistence" },
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
      owner: "calculate",
      invariant: "Parsing completes before persistence.",
      evidence: "The calculate coordinator owns the ordered calls.",
    }],
    baselineBehaviorInventory: [{
      key: "phase-ordering",
      behavior: "Parsing completes before persistence.",
      occurrenceSites: [{ location: "src/example.ts:10", consumer: "calculate" }],
      targetOwner: "calculate",
      consumerInterfaces: ["calculate(input)"],
      phaseSensitive: false,
      preservationTest: {
        id: "phase-ordering-public-seam",
        scenario: "Execute a valid calculation through the public seam.",
        assertion: "Persistence observes the parsed result and never runs first."
      }
    }],
    structuralAcceptance: [{
      criterion: "No extracted helper combines parsing and persistence.",
      verification: "Re-scan every touched or new symbol and inspect its responsibility map.",
      failureStatus: "structural-goal-not-met",
    }],
    convergencePolicy: {
      mode: "iterative",
      maxIterations: 5,
      rescanAfterEachStep: true,
      completionCondition: "all-structural-acceptance",
      onUnmet: "return-to-planning",
    },
    scope: { includedPaths: ["src/example.ts"], excludedPaths: ["migrations"] },
    preservationEnvelope: [{ category: "api", invariant: "Keep the API stable.", evidence: "Caller contract." }],
    changeBoundaries: {
      publicApi: "preserve",
      databaseSchema: "preserve",
      configuration: "preserve",
      dependencies: "preserve",
      runtimeBehavior: "preserve",
    },
    baselineChecks: ["Run test."],
    steps: [{
      id: "S1",
      title: "Extract parsing phase",
      files: ["src/example.ts"],
      transformation: "Extract parsing into a private pure helper.",
      structuralOutcome: "Parsing has one cohesive owner and persistence remains outside it.",
      preconditions: ["Baseline passes."],
      reversible: true,
      verification: ["Run focused test."],
      rollback: "Revert S1.",
    }],
    finalVerification: ["Run suite."],
    composedVerification: {
      publicEntryPoint: "calculate(input)",
      providerGraph: "Instantiate the production calculate module with its repository adapter.",
      command: "npm test -- calculate.integration.test.ts",
      assertions: ["The public result and collaborator ordering remain unchanged."],
      behaviorTestIds: ["phase-ordering-public-seam"],
    },
    risks: [{ risk: "Ordering drift.", mitigation: "Characterize order.", residual: "None known." }],
    stopConditions: ["A public contract change is required."],
    authorization: { prohibitedOperations: ["push", "merge", "deploy"] },
  };
}

async function runValidator(document) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "refactor-plan-"));
  const file = path.join(directory, "plan.json");
  await fs.writeFile(file, JSON.stringify(document));
  try {
    return await execFileAsync(process.execPath, [validator, file]);
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

test("accepts a complete awaiting-approval plan", async () => {
  const result = await runValidator(validPlan());
  assert.match(result.stdout, /Plan is valid/);
});

test("rejects approval without approver identity", async () => {
  const document = validPlan();
  document.status = "approved";
  document.approval.approvedStepIds = ["S1"];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /approval\.approvedBy/);
    assert.match(error.stderr, /approval\.approvedAt/);
    return true;
  });
});

test("accepts a human-approved subset of known steps", async () => {
  const document = validPlan();
  document.status = "approved";
  document.approval = {
    type: "human",
    approvedBy: "test-reviewer",
    approvedAt: "2026-11-13T09:00:00.000Z",
    approvedStepIds: ["S1"],
  };
  const result = await runValidator(document);
  assert.match(result.stdout, /Plan is valid/);
});

test("rejects implementation steps for a rejected candidate", async () => {
  const document = validPlan();
  document.disposition.decision = "reject";
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /reject plans must not contain implementation steps/);
    return true;
  });
});

test("rejects a proceed plan without structural acceptance", async () => {
  const document = validPlan();
  document.structuralAcceptance = [];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /requires structuralAcceptance/);
    return true;
  });
});

test("rejects an unbounded or non-iterative convergence policy", async () => {
  const document = validPlan();
  document.convergencePolicy.mode = "single-pass";
  document.convergencePolicy.maxIterations = 0;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /mode must equal iterative/);
    assert.match(error.stderr, /maxIterations must be a positive integer/);
    return true;
  });
});

test("rejects shallow targets without concrete interfaces or deletion evidence", async () => {
  const document = validPlan();
  delete document.targetStructure[0].interface;
  delete document.targetStructure[0].implementationDepth;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /interface\.entryPoints/);
    assert.match(error.stderr, /implementationDepth\.deletionTest/);
    return true;
  });
});

test("rejects dependency redistribution that increases peak fan-out", async () => {
  const document = validPlan();
  document.dependencyGraph.target.edges.push({ from: "calculate", to: "logger", ownership: "logging" });
  document.dependencyGraph.target.maxFanOut = 99;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /maxFanOut must equal/);
    assert.match(error.stderr, /maxFanOut must not exceed/);
    return true;
  });
});

test("requires authoritative parameter and data-clump evidence", async () => {
  const document = validPlan();
  document.sourceCandidates = [{
    ...document.sourceCandidates[0],
    case: { id: "007", title: "Long Parameter List", intent: "Count declared parameters." },
  }, {
    ...document.sourceCandidates[0],
    candidateId: "c2",
    case: { id: "014", title: "Data Clumps", intent: "Find values recurring together." },
  }];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /measurement\.method/);
    assert.match(error.stderr, /dataClumpAnalysis/);
    return true;
  });
});

test("rejects plans without composed public-seam verification", async () => {
  const document = validPlan();
  delete document.composedVerification;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /composedVerification\.publicEntryPoint/);
    return true;
  });
});

test("rejects metric gaming through duplicated knowledge and false deletion evidence", async () => {
  const document = validPlan();
  document.targetStructure[0].knowledgeOverlap.introducedDuplicates = ["repository query mapping"];
  document.targetStructure[0].implementationDepth.deletionTest = "Deleting it makes callers more complex.";
  document.dependencyGraph.introducedKnowledgeDuplicates = ["repository query mapping"];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /introducedDuplicates must be empty/);
    assert.match(error.stderr, /deletionTest\.deletionFallback/);
    assert.match(error.stderr, /introducedKnowledgeDuplicates must be empty/);
    return true;
  });
});

test("requires reuse analysis and repository conformance for a new adapter", async () => {
  const document = validPlan();
  const target = document.targetStructure[0];
  target.kind = "repository";
  target.isNew = true;
  delete target.existingModuleAnalysis;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /existingModuleAnalysis\.alternatives/);
    assert.match(error.stderr, /repositoryConformance\.registrationModule/);
    assert.match(error.stderr, /repositoryConformance\.duplicationStrategy/);
    return true;
  });
});

test("accepts a conformant new repository with one knowledge owner", async () => {
  const document = validPlan();
  const target = document.targetStructure[0];
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
  const result = await runValidator(document);
  assert.match(result.stdout, /Plan is valid/);
});

test("requires a coordinator structure when change scenarios are independent", async () => {
  const document = validPlan();
  document.targetStructure[0].changeScenarios.push({
    scenario: "Persistence schema changes.",
    affectedOwnedBehavior: ["database writes"],
    affectsWholeModule: false,
  });
  document.targetStructure[0].cohesion = { disposition: "cohesive", justification: "One class." };
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /coordinator-with-collaborators when a change scenario affects only part/);
    return true;
  });
});

test("rejects target dependencies that do not match graph edges", async () => {
  const document = validPlan();
  document.targetStructure[0].implementationDepth.ownedDependencies.push("logger");
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /must exactly match dependencyGraph\.target outgoing edges/);
    return true;
  });
});

test("rejects a case 007 elimination target with a threshold hotspot", async () => {
  const document = validPlan();
  const dependencies = ["repository", "logger", "clock", "metrics", "queue", "storage"];
  document.dependencyGraph.target.nodes.push(...dependencies.slice(1));
  document.dependencyGraph.target.edges = dependencies.map((to) => ({ from: "calculate", to, ownership: to }));
  document.dependencyGraph.target.maxFanOut = 6;
  document.targetStructure[0].implementationDepth.ownedDependencies = dependencies;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /contradicts the case 007 eliminate target/);
    return true;
  });
});

test("rejects duplicate or missing exclusive ownership assignments", async () => {
  const document = validPlan();
  document.targetStructure[0].exclusiveOwnershipKeys = [];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /exclusive ownership phase-ordering must be assigned exactly once/);
    return true;
  });
});

test("rejects an inventoried baseline algorithm without its exclusive owner", async () => {
  const document = validPlan();
  document.baselineBehaviorInventory[0].key = "shared-input-validator";
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /must map to exclusiveOwnership/);
    return true;
  });
});

test("requires changed-between-phases coverage for a phase-sensitive algorithm", async () => {
  const document = validPlan();
  document.baselineBehaviorInventory[0].phaseSensitive = true;
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /changedBetweenPhases must describe the phase mutation/);
    return true;
  });
});

test("accepts one pure algorithm owner shared by two phase consumers", async () => {
  const document = validPlan();
  const behavior = document.baselineBehaviorInventory[0];
  behavior.phaseSensitive = true;
  behavior.occurrenceSites.push({ location: "src/example.ts:40", consumer: "validateLockedInput" });
  behavior.consumerInterfaces.push("validateLockedInput(input)");
  behavior.preservationTest.changedBetweenPhases = "The locked input differs from the optimistic input.";
  const result = await runValidator(document);
  assert.match(result.stdout, /Plan is valid/);
});

test("requires composed verification to reference every baseline behavior test", async () => {
  const document = validPlan();
  document.composedVerification.behaviorTestIds = ["unknown-test"];
  await assert.rejects(runValidator(document), (error) => {
    assert.match(error.stderr, /must exactly match baseline behavior preservation tests/);
    return true;
  });
});
