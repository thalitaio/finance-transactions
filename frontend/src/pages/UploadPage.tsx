import { useRef, useState } from 'react';
import { api, type BatchResult } from '../api.ts';

export function UploadPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);
  const [error, setError] = useState<string>('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setFileName(file.name);
    setResult(null);
    setError('');
  };

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const text = await file.text();
      let data: unknown[];

      if (file.name.endsWith('.csv')) {
        data = parseCsv(text);
      } else {
        const parsed = JSON.parse(text);
        data = Array.isArray(parsed) ? parsed : parsed.transactions ?? [parsed];
      }

      const res = await api.uploadBatch(data);
      setResult(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="upload-section">
        <p style={{ marginBottom: '0.75rem', color: 'var(--text-muted)' }}>
          Upload a JSON or CSV file with transactions
        </p>
        <input
          ref={fileRef}
          type="file"
          id="file-input"
          accept=".json,.csv"
          onChange={handleFile}
        />
        <label htmlFor="file-input" className="upload-label">
          {fileName || 'Choose file...'}
        </label>
        <br />
        <button
          className="upload-btn"
          disabled={!fileName || loading}
          onClick={handleUpload}
        >
          {loading ? 'Processing...' : 'Upload & Process'}
        </button>
      </div>

      {error && (
        <div className="result-banner" style={{ borderColor: 'var(--red)' }}>
          <span className="red">{error}</span>
        </div>
      )}

      {result && (
        <div className="result-banner">
          <div className="stat">
            <span className="green">Processed:</span>
            <strong>{result.processed}</strong>
          </div>
          <div className="stat">
            <span className="yellow">Duplicates:</span>
            <strong>{result.duplicates}</strong>
          </div>
          <div className="stat">
            <span className="red">Invalid:</span>
            <strong>{result.invalid}</strong>
          </div>
        </div>
      )}

      {result && result.errors.length > 0 && (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {result.errors.map((e, i) => (
                <tr key={i}>
                  <td className="mono">{e.id}</td>
                  <td>{e.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function parseCsv(text: string): unknown[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const val = values[i];
      if (h === 'amount') {
        obj[h] = Number(val);
      } else {
        obj[h] = val === '' ? undefined : val;
      }
    });
    return obj;
  });
}
