import { logger } from './logger.js';

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  onRetry?: (error: Error, attempt: number) => void;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: Number(process.env.RETRY_MAX_ATTEMPTS) || 3,
  baseDelayMs: Number(process.env.RETRY_BASE_DELAY_MS) || 200,
};

function isTransientError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes('deadlock') ||
      message.includes('lock timeout') ||
      message.includes('connection') ||
      message.includes('econnrefused') ||
      message.includes('serialization failure')
    );
  }
  return false;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const { maxAttempts, baseDelayMs, onRetry } = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const isLast = attempt === maxAttempts;
      const isTransient = isTransientError(error);

      if (isLast || !isTransient) {
        throw error;
      }

      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      logger.warn(
        { attempt, maxAttempts, delay, error: (error as Error).message },
        'Transient error — retrying',
      );

      onRetry?.(error as Error, attempt);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('withRetry: unreachable');
}
