import { describe, it, expect } from 'vitest';
import {
  validateTransactions,
  sortByTimestamp,
} from '../../src/modules/transactions/transaction.validator.js';

describe('validateTransactions', () => {
  it('should accept a valid deposit', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-1', type: 'deposit', amount: 100, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('should accept a valid withdraw', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-2', type: 'withdraw', amount: 50, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('should accept a valid transfer', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-3', type: 'transfer', amount: 30, timestamp: '2026-01-01T00:00:00Z', from_user_id: 'user-1', to_user_id: 'user-2' },
    ]);
    expect(valid).toHaveLength(1);
    expect(invalid).toHaveLength(0);
  });

  it('should reject deposit without user_id', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-4', type: 'deposit', amount: 100, timestamp: '2026-01-01T00:00:00Z' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].reason.length).toBeGreaterThan(0);
  });

  it('should reject transfer without from_user_id', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-5', type: 'transfer', amount: 30, timestamp: '2026-01-01T00:00:00Z', to_user_id: 'user-2' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('should reject amount <= 0', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-6', type: 'deposit', amount: 0, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
      { id: 'tx-7', type: 'deposit', amount: -10, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(2);
    expect(invalid[0].reason).toContain('amount must be greater than 0');
  });

  it('should reject self-transfer', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-8', type: 'transfer', amount: 50, timestamp: '2026-01-01T00:00:00Z', from_user_id: 'user-1', to_user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].reason).toContain('self-transfer');
  });

  it('should reject unknown transaction type', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-9', type: 'refund', amount: 10, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('should reject missing id', () => {
    const { valid, invalid } = validateTransactions([
      { type: 'deposit', amount: 100, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
    ]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(1);
  });

  it('should handle mixed valid and invalid transactions', () => {
    const { valid, invalid } = validateTransactions([
      { id: 'tx-ok', type: 'deposit', amount: 100, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
      { id: 'tx-bad', type: 'deposit', amount: -5, timestamp: '2026-01-01T00:00:00Z', user_id: 'user-1' },
      { id: 'tx-ok2', type: 'transfer', amount: 20, timestamp: '2026-01-02T00:00:00Z', from_user_id: 'user-1', to_user_id: 'user-2' },
    ]);
    expect(valid).toHaveLength(2);
    expect(invalid).toHaveLength(1);
  });

  it('should handle empty input', () => {
    const { valid, invalid } = validateTransactions([]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(0);
  });

  it('should handle null/undefined inputs gracefully', () => {
    const { valid, invalid } = validateTransactions([null, undefined, '', 42]);
    expect(valid).toHaveLength(0);
    expect(invalid).toHaveLength(4);
  });
});

describe('sortByTimestamp', () => {
  it('should sort transactions by timestamp ascending', () => {
    const transactions = [
      { id: 'tx-3', type: 'deposit' as const, amount: 10, timestamp: '2026-03-01T00:00:00Z', user_id: 'u1' },
      { id: 'tx-1', type: 'deposit' as const, amount: 30, timestamp: '2026-01-01T00:00:00Z', user_id: 'u1' },
      { id: 'tx-2', type: 'deposit' as const, amount: 20, timestamp: '2026-02-01T00:00:00Z', user_id: 'u1' },
    ];
    const sorted = sortByTimestamp(transactions);
    expect(sorted[0].id).toBe('tx-1');
    expect(sorted[1].id).toBe('tx-2');
    expect(sorted[2].id).toBe('tx-3');
  });

  it('should not mutate original array', () => {
    const transactions = [
      { id: 'tx-2', type: 'deposit' as const, amount: 20, timestamp: '2026-02-01T00:00:00Z', user_id: 'u1' },
      { id: 'tx-1', type: 'deposit' as const, amount: 10, timestamp: '2026-01-01T00:00:00Z', user_id: 'u1' },
    ];
    const sorted = sortByTimestamp(transactions);
    expect(transactions[0].id).toBe('tx-2');
    expect(sorted[0].id).toBe('tx-1');
  });
});
