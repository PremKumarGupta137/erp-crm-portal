import type { ChallanStatus, CustomerStatus, CustomerType, MovementType, Role } from '../types';

/* ---------------- formatting helpers ---------------- */

export const inr = (value: string | number | null | undefined) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));

export const formatDate = (value: string | null | undefined) =>
  value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const formatDateTime = (value: string | null | undefined) =>
  value
    ? new Date(value).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

/** Value for a <input type="date"> from an ISO timestamp. */
export const toDateInput = (value: string | null | undefined) =>
  value ? new Date(value).toISOString().slice(0, 10) : '';

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

/* ---------------- badges ---------------- */

const customerStatusTone: Record<CustomerStatus, string> = {
  LEAD: 'badge-amber',
  ACTIVE: 'badge-green',
  INACTIVE: 'badge-slate',
};

const challanStatusTone: Record<ChallanStatus, string> = {
  DRAFT: 'badge-amber',
  CONFIRMED: 'badge-green',
  CANCELLED: 'badge-red',
};

const roleTone: Record<Role, string> = {
  ADMIN: 'badge-blue',
  SALES: 'badge-green',
  WAREHOUSE: 'badge-amber',
  ACCOUNTS: 'badge-slate',
};

export const StatusBadge = ({ status }: { status: CustomerStatus }) => (
  <span className={`badge ${customerStatusTone[status]}`}>{status}</span>
);

export const ChallanBadge = ({ status }: { status: ChallanStatus }) => (
  <span className={`badge ${challanStatusTone[status]}`}>{status}</span>
);

export const RoleBadge = ({ role }: { role: Role }) => (
  <span className={`badge ${roleTone[role]}`}>{role}</span>
);

export const TypeBadge = ({ type }: { type: CustomerType }) => (
  <span className="badge badge-slate">{type}</span>
);

export const MovementBadge = ({ type }: { type: MovementType }) => (
  <span className={`badge ${type === 'IN' ? 'badge-green' : 'badge-red'}`}>
    {type === 'IN' ? '↑ IN' : '↓ OUT'}
  </span>
);

export function StockBadge({ stock, min }: { stock: number; min: number }) {
  if (stock <= 0) return <span className="badge badge-red">Out of stock</span>;
  if (stock <= min) return <span className="badge badge-amber">Low · {stock}</span>;
  return <span className="badge badge-green">{stock}</span>;
}

/* ---------------- states ---------------- */

export const Loading = ({ label = 'Loading…' }: { label?: string }) => (
  <div className="loading-row">
    <div className="spinner" />
    <span>{label}</span>
  </div>
);

export const EmptyState = ({
  icon = '∅',
  title,
  hint,
}: {
  icon?: string;
  title: string;
  hint?: string;
}) => (
  <div className="empty">
    <div className="empty-icon">{icon}</div>
    <div className="strong">{title}</div>
    {hint && <div className="faint" style={{ marginTop: 4 }}>{hint}</div>}
  </div>
);

/** Renders the API's message plus any per-field validation details. */
export function ErrorAlert({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  const details = (error as { details?: { field: string; message: string }[] }).details;
  return (
    <div className="alert alert-error">
      <div>{message}</div>
      {details?.length ? (
        <ul>
          {details.map((d, i) => (
            <li key={i}>
              <strong>{d.field}</strong>: {d.message}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
