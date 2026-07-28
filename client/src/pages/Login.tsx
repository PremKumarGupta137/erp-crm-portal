import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { ErrorAlert } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@erpcrm.com', password: 'Admin@123' },
  { role: 'Sales', email: 'sales@erpcrm.com', password: 'Sales@123' },
  { role: 'Warehouse', email: 'warehouse@erpcrm.com', password: 'Warehouse@123' },
  { role: 'Accounts', email: 'accounts@erpcrm.com', password: 'Accounts@123' },
];

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('admin@erpcrm.com');
  const [password, setPassword] = useState('Admin@123');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to="/" replace />;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-hero">
        <div className="sidebar-logo" style={{ width: 38, height: 38, marginBottom: 22 }}>
          EC
        </div>
        <h2>Operations portal for wholesale distribution</h2>
        <p>
          One place for the sales, warehouse and accounts teams to manage customers, stock and
          dispatch documents — with every stock movement recorded.
        </p>
        <div className="login-features">
          <div className="login-feature">
            <span>▸</span>
            <span>Customer CRM with follow-up history and lead pipeline</span>
          </div>
          <div className="login-feature">
            <span>▸</span>
            <span>Product catalogue with low-stock alerts and a full movement ledger</span>
          </div>
          <div className="login-feature">
            <span>▸</span>
            <span>Sales challans that reduce stock atomically and never go negative</span>
          </div>
          <div className="login-feature">
            <span>▸</span>
            <span>Role-based access for Admin, Sales, Warehouse and Accounts</span>
          </div>
        </div>
      </div>

      <div className="login-panel">
        <form className="login-form" onSubmit={onSubmit}>
          <h1>Sign in</h1>
          <p>Use one of the demo accounts below to explore the portal.</p>

          <ErrorAlert error={error} />

          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="demo-creds">
            <h4>Demo accounts — click to fill</h4>
            {DEMO_ACCOUNTS.map((account) => (
              <div className="demo-row" key={account.email}>
                <div>
                  <div className="strong">{account.role}</div>
                  <code>{account.email}</code>
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEmail(account.email);
                    setPassword(account.password);
                  }}
                >
                  Use
                </button>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
