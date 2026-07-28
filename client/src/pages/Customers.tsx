import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerForm } from '../components/CustomerForm';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { EmptyState, ErrorAlert, Loading, StatusBadge, TypeBadge, formatDate } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useDebounced } from '../hooks/useDebounced';
import { apiPaginated, type Paginated } from '../lib/api';
import type { Customer } from '../types';

export default function CustomersPage() {
  const { can } = useAuth();
  const { notify } = useToast();

  const [result, setResult] = useState<Paginated<Customer> | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [customerType, setCustomerType] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebounced(search);

  const [editing, setEditing] = useState<Customer | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiPaginated<Customer>('/api/customers', {
        query: { page, limit: 10, search: debouncedSearch, status, customerType },
      });
      setResult(data);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, customerType]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, customerType]);

  const canWrite = can('SALES');

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Customers</h1>
          <p>Leads, active accounts and follow-up history.</p>
        </div>
        {canWrite && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + Add Customer
          </button>
        )}
      </div>

      <div className="toolbar">
        <input
          className="input search"
          placeholder="Search by name, mobile, business, email or GST…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="LEAD">Lead</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select className="select" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
          <option value="">All types</option>
          <option value="RETAIL">Retail</option>
          <option value="WHOLESALE">Wholesale</option>
          <option value="DISTRIBUTOR">Distributor</option>
        </select>
        {(search || status || customerType) && (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setSearch('');
              setStatus('');
              setCustomerType('');
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      <ErrorAlert error={error} />

      <div className="card">
        {loading && !result ? (
          <Loading />
        ) : result && result.data.length === 0 ? (
          <EmptyState
            icon="👥"
            title="No customers match this view"
            hint={search || status ? 'Try clearing the filters.' : 'Add your first customer to get started.'}
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Contact</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Follow-up</th>
                    <th className="num">Challans</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {result?.data.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link to={`/customers/${customer.id}`} className="strong">
                          {customer.name}
                        </Link>
                        <div className="faint">{customer.businessName ?? '—'}</div>
                      </td>
                      <td>
                        <div>{customer.mobile}</div>
                        <div className="faint">{customer.email ?? '—'}</div>
                      </td>
                      <td>
                        <TypeBadge type={customer.customerType} />
                      </td>
                      <td>
                        <StatusBadge status={customer.status} />
                      </td>
                      <td className="nowrap muted">{formatDate(customer.followUpDate)}</td>
                      <td className="num muted">{customer._count?.challans ?? 0}</td>
                      <td className="nowrap">
                        <Link className="btn btn-ghost btn-sm" to={`/customers/${customer.id}`}>
                          View
                        </Link>
                        {canWrite && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditing(customer)}>
                            Edit
                          </button>
                        )}
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

      {creating && (
        <Modal title="Add customer" onClose={() => setCreating(false)}>
          <CustomerForm
            onCancel={() => setCreating(false)}
            onSaved={() => {
              setCreating(false);
              notify('Customer added');
              load();
            }}
          />
        </Modal>
      )}

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <CustomerForm
            customer={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => {
              setEditing(null);
              notify('Customer updated');
              load();
            }}
          />
        </Modal>
      )}
    </>
  );
}
