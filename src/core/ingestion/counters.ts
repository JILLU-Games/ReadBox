export interface CounterPrismaClient {
  mailbox: {
    findMany(args: {
      where: Record<string, unknown>;
      select: { id: true; uuid: true; emailAddress: true };
      orderBy: { id: "asc" | "desc" };
    }): Promise<Array<{ id: bigint; uuid: string; emailAddress: string }>>;
    update(args: {
      where: { id: bigint };
      data: Record<string, unknown>;
    }): Promise<unknown>;
  };
  message: {
    count(args: { where: Record<string, unknown> }): Promise<number>;
    aggregate(args: {
      where: Record<string, unknown>;
      _max: { receivedAt: true };
    }): Promise<{ _max: { receivedAt: Date | null } }>;
  };
}

export interface CounterRecalculationResult {
  readonly mailboxId: bigint;
  readonly totalMessages: number;
  readonly unreadMessages: number;
  readonly lastReceivedAt: Date | null;
}

export async function recalculateMailboxCounters(
  prisma: Pick<CounterPrismaClient, "mailbox" | "message">,
  mailboxId: bigint,
): Promise<CounterRecalculationResult> {
  const activeFilter = {
    mailboxId,
    deletedAt: null,
  };

  const [totalMessages, unreadMessages, latest] = await Promise.all([
    prisma.message.count({ where: activeFilter }),
    prisma.message.count({
      where: { ...activeFilter, isRead: false },
    }),
    prisma.message.aggregate({
      where: activeFilter,
      _max: { receivedAt: true },
    }),
  ]);

  const lastReceivedAt = latest._max.receivedAt ?? null;

  await prisma.mailbox.update({
    where: { id: mailboxId },
    data: {
      totalMessages: BigInt(totalMessages),
      unreadMessages: BigInt(unreadMessages),
      lastReceivedAt,
    },
  });

  return {
    mailboxId,
    totalMessages,
    unreadMessages,
    lastReceivedAt,
  };
}

export async function recalculateAllMailboxCounters(
  prisma: CounterPrismaClient,
  options: { readonly mailboxUuid?: string } = {},
): Promise<{ readonly updatedCount: number }> {
  const mailboxes = await prisma.mailbox.findMany({
    where: {
      deletedAt: null,
      ...(options.mailboxUuid ? { uuid: options.mailboxUuid } : {}),
    },
    select: { id: true, uuid: true, emailAddress: true },
    orderBy: { id: "asc" },
  });

  let updatedCount = 0;
  for (const mailbox of mailboxes) {
    await recalculateMailboxCounters(prisma, mailbox.id);
    updatedCount += 1;
  }

  return { updatedCount };
}
