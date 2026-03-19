const BASE = '';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface UserBalance {
  userId: string;
  balance: string;
  updatedAt: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface Transaction {
  id: string;
  externalId: string;
  type: 'deposit' | 'withdraw' | 'transfer';
  amount: string;
  timestamp: string;
  userId: string | null;
  fromUserId: string | null;
  toUserId: string | null;
  status: 'processed' | 'invalid' | 'duplicate';
  errorReason: string | null;
  createdAt: string;
}

export interface Summary {
  deposits: { count: number; total: number };
  withdrawals: { count: number; total: number };
  transfers: { count: number; total: number };
  invalidCount: number;
}

export interface BatchResult {
  processed: number;
  duplicates: number;
  invalid: number;
  errors: Array<{ id: string; reason: string }>;
}

export const api = {
  getUsers: (page = 1, limit = 50) =>
    fetchJson<Paginated<UserBalance>>(`/users?page=${page}&limit=${limit}`),

  getUserBalance: (id: string) =>
    fetchJson<UserBalance>(`/users/${id}/balance`),

  getUserTransactions: (id: string, page = 1, limit = 50) =>
    fetchJson<Paginated<Transaction>>(`/users/${id}/transactions?page=${page}&limit=${limit}`),

  getInvalidTransactions: (page = 1, limit = 50) =>
    fetchJson<Paginated<Transaction>>(`/transactions/invalid?page=${page}&limit=${limit}`),

  getSummary: () =>
    fetchJson<Summary>('/transactions/summary'),

  uploadBatch: async (transactions: unknown[]): Promise<BatchResult> => {
    const res = await fetch(`${BASE}/transactions/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactions }),
    });
    return res.json();
  },
};
