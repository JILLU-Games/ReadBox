import { getCurrentUser } from "@/core/auth/current-user";
import type { SetupLifecycle } from "@/core/setup/lifecycle";
import "server-only";

export type { SetupLifecycle } from "@/core/setup/lifecycle";

declare const verifiedPrincipalBrand: unique symbol;

export type SetupPrincipalKind =
  | "anonymous"
  | "application-user"
  | "application-admin"
  | "trusted-installer";

export interface VerifiedSetupPrincipal {
  readonly kind: SetupPrincipalKind;
  readonly [verifiedPrincipalBrand]: true;
}

export type InstallerOperationScope =
  | "setup:initialize"
  | "setup:record-failure"
  | "setup:recover"
  | "installer:manage";

export type SetupAuthorizationRequest =
  | { readonly action: "inspect-status" }
  | { readonly action: "application-access" }
  | { readonly action: "validate-transition" }
  | {
      readonly action: "privileged-operation";
      readonly operationId: string;
      readonly requiredScope: InstallerOperationScope;
    };

export type SetupAuthorizationDecision =
  | { readonly kind: "allow"; readonly scope: "status-summary" }
  | {
      readonly kind: "allow";
      readonly principalKind: "trusted-installer";
      readonly operationId: string;
      readonly scope: InstallerOperationScope;
      readonly lifecycle: SetupLifecycle;
    }
  | { readonly kind: "delegate"; readonly target: "application-route-guards" }
  | {
      readonly kind: "deny";
      readonly code:
        | "unauthenticated"
        | "forbidden"
        | "invalid-principal"
        | "setup-state-mismatch";
    }
  | {
      readonly kind: "unsupported";
      readonly code:
        | "trusted-principal-issuer-unavailable"
        | "transition-validation-internal-only";
    }
  | { readonly kind: "invalid"; readonly code: "invalid-request" };

type PrincipalRecord =
  | { readonly kind: "anonymous" }
  | { readonly kind: "application-user" }
  | { readonly kind: "application-admin" }
  | {
      readonly kind: "trusted-installer";
      readonly operationIds: ReadonlySet<string>;
      readonly scopes: ReadonlySet<InstallerOperationScope>;
    };

const principalRecords = new WeakMap<object, PrincipalRecord>();
const lifecycleValues = new Set<SetupLifecycle>([
  "not-started",
  "in-progress",
  "completed",
  "failed",
  "interrupted",
]);
const installerScopes = new Set<InstallerOperationScope>([
  "setup:initialize",
  "setup:record-failure",
  "setup:recover",
  "installer:manage",
]);

function registerPrincipal(record: PrincipalRecord): VerifiedSetupPrincipal {
  const principal = Object.freeze({
    kind: record.kind,
  }) as VerifiedSetupPrincipal;
  principalRecords.set(principal, record);
  return principal;
}

export async function resolveSetupPrincipal(): Promise<VerifiedSetupPrincipal> {
  try {
    const user = await getCurrentUser();
    if (!user) return registerPrincipal({ kind: "anonymous" });

    return registerPrincipal({
      kind: user.isAdministrator ? "application-admin" : "application-user",
    });
  } catch {
    return registerPrincipal({ kind: "anonymous" });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isLifecycle(value: unknown): value is SetupLifecycle {
  return (
    typeof value === "string" && lifecycleValues.has(value as SetupLifecycle)
  );
}

function isScope(value: unknown): value is InstallerOperationScope {
  return (
    typeof value === "string" &&
    installerScopes.has(value as InstallerOperationScope)
  );
}

function isSetupRequest(value: unknown): value is SetupAuthorizationRequest {
  if (!isRecord(value)) return false;
  if (
    value.action === "inspect-status" ||
    value.action === "application-access" ||
    value.action === "validate-transition"
  ) {
    return true;
  }
  return (
    value.action === "privileged-operation" &&
    typeof value.operationId === "string" &&
    value.operationId.length > 0 &&
    isScope(value.requiredScope)
  );
}

function lifecycleAllows(
  scope: InstallerOperationScope,
  lifecycle: SetupLifecycle,
): boolean {
  if (scope === "setup:initialize") {
    return lifecycle === "not-started" || lifecycle === "in-progress";
  }
  if (scope === "setup:record-failure") {
    return lifecycle === "in-progress";
  }
  if (scope === "setup:recover") {
    return lifecycle === "failed" || lifecycle === "interrupted";
  }
  return lifecycle === "completed";
}

export function authorizeSetupRequest(
  principalValue: unknown,
  requestValue: unknown,
  lifecycleValue: unknown,
): SetupAuthorizationDecision {
  if (!isRecord(principalValue)) {
    return { kind: "deny", code: "invalid-principal" };
  }
  const principal = principalRecords.get(principalValue);
  if (!principal) return { kind: "deny", code: "invalid-principal" };
  if (!isSetupRequest(requestValue) || !isLifecycle(lifecycleValue)) {
    return { kind: "invalid", code: "invalid-request" };
  }

  if (requestValue.action === "inspect-status") {
    return { kind: "allow", scope: "status-summary" };
  }
  if (requestValue.action === "application-access") {
    return principal.kind === "application-user" ||
      principal.kind === "application-admin"
      ? { kind: "delegate", target: "application-route-guards" }
      : { kind: "deny", code: "unauthenticated" };
  }
  if (requestValue.action === "validate-transition") {
    return {
      kind: "unsupported",
      code: "transition-validation-internal-only",
    };
  }

  if (!lifecycleAllows(requestValue.requiredScope, lifecycleValue)) {
    return { kind: "deny", code: "setup-state-mismatch" };
  }
  if (principal.kind === "trusted-installer") {
    if (
      principal.operationIds.has(requestValue.operationId) &&
      principal.scopes.has(requestValue.requiredScope)
    ) {
      return {
        kind: "allow",
        principalKind: "trusted-installer",
        operationId: requestValue.operationId,
        scope: requestValue.requiredScope,
        lifecycle: lifecycleValue,
      };
    }
    return { kind: "deny", code: "forbidden" };
  }
  if (principal.kind === "anonymous") {
    return { kind: "deny", code: "unauthenticated" };
  }
  return { kind: "deny", code: "forbidden" };
}

export interface PublicSetupStatus {
  readonly lifecycle: SetupLifecycle;
}

export function toPublicSetupStatus(state: unknown): PublicSetupStatus | null {
  if (!isRecord(state) || !isLifecycle(state.lifecycle)) return null;
  return Object.freeze({ lifecycle: state.lifecycle });
}
