import { useCallback, useEffect, useState } from 'react';
import { Modal } from '../components/Modal';
import { ErrorAlert, Loading, RoleBadge, formatDate } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Role, User } from '../types';

const ROLE_CAPABILITIES: { role: Role; can: string }[] = [
  { role: 'ADMIN', can: 'Full access to every module, plus user management' },
  { role: 'SALES', can: 'Create/edit customers and follow-ups, create and confirm challans' },
  { role: 'WAREHOUSE', can: 'Create/edit products, adjust stock, confirm and cancel challans' },
  { role: 'ACCOUNTS', can: 'Read-only across customers, products and challans' },
];

export default function UsersPage() {
  const { notify } = useToast();
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      setUsers(await api<User[]>('/api/auth/users'));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Users &amp; roles</h1>
          <p>Role-based access control. Admins can provision new accounts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setCreating(true)}>
          + Add User
        </button>
      </div>

      <ErrorAlert error={error} />

      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">
            <h3>Accounts</h3>
          </div>
          {!users ? (
            <Loading />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Added</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="strong">{user.name}</td>
                      <td className="muted">{user.email}</td>
                      <td>
                        <RoleBadge role={user.role} />
                      </td>
                      <td className="muted nowrap">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h3>What each role can do</h3>
          </div>
          <div className="card-body">
            <div className="timeline">
              {ROLE_CAPABILITIES.map((entry) => (
                <div className="timeline-item" key={entry.role}>
                  <div className="timeline-dot" />
                  <div>
                    <RoleBadge role={entry.role} />
                    <div style={{ marginTop: 4 }}>{entry.can}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="faint" style={{ marginTop: 12 }}>
              These rules are enforced on the server by the <code>requireRole</code> middleware — the
              UI only hides buttons, it is not the security boundary.
            </div>
          </div>
        </div>
      </div>

      {creating && (
        <Modal title="Add user" onClose={() => setCreating(false)} size="sm">
          <UserForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              notify('User created');
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}

function UserForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'SALES' as Role });
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api('/api/auth/register', { method: 'POST', body: form });
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
      <div className="field">
        <label>
          Full name <span className="req">*</span>
        </label>
        <input
          className="input"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
      </div>
      <div className="field">
        <label>
          Email <span className="req">*</span>
        </label>
        <input
          className="input"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          required
        />
      </div>
      <div className="field">
        <label>
          Password <span className="req">*</span>
        </label>
        <input
          className="input"
          type="password"
          minLength={6}
          value={form.password}
          onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
          required
        />
      </div>
      <div className="field">
        <label>Role</label>
        <select
          className="select"
          value={form.role}
          onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
        >
          <option value="ADMIN">Admin</option>
          <option value="SALES">Sales</option>
          <option value="WAREHOUSE">Warehouse</option>
          <option value="ACCOUNTS">Accounts</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  );
}
