import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../../src/app.js';
import { prisma } from '../../src/infra/database/prisma.js';
import type { FastifyInstance } from 'fastify';

let app: FastifyInstance;

beforeAll(async () => {
  await prisma.$connect();

  await prisma.transaction.deleteMany({
    where: { externalId: { startsWith: 'int-' } },
  });
  await prisma.userBalance.deleteMany({
    where: { userId: { startsWith: 'int-' } },
  });

  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
});

describe('Health endpoint', () => {
  it('GET /health should return ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('uptime');
  });
});

describe('POST /transactions/batch', () => {
  it('should reject empty body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('should reject body without transactions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: { transactions: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it('should process a valid deposit', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          {
            id: 'int-test-deposit-1',
            type: 'deposit',
            amount: 500,
            timestamp: '2026-01-01T10:00:00Z',
            user_id: 'int-user-1',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(1);
    expect(body.invalid).toBe(0);
    expect(body.duplicates).toBe(0);
  });

  it('should detect duplicate transactions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          {
            id: 'int-test-deposit-1',
            type: 'deposit',
            amount: 500,
            timestamp: '2026-01-01T10:00:00Z',
            user_id: 'int-user-1',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.duplicates).toBe(1);
    expect(body.processed).toBe(0);
  });

  it('should handle mixed valid and invalid transactions', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          {
            id: 'int-test-mix-valid',
            type: 'deposit',
            amount: 200,
            timestamp: '2026-01-02T10:00:00Z',
            user_id: 'int-user-2',
          },
          {
            id: 'int-test-mix-invalid',
            type: 'deposit',
            amount: -10,
            timestamp: '2026-01-02T10:00:00Z',
            user_id: 'int-user-2',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(1);
    expect(body.invalid).toBe(1);
  });

  it('should reject withdraw with insufficient balance', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          {
            id: 'int-test-overdraft',
            type: 'withdraw',
            amount: 99999,
            timestamp: '2026-01-03T10:00:00Z',
            user_id: 'int-user-1',
          },
        ],
      },
    });

    expect([200, 422]).toContain(res.statusCode);
    const body = JSON.parse(res.body);
    expect(body.invalid).toBeGreaterThanOrEqual(1);
  });

  it('should process a transfer correctly', async () => {
    await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          { id: 'int-seed-from', type: 'deposit', amount: 1000, timestamp: '2026-01-01T00:00:00Z', user_id: 'int-transfer-from' },
        ],
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          {
            id: 'int-test-transfer-1',
            type: 'transfer',
            amount: 300,
            timestamp: '2026-01-04T10:00:00Z',
            from_user_id: 'int-transfer-from',
            to_user_id: 'int-transfer-to',
          },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(1);
  });

  it('should sort out-of-order transactions by timestamp', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: {
        transactions: [
          { id: 'int-oo-withdraw', type: 'withdraw', amount: 50, timestamp: '2026-06-02T00:00:00Z', user_id: 'int-user-oo' },
          { id: 'int-oo-deposit', type: 'deposit', amount: 200, timestamp: '2026-06-01T00:00:00Z', user_id: 'int-user-oo' },
        ],
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(2);
    expect(body.invalid).toBe(0);
  });
});

describe('POST /transactions/batch — 100 out-of-order transactions', () => {
  it('should process 100 out-of-order transactions and produce correct final balance', async () => {
    const userId = 'int-stress-user';
    const transactions: unknown[] = [];

    for (let i = 0; i < 60; i++) {
      transactions.push({
        id: `int-stress-dep-${i}`,
        type: 'deposit',
        amount: 100,
        timestamp: new Date(2026, 0, 1, i % 24, Math.floor(i / 24)).toISOString(),
        user_id: userId,
      });
    }

    for (let i = 0; i < 30; i++) {
      transactions.push({
        id: `int-stress-wd-${i}`,
        type: 'withdraw',
        amount: 10,
        timestamp: new Date(2026, 1, 1, i % 24, Math.floor(i / 24)).toISOString(),
        user_id: userId,
      });
    }

    const recipientId = 'int-stress-recipient';
    for (let i = 0; i < 10; i++) {
      transactions.push({
        id: `int-stress-tr-${i}`,
        type: 'transfer',
        amount: 50,
        timestamp: new Date(2026, 2, 1, i).toISOString(),
        from_user_id: userId,
        to_user_id: recipientId,
      });
    }

    // 60 deposits * 100 = 6000
    // 30 withdrawals * 10 = 300
    // 10 transfers * 50 = 500 (debited from userId)
    // Expected sender balance: 6000 - 300 - 500 = 5200
    // Expected recipient balance: 10 * 50 = 500

    const shuffled = transactions.sort(() => Math.random() - 0.5);

    const res = await app.inject({
      method: 'POST',
      url: '/transactions/batch',
      payload: { transactions: shuffled },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.processed).toBe(100);
    expect(body.invalid).toBe(0);
    expect(body.duplicates).toBe(0);

    const senderRes = await app.inject({ method: 'GET', url: `/users/${userId}/balance` });
    expect(senderRes.statusCode).toBe(200);
    const sender = JSON.parse(senderRes.body);
    expect(Number(sender.balance)).toBe(5200);

    const recipientRes = await app.inject({ method: 'GET', url: `/users/${recipientId}/balance` });
    expect(recipientRes.statusCode).toBe(200);
    const recipient = JSON.parse(recipientRes.body);
    expect(Number(recipient.balance)).toBe(500);
  });
});

describe('GET /users', () => {
  it('should list users with balances', async () => {
    const res = await app.inject({ method: 'GET', url: '/users' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('total');
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe('GET /transactions/invalid', () => {
  it('should list invalid transactions', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions/invalid' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('items');
    expect(Array.isArray(body.items)).toBe(true);
  });
});

describe('GET /transactions/summary', () => {
  it('should return transaction summary', async () => {
    const res = await app.inject({ method: 'GET', url: '/transactions/summary' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty('deposits');
    expect(body).toHaveProperty('withdrawals');
    expect(body).toHaveProperty('transfers');
    expect(body).toHaveProperty('invalidCount');
  });
});
