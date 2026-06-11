'use client';

import { useEffect, useCallback } from 'react';

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
  dialog: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    width: '100%',
    maxWidth: '420px',
    padding: '32px',
    animation: 'fadeIn 0.25s ease',
    textAlign: 'center',
  },
  icon: {
    fontSize: '48px',
    marginBottom: '16px',
  },
  message: {
    fontSize: '15px',
    color: 'var(--text)',
    lineHeight: 1.6,
    marginBottom: '28px',
    fontWeight: 500,
  },
  actions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'center',
  },
  cancelBtn: {
    padding: '10px 24px',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    border: '1px solid var(--border)',
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all var(--transition)',
  },
  confirmBtn: {
    padding: '10px 24px',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    border: 'none',
    background: 'var(--danger)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all var(--transition)',
  },
};

export default function ConfirmDialog({ isOpen, onConfirm, onCancel, message = 'Apakah Anda yakin?' }) {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onCancel();
    },
    [onCancel]
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
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={styles.dialog}>
        <div style={styles.icon}>⚠️</div>
        <div style={styles.message}>{message}</div>
        <div style={styles.actions}>
          <button
            style={styles.cancelBtn}
            onClick={onCancel}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--bg)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--surface)';
            }}
          >
            Batal
          </button>
          <button
            style={styles.confirmBtn}
            onClick={onConfirm}
            onMouseEnter={(e) => {
              e.currentTarget.style.opacity = '0.9';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = '1';
            }}
          >
            Ya, Lanjutkan
          </button>
        </div>
      </div>
    </div>
  );
}
