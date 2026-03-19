import { Prisma } from '@prisma/client';
import { prisma } from '../../infra/database/prisma.js';

export async function findByExternalIds(externalIds: string[]) {
  return prisma.transaction.findMany({
    where: { externalId: { in: externalIds } },
    select: { externalId: true },
  });
}

export async function findInvalidTransactions(page = 1, limit = 50) {
  const where: Prisma.TransactionWhereInput = {
    status: { in: ['invalid', 'duplicate'] },
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function findTransactionsByUserId(userId: string, page = 1, limit = 50) {
  const where: Prisma.TransactionWhereInput = {
    OR: [
      { userId },
      { fromUserId: userId },
      { toUserId: userId },
    ],
    status: 'processed',
  };

  const [items, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { items, total, page, limit };
}

export async function getTransactionSummary() {
  const [deposits, withdrawals, transfers, invalidCount] = await Promise.all([
    prisma.transaction.aggregate({
      where: { type: 'deposit', status: 'processed' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'withdraw', status: 'processed' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.aggregate({
      where: { type: 'transfer', status: 'processed' },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.transaction.count({
      where: { status: { in: ['invalid', 'duplicate'] } },
    }),
  ]);

  return {
    deposits: {
      count: deposits._count,
      total: deposits._sum.amount?.toNumber() ?? 0,
    },
    withdrawals: {
      count: withdrawals._count,
      total: withdrawals._sum.amount?.toNumber() ?? 0,
    },
    transfers: {
      count: transfers._count,
      total: transfers._sum.amount?.toNumber() ?? 0,
    },
    invalidCount,
  };
}
