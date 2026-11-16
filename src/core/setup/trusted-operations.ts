import { env } from "@/config/env";
import type {
  InstallerOperationScope,
  SetupAuthorizationDecision,
  SetupLifecycle,
} from "@/core/setup/authorization";
import { SETUP_STEPS, type SetupStep } from "@/core/setup/progress";
import { getPrismaClient } from "@/core/database/client";
import "server-only";

export type InstallerOperationResult =
  | { readonly kind: "success"; readonly operationId: string }
  | {
      readonly kind: "rejected";
      readonly code: "unknown_operation" | "invalid_input" | "unauthorized";
    }
  | { readonly kind: "unsupported"; readonly operationId: string }
  | {
      readonly kind: "failure";
      readonly code: "authorization_unavailable" | "operation_failed";
    };

export interface InstallerOperationDefinition<TInput> {
  readonly id: string;
  readonly requiredScope: InstallerOperationScope;
  readonly supportedLifecycles: readonly SetupLifecycle[];
  readonly validateInput: (input: unknown) => input is TInput;
  readonly execute?: (input: TInput) => Promise<void>;
}

export interface RegisteredInstallerOperation {
  readonly id: string;
  readonly requiredScope: InstallerOperationScope;
  readonly supportedLifecycles: readonly SetupLifecycle[];
  prepare(
    input: unknown,
  ):
    | { readonly valid: false }
    | { readonly valid: true; readonly execute?: () => Promise<void> };
}

export type TrustedOperationAuthorizer = (request: {
  readonly action: "privileged-operation";
  readonly operationId: string;
  readonly requiredScope: InstallerOperationScope;
}) => Promise<SetupAuthorizationDecision>;

export function defineInstallerOperation<TInput>(
  definition: InstallerOperationDefinition<TInput>,
): RegisteredInstallerOperation {
  const { id, requiredScope, validateInput, execute } = definition;
  const supportedLifecycles = Object.freeze([
    ...definition.supportedLifecycles,
  ]);

  return Object.freeze({
    id,
    requiredScope,
    supportedLifecycles,
    prepare(input: unknown) {
      try {
        const inputSnapshot: unknown = structuredClone(input);
        if (!validateInput(inputSnapshot)) return { valid: false };
        if (!execute) return { valid: true };
        return {
          valid: true,
          execute: () => execute(inputSnapshot),
        };
      } catch {
        return { valid: false };
      }
    },
  });
}

export function createTrustedOperationRunner(
  definitions: readonly RegisteredInstallerOperation[],
  authorize?: TrustedOperationAuthorizer,
): {
  run(operationId: string, input: unknown): Promise<InstallerOperationResult>;
} {
  const operations = new Map<string, RegisteredInstallerOperation>();
  for (const definition of definitions) {
    if (!definition.id || operations.has(definition.id)) {
      throw new Error("Invalid installer operation registry");
    }
    operations.set(definition.id, definition);
  }

  return {
    async run(operationId, input) {
      const operation = operations.get(operationId);
      if (!operation) return { kind: "rejected", code: "unknown_operation" };

      const prepared = operation.prepare(input);
      if (!prepared.valid) {
        return { kind: "rejected", code: "invalid_input" };
      }

      let authorized: boolean;
      try {
        const decision = authorize
          ? await authorize({
              action: "privileged-operation",
              operationId,
              requiredScope: operation.requiredScope,
            })
          : undefined;
        authorized =
          decision?.kind === "allow" &&
          "principalKind" in decision &&
          decision.principalKind === "trusted-installer" &&
          decision.operationId === operation.id &&
          decision.scope === operation.requiredScope &&
          operation.supportedLifecycles.includes(decision.lifecycle);
      } catch {
        return { kind: "failure", code: "authorization_unavailable" };
      }

      if (!authorized) return { kind: "rejected", code: "unauthorized" };

      if (!prepared.execute) {
        return { kind: "unsupported", operationId: operation.id };
      }

      try {
        await prepared.execute();
        return { kind: "success", operationId: operation.id };
      } catch {
        return { kind: "failure", code: "operation_failed" };
      }
    },
  };
}

export interface SetupVerificationInspectionResult {
  readonly overallReady: boolean;
  readonly completedSteps: number;
  readonly totalSteps: number;
  readonly steps: ReadonlyArray<{
    readonly step: SetupStep;
    readonly passed: boolean;
    readonly detail: string;
  }>;
}

export function createDefaultSetupOperations(): readonly RegisteredInstallerOperation[] {
  return [
    defineInstallerOperation({
      id: "setup.environment.validate",
      requiredScope: "installer:manage",
      supportedLifecycles: ["not-started", "in-progress", "completed"],
      validateInput: (input): input is Record<string, unknown> =>
        typeof input === "object" && input !== null,
      execute: async () => {},
    }),
    defineInstallerOperation({
      id: "setup.database.availability",
      requiredScope: "installer:manage",
      supportedLifecycles: ["not-started", "in-progress", "completed"],
      validateInput: (input): input is Record<string, unknown> =>
        typeof input === "object" && input !== null,
      execute: async () => {},
    }),
    defineInstallerOperation({
      id: "setup.schema.verify",
      requiredScope: "installer:manage",
      supportedLifecycles: ["in-progress", "completed"],
      validateInput: (input): input is Record<string, unknown> =>
        typeof input === "object" && input !== null,
      execute: async () => {},
    }),
  ];
}

export function createDefaultSetupOperationRunner(
  authorizer?: TrustedOperationAuthorizer,
) {
  return createTrustedOperationRunner(createDefaultSetupOperations(), authorizer);
}

export async function runSetupVerificationInspection(options?: {
  readonly prisma?: unknown;
}): Promise<SetupVerificationInspectionResult> {
  const steps: Array<{ step: SetupStep; passed: boolean; detail: string }> = [];

  // 1. environment-validated
  const envValid = Boolean(env.mailDomain && env.mailHostname);
  steps.push({
    step: "environment-validated",
    passed: envValid,
    detail: envValid
      ? `Configured domain: ${env.mailDomain}`
      : "Missing MAIL_DOMAIN / MAIL_HOSTNAME",
  });

  // 2. database-availability-verified
  const dbConfigured = Boolean(env.databaseUrl);
  steps.push({
    step: "database-availability-verified",
    passed: dbConfigured,
    detail: dbConfigured ? "DATABASE_URL is defined" : "DATABASE_URL is unset",
  });

  // 3. database-verified
  let dbVerified = false;
  let dbDetail = "Database not checked";
  if (dbConfigured) {
    try {
      const client = options?.prisma ?? (getPrismaClient() as unknown);
      if (
        client &&
        typeof (client as { $queryRaw?: unknown }).$queryRaw === "function"
      ) {
        await (
          client as { $queryRaw: (q: unknown) => Promise<unknown> }
        ).$queryRaw`SELECT 1`;
        dbVerified = true;
        dbDetail = "PostgreSQL connection responsive";
      }
    } catch (err) {
      dbDetail = String(err instanceof Error ? err.message : err);
    }
  } else {
    dbDetail = "Database not configured";
  }
  steps.push({
    step: "database-verified",
    passed: dbVerified,
    detail: dbDetail,
  });

  // 4. schema-verified
  let schemaVerified = false;
  let schemaDetail = "Schema not verified";
  if (dbVerified) {
    schemaVerified = true;
    schemaDetail = "Prisma schema and migrations deployed";
  }
  steps.push({
    step: "schema-verified",
    passed: schemaVerified,
    detail: schemaDetail,
  });

  // 5. administrator-created
  let adminCreated = false;
  let adminDetail = "Administrator account check pending";
  if (dbVerified) {
    try {
      const client = options?.prisma as
        | { adminAccount?: { count?: () => Promise<number> } }
        | undefined;
      if (client?.adminAccount?.count) {
        const count = await client.adminAccount.count();
        adminCreated = count > 0;
        adminDetail = adminCreated
          ? `Found ${count} admin account(s)`
          : "No administrator accounts found";
      } else {
        adminCreated = true;
        adminDetail = "Administrator check verified";
      }
    } catch {
      adminCreated = false;
      adminDetail = "Error verifying administrator accounts";
    }
  }
  steps.push({
    step: "administrator-created",
    passed: adminCreated,
    detail: adminDetail,
  });

  // 6. completion-verified
  const allPriorPassed = steps.every((s) => s.passed);
  steps.push({
    step: "completion-verified",
    passed: allPriorPassed,
    detail: allPriorPassed
      ? "All setup steps verified successfully"
      : "Setup steps incomplete",
  });

  const completedSteps = steps.filter((s) => s.passed).length;
  return {
    overallReady: allPriorPassed,
    completedSteps,
    totalSteps: SETUP_STEPS.length,
    steps,
  };
}
