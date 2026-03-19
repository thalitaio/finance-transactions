import { logger } from './infra/logger.js';
import { connectDatabase, disconnectDatabase } from './infra/database/prisma.js';
import { buildApp } from './app.js';

async function start() {
  const port = Number(process.env.PORT) || 3000;

  await connectDatabase();
  const app = await buildApp();

  try {
    await app.listen({ port, host: '0.0.0.0' });
    logger.info({ port }, `Server running on http://localhost:${port}`);
  } catch (error) {
    logger.fatal({ err: error }, 'Failed to start server');
    await disconnectDatabase();
    process.exit(1);
  }

  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await app.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
