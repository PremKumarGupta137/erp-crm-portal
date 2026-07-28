import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ChallanBadge,
  EmptyState,
  ErrorAlert,
  Loading,
  MovementBadge,
  formatDate,
  formatDateTime,
  inr,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import type { DashboardSummary } from '../types';

export default function DashboardPage() {
  const { user } = useAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    api<DashboardSummary>('/api/dashboard/summary').then(setSummary).catch(setError);
  }, []);

  if (error) return <ErrorAlert error={error} />;
  if (!summary) return <Loading label="Loading dashboard…" />;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Welcome back, {user?.name.split(' ')[0]}</h1>
          <p>Here is what is happening across sales, inventory and CRM today.</p>
        </div>
        <Link className="btn btn-primary" to="/challans/new">
          + New Challan
        </Link>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 16 }}>
        <div className="stat">
          <div className="stat-label">Customers</div>
          <div className="stat-value">{summary.customers.total}</div>
          <div className="stat-hint">
            {summary.customers.active} active · {summary.customers.leads} leads
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Products</div>
          <div className="stat-value">{summary.products.total}</div>
          <div className="stat-hint">{summary.products.inventoryUnits.toLocaleString('en-IN')} units in stock</div>
        </div>
        <div className="stat">
          <div className="stat-label">Confirmed Sales</div>
          <div className="stat-value">{inr(summary.challans.confirmedValue)}</div>
          <div className="stat-hint">
            {summary.challans.confirmed} challans · {summary.challans.confirmedUnits} units dispatched
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Needs Attention</div>
          <div className="stat-value" style={{ color: summary.products.lowStockCount ? 'var(--red)' : undefined }}>
            {summary.products.lowStockCount + summary.challans.draft}
          </div>
          <div className="stat-hint">
            {summary.products.lowStockCount} low stock · {summary.challans.draft} draft challans
          </div>
        </div>
      </div>

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Low stock alerts</h3>
            <Link to="/products?lowStock=true" className="faint">
              View all →
            </Link>
          </div>
          {summary.lowStockProducts.length === 0 ? (
            <EmptyState icon="✓" title="Every product is above its alert level" />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Location</th>
                    <th className="num">Stock</th>
                    <th className="num">Alert at</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStockProducts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <Link to={`/products/${p.id}`} className="strong">
                          {p.name}
                        </Link>
                        <div className="faint">{p.sku}</div>
                      </td>
                      <td className="muted">{p.location ?? '—'}</td>
                      <td className="num strong" style={{ color: 'var(--red)' }}>
                        {p.currentStock}
                      </td>
                      <td className="num muted">{p.minStockAlert}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>Recent challans</h3>
            <Link to="/challans" className="faint">
              View all →
            </Link>
          </div>
          {summary.recentChallans.length === 0 ? (
            <EmptyState icon="🧾" title="No challans yet" hint="Create one from the Sales section." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Challan</th>
                    <th>Customer</th>
                    <th>Status</th>
                    <th className="num">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentChallans.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/challans/${c.id}`} className="strong">
                          {c.challanNumber}
                        </Link>
                        <div className="faint">{formatDate(c.createdAt)}</div>
                      </td>
                      <td>{c.customer.businessName ?? c.customer.name}</td>
                      <td>
                        <ChallanBadge status={c.status} />
                      </td>
                      <td className="num">{inr(c.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-head">
          <h3>Latest stock movements</h3>
          <Link to="/stock" className="faint">
            Full ledger →
          </Link>
        </div>
        {summary.recentMovements.length === 0 ? (
          <EmptyState icon="⇅" title="No stock movements recorded yet" />
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Product</th>
                  <th>Type</th>
                  <th className="num">Qty</th>
                  <th>Reason</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentMovements.map((m) => (
                  <tr key={m.id}>
                    <td className="muted nowrap">{formatDateTime(m.createdAt)}</td>
                    <td>
                      <span className="strong">{m.product?.name}</span>
                      <div className="faint">{m.product?.sku}</div>
                    </td>
                    <td>
                      <MovementBadge type={m.type} />
                    </td>
                    <td className="num strong">{m.quantity}</td>
                    <td className="muted">{m.reason}</td>
                    <td className="muted">{m.createdBy?.name ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
