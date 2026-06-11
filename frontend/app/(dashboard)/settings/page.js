'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';

const styles = {
  page: { animation: 'fadeIn 0.4s ease' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
    gap: '24px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    padding: '28px',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
  },
  infoLabel: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    fontFamily: 'monospace',
  },
  testBtn: {
    padding: '12px 28px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    marginTop: '20px',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: 600,
    gap: '6px',
  },
  connected: {
    background: 'rgba(22, 163, 74, 0.1)',
    color: 'var(--success)',
    border: '1px solid rgba(22, 163, 74, 0.2)',
  },
  disconnected: {
    background: 'rgba(220, 38, 38, 0.1)',
    color: 'var(--danger)',
    border: '1px solid rgba(220, 38, 38, 0.2)',
  },
  pending: {
    background: 'var(--bg)',
    color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  },
  adminAvatar: {
    width: '56px',
    height: '56px',
    borderRadius: '14px',
    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#fff',
    fontWeight: 700,
    marginBottom: '16px',
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  adminName: {
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '4px',
  },
  adminRole: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  pulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    animation: 'pulse 2s ease-in-out infinite',
  },
};

function decodeJWT(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

export default function SettingsPage() {
  const [username, setUsername] = useState('');
  const [connectionStatus, setConnectionStatus] = useState('pending'); // pending | connected | failed
  const [testing, setTesting] = useState(false);
  const [apiUrl] = useState(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api');
  const [backendInfo, setBackendInfo] = useState(null);

  // Decode JWT
  useEffect(() => {
    const token = getToken();
    if (token) {
      const payload = decodeJWT(token);
      setUsername(payload?.username || payload?.sub || 'admin');
    }
  }, []);

  // Initial connection test
  useEffect(() => {
    testConnection(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const testConnection = useCallback(async (silent = false) => {
    if (!silent) setTesting(true);
    setConnectionStatus('pending');
    try {
      const res = await api.get('/stats/overview');
      setConnectionStatus('connected');
      setBackendInfo(res);
    } catch {
      setConnectionStatus('failed');
      setBackendInfo(null);
    } finally {
      setTesting(false);
    }
  }, []);

  const getStatusBadge = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <span style={{ ...styles.statusBadge, ...styles.connected }}>
            <span style={{ ...styles.pulse, background: 'var(--success)' }} />
            Connected
          </span>
        );
      case 'failed':
        return (
          <span style={{ ...styles.statusBadge, ...styles.disconnected }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--danger)' }} />
            Failed
          </span>
        );
      default:
        return (
          <span style={{ ...styles.statusBadge, ...styles.pending }}>
            <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />
            Checking...
          </span>
        );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.grid}>
        {/* Admin Info */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>👤 Admin Profile</div>
          <div style={styles.adminAvatar}>
            {username?.charAt(0)?.toUpperCase() || 'A'}
          </div>
          <div style={styles.adminName}>{username}</div>
          <div style={styles.adminRole}>Administrator</div>
        </div>

        {/* System Info */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>🖥️ Informasi Sistem</div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>API URL</span>
            <span style={styles.infoValue}>{apiUrl}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Backend Status</span>
            {getStatusBadge()}
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>MQTT Status</span>
            {connectionStatus === 'connected' ? (
              <span style={{ ...styles.statusBadge, ...styles.connected }}>
                <span style={{ ...styles.pulse, background: 'var(--success)' }} />
                Online
              </span>
            ) : (
              <span style={{ ...styles.statusBadge, ...styles.pending }}>
                Unknown
              </span>
            )}
          </div>
          {backendInfo && (
            <>
              <div style={styles.infoRow}>
                <span style={styles.infoLabel}>Total Assets</span>
                <span style={{ ...styles.infoValue, fontFamily: 'inherit' }}>
                  {backendInfo.total_assets ?? '—'}
                </span>
              </div>
              <div style={styles.infoRowLast}>
                <span style={styles.infoLabel}>Active Sessions</span>
                <span style={{ ...styles.infoValue, fontFamily: 'inherit' }}>
                  {backendInfo.active_sessions ?? '—'}
                </span>
              </div>
            </>
          )}

          <button
            style={{
              ...styles.testBtn,
              opacity: testing ? 0.7 : 1,
              cursor: testing ? 'not-allowed' : 'pointer',
            }}
            onClick={() => testConnection(false)}
            disabled={testing}
            onMouseEnter={(e) => {
              if (!testing) {
                e.currentTarget.style.background = 'var(--primary-dark)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--primary)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {testing ? (
              <>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
                Testing...
              </>
            ) : (
              <>🔌 Test Connection</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
