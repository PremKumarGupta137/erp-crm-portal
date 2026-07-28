import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerForm } from '../components/CustomerForm';
import { Modal } from '../components/Modal';
import {
  ChallanBadge,
  EmptyState,
  ErrorAlert,
  Loading,
  StatusBadge,
  TypeBadge,
  formatDate,
  formatDateTime,
  inr,
} from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Customer } from '../types';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { notify } = useToast();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [editing, setEditing] = useState(false);
  const [addingNote, setAddingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      setCustomer(await api<Customer>(`/api/customers/${id}`));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorAlert error={error} />;
  if (!customer) return <Loading />;

  const canWrite = can('SALES');
  const address = [customer.addressLine, customer.city, customer.state, customer.pincode]
    .filter(Boolean)
    .join(', ');

  return (
    <>
      <div className="page-head">
        <div>
          <Link to="/customers" className="faint">
            ← Back to customers
          </Link>
          <h1 style={{ marginTop: 6 }}>{customer.name}</h1>
          <p>
            {customer.businessName ?? 'No business name'} · added {formatDate(customer.createdAt)} by{' '}
            {customer.createdBy?.name ?? 'system'}
          </p>
        </div>
        <div className="row">
          <StatusBadge status={customer.status} />
          <TypeBadge type={customer.customerType} />
          {canWrite && (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(true)}>
                Edit
              </button>
              <button className="btn btn-primary" onClick={() => setAddingNote(true)}>
                + Follow-up
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-2">
        <div className="stack">
          <div className="card">
            <div className="card-head">
              <h3>Contact & business details</h3>
            </div>
            <div className="card-body">
              <div className="detail-grid">
                <div className="detail-item">
                  <div className="k">Mobile</div>
                  <div className="v">{customer.mobile}</div>
                </div>
                <div className="detail-item">
                  <div className="k">Email</div>
                  <div className="v">{customer.email ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="k">GST number</div>
                  <div className="v">{customer.gstNumber ?? '—'}</div>
                </div>
                <div className="detail-item">
                  <div className="k">Next follow-up</div>
                  <div className="v">{formatDate(customer.followUpDate)}</div>
                </div>
                <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="k">Address</div>
                  <div className="v">{address || '—'}</div>
                </div>
                {customer.notes && (
                  <div className="detail-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="k">Notes</div>
                    <div className="v">{customer.notes}</div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Recent challans</h3>
            </div>
            {!customer.challans?.length ? (
              <EmptyState icon="🧾" title="No challans for this customer yet" />
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Challan</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th className="num">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customer.challans.map((c) => (
                      <tr key={c.id}>
                        <td>
                          <Link to={`/challans/${c.id}`} className="strong">
                            {c.challanNumber}
                          </Link>
                        </td>
                        <td className="muted nowrap">{formatDate(c.createdAt)}</td>
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

        <div className="card">
          <div className="card-head">
            <h3>Follow-up history</h3>
            <span className="faint">{customer.followUps?.length ?? 0} entries</span>
          </div>
          <div className="card-body">
            {!customer.followUps?.length ? (
              <EmptyState icon="💬" title="No follow-ups logged" hint="Every call or visit can be recorded here." />
            ) : (
              <div className="timeline">
                {customer.followUps.map((f) => (
                  <div className="timeline-item" key={f.id}>
                    <div className="timeline-dot" />
                    <div style={{ minWidth: 0 }}>
                      <div>{f.note}</div>
                      <div className="faint" style={{ marginTop: 3 }}>
                        {formatDateTime(f.createdAt)} · {f.createdBy?.name ?? 'system'}
                        {f.followUpDate && ` · next: ${formatDate(f.followUpDate)}`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {editing && (
        <Modal title={`Edit ${customer.name}`} onClose={() => setEditing(false)}>
          <CustomerForm
            customer={customer}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false);
              notify('Customer updated');
              load();
            }}
          />
        </Modal>
      )}

      {addingNote && (
        <FollowUpModal
          customer={customer}
          onClose={() => setAddingNote(false)}
          onSaved={() => {
            setAddingNote(false);
            notify('Follow-up added');
            load();
          }}
        />
      )}
    </>
  );
}

function FollowUpModal({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [note, setNote] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [status, setStatus] = useState<Customer['status']>(customer.status);
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api(`/api/customers/${customer.id}/follow-ups`, {
        method: 'POST',
        body: {
          note,
          followUpDate: followUpDate ? new Date(followUpDate).toISOString() : null,
          status,
        },
      });
      onSaved();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Add follow-up" onClose={onClose} size="sm">
      <form onSubmit={submit}>
        <ErrorAlert error={error} />
        <div className="field">
          <label>
            What happened? <span className="req">*</span>
          </label>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Called about the pending rate revision…"
            required
          />
        </div>
        <div className="field">
          <label>Next follow-up date</label>
          <input
            className="input"
            type="date"
            value={followUpDate}
            onChange={(e) => setFollowUpDate(e.target.value)}
          />
        </div>
        <div className="field">
          <label>Update status to</label>
          <select
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as Customer['status'])}
          >
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Add follow-up'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
