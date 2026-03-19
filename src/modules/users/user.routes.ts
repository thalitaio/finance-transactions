import type { FastifyInstance } from 'fastify';
import { findAllUsers, findUserBalance } from './user.repository.js';
import { findTransactionsByUserId } from '../transactions/transaction.repository.js';
import { logger } from '../../infra/logger.js';

export async function userRoutes(app: FastifyInstance): Promise<void> {
  app.get('/users', async (request, reply) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string>;
    try {
      return await findAllUsers(Number(page), Number(limit));
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch users');
      return reply.status(500).send({ error: 'Failed to fetch users', statusCode: 500 });
    }
  });

  app.get('/users/:id/balance', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const balance = await findUserBalance(id);
      if (!balance) {
        return reply.status(404).send({ error: 'User not found' });
      }
      return balance;
    } catch (error) {
      logger.error({ err: error, userId: id }, 'Failed to fetch user balance');
      return reply.status(500).send({ error: 'Failed to fetch user balance', statusCode: 500 });
    }
  });

  app.get('/users/:id/transactions', async (request, reply) => {
    const { id } = request.params as { id: string };
    const { page = '1', limit = '50' } = request.query as Record<string, string>;
    try {
      return await findTransactionsByUserId(id, Number(page), Number(limit));
    } catch (error) {
      logger.error({ err: error, userId: id }, 'Failed to fetch user transactions');
      return reply.status(500).send({ error: 'Failed to fetch user transactions', statusCode: 500 });
    }
  });
}
