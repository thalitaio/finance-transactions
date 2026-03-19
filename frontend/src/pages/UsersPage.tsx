import { useEffect, useState } from 'react';
import { api, type UserBalance, type Paginated } from '../api.ts';

interface Props {
  onSelectUser: (userId: string) => void;
}

export function UsersPage({ onSelectUser }: Props) {
  const [data, setData] = useState<Paginated<UserBalance> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api.getUsers(page)
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!data || data.items.length === 0) {
    if (error) {
      return <div className="empty">{error}</div>;
    }
    return <div className="empty">No users found. Upload transactions first.</div>;
  }

  const totalPages = Math.ceil(data.total / data.limit);

  return (
    <div>
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th style={{ textAlign: 'right' }}>Last Updated</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((user) => (
              <tr
                key={user.userId}
                className="clickable"
                onClick={() => onSelectUser(user.userId)}
              >
                <td className="mono">{user.userId}</td>
                <td style={{ textAlign: 'right', fontWeight: 600 }}>
                  {formatCurrency(user.balance)}
                </td>
                <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>
                  {new Date(user.updatedAt).toLocaleString()}
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

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value));
}
