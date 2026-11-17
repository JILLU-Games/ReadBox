import { env } from "@/config/env";
import { bootstrapInitialAccount } from "@/core/auth/operator-bootstrap";
import { getOperatorEnvironmentError } from "@/core/auth/operator-environment";
import {
  issueAdminPasswordResetToken,
  issuePasswordResetToken,
} from "@/core/auth/password-reset";
import { getPrismaClient } from "@/core/database/client";
import { stderr, stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { z } from "zod";

const usernameSchema = z.string().trim().min(1).max(150);
const accountDetailsSchema = z.object({
  username: usernameSchema,
  firstName: z.string().trim().max(150),
  lastName: z.string().trim().max(150),
  email: z.string().trim().max(254),
});

function assertLocalOperatorEnvironment(): void {
  const error = getOperatorEnvironmentError({
    nodeEnv: env.nodeEnv,
    databaseUrl: env.databaseUrl,
    interactive: stdin.isTTY === true && stdout.isTTY === true,
  });
  if (error) throw new Error(error);
}

function displayResetToken(token: string): void {
  stdout.write(
    `\nOne-time password reset token (shown once; keep it local):\n${token}\n\n`,
  );
}

async function main(): Promise<void> {
  assertLocalOperatorEnvironment();

  const prompt = createInterface({ input: stdin, output: stdout });
  const prisma = getPrismaClient();

  try {
    const action = await prompt.question("Action (bootstrap/reset): ");

    if (action === "bootstrap") {
      const details = accountDetailsSchema.safeParse({
        username: await prompt.question("Initial admin username: "),
        firstName: await prompt.question("First name (optional): "),
        lastName: await prompt.question("Last name (optional): "),
        email: await prompt.question("Email (optional): "),
      });
      if (!details.success) {
        stdout.write("Invalid account details. No account was created.\n");
        return;
      }

      const confirmation = await prompt.question(
        'Type "CREATE INITIAL ADMIN" to continue: ',
      );
      if (confirmation !== "CREATE INITIAL ADMIN") {
        stdout.write("Bootstrap cancelled.\n");
        return;
      }

      const result = await bootstrapInitialAccount(prisma, details.data);
      if (!result) {
        stdout.write("Bootstrap requires an empty local user table.\n");
        return;
      }

      stdout.write("Initial account created with password reset required.\n");
      displayResetToken(result.resetToken);
      return;
    }

    if (action === "reset") {
      const username = usernameSchema.safeParse(
        await prompt.question("Exact account username: "),
      );
      if (!username.success) {
        stdout.write("Invalid account name. No reset was issued.\n");
        return;
      }

      const confirmation = await prompt.question("Confirm exact username: ");
      if (confirmation !== username.data) {
        stdout.write("Confirmation did not match. No reset was issued.\n");
        return;
      }

      const targetUser = await prisma.user.findFirst({
        where: {
          username: { equals: username.data, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (targetUser) {
        const resetToken = await issuePasswordResetToken(prisma, targetUser.id);
        stdout.write(
          "Password reset is required for the selected local user account.\n",
        );
        displayResetToken(resetToken);
        return;
      }

      const targetAdmin = await prisma.adminAccount.findFirst({
        where: {
          username: { equals: username.data, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (targetAdmin) {
        const resetToken = await issueAdminPasswordResetToken(
          prisma,
          targetAdmin.id,
        );
        stdout.write(
          "Password reset is required for the selected local administrator account.\n",
        );
        displayResetToken(resetToken);
        return;
      }

      stdout.write("Account could not be reset.\n");
      return;
    }

    stdout.write("Choose either bootstrap or reset. No account was changed.\n");
  } finally {
    prompt.close();
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  stderr.write(
    "Authentication operator action failed. No secret was displayed.\n",
  );
  process.exitCode = 1;
});
