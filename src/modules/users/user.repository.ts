import { prisma } from '../../infra/database/prisma.js';

export async function findAllUsers(page = 1, limit = 50) {
  const [items, total] = await Promise.all([
    prisma.userBalance.findMany({
      orderBy: { userId: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.userBalance.count(),
  ]);

  return { items, total, page, limit };
}

export async function findUserBalance(userId: string) {
  return prisma.userBalance.findUnique({ where: { userId } });
}
