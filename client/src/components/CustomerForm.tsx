import { useState } from 'react';
import { api } from '../lib/api';
import type { Customer } from '../types';
import { ErrorAlert, toDateInput } from './ui';

type FormState = {
  name: string;
  mobile: string;
  email: string;
  businessName: string;
  gstNumber: string;
  customerType: Customer['customerType'];
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  status: Customer['status'];
  followUpDate: string;
  notes: string;
};

function initialState(customer?: Customer): FormState {
  return {
    name: customer?.name ?? '',
    mobile: customer?.mobile ?? '',
    email: customer?.email ?? '',
    businessName: customer?.businessName ?? '',
    gstNumber: customer?.gstNumber ?? '',
    customerType: customer?.customerType ?? 'RETAIL',
    addressLine: customer?.addressLine ?? '',
    city: customer?.city ?? '',
    state: customer?.state ?? '',
    pincode: customer?.pincode ?? '',
    status: customer?.status ?? 'LEAD',
    followUpDate: toDateInput(customer?.followUpDate),
    notes: customer?.notes ?? '',
  };
}

interface Props {
  customer?: Customer;
  onSaved: (customer: Customer) => void;
  onCancel: () => void;
}

export function CustomerForm({ customer, onSaved, onCancel }: Props) {
  const [form, setForm] = useState<FormState>(initialState(customer));
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      // Empty strings are dropped so optional columns stay NULL rather than ''.
      const payload = {
        ...form,
        email: form.email || undefined,
        followUpDate: form.followUpDate ? new Date(form.followUpDate).toISOString() : null,
      };
      const saved = customer
        ? await api<Customer>(`/api/customers/${customer.id}`, { method: 'PUT', body: payload })
        : await api<Customer>('/api/customers', { method: 'POST', body: payload });
      onSaved(saved);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} id="customer-form">
      <ErrorAlert error={error} />

      <div className="form-grid">
        <div className="field">
          <label>
            Customer name <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Suresh Kumar"
            required
          />
        </div>

        <div className="field">
          <label>
            Mobile number <span className="req">*</span>
          </label>
          <input
            className="input"
            value={form.mobile}
            onChange={(e) => set('mobile', e.target.value)}
            placeholder="9876543210"
            required
          />
        </div>

        <div className="field">
          <label>Email</label>
          <input
            className="input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            placeholder="name@company.com"
          />
        </div>

        <div className="field">
          <label>Business name</label>
          <input
            className="input"
            value={form.businessName}
            onChange={(e) => set('businessName', e.target.value)}
            placeholder="Shree Traders"
          />
        </div>

        <div className="field">
          <label>GST number</label>
          <input
            className="input"
            value={form.gstNumber}
            onChange={(e) => set('gstNumber', e.target.value.toUpperCase())}
            placeholder="27AABCS1429B1ZQ"
          />
        </div>

        <div className="field">
          <label>Customer type</label>
          <select
            className="select"
            value={form.customerType}
            onChange={(e) => set('customerType', e.target.value as FormState['customerType'])}
          >
            <option value="RETAIL">Retail</option>
            <option value="WHOLESALE">Wholesale</option>
            <option value="DISTRIBUTOR">Distributor</option>
          </select>
        </div>

        <div className="field">
          <label>Status</label>
          <select
            className="select"
            value={form.status}
            onChange={(e) => set('status', e.target.value as FormState['status'])}
          >
            <option value="LEAD">Lead</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        <div className="field">
          <label>Next follow-up date</label>
          <input
            className="input"
            type="date"
            value={form.followUpDate}
            onChange={(e) => set('followUpDate', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Address</label>
        <input
          className="input"
          value={form.addressLine}
          onChange={(e) => set('addressLine', e.target.value)}
          placeholder="14 MG Road"
        />
      </div>

      <div className="form-grid">
        <div className="field">
          <label>City</label>
          <input className="input" value={form.city} onChange={(e) => set('city', e.target.value)} />
        </div>
        <div className="field">
          <label>State</label>
          <input className="input" value={form.state} onChange={(e) => set('state', e.target.value)} />
        </div>
        <div className="field">
          <label>Pincode</label>
          <input
            className="input"
            value={form.pincode}
            onChange={(e) => set('pincode', e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label>Notes</label>
        <textarea
          className="textarea"
          value={form.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Credit terms, delivery preferences, anything the team should know…"
        />
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : customer ? 'Save changes' : 'Add customer'}
        </button>
      </div>
    </form>
  );
}
