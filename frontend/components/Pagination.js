const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 0',
    marginTop: '16px',
  },
  info: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  buttons: {
    display: 'flex',
    gap: '8px',
  },
  btn: {
    padding: '8px 16px',
    borderRadius: 'var(--radius)',
    fontSize: '13px',
    fontWeight: 600,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
};

export default function Pagination({ page = 1, total = 0, limit = 20, onPageChange }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div style={styles.container}>
      <div style={styles.info}>
        Halaman {page} dari {totalPages} ({total} data)
      </div>
      <div style={styles.buttons}>
        <button
          style={{
            ...styles.btn,
            ...(hasPrev ? {} : styles.btnDisabled),
          }}
          onClick={() => hasPrev && onPageChange(page - 1)}
          disabled={!hasPrev}
          onMouseEnter={(e) => {
            if (hasPrev) {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
          }}
        >
          ← Previous
        </button>
        <button
          style={{
            ...styles.btn,
            ...(hasNext ? {} : styles.btnDisabled),
          }}
          onClick={() => hasNext && onPageChange(page + 1)}
          disabled={!hasNext}
          onMouseEnter={(e) => {
            if (hasNext) {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.borderColor = 'var(--primary)';
              e.currentTarget.style.color = 'var(--primary)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--surface)';
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.color = 'var(--text)';
          }}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
