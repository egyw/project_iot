const styles = {
  wrapper: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    overflow: 'hidden',
    animation: 'fadeIn 0.4s ease',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '14px 18px',
    textAlign: 'left',
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    background: 'var(--bg)',
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 18px',
    fontSize: '14px',
    color: 'var(--text)',
    borderBottom: '1px solid var(--border)',
    verticalAlign: 'middle',
  },
  row: {
    transition: 'background var(--transition)',
    cursor: 'default',
  },
  emptyContainer: {
    padding: '60px 24px',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  emptyIcon: {
    fontSize: '40px',
    opacity: 0.5,
  },
  emptyText: {
    fontSize: '15px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  loadingContainer: {
    padding: '0',
  },
  skeletonRow: {
    display: 'flex',
    gap: '18px',
    padding: '14px 18px',
    borderBottom: '1px solid var(--border)',
  },
  skeletonCell: {
    height: '16px',
    borderRadius: '4px',
    flex: 1,
  },
};

export default function DataTable({ columns = [], data = [], loading = false, emptyMessage = 'No data found', onRowClick }) {
  if (loading) {
    return (
      <div style={styles.wrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={styles.th}>{col.label}</th>
              ))}
            </tr>
          </thead>
        </table>
        <div style={styles.loadingContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} style={styles.skeletonRow}>
              {columns.map((col) => (
                <div
                  key={col.key}
                  className="skeleton"
                  style={{
                    ...styles.skeletonCell,
                    animationDelay: `${i * 0.08}s`,
                    maxWidth: col.key === 'actions' ? '120px' : undefined,
                  }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={styles.wrapper}>
        <table style={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={styles.th}>{col.label}</th>
              ))}
            </tr>
          </thead>
        </table>
        <div style={styles.emptyContainer}>
          <div style={styles.emptyIcon}>📭</div>
          <div style={styles.emptyText}>{emptyMessage}</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={styles.th}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, idx) => (
            <tr
              key={row.id || idx}
              style={{
                ...styles.row,
                cursor: onRowClick ? 'pointer' : 'default',
              }}
              onClick={() => onRowClick && onRowClick(row)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              {columns.map((col) => (
                <td key={col.key} style={styles.td}>
                  {col.render ? col.render(row[col.key], row) : (row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
