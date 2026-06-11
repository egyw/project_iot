'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Pagination from '@/components/Pagination';
import Modal from '@/components/Modal';
import Badge from '@/components/Badge';
import ConfirmDialog from '@/components/ConfirmDialog';

const styles = {
  page: { animation: 'fadeIn 0.4s ease' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '20px',
    gap: '12px',
    flexWrap: 'wrap',
  },
  filters: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
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
    minWidth: '160px',
  },
  toggleGroup: {
    display: 'flex',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    border: '1px solid var(--border)',
  },
  toggleBtn: {
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    background: 'var(--surface)',
    color: 'var(--text-muted)',
  },
  toggleBtnActive: {
    background: 'var(--primary)',
    color: '#fff',
  },
  addBtn: {
    padding: '10px 20px',
    background: 'var(--primary)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    whiteSpace: 'nowrap',
    boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  input: {
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--surface)',
    outline: 'none',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
  },
  formActions: {
    display: 'flex',
    gap: '12px',
    justifyContent: 'flex-end',
    marginTop: '8px',
  },
  cancelBtn: {
    padding: '10px 20px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    background: 'var(--surface)',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all var(--transition)',
  },
  submitBtn: {
    padding: '10px 24px',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 600,
    background: 'var(--primary)',
    color: '#fff',
    cursor: 'pointer',
    transition: 'all var(--transition)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  submitBtnDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  },
  errorMsg: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 'var(--radius)',
    padding: '10px 14px',
    fontSize: '13px',
    color: 'var(--danger)',
    fontWeight: 500,
  },
  actionBtns: {
    display: 'flex',
    gap: '8px',
  },
  actionBtn: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all var(--transition)',
    border: '1px solid',
  },
};

export default function AssetsPage() {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterType, setFilterType] = useState('');
  const [showAvailable, setShowAvailable] = useState(false);

  // Asset types for dropdown
  const [assetTypes, setAssetTypes] = useState([]);

  // Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [formData, setFormData] = useState({ asset_type_id: '', rfid_uid: '', label: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Fetch asset types
  useEffect(() => {
    const fetchTypes = async () => {
      try {
        const res = await api.get('/assets/types');
        setAssetTypes(res.types || res.data || res || []);
      } catch (err) {
        console.error('Failed to fetch asset types:', err);
      }
    };
    fetchTypes();
  }, []);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (filterType) params.set('type_id', filterType);
      if (showAvailable) params.set('available', 'true');
      const res = await api.get(`/assets?${params}`);
      setAssets(res.assets || res.data || []);
      setTotal(res.total || res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch assets:', err);
    } finally {
      setLoading(false);
    }
  }, [page, filterType, showAvailable]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  // Reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [filterType, showAvailable]);

  const openAdd = () => {
    setFormData({
      asset_type_id: assetTypes[0]?.id || '',
      rfid_uid: '',
      label: '',
    });
    setFormError('');
    setShowAddModal(true);
  };

  const openEdit = (asset) => {
    setEditAsset(asset);
    setFormData({
      rfid_uid: asset.rfid_uid || '',
      label: asset.label || '',
    });
    setFormError('');
    setShowEditModal(true);
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/assets', {
        asset_type_id: Number(formData.asset_type_id),
        rfid_uid: formData.rfid_uid,
        label: formData.label,
      });
      setShowAddModal(false);
      fetchAssets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.put(`/assets/${editAsset.id}`, {
        rfid_uid: formData.rfid_uid,
        label: formData.label,
      });
      setShowEditModal(false);
      setEditAsset(null);
      fetchAssets();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/assets/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchAssets();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
      setDeleteTarget(null);
    }
  };

  const inputFocusStyle = (e) => {
    e.target.style.borderColor = 'var(--primary)';
    e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
  };
  const inputBlurStyle = (e) => {
    e.target.style.borderColor = 'var(--border)';
    e.target.style.boxShadow = 'none';
  };

  const columns = [
    { key: 'label', label: 'Label' },
    {
      key: 'type_name',
      label: 'Tipe',
      render: (val, row) => val || row.asset_type?.name || '—',
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => {
        const available = val === 'available' || val === 'tersedia';
        return (
          <Badge
            text={available ? 'Tersedia' : 'Dipinjam'}
            color={available ? 'success' : 'warning'}
          />
        );
      },
    },
    {
      key: 'rfid_uid',
      label: 'RFID UID',
      render: (val) => (
        <span style={{ fontSize: '13px', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
          {val || '—'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => {
        const isBorrowed = row.status === 'borrowed' || row.status === 'dipinjam';
        return (
          <div style={styles.actionBtns}>
            <button
              style={{
                ...styles.actionBtn,
                color: 'var(--primary)',
                borderColor: 'rgba(37, 99, 235, 0.3)',
                background: 'rgba(37, 99, 235, 0.05)',
              }}
              onClick={(e) => {
                e.stopPropagation();
                openEdit(row);
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(37, 99, 235, 0.12)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(37, 99, 235, 0.05)';
              }}
            >
              ✏️ Edit
            </button>
            <button
              style={{
                ...styles.actionBtn,
                color: isBorrowed ? 'var(--text-muted)' : 'var(--danger)',
                borderColor: isBorrowed ? 'var(--border)' : 'rgba(220, 38, 38, 0.3)',
                background: isBorrowed ? 'var(--bg)' : 'rgba(220, 38, 38, 0.05)',
                cursor: isBorrowed ? 'not-allowed' : 'pointer',
                opacity: isBorrowed ? 0.5 : 1,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (!isBorrowed) setDeleteTarget(row);
              }}
              disabled={isBorrowed}
              title={isBorrowed ? 'Tidak dapat dihapus saat dipinjam' : ''}
            >
              🗑️ Hapus
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.filters}>
          <select
            style={styles.select}
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">Semua Tipe</option>
            {assetTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>

          <div style={styles.toggleGroup}>
            <button
              style={{
                ...styles.toggleBtn,
                ...(!showAvailable ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setShowAvailable(false)}
            >
              Semua
            </button>
            <button
              style={{
                ...styles.toggleBtn,
                ...(showAvailable ? styles.toggleBtnActive : {}),
              }}
              onClick={() => setShowAvailable(true)}
            >
              Tersedia
            </button>
          </div>
        </div>

        <button
          style={styles.addBtn}
          onClick={openAdd}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-dark)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ➕ Tambah Asset
        </button>
      </div>

      <DataTable
        columns={columns}
        data={assets}
        loading={loading}
        emptyMessage="Tidak ada asset ditemukan"
      />

      {total > 20 && (
        <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah Asset Baru">
        <form style={styles.form} onSubmit={handleAdd}>
          {formError && <div style={styles.errorMsg}>{formError}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>Tipe Asset</label>
            <select
              style={styles.select}
              value={formData.asset_type_id}
              onChange={(e) => setFormData({ ...formData, asset_type_id: e.target.value })}
              required
            >
              <option value="">Pilih tipe...</option>
              {assetTypes.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Label</label>
            <input
              style={styles.input}
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Contoh: Multimeter-001"
              required
              onFocus={inputFocusStyle}
              onBlur={inputBlurStyle}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>RFID UID</label>
            <input
              style={styles.input}
              value={formData.rfid_uid}
              onChange={(e) => setFormData({ ...formData, rfid_uid: e.target.value })}
              placeholder="UID tag RFID"
              onFocus={inputFocusStyle}
              onBlur={inputBlurStyle}
            />
          </div>
          <div style={styles.formActions}>
            <button type="button" style={styles.cancelBtn} onClick={() => setShowAddModal(false)}>
              Batal
            </button>
            <button
              type="submit"
              style={{ ...styles.submitBtn, ...(formLoading ? styles.submitBtnDisabled : {}) }}
              disabled={formLoading}
            >
              {formLoading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
              {formLoading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Asset">
        <form style={styles.form} onSubmit={handleEdit}>
          {formError && <div style={styles.errorMsg}>{formError}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>Label</label>
            <input
              style={styles.input}
              value={formData.label}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="Contoh: Multimeter-001"
              required
              onFocus={inputFocusStyle}
              onBlur={inputBlurStyle}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>RFID UID</label>
            <input
              style={styles.input}
              value={formData.rfid_uid}
              onChange={(e) => setFormData({ ...formData, rfid_uid: e.target.value })}
              placeholder="UID tag RFID"
              onFocus={inputFocusStyle}
              onBlur={inputBlurStyle}
            />
          </div>
          <div style={styles.formActions}>
            <button type="button" style={styles.cancelBtn} onClick={() => setShowEditModal(false)}>
              Batal
            </button>
            <button
              type="submit"
              style={{ ...styles.submitBtn, ...(formLoading ? styles.submitBtnDisabled : {}) }}
              disabled={formLoading}
            >
              {formLoading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
              {formLoading ? 'Menyimpan...' : 'Update'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        message={`Hapus asset "${deleteTarget?.label}"? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}
