import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorAlert, Loading, MovementBadge, formatDateTime } from '../components/ui';
import { apiPaginated, type Paginated } from '../lib/api';
import type { StockMovement } from '../types';

export default function StockMovementsPage() {
  const [result, setResult] = useState<Paginated<StockMovement> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(await apiPaginated<StockMovement>('/api/products/movements/all', {
        query: { page, limit: 20, type },
      }));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, type]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [type]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Stock movements</h1>
          <p>Every stock change in the system — manual adjustments and challan dispatches.</p>
        </div>
      </div>

      <div className="toolbar">
        <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All movements</option>
          <option value="IN">IN only</option>
          <option value="OUT">OUT only</option>
        </select>
      </div>

      <ErrorAlert error={error} />

      <div className="card">
        {loading && !result ? (
          <Loading />
        ) : result && result.data.length === 0 ? (
          <EmptyState icon="⇅" title="No stock movements yet" />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Product</th>
                    <th>Type</th>
                    <th className="num">Quantity</th>
                    <th>Reason</th>
                    <th>Reference</th>
                    <th>Created by</th>
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((m) => (
                    <tr key={m.id}>
                      <td className="muted nowrap">{formatDateTime(m.createdAt)}</td>
                      <td>
                        <Link to={`/products/${m.product?.id}`} className="strong">
                          {m.product?.name}
                        </Link>
                        <div className="faint">{m.product?.sku}</div>
                      </td>
                      <td>
                        <MovementBadge type={m.type} />
                      </td>
                      <td className="num strong">
                        {m.type === 'IN' ? '+' : '−'}
                        {m.quantity}
                      </td>
                      <td>{m.reason}</td>
                      <td className="muted">
                        {m.referenceType === 'CHALLAN' && m.referenceId ? (
                          <Link to={`/challans/${m.referenceId}`}>Challan →</Link>
                        ) : (
                          <span className="faint">{m.referenceType ?? '—'}</span>
                        )}
                      </td>
                      <td className="muted">{m.createdBy?.name ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result && <Pagination {...result.meta} onPage={setPage} />}
          </>
        )}
      </div>
    </>
  );
}
