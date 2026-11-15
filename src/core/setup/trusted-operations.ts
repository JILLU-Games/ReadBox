import type {
  InstallerOperationScope,
  SetupAuthorizationDecision,
  SetupLifecycle,
} from "@/core/setup/authorization";
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

interface RegisteredInstallerOperation {
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
