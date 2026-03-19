import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database/prisma.js';
import { logger } from '../../infra/logger.js';
import { withRetry } from '../../infra/retry.js';
import type { TransactionInput } from './transaction.schema.js';
import {
  validateTransactions,
  sortByTimestamp,
} from './transaction.validator.js';
import { findByExternalIds } from './transaction.repository.js';

export interface ProcessingResult {
  processed: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ id: string; reason: string }>;
}

export async function processBatch(rawTransactions: unknown[]): Promise<ProcessingResult> {
  const startTime = Date.now();
  logger.info({ count: rawTransactions.length }, 'Starting batch processing');

  const { valid, invalid } = validateTransactions(rawTransactions);

  const result: ProcessingResult = {
    processed: 0,
    duplicates: 0,
    invalid: invalid.length,
    errors: invalid.map((i) => ({
      id: (i.raw as Record<string, unknown>)?.id as string ?? 'unknown',
      reason: i.reason,
    })),
  };

  const invalidRecords: Prisma.TransactionCreateManyInput[] = invalid.map((i) => {
    const raw = i.raw as Record<string, unknown>;
    return {
      externalId: (raw?.id as string) ?? `invalid-${Date.now()}-${Math.random()}`,
      type: (['deposit', 'withdraw', 'transfer'].includes(raw?.type as string)
        ? raw.type as 'deposit' | 'withdraw' | 'transfer'
        : 'deposit'),
      amount: typeof raw?.amount === 'number' ? raw.amount : 0,
      timestamp: raw?.timestamp ? new Date(raw.timestamp as string) : new Date(),
      userId: (raw?.user_id as string) ?? null,
      fromUserId: (raw?.from_user_id as string) ?? null,
      toUserId: (raw?.to_user_id as string) ?? null,
      status: 'invalid' as const,
      errorReason: i.reason,
    };
  });

  if (invalidRecords.length > 0) {
    await prisma.transaction.createMany({ data: invalidRecords, skipDuplicates: true });
    logger.info({ count: invalidRecords.length }, 'Saved invalid transactions');
  }

  if (valid.length === 0) {
    logger.info('No valid transactions to process');
    return result;
  }

  const existingIds = await findByExternalIds(valid.map((t) => t.id));
  const existingSet = new Set(existingIds.map((t) => t.externalId));

  const seenInBatch = new Set<string>();
  const newTransactions: TransactionInput[] = [];
  for (const tx of valid) {
    if (existingSet.has(tx.id) || seenInBatch.has(tx.id)) {
      result.duplicates++;
      result.errors.push({ id: tx.id, reason: 'duplicate transaction' });
    } else {
      seenInBatch.add(tx.id);
      newTransactions.push(tx);
    }
  }

  if (result.duplicates > 0) {
    const newSet = new Set(newTransactions.map((t) => t.id));
    const dupRecords: Prisma.TransactionCreateManyInput[] = valid
      .filter((tx) => !newSet.has(tx.id))
      .map((tx, i) => ({
        externalId: `dup-${tx.id}-${Date.now()}-${i}`,
        type: tx.type,
        amount: tx.amount,
        timestamp: new Date(tx.timestamp),
        userId: tx.type !== 'transfer' ? tx.user_id ?? null : null,
        fromUserId: tx.type === 'transfer' ? tx.from_user_id ?? null : null,
        toUserId: tx.type === 'transfer' ? tx.to_user_id ?? null : null,
        status: 'duplicate' as const,
        errorReason: 'duplicate transaction',
      }));
    await prisma.transaction.createMany({ data: dupRecords, skipDuplicates: true });
  }

  const sorted = sortByTimestamp(newTransactions);

  await withRetry(async () => {
    await prisma.$transaction(async (tx) => {
      for (const transaction of sorted) {
        await processOne(tx, transaction, result);
      }
    });
  });

  const elapsed = Date.now() - startTime;
  logger.info(
    { ...result, elapsedMs: elapsed },
    'Batch processing completed',
  );

  return result;
}

type PrismaTx = Omit<
  typeof prisma,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

async function processOne(
  tx: PrismaTx,
  input: TransactionInput,
  result: ProcessingResult,
): Promise<void> {
  try {
    switch (input.type) {
      case 'deposit': {
        const created = await createTransactionIfNotDuplicate(tx, result, {
          externalId: input.id,
          type: 'deposit',
          amount: input.amount,
          timestamp: new Date(input.timestamp),
          userId: input.user_id ?? null,
          status: 'processed',
        });
        if (!created) {
          return;
        }

        await tx.userBalance.upsert({
          where: { userId: input.user_id! },
          create: { userId: input.user_id!, balance: input.amount },
          update: { balance: { increment: input.amount } },
        });
        result.processed++;
        break;
      }
      case 'withdraw': {
        const userBalance = await tx.userBalance.findUnique({
          where: { userId: input.user_id! },
        });
        const currentBalance = userBalance?.balance?.toNumber() ?? 0;

        if (currentBalance < input.amount) {
          const created = await createTransactionIfNotDuplicate(tx, result, {
            externalId: input.id,
            type: 'withdraw',
            amount: input.amount,
            timestamp: new Date(input.timestamp),
            userId: input.user_id ?? null,
            status: 'invalid',
            errorReason: `insufficient balance (has ${currentBalance}, needs ${input.amount})`,
          });
          if (!created) {
            return;
          }
          result.invalid++;
          result.errors.push({
            id: input.id,
            reason: `insufficient balance (has ${currentBalance}, needs ${input.amount})`,
          });
          return;
        }

        const created = await createTransactionIfNotDuplicate(tx, result, {
          externalId: input.id,
          type: 'withdraw',
          amount: input.amount,
          timestamp: new Date(input.timestamp),
          userId: input.user_id ?? null,
          status: 'processed',
        });
        if (!created) {
          return;
        }

        await tx.userBalance.update({
          where: { userId: input.user_id! },
          data: { balance: { decrement: input.amount } },
        });
        result.processed++;
        break;
      }
      case 'transfer': {
        const sender = await tx.userBalance.findUnique({
          where: { userId: input.from_user_id! },
        });
        const senderBalance = sender?.balance?.toNumber() ?? 0;

        if (senderBalance < input.amount) {
          const created = await createTransactionIfNotDuplicate(tx, result, {
            externalId: input.id,
            type: 'transfer',
            amount: input.amount,
            timestamp: new Date(input.timestamp),
            fromUserId: input.from_user_id ?? null,
            toUserId: input.to_user_id ?? null,
            status: 'invalid',
            errorReason: `insufficient balance (has ${senderBalance}, needs ${input.amount})`,
          });
          if (!created) {
            return;
          }
          result.invalid++;
          result.errors.push({
            id: input.id,
            reason: `insufficient balance (has ${senderBalance}, needs ${input.amount})`,
          });
          return;
        }

        const created = await createTransactionIfNotDuplicate(tx, result, {
          externalId: input.id,
          type: 'transfer',
          amount: input.amount,
          timestamp: new Date(input.timestamp),
          fromUserId: input.from_user_id ?? null,
          toUserId: input.to_user_id ?? null,
          status: 'processed',
        });
        if (!created) {
          return;
        }

        await tx.userBalance.update({
          where: { userId: input.from_user_id! },
          data: { balance: { decrement: input.amount } },
        });

        await tx.userBalance.upsert({
          where: { userId: input.to_user_id! },
          create: { userId: input.to_user_id!, balance: input.amount },
          update: { balance: { increment: input.amount } },
        });
        result.processed++;
        break;
      }
    }
    logger.debug({ txId: input.id, type: input.type }, 'Transaction processed');
  } catch (error) {
    logger.error({ txId: input.id, err: error }, 'Failed to process transaction');
    throw error;
  }
}

async function createTransactionIfNotDuplicate(
  tx: PrismaTx,
  result: ProcessingResult,
  data: Prisma.TransactionCreateInput,
): Promise<boolean> {
  try {
    await tx.transaction.create({ data });
    return true;
  } catch (error) {
    if (isUniqueExternalIdError(error)) {
      registerDuplicate(result, data.externalId);
      return false;
    }
    throw error;
  }
}

function isUniqueExternalIdError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError
    && error.code === 'P2002'
  );
}

function registerDuplicate(result: ProcessingResult, id: string): void {
  result.duplicates++;
  result.errors.push({ id, reason: 'duplicate transaction' });
}
