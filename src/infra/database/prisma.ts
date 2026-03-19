import { PrismaClient } from '@prisma/client';
import { logger } from '../logger.js';

export const prisma = new PrismaClient({
  log: [
    { level: 'error', emit: 'event' },
    { level: 'warn', emit: 'event' },
  ],
});

prisma.$on('error', (e) => {
  logger.error({ target: e.target, message: e.message }, 'Prisma error');
});

prisma.$on('warn', (e) => {
  logger.warn({ target: e.target, message: e.message }, 'Prisma warning');
});

export async function connectDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    logger.info('Database connected');
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to connect to database');
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
