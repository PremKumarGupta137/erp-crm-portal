interface PaginationProps {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, limit, total, totalPages, onPage }: PaginationProps) {
  if (total === 0) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span>
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="pagination-controls">
        <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          ← Prev
        </button>
        <span style={{ padding: '0 6px' }}>
          Page {page} of {totalPages}
        </span>
        <button
          className="btn btn-secondary btn-sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
