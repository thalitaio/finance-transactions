import { useEffect, useState } from 'react';
import { api, type UserBalance, type Transaction, type Paginated } from '../api.ts';

interface Props {
  userId: string;
  onBack: () => void;
}

export function UserDetailPage({ userId, onBack }: Props) {
  const [balance, setBalance] = useState<UserBalance | null>(null);
  const [txData, setTxData] = useState<Paginated<Transaction> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.getUserBalance(userId),
      api.getUserTransactions(userId, page),
    ]).then(([b, t]) => {
      setBalance(b);
      setTxData(t);
    }).finally(() => setLoading(false));
  }, [userId, page]);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  const totalPages = txData ? Math.ceil(txData.total / txData.limit) : 0;

  return (
    <div>
      <button className="back-btn" onClick={onBack}>Back to users</button>

      {balance && (
        <div className="summary-grid" style={{ marginBottom: '1.5rem' }}>
          <div className="summary-card">
            <div className="label">User</div>
            <div className="value mono" style={{ fontSize: '0.95rem' }}>{userId}</div>
          </div>
          <div className="summary-card">
            <div className="label">Current Balance</div>
            <div className="value green">{formatCurrency(balance.balance)}</div>
          </div>
        </div>
      )}

      <h3 style={{ marginBottom: '1rem', fontSize: '1rem', color: 'var(--text-muted)' }}>
        Transaction History ({txData?.total ?? 0})
      </h3>

      {txData && txData.items.length > 0 ? (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>Amount</th>
                <th>Details</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {txData.items.map((tx) => (
                <tr key={tx.id}>
                  <td><span className={`badge ${tx.type}`}>{tx.type}</span></td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>
                    {formatCurrency(tx.amount)}
                  </td>
                  <td className="mono" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    {tx.type === 'transfer'
                      ? `${tx.fromUserId} → ${tx.toUserId}`
                      : tx.userId}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>
                    {new Date(tx.timestamp).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      ) : (
        <div className="empty">No transactions found for this user.</div>
      )}
    </div>
  );
}

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}
