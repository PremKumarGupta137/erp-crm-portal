import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  EmptyState,
  ErrorAlert,
  Loading,
  MovementBadge,
  StockBadge,
  formatDateTime,
  inr,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Product } from '../types';
import { StockAdjustModal } from './Products';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { notify } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [adjusting, setAdjusting] = useState(false);

  const load = useCallback(async () => {
    try {
      setProduct(await api<Product>(`/api/products/${id}`));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorAlert error={error} />;
  if (!product) return <Loading />;

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/products" className="faint">
            ← Back to products
          </Link>
          <h1 style={{ marginTop: 6 }}>{product.name}</h1>
          <p>
            {product.sku} · {product.category}
          </p>
        </div>
        <div className="row">
          <StockBadge stock={product.currentStock} min={product.minStockAlert} />
          {can('WAREHOUSE') && (
            <button className="btn btn-primary" onClick={() => setAdjusting(true)}>
              Adjust stock
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-label">Current stock</div>
          <div
            className="stat-value"
            style={{ color: product.currentStock <= product.minStockAlert ? 'var(--red)' : undefined }}
          >
            {product.currentStock}
          </div>
          <div className="stat-hint">Alert threshold: {product.minStockAlert}</div>
        </div>
        <div className="stat">
          <div className="stat-label">Unit price</div>
          <div className="stat-value">{inr(product.unitPrice)}</div>
          <div className="stat-hint">per unit</div>
        </div>
        <div className="stat">
          <div className="stat-label">Stock value</div>
          <div className="stat-value">{inr(Number(product.unitPrice) * product.currentStock)}</div>
          <div className="stat-hint">at current price</div>
        </div>
        <div className="stat">
          <div className="stat-label">Location</div>
          <div className="stat-value" style={{ fontSize: 20 }}>
            {product.location ?? '—'}
          </div>
          <div className="stat-hint">warehouse position</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>Stock movement ledger</h3>
          <span className="faint">Last {product.stockMovements?.length ?? 0} movements</span>
        </div>
        {!product.stockMovements?.length ? (
          <EmptyState icon="⇅" title="No movements recorded" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Type</th>
                  <th className="num">Quantity</th>
                  <th>Reason</th>
                  <th>Reference</th>
                  <th>Created by</th>
                </tr>
              </thead>
              <tbody>
                {product.stockMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="muted nowrap">{formatDateTime(m.createdAt)}</td>
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
        )}
      </div>

      {adjusting && (
        <StockAdjustModal
          product={product}
          onClose={() => setAdjusting(false)}
          onSaved={() => {
            setAdjusting(false);
            notify('Stock updated');
            load();
          }}
        />
      )}
    </>
  );
}
