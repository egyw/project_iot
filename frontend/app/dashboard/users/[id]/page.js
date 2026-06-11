'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';

const styles = {
  page: { animation: 'fadeIn 0.4s ease' },
  backLink: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--primary)',
    marginBottom: '20px',
    transition: 'opacity var(--transition)',
    textDecoration: 'none',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    padding: '28px',
    marginBottom: '24px',
  },
  userHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    marginBottom: '24px',
  },
  avatar: {
    width: '64px',
    height: '64px',
    borderRadius: '16px',
    background: 'linear-gradient(135deg, var(--primary), #7c3aed)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '28px',
    color: '#fff',
    fontWeight: 700,
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.25)',
  },
  userName: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.02em',
  },
  userNrp: {
    fontSize: '14px',
    color: 'var(--text-muted)',
    fontWeight: 500,
    marginTop: '2px',
  },
  infoGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '20px',
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  infoLabel: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  infoValue: {
    fontSize: '15px',
    fontWeight: 500,
    color: 'var(--text)',
  },
  sectionTitle: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text)',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  activeHighlight: {
    background: 'rgba(217, 119, 6, 0.06)',
    border: '1px solid rgba(217, 119, 6, 0.2)',
    borderRadius: 'var(--radius-lg)',
    padding: '16px 20px',
    marginBottom: '20px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  activeIcon: {
    fontSize: '24px',
  },
  activeText: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--warning)',
  },
  activeDetail: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  errorContainer: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius-lg)',
    padding: '32px',
    textAlign: 'center',
  },
  loadingContainer: {
    display: 'flex',
    justifyContent: 'center',
    padding: '80px 0',
  },
};

export default function UserDetailPage() {
  const params = useParams();
  const userId = params.id;

  const [user, setUser] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchUser = useCallback(async () => {
    setLoading(true);
    try {
      const userData = await api.get(`/users/${userId}`);
      setUser(userData.data || userData.user || userData);

      // Fetch sessions for this user
      try {
        const sessionData = await api.get(`/sessions?user_id=${userId}`);
        setSessions(sessionData.sessions || sessionData.data || []);
      } catch {
        setSessions([]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.loadingContainer}>
          <div className="spinner" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <Link href="/dashboard/users" style={styles.backLink}>← Kembali ke Users</Link>
        <div style={styles.errorContainer}>
          <p style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const activeSessions = sessions.filter(
    (s) => s.status === 'active' || s.status === 'partially_returned'
  );

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const statusColor = (status) => {
    const map = {
      active: 'warning',
      partially_returned: 'primary',
      fully_returned: 'success',
    };
    return map[status] || 'muted';
  };

  const statusLabel = (status) => {
    const map = {
      active: 'Aktif',
      partially_returned: 'Sebagian Kembali',
      fully_returned: 'Selesai',
    };
    return map[status] || status;
  };

  const sessionColumns = [
    {
      key: 'borrowed_at',
      label: 'Tanggal',
      render: (val) => formatDate(val),
    },
    {
      key: 'item_count',
      label: 'Jumlah Item',
      render: (val, row) => val || row.items?.length || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => <Badge text={statusLabel(val)} color={statusColor(val)} />,
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => (
        <Link
          href={`/dashboard/sessions/${row.id}`}
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: 'var(--primary)',
            transition: 'opacity var(--transition)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          Lihat Detail →
        </Link>
      ),
    },
  ];

  return (
    <div style={styles.page}>
      <Link href="/dashboard/users" style={styles.backLink}>
        ← Kembali ke Users
      </Link>

      {/* User Info Card */}
      <div style={styles.card}>
        <div style={styles.userHeader}>
          <div style={styles.avatar}>
            {user?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <div>
            <div style={styles.userName}>{user?.name}</div>
            <div style={styles.userNrp}>NRP: {user?.nrp}</div>
          </div>
        </div>

        <div style={styles.infoGrid}>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>RFID UID</span>
            <span style={styles.infoValue}>
              {user?.rfid_uid || (
                <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Belum terdaftar
                </span>
              )}
            </span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Terdaftar Pada</span>
            <span style={styles.infoValue}>{formatDate(user?.created_at)}</span>
          </div>
          <div style={styles.infoItem}>
            <span style={styles.infoLabel}>Total Pinjaman</span>
            <span style={styles.infoValue}>{sessions.length} sesi</span>
          </div>
        </div>
      </div>

      {/* Active Session Highlight */}
      {activeSessions.length > 0 && (
        <div style={styles.activeHighlight}>
          <span style={styles.activeIcon}>⚡</span>
          <div>
            <div style={styles.activeText}>
              {activeSessions.length} sesi pinjaman aktif
            </div>
            <div style={styles.activeDetail}>
              User ini memiliki pinjaman yang belum dikembalikan
            </div>
          </div>
        </div>
      )}

      {/* Session History */}
      <div style={styles.sectionTitle}>📋 Riwayat Pinjaman</div>
      <DataTable
        columns={sessionColumns}
        data={sessions}
        loading={false}
        emptyMessage="Belum ada riwayat pinjaman"
        onRowClick={(row) => {
          window.location.href = `/sessions/${row.id}`;
        }}
      />
    </div>
  );
}
