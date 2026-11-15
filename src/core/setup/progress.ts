export const SETUP_STEPS = [
  "environment-validated",
  "database-availability-verified",
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

function isSetupProgress(value: unknown): value is SetupProgress {
  if (typeof value !== "object" || value === null) return false;

  const completedSteps = (value as { readonly completedSteps?: unknown })
    .completedSteps;
  return (
    Number.isSafeInteger(completedSteps) &&
    (completedSteps as number) >= 0 &&
    (completedSteps as number) <= SETUP_STEPS.length
  );
}

export function completeSetupStep(
  progressValue: unknown,
  step: SetupStep,
): SetupProgress | null {
  if (!isSetupProgress(progressValue)) return null;

  const stepIndex = SETUP_STEPS.indexOf(step);
  if (stepIndex < 0) return null;
  if (stepIndex < progressValue.completedSteps) return progressValue;
  if (stepIndex !== progressValue.completedSteps) return null;

  return { completedSteps: progressValue.completedSteps + 1 };
}

export function isSetupComplete(progressValue: unknown): boolean {
  return (
    isSetupProgress(progressValue) &&
    progressValue.completedSteps === SETUP_STEPS.length
  );
}
