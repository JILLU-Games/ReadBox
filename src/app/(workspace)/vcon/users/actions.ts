"use server";

import { env } from "@/config/env";
import {
  createManagedUser,
  deleteManagedUser,
  updateManagedUser,
  type ManagedUserResult,
} from "@/core/accounts/users";
import { requireAdminUser } from "@/core/auth/route-guards";
import { getPrismaClient } from "@/core/database/client";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

export interface CreateUserActionInput {
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly password: string;
  readonly passwordConfirmation: string;
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly assignedMailboxIds: readonly string[];
}

export interface UpdateUserActionInput {
  readonly username: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly isActive: boolean;
  readonly canDeleteMessages: boolean;
  readonly canDeleteMailboxes: boolean;
  readonly assignedMailboxIds: readonly string[];
}

function databaseUnavailableResult(): ManagedUserResult<never> {
  return {
    ok: false,
    code: "unavailable",
    error:
      "Database is not connected in this local environment. Configure DATABASE_URL to manage persistent user accounts.",
  };
}

export async function createUserAction(
  input: CreateUserActionInput,
): Promise<ManagedUserResult<{ id: string; username: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await createManagedUser(getPrismaClient(), input, {
    actorId: actor.id,
    authSource: actor.authSource,
    actorUsername: actor.username,
    headers: requestHeaders,
    trustProxyHeaders: env.trustProxyHeaders,
  });

  if (result.ok) {
    revalidatePath("/vcon/users");
    revalidatePath("/vcon");
    revalidatePath("/vcon/audit");
  }

  return result;
}

export async function updateUserAction(
  userId: string,
  input: UpdateUserActionInput,
): Promise<ManagedUserResult<{ id: string; username: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await updateManagedUser(getPrismaClient(), userId, input, {
    actorId: actor.id,
    authSource: actor.authSource,
    actorUsername: actor.username,
    headers: requestHeaders,
    trustProxyHeaders: env.trustProxyHeaders,
  });

  if (result.ok) {
    revalidatePath("/vcon/users");
    revalidatePath(`/vcon/users/${userId}/edit`);
    revalidatePath("/vcon");
    revalidatePath("/vcon/audit");
  }

  return result;
}

export async function deleteUserAction(
  userId: string,
): Promise<ManagedUserResult<{ username: string }>> {
  const actor = await requireAdminUser();
  if (!env.databaseUrl) {
    return databaseUnavailableResult();
  }

  const requestHeaders = await headers();
  const result = await deleteManagedUser(getPrismaClient(), userId, {
    actorId: actor.id,
    authSource: actor.authSource,
    actorUsername: actor.username,
    headers: requestHeaders,
    trustProxyHeaders: env.trustProxyHeaders,
  });

  if (result.ok) {
    revalidatePath("/vcon/users");
    revalidatePath("/vcon");
    revalidatePath("/vcon/audit");
  }

  return result;
}
