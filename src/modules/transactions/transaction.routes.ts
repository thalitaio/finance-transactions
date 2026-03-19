import type { FastifyInstance } from 'fastify';
import { processBatch } from './transaction.processor.js';
import {
  findInvalidTransactions,
  getTransactionSummary,
} from './transaction.repository.js';
import { logger } from '../../infra/logger.js';

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  app.post('/transactions/batch', async (request, reply) => {
    const body = request.body as { transactions?: unknown[] } | unknown[];

    const rawTransactions = Array.isArray(body)
      ? body
      : body?.transactions;

    if (!Array.isArray(rawTransactions) || rawTransactions.length === 0) {
      return reply.status(400).send({
        error: 'Request body must contain a non-empty "transactions" array',
      });
    }

    logger.info({ count: rawTransactions.length }, 'Received batch request');

    try {
      const result = await processBatch(rawTransactions);
      const statusCode = result.invalid > 0 && result.processed === 0 ? 422 : 200;
      return reply.status(statusCode).send(result);
    } catch (error) {
      logger.error({ err: error }, 'Batch processing failed unexpectedly');
      return reply.status(500).send({
        error: 'Failed to process transaction batch',
        statusCode: 500,
      });
    }
  });

  app.get('/transactions/invalid', async (request, reply) => {
    const { page = '1', limit = '50' } = request.query as Record<string, string>;
    try {
      return await findInvalidTransactions(Number(page), Number(limit));
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch invalid transactions');
      return reply.status(500).send({ error: 'Failed to fetch invalid transactions', statusCode: 500 });
    }
  });

  app.get('/transactions/summary', async (_request, reply) => {
    try {
      return await getTransactionSummary();
    } catch (error) {
      logger.error({ err: error }, 'Failed to fetch transaction summary');
      return reply.status(500).send({ error: 'Failed to fetch transaction summary', statusCode: 500 });
    }
  });
}
