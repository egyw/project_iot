'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import DataTable from '@/components/DataTable';
import Modal from '@/components/Modal';
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
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text-muted)',
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
  textarea: {
    padding: '10px 14px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    color: 'var(--text)',
    background: 'var(--surface)',
    outline: 'none',
    resize: 'vertical',
    minHeight: '80px',
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
  description: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    maxWidth: '300px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
};

export default function AssetTypesPage() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editType, setEditType] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/assets/types');
      setTypes(res.types || res.data || res || []);
    } catch (err) {
      console.error('Failed to fetch asset types:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const openAdd = () => {
    setEditType(null);
    setFormData({ name: '', description: '' });
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (type) => {
    setEditType(type);
    setFormData({ name: type.name, description: type.description || '' });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      if (editType) {
        await api.put(`/assets/types/${editType.id}`, formData);
      } else {
        await api.post('/assets/types', formData);
      }
      setShowModal(false);
      fetchTypes();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/assets/types/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchTypes();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Nama Tipe' },
    {
      key: 'description',
      label: 'Deskripsi',
      render: (val) => (
        <span style={styles.description}>{val || '—'}</span>
      ),
    },
    {
      key: 'asset_count',
      label: 'Jumlah Asset',
      render: (val) => val ?? '—',
    },
    {
      key: 'actions',
      label: 'Aksi',
      render: (_, row) => (
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
              color: 'var(--danger)',
              borderColor: 'rgba(220, 38, 38, 0.3)',
              background: 'rgba(220, 38, 38, 0.05)',
            }}
            onClick={(e) => {
              e.stopPropagation();
              setDeleteTarget(row);
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.12)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(220, 38, 38, 0.05)';
            }}
          >
            🗑️ Hapus
          </button>
        </div>
      ),
    },
  ];

  return (
    <div style={styles.page}>
      <div style={styles.toolbar}>
        <div style={styles.title}>Kelola tipe asset laboratorium</div>
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
          ➕ Tambah Tipe
        </button>
      </div>

      <DataTable
        columns={columns}
        data={types}
        loading={loading}
        emptyMessage="Belum ada tipe asset"
      />

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editType ? 'Edit Tipe Asset' : 'Tambah Tipe Asset'}
        size="sm"
      >
        <form style={styles.form} onSubmit={handleSubmit}>
          {formError && <div style={styles.errorMsg}>{formError}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>Nama Tipe</label>
            <input
              style={styles.input}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Contoh: Multimeter, Osiloskop"
              required
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Deskripsi</label>
            <textarea
              style={styles.textarea}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi singkat tipe asset..."
              onFocus={(e) => {
                e.target.style.borderColor = 'var(--primary)';
                e.target.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'var(--border)';
                e.target.style.boxShadow = 'none';
              }}
            />
          </div>
          <div style={styles.formActions}>
            <button type="button" style={styles.cancelBtn} onClick={() => setShowModal(false)}>
              Batal
            </button>
            <button
              type="submit"
              style={{ ...styles.submitBtn, ...(formLoading ? styles.submitBtnDisabled : {}) }}
              disabled={formLoading}
            >
              {formLoading && <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
              {formLoading ? 'Menyimpan...' : editType ? 'Update' : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        message={`Hapus tipe "${deleteTarget?.name}"? Semua asset dengan tipe ini mungkin terpengaruh.`}
      />
    </div>
  );
}
