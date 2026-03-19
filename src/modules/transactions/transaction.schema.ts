import { z } from 'zod';

const baseSchema = z.object({
  id: z.string().min(1, 'id is required'),
  amount: z.number(),
  timestamp: z.string().or(z.date()),
});

const depositWithdrawSchema = baseSchema.extend({
  type: z.enum(['deposit', 'withdraw']),
  user_id: z.string().min(1, 'user_id is required for deposit/withdraw'),
  from_user_id: z.string().optional(),
  to_user_id: z.string().optional(),
});

const transferSchema = baseSchema.extend({
  type: z.literal('transfer'),
  user_id: z.string().optional(),
  from_user_id: z.string().min(1, 'from_user_id is required for transfer'),
  to_user_id: z.string().min(1, 'to_user_id is required for transfer'),
});

export const transactionInputSchema = z.discriminatedUnion('type', [
  depositWithdrawSchema,
  transferSchema,
]);

export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const batchInputSchema = z.object({
  transactions: z.array(z.unknown()).min(1, 'At least one transaction is required'),
});
