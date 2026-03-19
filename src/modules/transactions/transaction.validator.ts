import { transactionInputSchema, type TransactionInput } from './transaction.schema.js';

export interface ValidationResult {
  valid: TransactionInput[];
  invalid: Array<{ raw: unknown; reason: string }>;
}

export function validateTransactions(rawList: unknown[]): ValidationResult {
  const valid: TransactionInput[] = [];
  const invalid: Array<{ raw: unknown; reason: string }> = [];

  for (const raw of rawList) {
    const parsed = transactionInputSchema.safeParse(raw);

    if (!parsed.success) {
      const reason = parsed.error.issues.map((i) => i.message).join('; ');
      invalid.push({ raw, reason });
      continue;
    }

    const tx = parsed.data;

    if (tx.amount <= 0) {
      invalid.push({ raw, reason: 'amount must be greater than 0' });
      continue;
    }

    if (tx.type === 'transfer' && tx.from_user_id === tx.to_user_id) {
      invalid.push({ raw, reason: 'self-transfer not allowed (from_user_id == to_user_id)' });
      continue;
    }

    valid.push(tx);
  }

  return { valid, invalid };
}

export function sortByTimestamp(transactions: TransactionInput[]): TransactionInput[] {
  return [...transactions].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
}
