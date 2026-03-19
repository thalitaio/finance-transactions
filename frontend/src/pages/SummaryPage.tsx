import { useEffect, useState } from 'react';
import { api, type Summary } from '../api.ts';

export function SummaryPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setError('');
    api.getSummary()
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Failed to load summary');
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading"><div className="spinner" /></div>;
  }

  if (!data) {
    return <div className="empty">{error || 'Failed to load summary.'}</div>;
  }

  const totalProcessed = data.deposits.count + data.withdrawals.count + data.transfers.count;

  return (
    <div>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="label">Deposits</div>
          <div className="value green">{formatCurrency(data.deposits.total)}</div>
          <div className="sub">{data.deposits.count} transactions</div>
        </div>
        <div className="summary-card">
          <div className="label">Withdrawals</div>
          <div className="value red">{formatCurrency(data.withdrawals.total)}</div>
          <div className="sub">{data.withdrawals.count} transactions</div>
        </div>
        <div className="summary-card">
          <div className="label">Transfers</div>
          <div className="value primary">{formatCurrency(data.transfers.total)}</div>
          <div className="sub">{data.transfers.count} transactions</div>
        </div>
        <div className="summary-card">
          <div className="label">Invalid / Duplicate</div>
          <div className="value yellow">{data.invalidCount}</div>
          <div className="sub">rejected transactions</div>
        </div>
      </div>

      <div className="summary-card" style={{ marginTop: '1rem' }}>
        <div className="label">Total Processed</div>
        <div className="value">{totalProcessed}</div>
        <div className="sub">
          Net flow: {formatCurrency(data.deposits.total - data.withdrawals.total)}
        </div>
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}
