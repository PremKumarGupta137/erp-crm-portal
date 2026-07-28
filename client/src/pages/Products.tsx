import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorAlert, Loading, StockBadge, inr } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounced } from '../hooks/useDebounced';
import { api, apiPaginated, type Paginated } from '../lib/api';
import type { Product } from '../types';

export default function ProductsPage() {
  const { can } = useAuth();
  const { notify } = useToast();
  const [searchParams] = useSearchParams();

  const [result, setResult] = useState<Paginated<Product> | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [lowStock, setLowStock] = useState(searchParams.get('lowStock') === 'true');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [adjusting, setAdjusting] = useState<Product | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiPaginated<Product>('/api/products', {
        query: { page, limit: 10, search: debouncedSearch, category, lowStock: lowStock ? 'true' : '' },
      });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, category, lowStock]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api<string[]>('/api/products/categories').then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, category, lowStock]);

  const canWrite = can('WAREHOUSE');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Products</h1>
          <p>Catalogue, pricing and live stock levels.</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Add Product
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by name, SKU or category…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <button
          className={`btn btn-sm ${lowStock ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setLowStock((v) => !v)}
        >
          ⚠ Low stock only
        </button>
      </div>

      <ErrorAlert error={error} />

      <div className="card">
        {loading && !result ? (
          <Loading />
        ) : result && result.data.length === 0 ? (
          <EmptyState icon="📦" title="No products found" hint="Adjust the filters or add a product." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Location</th>
                    <th className="num">Unit price</th>
                    <th>Stock</th>
                    <th className="num">Alert at</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <Link to={`/products/${product.id}`} className="strong">
                          {product.name}
                        </Link>
                        <div className="faint">{product.sku}</div>
                      </td>
                      <td className="muted">{product.category}</td>
                      <td className="muted">{product.location ?? '—'}</td>
                      <td className="num">{inr(product.unitPrice)}</td>
                      <td>
                        <StockBadge stock={product.currentStock} min={product.minStockAlert} />
                      </td>
                      <td className="num muted">{product.minStockAlert}</td>
                      <td className="nowrap">
                        {canWrite && (
                          <>
                            <button className="btn btn-ghost btn-sm" onClick={() => setAdjusting(product)}>
                              Stock
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(product)}>
                              Edit
                            </button>
                          </>
                        )}
                        <Link className="btn btn-ghost btn-sm" to={`/products/${product.id}`}>
                          View
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

      {(creating || editing) && (
        <Modal
          title={editing ? `Edit ${editing.name}` : 'Add product'}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <ProductForm
            product={editing ?? undefined}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
            onSaved={() => {
              setCreating(false);
              setEditing(null);
              notify(editing ? 'Product updated' : 'Product added');
              load();
            }}
          />
        </Modal>
      )}

      {adjusting && (
        <StockAdjustModal
          product={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            notify('Stock updated');
            load();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */

export function ProductForm({
  product,
  onSaved,
  onCancel,
}: {
  product?: Product;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? '',
    sku: product?.sku ?? '',
    category: product?.category ?? '',
    unitPrice: product?.unitPrice ?? '',
    currentStock: String(product?.currentStock ?? 0),
    minStockAlert: String(product?.minStockAlert ?? 0),
    location: product?.location ?? '',
  });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unitPrice: Number(form.unitPrice),
        minStockAlert: Number(form.minStockAlert),
        location: form.location || undefined,
        // Opening stock is only meaningful on create — afterwards stock changes
        // must go through the stock movement endpoint so the ledger stays honest.
        ...(product ? {} : { currentStock: Number(form.currentStock) }),
      };
      if (product) {
        await api(`/api/products/${product.id}`, { method: 'PUT', body: payload });
      } else {
        await api('/api/products', { method: 'POST', body: payload });
      }
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit}>
      <ErrorAlert error={error} />

      <div className="form-grid">
        <div className="field">
          <label>
            Product name <span className="req">*</span>
          </label>
          <input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} required />
        </div>
        <div className="field">
          <label>
            SKU / code <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.sku}
            onChange={(e) => set('sku', e.target.value.toUpperCase())}
            placeholder="OIL-SF-1L"
            disabled={!!product}
            required
          />
          {product && <div className="faint">SKU cannot be changed after creation.</div>}
        </div>
        <div className="field">
          <label>
            Category <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.category}
            onChange={(e) => set('category', e.target.value)}
            placeholder="Staples"
            required
          />
        </div>
        <div className="field">
          <label>
            Unit price (₹) <span className="req">*</span>
          </label>
          <input
            className="input"
            type="number"
            step="0.01"
            min="0"
            value={form.unitPrice}
            onChange={(e) => set('unitPrice', e.target.value)}
            required
          />
        </div>
        {!product && (
          <div className="field">
            <label>Opening stock</label>
            <input
              className="input"
              type="number"
              min="0"
              value={form.currentStock}
              onChange={(e) => set('currentStock', e.target.value)}
            />
          </div>
        )}
        <div className="field">
          <label>Minimum stock alert</label>
          <input
            className="input"
            type="number"
            min="0"
            value={form.minStockAlert}
            onChange={(e) => set('minStockAlert', e.target.value)}
          />
        </div>
        <div className="field">
          <label>Warehouse location</label>
          <input
            className="input"
            value={form.location}
            onChange={(e) => set('location', e.target.value)}
            placeholder="Rack A1"
          />
        </div>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function StockAdjustModal({
  product,
  onClose,
  onSaved,
}: {
  product: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const projected = product.currentStock + (type === 'IN' ? Number(quantity) : -Number(quantity));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/products/${product.id}/stock`, {
        method: 'POST',
        body: { type, quantity: Number(quantity), reason },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title={`Adjust stock — ${product.name}`} onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <ErrorAlert error={error} />

        <div className="alert alert-info">
          Current stock: <strong>{product.currentStock}</strong> · after this movement:{' '}
          <strong style={{ color: projected < 0 ? 'var(--red)' : undefined }}>
            {Number.isFinite(projected) ? projected : '—'}
          </strong>
        </div>

        <div className="field">
          <label>Movement type</label>
          <select className="select" value={type} onChange={(e) => setType(e.target.value as 'IN' | 'OUT')}>
            <option value="IN">IN — stock received</option>
            <option value="OUT">OUT — stock issued / damaged</option>
          </select>
        </div>
        <div className="field">
          <label>
            Quantity <span className="req">*</span>
          </label>
          <input
            className="input"
            type="number"
            min="1"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label>
            Reason <span className="req">*</span>
          </label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Purchase order received / damaged in transit"
            required
          />
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving || projected < 0}>
            {saving ? 'Saving…' : 'Record movement'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
