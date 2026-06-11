'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import DataTable from '@/components/DataTable';
import Badge from '@/components/Badge';
import Modal from '@/components/Modal';
import ConfirmDialog from '@/components/ConfirmDialog';

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
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '24px',
    marginBottom: '24px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
  },
  cardFull: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow)',
    padding: '24px',
    gridColumn: '1 / -1',
  },
  cardTitle: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  infoRowLast: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
  },
  infoLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  photoContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '200px',
  },
  photo: {
    maxWidth: '100%',
    maxHeight: '300px',
    borderRadius: 'var(--radius)',
    objectFit: 'contain',
    boxShadow: 'var(--shadow-md)',
  },
  photoPlaceholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '40px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    border: '2px dashed var(--border)',
    color: 'var(--text-muted)',
    width: '100%',
    minHeight: '200px',
  },
  photoIcon: {
    fontSize: '40px',
    opacity: 0.4,
  },
  photoText: {
    fontSize: '13px',
    fontWeight: 500,
  },
  returnBtn: {
    padding: '12px 24px',
    background: 'var(--warning)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: '0 2px 8px rgba(217, 119, 6, 0.3)',
    marginTop: '20px',
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
  checkboxList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '20px',
  },
  checkboxItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 14px',
    background: 'var(--bg)',
    borderRadius: 'var(--radius)',
    transition: 'background var(--transition)',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: 'var(--primary)',
  },
  checkboxLabel: {
    fontSize: '14px',
    fontWeight: 500,
    color: 'var(--text)',
    flex: 1,
  },
  checkboxType: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  forceBtn: {
    padding: '10px 20px',
    background: 'var(--danger)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    width: '100%',
    marginBottom: '12px',
  },
  submitReturnBtn: {
    padding: '10px 20px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
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
  errorMsg: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--danger)',
    fontWeight: 500,
    marginBottom: '12px',
  },
  successMsg: {
    background: 'rgba(22, 163, 74, 0.06)',
    border: '1px solid rgba(22, 163, 74, 0.2)',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--success)',
    fontWeight: 500,
    marginBottom: '16px',
  },
};

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

export default function SessionDetailPage() {
  const params = useParams();
  const sessionId = params.id;

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Photo
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoError, setPhotoError] = useState(false);

  // Return modal
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [returnLoading, setReturnLoading] = useState(false);
  const [returnError, setReturnError] = useState('');
  const [returnSuccess, setReturnSuccess] = useState('');

  // Force return confirm
  const [showForceConfirm, setShowForceConfirm] = useState(false);

  const fetchSession = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/sessions/${sessionId}`);
      setSession(res.session || res);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Fetch photo with auth
  const fetchPhoto = useCallback(async () => {
    try {
      const token = getToken();
      const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${BASE_URL}/sessions/${sessionId}/photo`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Photo not found');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setPhotoUrl(url);
    } catch {
      setPhotoError(true);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    fetchPhoto();
    return () => {
      // Cleanup blob URL
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [fetchSession, fetchPhoto]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const canReturn = session?.status === 'active' || session?.status === 'partially_returned';

  const unreturned = (session?.items || []).filter((item) => !item.returned_at);

  const toggleAsset = (assetId) => {
    setSelectedAssets((prev) =>
      prev.includes(assetId) ? prev.filter((id) => id !== assetId) : [...prev, assetId]
    );
  };

  const handleReturn = async () => {
    setReturnLoading(true);
    setReturnError('');
    setReturnSuccess('');
    try {
      await api.put(`/sessions/${sessionId}/return`, {
        asset_ids: selectedAssets,
        force_all: false,
      });
      setReturnSuccess('Asset berhasil dikembalikan!');
      setSelectedAssets([]);
      setShowReturnModal(false);
      fetchSession();
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setReturnLoading(false);
    }
  };

  const handleForceReturn = async () => {
    setReturnLoading(true);
    setReturnError('');
    try {
      await api.put(`/sessions/${sessionId}/return`, {
        asset_ids: [],
        force_all: true,
      });
      setShowForceConfirm(false);
      setShowReturnModal(false);
      setReturnSuccess('Semua asset berhasil dikembalikan!');
      fetchSession();
    } catch (err) {
      setReturnError(err.message);
    } finally {
      setReturnLoading(false);
    }
  };

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
        <Link href="/sessions" style={styles.backLink}>← Kembali ke Sessions</Link>
        <div style={styles.errorContainer}>
          <p style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ {error}</p>
        </div>
      </div>
    );
  }

  const itemColumns = [
    {
      key: 'label',
      label: 'Label',
      render: (val, row) => val || row.asset_label || '—',
    },
    {
      key: 'type_name',
      label: 'Tipe',
      render: (val, row) => val || row.asset_type || '—',
    },
    {
      key: 'borrowed_at',
      label: 'Waktu Pinjam',
      render: (val, row) => (
        <span style={{ fontSize: '13px' }}>
          {formatDate(val || row.created_at)}
        </span>
      ),
    },
    {
      key: 'returned_at',
      label: 'Waktu Kembali',
      render: (val) => val ? (
        <span style={{ fontSize: '13px', color: 'var(--success)' }}>
          {formatDate(val)}
        </span>
      ) : (
        <Badge text="Belum dikembalikan" color="warning" />
      ),
    },
  ];

  return (
    <div style={styles.page}>
      <Link href="/sessions" style={styles.backLink}>
        ← Kembali ke Sessions
      </Link>

      {returnSuccess && <div style={styles.successMsg}>✅ {returnSuccess}</div>}

      {/* Session Info + Photo */}
      <div style={styles.grid}>
        {/* Session Info */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>📋 Informasi Sesi</div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Session ID</span>
            <span style={{ ...styles.infoValue, fontFamily: 'monospace' }}>#{session?.id}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Status</span>
            <Badge
              text={statusLabelMap[session?.status] || session?.status}
              color={statusColorMap[session?.status] || 'muted'}
            />
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Peminjam</span>
            <span style={styles.infoValue}>{session?.user_name || session?.user?.name || '—'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>NRP</span>
            <span style={styles.infoValue}>{session?.user_nrp || session?.user?.nrp || '—'}</span>
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Tanggal Pinjam</span>
            <span style={{ fontSize: '13px', fontWeight: 500 }}>
              {formatDate(session?.created_at)}
            </span>
          </div>
          <div style={styles.infoRowLast}>
            <span style={styles.infoLabel}>Jumlah Item</span>
            <span style={styles.infoValue}>{session?.items?.length || session?.item_count || 0}</span>
          </div>

          {/* Return Button */}
          {canReturn && (
            <button
              style={styles.returnBtn}
              onClick={() => {
                setSelectedAssets([]);
                setReturnError('');
                setShowReturnModal(true);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 4px 14px rgba(217, 119, 6, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(217, 119, 6, 0.3)';
              }}
            >
              🔄 Return Manual
            </button>
          )}
        </div>

        {/* Photo */}
        <div style={styles.card}>
          <div style={styles.cardTitle}>📷 Foto Peminjam</div>
          <div style={styles.photoContainer}>
            {photoUrl && !photoError ? (
              <img
                src={photoUrl}
                alt="Foto peminjam"
                style={styles.photo}
                onError={() => setPhotoError(true)}
              />
            ) : (
              <div style={styles.photoPlaceholder}>
                <span style={styles.photoIcon}>📸</span>
                <span style={styles.photoText}>Foto tidak tersedia</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div style={styles.sectionTitle}>📦 Detail Item</div>
      <DataTable
        columns={itemColumns}
        data={session?.items || []}
        loading={false}
        emptyMessage="Tidak ada item dalam sesi ini"
      />

      {/* Return Modal */}
      <Modal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Manual"
        size="md"
      >
        {returnError && <div style={styles.errorMsg}>{returnError}</div>}

        {unreturned.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
            Semua asset sudah dikembalikan.
          </p>
        ) : (
          <>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px' }}>
              Pilih asset yang ingin dikembalikan:
            </p>
            <div style={styles.checkboxList}>
              {unreturned.map((item) => {
                const assetId = item.asset_id || item.id;
                return (
                  <label
                    key={assetId}
                    style={{
                      ...styles.checkboxItem,
                      background: selectedAssets.includes(assetId)
                        ? 'rgba(37, 99, 235, 0.06)'
                        : 'var(--bg)',
                      border: selectedAssets.includes(assetId)
                        ? '1px solid rgba(37, 99, 235, 0.2)'
                        : '1px solid transparent',
                    }}
                  >
                    <input
                      type="checkbox"
                      style={styles.checkbox}
                      checked={selectedAssets.includes(assetId)}
                      onChange={() => toggleAsset(assetId)}
                    />
                    <span style={styles.checkboxLabel}>
                      {item.label || item.asset_label || `Asset #${assetId}`}
                    </span>
                    <span style={styles.checkboxType}>
                      {item.type_name || item.asset_type || ''}
                    </span>
                  </label>
                );
              })}
            </div>

            <button
              style={styles.forceBtn}
              onClick={() => setShowForceConfirm(true)}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; }}
            >
              ⚡ Force Return All
            </button>

            <button
              style={{
                ...styles.submitReturnBtn,
                opacity: selectedAssets.length === 0 || returnLoading ? 0.5 : 1,
                cursor: selectedAssets.length === 0 || returnLoading ? 'not-allowed' : 'pointer',
              }}
              onClick={handleReturn}
              disabled={selectedAssets.length === 0 || returnLoading}
            >
              {returnLoading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
              {returnLoading ? 'Memproses...' : `Return ${selectedAssets.length} Asset`}
            </button>
          </>
        )}
      </Modal>

      {/* Force Return Confirm */}
      <ConfirmDialog
        isOpen={showForceConfirm}
        onConfirm={handleForceReturn}
        onCancel={() => setShowForceConfirm(false)}
        message="Force return semua asset? Semua item yang belum dikembalikan akan ditandai sebagai dikembalikan."
      />
    </div>
  );
}
