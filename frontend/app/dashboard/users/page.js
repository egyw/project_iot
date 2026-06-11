'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
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
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '0 14px',
    flex: '1',
    maxWidth: '360px',
    transition: 'border-color var(--transition), box-shadow var(--transition)',
  },
  searchIcon: { fontSize: '16px', color: 'var(--text-muted)', flexShrink: 0 },
  searchInput: {
    border: 'none',
    outline: 'none',
    background: 'none',
    padding: '10px 0',
    fontSize: '14px',
    color: 'var(--text)',
    width: '100%',
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

export default function UsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // Form state
  const [formData, setFormData] = useState({ nrp: '', name: '', rfid_uid: '' });
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounced(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit: 20 });
      if (searchDebounced) params.set('search', searchDebounced);
      const res = await api.get(`/users?${params}`);
      setUsers(res.users || res.data || []);
      setTotal(res.total || res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Add user
  const handleAdd = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.post('/users', formData);
      setShowAddModal(false);
      setFormData({ nrp: '', name: '', rfid_uid: '' });
      fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Edit user
  const openEdit = (user) => {
    setEditUser(user);
    setFormData({ name: user.name, rfid_uid: user.rfid_uid || '' });
    setFormError('');
    setShowEditModal(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError('');
    try {
      await api.put(`/users/${editUser.id}`, {
        name: formData.name,
        rfid_uid: formData.rfid_uid,
      });
      setShowEditModal(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  // Delete user
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchUsers();
    } catch (err) {
      alert('Gagal menghapus: ' + err.message);
      setDeleteTarget(null);
    }
  };

  const columns = [
    { key: 'nrp', label: 'NRP' },
    { key: 'name', label: 'Nama' },
    {
      key: 'active_loans',
      label: 'Status Pinjaman',
      render: (val) => {
        const hasActive = val && val > 0;
        return (
          <Badge
            text={hasActive ? 'Aktif' : 'Tidak Ada'}
            color={hasActive ? 'warning' : 'muted'}
          />
        );
      },
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
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div
          style={styles.searchBox}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--primary)';
            e.currentTarget.style.boxShadow = '0 0 0 3px rgba(37, 99, 235, 0.1)';
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.boxShadow = 'none';
          }}
        >
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Cari NRP atau nama..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          style={styles.addBtn}
          onClick={() => {
            setFormData({ nrp: '', name: '', rfid_uid: '' });
            setFormError('');
            setShowAddModal(true);
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--primary-dark)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--primary)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          ➕ Tambah User
        </button>
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={users}
        loading={loading}
        emptyMessage="Tidak ada user ditemukan"
        onRowClick={(row) => router.push(`/dashboard/users/${row.id}`)}
      />

      {/* Pagination */}
      {total > 20 && (
        <Pagination page={page} total={total} limit={20} onPageChange={setPage} />
      )}

      {/* Add Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Tambah User Baru">
        <form style={styles.form} onSubmit={handleAdd}>
          {formError && <div style={styles.errorMsg}>{formError}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>NRP</label>
            <input
              style={styles.input}
              value={formData.nrp}
              onChange={(e) => setFormData({ ...formData, nrp: e.target.value })}
              placeholder="Contoh: 5025221001"
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
            <label style={styles.label}>Nama</label>
            <input
              style={styles.input}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama lengkap"
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
            <label style={styles.label}>RFID UID</label>
            <input
              style={styles.input}
              value={formData.rfid_uid}
              onChange={(e) => setFormData({ ...formData, rfid_uid: e.target.value })}
              placeholder="UID kartu RFID"
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
      <Modal isOpen={showEditModal} onClose={() => setShowEditModal(false)} title="Edit User">
        <form style={styles.form} onSubmit={handleEdit}>
          {formError && <div style={styles.errorMsg}>{formError}</div>}
          <div style={styles.formGroup}>
            <label style={styles.label}>NRP</label>
            <input style={{ ...styles.input, background: '#f1f5f9', cursor: 'not-allowed' }} value={editUser?.nrp || ''} disabled />
          </div>
          <div style={styles.formGroup}>
            <label style={styles.label}>Nama</label>
            <input
              style={styles.input}
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Nama lengkap"
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
            <label style={styles.label}>RFID UID</label>
            <input
              style={styles.input}
              value={formData.rfid_uid}
              onChange={(e) => setFormData({ ...formData, rfid_uid: e.target.value })}
              placeholder="UID kartu RFID"
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

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        message={`Hapus user "${deleteTarget?.name}" (${deleteTarget?.nrp})? Tindakan ini tidak dapat dibatalkan.`}
      />
    </div>
  );
}
