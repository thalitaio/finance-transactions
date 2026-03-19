import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { logger } from './infra/logger.js';
import { transactionRoutes } from './modules/transactions/transaction.routes.js';
import { userRoutes } from './modules/users/user.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });

  app.addHook('onRequest', (request, _reply, done) => {
    logger.info({ method: request.method, url: request.url }, 'Incoming request');
    done();
  });

  app.addHook('onResponse', (request, reply, done) => {
    logger.info(
      { method: request.method, url: request.url, statusCode: reply.statusCode },
      'Request completed',
    );
    done();
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, request, reply) => {
    logger.error(
      { err: error, method: request.method, url: request.url },
      'Unhandled error',
    );

    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? 'Internal server error' : error.message,
      statusCode,
      ...(process.env.NODE_ENV !== 'production' && { detail: error.message }),
    });
  });

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }));

  await app.register(transactionRoutes);
  await app.register(userRoutes);

  const frontendPath = path.join(__dirname, '..', 'frontend', 'dist');
  try {
    await app.register(fastifyStatic, {
      root: frontendPath,
      prefix: '/',
      wildcard: false,
    });

    app.setNotFoundHandler(async (request, reply) => {
      if (request.url.startsWith('/users') || request.url.startsWith('/transactions') || request.url.startsWith('/health')) {
        return reply.status(404).send({ error: 'Not found' });
      }
      return reply.sendFile('index.html');
    });
  } catch {
    logger.warn('Frontend dist folder not found — serving API only');
    app.setNotFoundHandler(async (_request, reply) => {
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  return app;
}
