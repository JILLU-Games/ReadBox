export const SETUP_STEPS = [
  "environment-validated",
  "database-requested",
  "database-created",
  "database-verified",
  "schema-verified",
  "administrator-created",
  "completion-verified",
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

export interface SetupProgress {
  readonly completedSteps: number;
}

export const INITIAL_SETUP_PROGRESS: SetupProgress = Object.freeze({
  completedSteps: 0,
});

export function completeSetupStep(
  progress: SetupProgress,
  step: SetupStep,
): SetupProgress | null {
  if (
    !Number.isSafeInteger(progress.completedSteps) ||
    progress.completedSteps < 0 ||
    progress.completedSteps > SETUP_STEPS.length
  ) {
    return null;
  }

  const stepIndex = SETUP_STEPS.indexOf(step);
  if (stepIndex < 0) return null;
  if (stepIndex < progress.completedSteps) return progress;
  if (stepIndex !== progress.completedSteps) return null;

  return { completedSteps: progress.completedSteps + 1 };
}

export function isSetupComplete(progress: SetupProgress): boolean {
  return (
    Number.isSafeInteger(progress.completedSteps) &&
    progress.completedSteps === SETUP_STEPS.length
  );
}
