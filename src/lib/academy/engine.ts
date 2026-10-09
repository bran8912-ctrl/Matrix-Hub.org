export interface ChallengeResult {
  passed: boolean;
  score: number;
  feedback: string[];
}

export function checkToolSelection(
  selected: string[],
  expected: string[],
  coaching: Record<string, string>,
): ChallengeResult {
  const selectedSet = new Set(selected);
  const expectedSet = new Set(expected);
  const wrong = [...selectedSet].filter((tool) => !expectedSet.has(tool));
  const missing = [...expectedSet].filter((tool) => !selectedSet.has(tool));
  const feedback = [
    ...wrong.map((tool) => coaching[tool] ?? `That tool is not needed for this task; select tools that perform the stated checks.`),
    ...missing.map((tool) => coaching[tool] ?? `Add the required tool: ${tool}.`),
  ];
  return { passed: feedback.length === 0, score: Math.max(0, expectedSet.size - missing.length - wrong.length), feedback };
}

export function checkJointDefects(
  selected: string[],
  expected: { id: string; feedback: string }[],
): ChallengeResult {
  const selectedSet = new Set(selected);
  const expectedSet = new Set(expected.map(({ id }) => id));
  const missed = expected.filter(({ id }) => !selectedSet.has(id));
  const falseFlags = [...selectedSet].filter((id) => !expectedSet.has(id));
  const feedback = [
    ...missed.map(({ feedback }) => feedback),
    ...falseFlags.map(() => 'That feature is not shown as a defect in this joint. Re-check the section view before flagging it.'),
  ];
  return {
    passed: feedback.length === 0,
    score: Math.max(0, expectedSet.size - missed.length - falseFlags.length),
    feedback,
  };
}

export function checkPosition(
  actualMm: number,
  expectedMm: number,
  toleranceMm: number,
  reference: string,
): ChallengeResult {
  if (![actualMm, expectedMm, toleranceMm].every(Number.isFinite) || toleranceMm < 0) {
    return { passed: false, score: 0, feedback: ['Enter finite measurements and a non-negative tolerance.'] };
  }
  const error = Math.abs(actualMm - expectedMm);
  const passed = error <= toleranceMm;
  const feedback = passed
    ? [`${actualMm} mm is within ±${toleranceMm} mm from ${reference}.`]
    : [`${actualMm} mm is ${error} mm from the ${expectedMm} mm target. Measure from ${reference}; using a different edge can shift the stiffener by 25 mm.`];
  return { passed, score: passed ? 1 : 0, feedback };
}

export function checkAlignment(
  measurements: { id: string; label: string; target: number; tolerance: number }[],
  actual: Record<string, number>,
): ChallengeResult {
  const feedback: string[] = [];
  let passedCount = 0;
  for (const measurement of measurements) {
    const value = actual[measurement.id];
    if (!Number.isFinite(value)) {
      feedback.push(`${measurement.label}: enter a valid measurement before checking.`);
      continue;
    }
    const deviation = Math.abs(value - measurement.target);
    if (deviation <= measurement.tolerance) {
      passedCount++;
    } else {
      feedback.push(`${measurement.label}: ${value} is ${deviation} from ${measurement.target}, outside the ±${measurement.tolerance} tolerance. Reposition and check again.`);
    }
  }
  return {
    passed: passedCount === measurements.length,
    score: passedCount,
    feedback: feedback.length ? feedback : ['All alignment measurements are within the supplied tolerances.'],
  };
}

export interface WorkflowReview {
  accepted: boolean;
  complete: boolean;
  score: number;
  nextStep: number;
  feedback: string;
}

export function recordWorkflowAction(
  requestedStep: string,
  currentStep: number,
  steps: { id: string; label: string; coaching: string }[],
): WorkflowReview {
  const current = steps[currentStep];
  if (!current) {
    return { accepted: false, complete: true, score: steps.length, nextStep: currentStep, feedback: 'Workflow complete. Review each check and its recorded result.' };
  }
  if (requestedStep !== current.id) {
    return {
      accepted: false,
      complete: false,
      score: currentStep,
      nextStep: currentStep,
      feedback: `Do not skip ahead. ${current.coaching}`,
    };
  }
  const nextStep = currentStep + 1;
  return {
    accepted: true,
    complete: nextStep === steps.length,
    score: nextStep,
    nextStep,
    feedback: nextStep === steps.length ? 'Sequence complete: review the steps and verify all recorded measurements.' : `${current.label} recorded. Continue with ${steps[nextStep].label.toLowerCase()}.`,
  };
}
