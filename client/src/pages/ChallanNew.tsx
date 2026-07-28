import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorAlert, Loading, inr } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api, apiPaginated } from '../lib/api';
import type { Challan, Customer, Product } from '../types';

interface Line {
  productId: string;
  quantity: number;
}

export default function ChallanNewPage() {
  const navigate = useNavigate();
  const { notify } = useToast();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ready, setReady] = useState(false);

  const [customerId, setCustomerId] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([{ productId: '', quantity: 1 }]);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState<'DRAFT' | 'CONFIRMED' | null>(null);

  // The dropdowns need the full lists, so ask for a large page rather than paginating.
  useEffect(() => {
    Promise.all([
      apiPaginated<Customer>('/api/customers', { query: { limit: 100, sort: 'name', order: 'asc' } }),
      apiPaginated<Product>('/api/products', { query: { limit: 100, sort: 'name', order: 'asc' } }),
    ])
      .then(([c, p]) => {
        setCustomers(c.data);
        setProducts(p.data.filter((product) => product.isActive));
      })
      .catch(setError)
      .finally(() => setReady(true));
  }, []);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const selectedCustomer = customers.find((c) => c.id === customerId);

  const rows = lines.map((line) => {
    const product = productById.get(line.productId);
    const unitPrice = Number(product?.unitPrice ?? 0);
    return {
      ...line,
      product,
      lineTotal: unitPrice * line.quantity,
      // Warn before submitting rather than making the user hit the API error.
      shortBy: product ? Math.max(0, line.quantity - product.currentStock) : 0,
    };
  });

  const totalQuantity = rows.reduce((sum, r) => sum + (r.product ? r.quantity : 0), 0);
  const totalAmount = rows.reduce((sum, r) => sum + r.lineTotal, 0);
  const hasShortage = rows.some((r) => r.shortBy > 0);
  const validLines = rows.filter((r) => r.product && r.quantity > 0);
  const duplicateProduct =
    new Set(validLines.map((r) => r.productId)).size !== validLines.length;

  const canSubmit = !!customerId && validLines.length > 0 && !duplicateProduct && !saving;

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  async function submit(status: 'DRAFT' | 'CONFIRMED') {
    setSaving(status);
    setError(null);
    try {
      const challan = await api<Challan>('/api/challans', {
        method: 'POST',
        body: {
          customerId,
          status,
          notes: notes || undefined,
          items: validLines.map((r) => ({ productId: r.productId, quantity: r.quantity })),
        },
      });
      notify(status === 'CONFIRMED' ? 'Challan confirmed — stock reduced' : 'Draft challan saved');
      navigate(`/challans/${challan.id}`);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(null);
    }
  }

  if (!ready) return <Loading label="Loading customers and products…" />;

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/challans" className="faint">
            ← Back to challans
          </Link>
          <h1 style={{ marginTop: 6 }}>New sales challan</h1>
          <p>Save as a draft to review later, or confirm now to dispatch and reduce stock.</p>
        </div>
      </div>

      <ErrorAlert error={error} />

      <div className="grid grid-2">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>1 · Customer</h3>
            </div>
            <div className="card-body">
              <div className="field mb-0">
                <label>
                  Select customer <span className="req">*</span>
                </label>
                <select
                  className="select"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">— Choose a customer —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.businessName ? ` · ${c.businessName}` : ''} ({c.mobile})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCustomer && (
                <div className="alert alert-info" style={{ marginTop: 14, marginBottom: 0 }}>
                  <div className="strong">{selectedCustomer.businessName ?? selectedCustomer.name}</div>
                  <div>
                    {selectedCustomer.mobile}
                    {selectedCustomer.gstNumber && ` · GST ${selectedCustomer.gstNumber}`}
                  </div>
                  <div className="faint">
                    {[
                      selectedCustomer.addressLine,
                      selectedCustomer.city,
                      selectedCustomer.state,
                      selectedCustomer.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ') || 'No address on file'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>3 · Notes</h3>
            </div>
            <div className="card-body">
              <textarea
                className="textarea"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Transport details, delivery instructions…"
              />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h3>2 · Products</h3>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setLines((c) => [...c, { productId: '', quantity: 1 }])}
            >
              + Add line
            </button>
          </div>
          <div className="card-body">
            {duplicateProduct && (
              <div className="alert alert-error">
                The same product appears on more than one line — increase the quantity instead.
              </div>
            )}

            <div className="stack">
              {rows.map((row, index) => (
                <div key={index} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <select
                      className="select"
                      value={row.productId}
                      onChange={(e) => updateLine(index, { productId: e.target.value })}
                    >
                      <option value="">— Select product —</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku}) · {p.currentStock} in stock
                        </option>
                      ))}
                    </select>
                    {row.product && (
                      <div className="faint" style={{ marginTop: 4 }}>
                        {inr(row.product.unitPrice)} / unit · {row.product.currentStock} available
                        {row.shortBy > 0 && (
                          <span style={{ color: 'var(--red)', fontWeight: 600 }}>
                            {' '}
                            · short by {row.shortBy}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <input
                    className={`input ${row.shortBy > 0 ? 'invalid' : ''}`}
                    style={{ width: 84 }}
                    type="number"
                    min="1"
                    value={row.quantity}
                    onChange={(e) => updateLine(index, { quantity: Math.max(1, Number(e.target.value)) })}
                  />

                  <div style={{ width: 96, textAlign: 'right', paddingTop: 8 }} className="strong">
                    {inr(row.lineTotal)}
                  </div>

                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 3 }}
                    disabled={lines.length === 1}
                    onClick={() => setLines((c) => c.filter((_, i) => i !== index))}
                    aria-label="Remove line"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <div
              className="row-between"
              style={{ marginTop: 18, paddingTop: 14, borderTop: '2px solid var(--border-strong)' }}
            >
              <div>
                <div className="faint">Total quantity</div>
                <div className="strong" style={{ fontSize: 18 }}>
                  {totalQuantity}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="faint">Total value</div>
                <div className="strong" style={{ fontSize: 18 }}>
                  {inr(totalAmount)}
                </div>
              </div>
            </div>

            {hasShortage && (
              <div className="alert alert-error" style={{ marginTop: 14, marginBottom: 0 }}>
                One or more lines exceed available stock. You can still save this as a draft — the
                server will reject confirmation until stock is available.
              </div>
            )}

            <div className="form-actions" style={{ marginTop: 16 }}>
              <button
                className="btn btn-secondary"
                disabled={!canSubmit}
                onClick={() => submit('DRAFT')}
              >
                {saving === 'DRAFT' ? 'Saving…' : 'Save as draft'}
              </button>
              <button
                className="btn btn-primary"
                disabled={!canSubmit || hasShortage}
                onClick={() => submit('CONFIRMED')}
              >
                {saving === 'CONFIRMED' ? 'Confirming…' : 'Confirm & reduce stock'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
