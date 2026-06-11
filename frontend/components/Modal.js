'use client';

import { useEffect, useCallback } from 'react';

const sizeMap = {
  sm: '420px',
  md: '560px',
  lg: '720px',
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.6)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
    padding: '24px',
    animation: 'fadeIn 0.2s ease',
  },
  modal: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    animation: 'fadeIn 0.25s ease',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  title: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.01em',
  },
  closeBtn: {
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '8px',
    fontSize: '18px',
    color: 'var(--text-muted)',
    transition: 'all var(--transition)',
    cursor: 'pointer',
    border: 'none',
    background: 'none',
    lineHeight: 1,
  },
  body: {
    padding: '24px',
    overflowY: 'auto',
    flex: 1,
  },
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  return (
    <div
      style={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          ...styles.modal,
          maxWidth: sizeMap[size] || sizeMap.md,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={styles.header}>
          <h2 style={styles.title}>{title}</h2>
          <button
            style={styles.closeBtn}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
              e.currentTarget.style.color = 'var(--text)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'none';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>
        <div style={styles.body}>{children}</div>
      </div>
    </div>
  );
}
