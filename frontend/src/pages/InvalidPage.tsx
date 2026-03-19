import { useEffect, useState } from 'react';
import { api, type Transaction, type Paginated } from '../api.ts';

export function InvalidPage() {
  const [data, setData] = useState<Paginated<Transaction> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getInvalidTransactions(page).then(setData).finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!data || data.items.length === 0) {
    return <div className="empty">No invalid transactions found.</div>;
  }

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div>
      <p style={{ marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
        Showing {data.items.length} of {data.total} invalid/duplicate transactions
      </p>

      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>External ID</th>
              <th>Type</th>
              <th>Status</th>
              <th>Error Reason</th>
              <th>Timestamp</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((tx) => (
              <tr key={tx.id}>
                <td className="mono">{tx.externalId}</td>
                <td><span className={`badge ${tx.type}`}>{tx.type}</span></td>
                <td><span className={`badge ${tx.status}`}>{tx.status}</span></td>
                <td>{tx.errorReason ?? '—'}</td>
                <td style={{ color: 'var(--text-muted)' }}>
                  {new Date(tx.timestamp).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
          <span>{page} / {totalPages}</span>
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  );
}
