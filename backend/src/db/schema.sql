-- Tabel users digunakan untuk menyimpan data mahasiswa yang merupakan peminjam aset.
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    nrp VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tabel asset_types digunakan untuk mendefinisikan jenis-jenis aset fisik yang tersedia di lab.
CREATE TABLE asset_types (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel assets digunakan untuk menyimpan data setiap aset fisik individual beserta UID RFID masing-masing.
CREATE TABLE assets (
    id SERIAL PRIMARY KEY,
    asset_type_id INTEGER NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
    rfid_uid VARCHAR(50) UNIQUE NOT NULL,
    label VARCHAR(100),
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tabel borrow_sessions digunakan untuk mencatat setiap sesi transaksi peminjaman oleh pengguna.
CREATE TABLE borrow_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    photo_path VARCHAR(255),
    borrowed_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- Tabel borrow_items digunakan untuk mencatat rincian aset apa saja yang dipinjam dalam suatu sesi.
CREATE TABLE borrow_items (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL REFERENCES borrow_sessions(id) ON DELETE RESTRICT,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    borrowed_at TIMESTAMP DEFAULT NOW(),
    returned_at TIMESTAMP
);

-- Index untuk mempercepat query pengecekan status pinjaman aktif dari seorang user
CREATE INDEX idx_borrow_sessions_user_status ON borrow_sessions(user_id, status);

-- Index parsial untuk mempercepat pencarian item-item yang masih dipinjam (belum dikembalikan)
CREATE INDEX idx_borrow_items_active ON borrow_items(session_id) WHERE returned_at IS NULL;

-- Index untuk mempercepat filter pencarian aset yang tersedia atau sedang dipinjam
CREATE INDEX idx_assets_available ON assets(is_available);

-- View active_loans digunakan untuk menampilkan rincian informasi semua item yang sedang berstatus dipinjam
CREATE VIEW active_loans AS
SELECT 
    bi.session_id,
    u.nrp AS user_nrp,
    u.name AS user_name,
    at.name AS asset_type_name,
    a.label AS asset_label,
    bi.borrowed_at
FROM borrow_items bi
JOIN borrow_sessions bs ON bi.session_id = bs.id
JOIN users u ON bs.user_id = u.id
JOIN assets a ON bi.asset_id = a.id
JOIN asset_types at ON a.asset_type_id = at.id
WHERE bi.returned_at IS NULL AND bs.status = 'active';

DO $$ BEGIN RAISE NOTICE 'Schema created successfully'; END $$;
