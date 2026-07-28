import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Modal } from '../components/Modal';
import { ChallanBadge, ErrorAlert, Loading, formatDateTime, inr } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../lib/api';
import type { Challan } from '../types';

export default function ChallanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { can } = useAuth();
  const { notify, notifyError } = useToast();

  const [challan, setChallan] = useState<Challan | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<null | 'confirm' | 'cancel'>(null);

  const load = useCallback(async () => {
    try {
      setChallan(await api<Challan>(`/api/challans/${id}`));
      setError(null);
    } catch (err) {
      setError(err);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function runAction(action: 'confirm' | 'cancel') {
    setBusy(true);
    setActionError(null);
    try {
      await api(`/api/challans/${id}/${action}`, { method: 'POST' });
      notify(action === 'confirm' ? 'Challan confirmed — stock reduced' : 'Challan cancelled');
      setConfirmDialog(null);
      await load();
    } catch (err) {
      setActionError(err);
      notifyError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <ErrorAlert error={error} />;
  if (!challan) return <Loading />;

  const snapshot = challan.customerSnapshot;
  const canAct = can('SALES', 'WAREHOUSE');

  return (
    <>
      <div className="page-head no-print">
        <div>
          <Link to="/challans" className="faint">
            ← Back to challans
          </Link>
          <h1 style={{ marginTop: 6 }}>{challan.challanNumber}</h1>
          <p>
            Created {formatDateTime(challan.createdAt)} by {challan.createdBy?.name ?? 'system'}
          </p>
        </div>
        <div className="row">
          <ChallanBadge status={challan.status} />
          <button className="btn btn-secondary" onClick={() => window.print()}>
            🖨 Print
          </button>
          {canAct && challan.status === 'DRAFT' && (
            <button className="btn btn-primary" onClick={() => setConfirmDialog('confirm')}>
              Confirm & reduce stock
            </button>
          )}
          {canAct && challan.status !== 'CANCELLED' && (
            <button className="btn btn-danger" onClick={() => setConfirmDialog('cancel')}>
              Cancel challan
            </button>
          )}
        </div>
      </div>

      <ErrorAlert error={actionError} />

      <div className="print-doc">
        <div className="doc-head">
          <div>
            <div className="doc-title">SALES CHALLAN</div>
            <div className="muted">Wholesale &amp; Distribution Pvt. Ltd.</div>
            <div className="faint">GSTIN 27AAAAA0000A1Z5 · Pune, Maharashtra</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="strong" style={{ fontSize: 16 }}>
              {challan.challanNumber}
            </div>
            <div className="muted">{formatDateTime(challan.createdAt)}</div>
            <div style={{ marginTop: 6 }}>
              <ChallanBadge status={challan.status} />
            </div>
          </div>
        </div>

        <div className="detail-grid" style={{ marginBottom: 22 }}>
          <div className="detail-item">
            <div className="k">Billed to</div>
            <div className="v strong">{snapshot.businessName ?? snapshot.name}</div>
            <div className="v muted">{snapshot.name}</div>
          </div>
          <div className="detail-item">
            <div className="k">Contact</div>
            <div className="v">{snapshot.mobile}</div>
            <div className="v muted">{snapshot.email ?? '—'}</div>
          </div>
          <div className="detail-item">
            <div className="k">GST number</div>
            <div className="v">{snapshot.gstNumber ?? '—'}</div>
            <div className="v muted">{snapshot.customerType}</div>
          </div>
          <div className="detail-item">
            <div className="k">Delivery address</div>
            <div className="v">{snapshot.address || '—'}</div>
          </div>
        </div>

        <table className="line-items">
          <thead>
            <tr>
              <th style={{ width: 34 }}>#</th>
              <th>Product</th>
              <th>SKU</th>
              <th className="num">Rate</th>
              <th className="num">Qty</th>
              <th className="num">Amount</th>
            </tr>
          </thead>
          <tbody>
            {challan.items.map((item, index) => (
              <tr key={item.id}>
                <td className="muted">{index + 1}</td>
                <td className="strong">{item.productName}</td>
                <td className="muted">{item.productSku}</td>
                <td className="num">{inr(item.unitPrice)}</td>
                <td className="num">{item.quantity}</td>
                <td className="num">{inr(item.lineTotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: 'right' }}>
                Total
              </td>
              <td className="num">{challan.totalQuantity}</td>
              <td className="num">{inr(challan.totalAmount)}</td>
            </tr>
          </tfoot>
        </table>

        {challan.notes && (
          <div style={{ marginTop: 18 }}>
            <div className="k faint">NOTES</div>
            <div>{challan.notes}</div>
          </div>
        )}

        <div className="faint" style={{ marginTop: 22, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          Product names, SKUs and rates on this document are a snapshot taken when the challan was
          created — later catalogue changes do not alter this record.
          {challan.confirmedAt && ` Confirmed on ${formatDateTime(challan.confirmedAt)}.`}
          {challan.cancelledAt && ` Cancelled on ${formatDateTime(challan.cancelledAt)}.`}
        </div>
      </div>

      {confirmDialog && (
        <Modal
          title={confirmDialog === 'confirm' ? 'Confirm challan?' : 'Cancel challan?'}
          onClose={() => setConfirmDialog(null)}
          size="sm"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setConfirmDialog(null)}>
                Go back
              </button>
              <button
                className={confirmDialog === 'confirm' ? 'btn btn-primary' : 'btn btn-danger'}
                disabled={busy}
                onClick={() => runAction(confirmDialog)}
              >
                {busy ? 'Working…' : confirmDialog === 'confirm' ? 'Yes, confirm' : 'Yes, cancel it'}
              </button>
            </>
          }
        >
          {confirmDialog === 'confirm' ? (
            <p style={{ margin: 0 }}>
              This will reduce warehouse stock by {challan.totalQuantity} units across{' '}
              {challan.items.length} product{challan.items.length === 1 ? '' : 's'} and write an OUT
              entry to the stock ledger. If any line is short, nothing will change.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              {challan.status === 'CONFIRMED'
                ? 'This challan is confirmed, so the stock it consumed will be returned to inventory.'
                : 'This draft will be marked cancelled. No stock was reserved, so nothing changes in inventory.'}
            </p>
          )}
        </Modal>
      )}
    </>
  );
}
