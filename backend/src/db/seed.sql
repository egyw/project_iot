-- Seed untuk tabel users (2 user)
INSERT INTO users (id, nrp, name, rfid_uid) VALUES
(1, '223117080', 'Egbert Wangarry', '04912b520a6480'),
(2, '000000000', 'Admin KTM', '8c1f5107')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel asset_types (3 jenis aset)
INSERT INTO asset_types (id, name, description) VALUES
(1, 'Bolpen', 'Bolpen standar lab'),
(2, 'Freshcare', 'Minyak angin aromatherapy Freshcare'),
(3, 'Stabilo', 'Highlighter Stabilo Boss')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel assets (6 aset fisik)
-- Aset 1 dan 4 sedang dipinjam (is_available = false)
INSERT INTO assets (id, asset_type_id, rfid_uid, label, is_available) VALUES
(1, 1, '5a81f1f7544189', 'Bolpen Coklat', false),
(2, 1, '77522164', 'Bolpen Hitam', true),
(3, 2, '5ac1a0ef544189', 'Freshcare Matcha', true),
(4, 3, '5a21d3f2544189', 'Stabilo Yellow', false),
(5, 3, '5a81a4f4544189', 'Stabilo Orange', true),
(6, 3, '5a2116f6544189', 'Stabilo Blue', true)
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel borrow_sessions
-- 1 sesi aktif untuk user 1
INSERT INTO borrow_sessions (id, user_id, status, photo_path) VALUES
(1, 1, 'active', '/uploads/photos/session_001.jpg')
ON CONFLICT (id) DO NOTHING;

-- Seed untuk tabel borrow_items
-- User 1 meminjam Bolpen Coklat (asset_id 1) dan Stabilo Yellow (asset_id 4)
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
