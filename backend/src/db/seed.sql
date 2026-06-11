-- Seed untuk tabel users (3 mahasiswa)
INSERT INTO users (id, nrp, name, rfid_uid) VALUES
(1, '5025211001', 'Egbert Wangarry', '04912b520a6480'),
(2, '5025211002', 'Admin KTM', '8c1f5107'),
(3, '5025211003', 'Andi Wijaya', '04:99:88:77:66:55:44')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel asset_types (3 jenis aset)
INSERT INTO asset_types (id, name, description) VALUES
(1, 'Bolpen', 'Bolpen standar lab'),
(2, 'Stopkontak', 'Stopkontak ekstensi 4 lubang'),
(3, 'Penggaris', 'Penggaris besi 30cm')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel assets (6 aset fisik)
-- Aset 1 dan 4 sedang dipinjam (is_available = false)
INSERT INTO assets (id, asset_type_id, rfid_uid, label, is_available) VALUES
(1, 1, '04:1A:2B:3C:4D:5E:6F', 'Bolpen-001', false),
(2, 1, '04:2A:3B:4C:5D:6E:7F', 'Bolpen-002', true),
(3, 1, '04:3A:4B:5C:6D:7E:8F', 'Bolpen-003', true),
(4, 2, '04:4A:5B:6C:7D:8E:9F', 'Stopkontak-001', false),
(5, 2, '04:5A:6B:7C:8D:9E:0F', 'Stopkontak-002', true),
(6, 3, '04:6A:7B:8C:9D:0E:1F', 'Penggaris-001', true)
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel borrow_sessions
-- 1 sesi aktif untuk user 1
INSERT INTO borrow_sessions (id, user_id, status, photo_path) VALUES
(1, 1, 'active', '/uploads/photos/session_001.jpg')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel borrow_items
-- User 1 meminjam Bolpen-001 (asset_id 1) dan Stopkontak-001 (asset_id 4)
INSERT INTO borrow_items (id, session_id, asset_id, returned_at) VALUES
(1, 1, 1, NULL),
(2, 1, 4, NULL)
ON CONFLICT (id) DO NOTHING;

-- Update sequences agar auto-increment (SERIAL) tidak bertabrakan saat insert manual tanpa ID di kemudian hari
SELECT setval('users_id_seq', (SELECT MAX(id) FROM users));
SELECT setval('asset_types_id_seq', (SELECT MAX(id) FROM asset_types));
SELECT setval('assets_id_seq', (SELECT MAX(id) FROM assets));
SELECT setval('borrow_sessions_id_seq', (SELECT MAX(id) FROM borrow_sessions));
SELECT setval('borrow_items_id_seq', (SELECT MAX(id) FROM borrow_items));
