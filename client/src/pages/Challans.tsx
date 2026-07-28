import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pagination } from '../components/Pagination';
import { ChallanBadge, EmptyState, ErrorAlert, Loading, formatDate, inr } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useDebounced } from '../hooks/useDebounced';
import { apiPaginated, type Paginated } from '../lib/api';
import type { Challan } from '../types';

export default function ChallansPage() {
  const { can } = useAuth();

  const [result, setResult] = useState<Paginated<Challan> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setResult(
        await apiPaginated<Challan>('/api/challans', {
          query: { page, limit: 10, search: debouncedSearch, status },
        }),
      );
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Sales challans</h1>
          <p>Dispatch documents. Confirming a challan reduces warehouse stock.</p>
        </div>
        {can('SALES') && (
          <Link className="btn btn-primary" to="/challans/new">
            + New Challan
          </Link>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by challan number, customer name or mobile…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <ErrorAlert error={error} />

      <div className="card">
        {loading && !result ? (
          <Loading />
        ) : result && result.data.length === 0 ? (
          <EmptyState icon="🧾" title="No challans found" hint="Create one from the New Challan button." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Challan no.</th>
                    <th>Customer</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th className="num">Lines</th>
                    <th className="num">Qty</th>
                    <th className="num">Value</th>
                    <th>Created by</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((challan) => (
                    <tr key={challan.id}>
                      <td>
                        <Link to={`/challans/${challan.id}`} className="strong">
                          {challan.challanNumber}
                        </Link>
                      </td>
                      <td>
                        <div>{challan.customer?.businessName ?? challan.customer?.name}</div>
                        <div className="faint">{challan.customer?.mobile}</div>
                      </td>
                      <td className="muted nowrap">{formatDate(challan.createdAt)}</td>
                      <td>
                        <ChallanBadge status={challan.status} />
                      </td>
                      <td className="num muted">{challan._count?.items ?? challan.items?.length ?? 0}</td>
                      <td className="num">{challan.totalQuantity}</td>
                      <td className="num strong">{inr(challan.totalAmount)}</td>
                      <td className="muted">{challan.createdBy?.name ?? '—'}</td>
                      <td>
                        <Link className="btn btn-ghost btn-sm" to={`/challans/${challan.id}`}>
                          Open
                        </Link>
                      </td>
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
