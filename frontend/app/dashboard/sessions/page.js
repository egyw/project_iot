'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import Badge from '@/components/Badge';

const styles = {
  page: { animation: 'fadeIn 0.4s ease' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '20px',
    flexWrap: 'wrap',
  },
  select: {
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--surface)',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color var(--transition)',
    minWidth: '180px',
  },
  dateInput: {
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--surface)',
    outline: 'none',
    cursor: 'pointer',
    transition: 'border-color var(--transition)',
  },
  dateGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  dateSeparator: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  userNrp: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  userName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
};

const statusOptions = [
  { value: '', label: 'Semua Status' },
  { value: 'active', label: 'Aktif' },
  { value: 'partially_returned', label: 'Sebagian Kembali' },
  { value: 'fully_returned', label: 'Selesai' },
];

const statusColorMap = {
  active: 'warning',
  partially_returned: 'primary',
  fully_returned: 'success',
};

const statusLabelMap = {
  active: 'Aktif',
  partially_returned: 'Sebagian Kembali',
  fully_returned: 'Selesai',
};

export default function SessionsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (statusFilter) params.set('status', statusFilter);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const res = await api.get(`/sessions?${params}`);
      setSessions(res.sessions || res.data || []);
      setTotal(res.total || res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, dateFrom, dateTo]);

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

  const columns = [
    {
      key: 'id',
      label: 'ID',
      render: (val) => (
        <span style={{ fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-muted)' }}>
          #{val}
        </span>
      ),
    },
    {
      key: 'user',
      label: 'User',
      render: (val, row) => (
        <div style={styles.userInfo}>
          <span style={styles.userName}>{row.user_name || val?.name || '—'}</span>
          <span style={styles.userNrp}>{row.user_nrp || val?.nrp || ''}</span>
        </div>
      ),
    },
    {
      key: 'item_count',
      label: 'Items',
      render: (val, row) => {
        const count = val || row.items?.length || 0;
        return (
          <span style={{ fontWeight: 600, fontSize: '14px' }}>
            {count} item{count !== 1 ? 's' : ''}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <Badge
          text={statusLabelMap[val] || val}
          color={statusColorMap[val] || 'muted'}
        />
      ),
    },
    {
      key: 'borrowed_at',
      label: 'Tanggal Pinjam',
      render: (val) => (
        <span style={{ fontSize: '13px' }}>{formatDate(val)}</span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => (
        <button
          style={{
            padding: '6px 14px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--primary)',
            borderColor: 'rgba(37, 99, 235, 0.3)',
            background: 'rgba(37, 99, 235, 0.05)',
            border: '1px solid rgba(37, 99, 235, 0.3)',
            cursor: 'pointer',
            transition: 'all var(--transition)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            router.push(`/dashboard/sessions/${row.id}`);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
          }}
        >
          Lihat Detail →
        </button>
      ),
    },
  ];

  return (
    <div style={styles.page}>
      {/* Filters */}
      <div style={styles.toolbar}>
        <select
          style={styles.select}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        <div style={styles.dateGroup}>
          <input
            type="date"
            style={styles.dateInput}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            placeholder="Dari"
          />
          <span style={styles.dateSeparator}>sampai</span>
          <input
            type="date"
            style={styles.dateInput}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            placeholder="Sampai"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={sessions}
        loading={loading}
        emptyMessage="Tidak ada sesi pinjaman ditemukan"
        onRowClick={(row) => router.push(`/dashboard/sessions/${row.id}`)}
      />

      {total > 20 && (
        <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
      )}
    </div>
  );
}
