import { describe, it, expect, vi } from 'vitest';
import { withRetry } from '../../src/infra/retry.js';

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient errors and eventually succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('connection refused (ECONNREFUSED)'))
      .mockResolvedValue('recovered');

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 });
    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw after max retries exhausted', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('deadlock detected'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('deadlock');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-transient errors', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('unique constraint violated'));

    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 }),
    ).rejects.toThrow('unique constraint');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should call onRetry callback on each retry', async () => {
    const onRetry = vi.fn();
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('deadlock detected'))
      .mockResolvedValue('ok');

    await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10, onRetry });
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(expect.any(Error), 1);
  });
});
