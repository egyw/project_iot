# SmartLab Asset Borrowing System
## Requirements Specification v1.0

---

## Daftar Isi
1. [Project Overview](#1-project-overview)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Hardware & Wiring](#3-hardware--wiring)
4. [Database Schema](#4-database-schema)
5. [OLED UI State Machine](#5-oled-ui-state-machine)
6. [MQTT Protocol](#6-mqtt-protocol)
7. [REST API Specification](#7-rest-api-specification)
8. [ESP32-S3 Firmware](#8-esp32-s3-firmware)
9. [ESP32-CAM Firmware](#9-esp32-cam-firmware)
10. [Backend (Node.js)](#10-backend-nodejs)
11. [Frontend Admin (Next.js)](#11-frontend-admin-nextjs)
12. [Node-RED Dashboard](#12-node-red-dashboard)
13. [Non-Functional Requirements](#13-non-functional-requirements)
14. [Error Handling](#14-error-handling)
15. [Struktur Folder Proyek](#15-struktur-folder-proyek)

---

## 1. Project Overview

### 1.1 Deskripsi
SmartLab Asset Borrowing System adalah sistem manajemen peminjaman aset laboratorium berbasis IoT. Mahasiswa dapat meminjam aset fisik (bolpen, stopkontak, dll.) menggunakan KTM yang dilengkapi tag NTAG213. Setiap aset fisik juga ditempel sticker NTAG213. Proses identifikasi peminjam dilakukan melalui scan KTM + pengambilan foto wajah sebagai bukti keamanan.

### 1.2 Tujuan
- Otomatisasi pelacakan aset laboratorium dengan RFID
- Identifikasi peminjam via scan KTM dan foto wajah
- Mendukung peminjaman parsial (multi-aset) dan pengembalian parsial
- Menyediakan admin dashboard real-time dan monitoring Node-RED
- Menyimpan audit trail lengkap dengan bukti foto

### 1.3 Aktor
| Aktor | Deskripsi |
|-------|-----------|
| **Mahasiswa (User)** | Melakukan peminjaman dan pengembalian aset via terminal RFID |
| **Admin** | Mengelola data user, aset, dan memantau aktivitas via web dashboard |
| **Sistem (IoT)** | ESP32-S3 + ESP32-CAM + Server melakukan otomatisasi |

---

## 2. Arsitektur Sistem

### 2.1 Komponen Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                       LOCAL WIFI NETWORK                        │
│                                                                 │
│  ┌───────────────┐     MQTT      ┌─────────────────────────┐   │
│  │   ESP32-S3    │◄────────────►│                         │   │
│  │  (Terminal)   │               │    PC Server (localhost) │   │
│  └───────────────┘               │                         │   │
│                                  │  ┌─────────────────────┐│   │
│  ┌───────────────┐  HTTP POST    │  │  Node.js + Express  ││   │
│  │   ESP32-CAM   │──────────────►│  │  (Port 3001)        ││   │
│  │  (Camera)     │               │  └────────┬────────────┘│   │
│  └───────────────┘               │           │             │   │
│                                  │  ┌─────────▼────────────┐│   │
│  ┌───────────────┐   REST API   │  │    PostgreSQL DB     ││   │
│  │  Next.js      │◄────────────►│  │    (Port 5432)       ││   │
│  │  Admin        │               │  └─────────────────────┘│   │
│  │  (Port 3000)  │               │                         │   │
│  └───────────────┘               │  ┌─────────────────────┐│   │
│                                  │  │  Mosquitto MQTT     ││   │
│  ┌───────────────┐   MQTT Sub   │  │  Broker (Port 1883) ││   │
│  │  Node-RED     │◄────────────►│  └─────────────────────┘│   │
│  │  (Port 1880)  │               └─────────────────────────┘   │
│  └───────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Stack Teknologi

| Layer | Teknologi | Port |
|-------|-----------|------|
| Firmware ESP32-S3 | Arduino IDE (C++) | — |
| Firmware ESP32-CAM | Arduino IDE (C++) | — |
| Backend API | Node.js + Express.js | 3001 |
| Database | PostgreSQL | 5432 |
| MQTT Broker | Mosquitto | 1883 |
| Admin Frontend | Next.js 14 (App Router) | 3000 |
| Monitoring | Node-RED | 1880 |

### 2.3 Jaringan
- **Rekomendasi**: Gunakan WiFi router lokal yang sudah ada di lab, atau aktifkan Mobile Hotspot dari PC server
- **IP Server**: Ditetapkan sebagai static IP (misalnya `192.168.1.100`) atau gunakan hostname
- Semua device (ESP32-S3, ESP32-CAM, browser admin, Node-RED) terhubung ke jaringan yang sama
- Konfigurasi IP server disimpan sebagai `SERVER_IP` di masing-masing firmware (define constant)

---

## 3. Hardware & Wiring

### 3.1 Komponen ESP32-S3 Terminal

| Komponen | Tipe | Jumlah |
|----------|------|--------|
| Mikrokontroler | ESP32-S3 | 1 |
| RFID Reader | PN532 | 1 |
| OLED Display | SSD1306 0.96" 128×64 (I2C) | 1 |
| Push Button | Momentary 3-pin | 2 |
| Buzzer | Active Buzzer 5V | 1 |
| NTAG213 Sticker | — | Sesuai jumlah aset + KTM |

### 3.2 Pin Assignment ESP32-S3

```
ESP32-S3 Pin    Komponen              Keterangan
─────────────   ───────────────────   ──────────────────────────────
GPIO 8 (SDA)    PN532 SDA             I2C Bus (shared dengan OLED)
GPIO 9 (SCL)    PN532 SCL             I2C Bus (shared dengan OLED)
GPIO 8 (SDA)    SSD1306 SDA           I2C Addr: 0x3C
GPIO 9 (SCL)    SSD1306 SCL           I2C Addr: 0x3C
                ** PN532 I2C Addr: 0x24
GPIO 0          Button A (KIRI)       INPUT_PULLUP, active LOW
GPIO 1          Button B (KANAN)      INPUT_PULLUP, active LOW
GPIO 2          Buzzer (+)            OUTPUT, active HIGH
3.3V / 5V       VCC komponen          Sesuai datasheet
GND             GND semua             Common ground
```

> **Catatan PN532**: Pastikan mode komunikasi PN532 diset ke **I2C** (switch SW1=OFF, SW2=OFF pada modul breakout). Jika menggunakan UART, gunakan GPIO43 (TX) dan GPIO44 (RX) dan update kode firmware.

### 3.3 Komponen ESP32-CAM

| Komponen | Tipe |
|----------|------|
| Mikrokontroler + Kamera | ESP32-CAM (AI-Thinker) + OV2640 |

> ESP32-CAM menggunakan koneksi WiFi. Flash via FTDI programmer (GPIO0 ke GND saat upload). Tidak ada komponen tambahan.

### 3.4 Tag NTAG213

- Setiap **KTM mahasiswa** ditempel 1 sticker NTAG213 → UID dipasangkan ke user di database
- Setiap **aset fisik individual** ditempel 1 sticker NTAG213 → UID dipasangkan ke asset di database
- Tidak ada data yang ditulis ke tag — sistem hanya membaca **7-byte UID**

---

## 4. Database Schema

### 4.1 Entity Relationship

```
users ─────────── borrow_sessions ─────── borrow_items ─── assets
  (1)                   (N)         (1)        (N)     (N)    (1)
                                                              │
                                                        asset_types (1)
```

### 4.2 DDL Lengkap

```sql
-- ============================================================
-- USERS: Mahasiswa yang terdaftar di sistem
-- ============================================================
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    nrp         VARCHAR(20)  UNIQUE NOT NULL,
    name        VARCHAR(100) NOT NULL,
    rfid_uid    VARCHAR(50)  UNIQUE NOT NULL,  -- UID dari NTAG213 di KTM
    created_at  TIMESTAMP    DEFAULT NOW(),
    updated_at  TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- ASSET_TYPES: Kategori/jenis aset (misal: "Bolpen", "Stopkontak")
-- ============================================================
CREATE TABLE asset_types (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- ============================================================
-- ASSETS: Aset fisik individual, masing-masing punya NTAG213
-- ============================================================
CREATE TABLE assets (
    id              SERIAL PRIMARY KEY,
    asset_type_id   INTEGER      NOT NULL REFERENCES asset_types(id) ON DELETE RESTRICT,
    rfid_uid        VARCHAR(50)  UNIQUE NOT NULL,  -- UID dari NTAG213 di aset
    label           VARCHAR(100),                  -- contoh: "Bolpen-003"
    is_available    BOOLEAN      DEFAULT TRUE,      -- FALSE jika sedang dipinjam
    created_at      TIMESTAMP    DEFAULT NOW()
);

-- ============================================================
-- BORROW_SESSIONS: Satu sesi peminjaman per transaksi
-- Satu user hanya boleh punya 1 sesi 'active' pada satu waktu
-- ============================================================
CREATE TABLE borrow_sessions (
    id              SERIAL PRIMARY KEY,
    user_id         INTEGER      NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status          VARCHAR(20)  NOT NULL DEFAULT 'active',
                    -- 'active'           : masih dipinjam
                    -- 'fully_returned'   : semua aset dikembalikan
                    -- 'partially_returned': sebagian sudah dikembalikan
    photo_path      VARCHAR(255),                  -- path file foto wajah peminjam
    borrowed_at     TIMESTAMP    DEFAULT NOW(),
    last_updated    TIMESTAMP    DEFAULT NOW()
);

-- Index untuk query "apakah user punya pinjaman aktif?"
CREATE INDEX idx_borrow_sessions_user_status
    ON borrow_sessions(user_id, status);

-- ============================================================
-- BORROW_ITEMS: Item individual dalam satu sesi
-- ============================================================
CREATE TABLE borrow_items (
    id              SERIAL PRIMARY KEY,
    session_id      INTEGER   NOT NULL REFERENCES borrow_sessions(id) ON DELETE RESTRICT,
    asset_id        INTEGER   NOT NULL REFERENCES assets(id) ON DELETE RESTRICT,
    borrowed_at     TIMESTAMP DEFAULT NOW(),
    returned_at     TIMESTAMP               -- NULL berarti belum dikembalikan
);

-- Pastikan satu aset tidak bisa ada di 2 sesi aktif sekaligus
-- (dihandle di application layer, bukan constraint DB)

-- ============================================================
-- VIEW: Berguna untuk dashboard admin
-- ============================================================
CREATE VIEW active_loans AS
    SELECT
        bs.id           AS session_id,
        u.nrp,
        u.name          AS user_name,
        at.name         AS asset_type,
        a.label         AS asset_label,
        bi.borrowed_at
    FROM borrow_items bi
    JOIN borrow_sessions bs  ON bi.session_id = bs.id
    JOIN users u             ON bs.user_id = u.id
    JOIN assets a            ON bi.asset_id = a.id
    JOIN asset_types at      ON a.asset_type_id = at.id
    WHERE bi.returned_at IS NULL
      AND bs.status = 'active';
```

### 4.3 Aturan Bisnis Database

| Aturan | Implementasi |
|--------|-------------|
| Satu user maks 1 sesi aktif | Cek di backend sebelum buat sesi baru |
| Aset tidak bisa dipinjam 2x | `assets.is_available = FALSE` saat dipinjam |
| Qty di OLED | `COUNT(bi.asset_id)` WHERE `asset_type_id` sama dalam 1 sesi |
| Status sesi | Update ke `partially_returned` jika ada `borrow_items` yang belum dikembalikan setelah return |

---

## 5. OLED UI State Machine

### 5.1 Layout Template (128×64)

```
+──────────────────────────────────+  ← y=0
│  TITLE BAR (tinggi 13px)         │
+──────────────────────────────────+  ← y=13
│                                  │
│  CONTENT AREA (tinggi 38px)      │  ← max ~4 baris teks kecil
│                                  │
+──────────────────────────────────+  ← y=51
│  BUTTON BAR (tinggi 13px)        │
│  [BTN_LEFT]         [BTN_RIGHT]  │
+──────────────────────────────────+  ← y=64
```

- **Font**: U8g2 font kecil (`u8g2_font_6x10_tf` atau `u8g2_font_5x8_tf`)
- **Invert**: Label tombol yang "aktif/direkomendasikan" ditampilkan dengan background putih (inverted)
- **Garis pemisah**: Horizontal line di y=13 dan y=51

### 5.2 Daftar State

```
STATE_HOME
STATE_KTM_INVALID
STATE_ACTION_SELECT
STATE_SCAN_ITEMS
STATE_SCAN_ITEM_FEEDBACK
STATE_BORROW_SUMMARY
STATE_BORROW_PROCESSING
STATE_BORROW_SUCCESS
STATE_RETURN_SCAN
STATE_RETURN_SCAN_FEEDBACK
STATE_RETURN_SUMMARY
STATE_RETURN_PROCESSING
STATE_RETURN_SUCCESS
STATE_ERROR
```

### 5.3 State Detail & Transisi

---

#### `STATE_HOME`
```
┌──────────────────────────────────┐
│  SmartLab Borrowing              │
├──────────────────────────────────┤
│                                  │
│    Scan KTM Anda                 │
│    untuk memulai...              │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Menunggu scan RFID (KTM)
- Kedua tombol tidak aktif / diabaikan
- Buzzer: diam

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| KTM di-scan, UID ditemukan di DB | `STATE_ACTION_SELECT` |
| KTM di-scan, UID tidak ditemukan | `STATE_KTM_INVALID` |

---

#### `STATE_KTM_INVALID`
```
┌──────────────────────────────────┐
│  KTM Tidak Dikenal               │
├──────────────────────────────────┤
│                                  │
│  UID tidak terdaftar             │
│  di sistem.                      │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 1 beep panjang (500ms)
- Auto-kembali ke `STATE_HOME` setelah **3 detik**
- Tombol diabaikan

---

#### `STATE_ACTION_SELECT`
```
┌──────────────────────────────────┐
│  Halo, [nama user]               │
├──────────────────────────────────┤
│  NRP : [nrp]                     │
│                                  │
│  Pilih aksi:                     │
│                                  │
├──────────────────────────────────┤
│  [PINJAM]           [KEMBALI]    │
└──────────────────────────────────┘
```
- Buzzer: 1 beep pendek (100ms) saat masuk state ini
- ESP32-CAM dipicu **mengambil foto saat state ini dimasuki**
  - Server mengirim MQTT `smartlab/cam/trigger` bersamaan dengan respons KTM
  - Foto disimpan sebagai **PENDING** di `uploads/temp/{session_token}.jpg`
- **Jika user memiliki sesi aktif**: label `[KEMBALI]` ditampilkan **inverted** (background putih)
- **Jika user tidak memiliki sesi aktif**: label `[KEMBALI]` ditampilkan normal (tidak inverted, tapi tetap bisa dipilih — akan error)
- Nama di-truncate jika panjang (max ~18 karakter)

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| Tombol A (KIRI / PINJAM) | `STATE_SCAN_ITEMS` |
| Tombol B (KANAN / KEMBALI), user punya sesi aktif | `STATE_RETURN_SCAN` |
| Tombol B (KANAN / KEMBALI), user tidak punya sesi aktif | `STATE_ERROR` ("Tidak ada pinjaman aktif"), lalu `STATE_HOME` setelah 3s + hapus foto pending |
| Timeout 30 detik tidak ada aksi | `STATE_HOME` + hapus foto pending |

---

#### `STATE_SCAN_ITEMS`
```
┌──────────────────────────────────┐
│  Scan Barang                     │
├──────────────────────────────────┤
│  Item: [nama_type terakhir]      │
│  Qty : [qty type tersebut]       │
│                                  │
│  Total: [total item di-scan]     │
├──────────────────────────────────┤
│  [Batal]             [Selesai>]  │
└──────────────────────────────────┘
```
- **Kondisi awal** (sebelum ada scan): "Item: -", "Qty: -", "Total: 0"
- Setiap kali aset di-scan:
  - Jika `asset_type` sama dengan item terakhir → `qty++`
  - Jika `asset_type` berbeda → tampilkan nama dan qty baru (qty = 1 untuk tipe baru ini)
  - Total item selalu bertambah
- Label `[Selesai>]` baru aktif (tidak disabled) jika total item ≥ 1
- Tombol B diabaikan jika total = 0 (buzzer 1 beep pendek sebagai feedback)

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| Scan RFID aset valid | `STATE_SCAN_ITEM_FEEDBACK` (flash 1s) → kembali `STATE_SCAN_ITEMS` |
| Scan RFID aset tidak valid / error | `STATE_SCAN_ITEM_FEEDBACK` (error, flash 1s) → kembali `STATE_SCAN_ITEMS` |
| Tombol A (Batal) | `STATE_HOME` + hapus foto pending + reset semua data sesi lokal |
| Tombol B (Selesai) + total ≥ 1 | `STATE_BORROW_SUMMARY` |

---

#### `STATE_SCAN_ITEM_FEEDBACK`
State sementara (1 detik) untuk menampilkan hasil scan aset.

**Skenario A — Scan berhasil:**
```
┌──────────────────────────────────┐
│  Scan Barang                     │
├──────────────────────────────────┤
│  ✓ [nama aset]                   │
│    ([label aset, misal Bolpen-3])│
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 1 beep pendek (80ms)

**Skenario B — Sudah di-scan di sesi ini:**
```
┌──────────────────────────────────┐
│  Scan Barang                     │
├──────────────────────────────────┤
│  ! Sudah di-scan                 │
│    [nama aset]                   │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 2 beep pendek (80ms, jeda 100ms, 80ms)

**Skenario C — Sedang dipinjam orang lain:**
```
┌──────────────────────────────────┐
│  Scan Barang                     │
├──────────────────────────────────┤
│  X Sedang dipinjam!              │
│    [nama aset]                   │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 2 beep pendek

**Skenario D — UID tidak dikenal:**
```
┌──────────────────────────────────┐
│  Scan Barang                     │
├──────────────────────────────────┤
│  X Barang tidak dikenal          │
│    (UID: [uid singkat])          │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 1 beep panjang (400ms)

---

#### `STATE_BORROW_SUMMARY`
```
┌──────────────────────────────────┐
│  Ringkasan Pinjaman              │
├──────────────────────────────────┤
│  Bolpen           x2             │
│  Stopkontak       x1             │
│  [item lain...]                  │
│  [auto-scroll jika > 3 baris]    │
├──────────────────────────────────┤
│  [Batal]          [Konfirmasi!]  │
└──────────────────────────────────┘
```
- Jika item > 3 baris: auto-scroll setiap **2 detik** (loop)
- Format tiap baris: `[nama_type]` + `x[qty]`, rata kanan untuk angka
- Label `[Konfirmasi!]` ditampilkan **inverted**

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| Tombol A (Batal) | `STATE_HOME` + hapus foto pending + reset data |
| Tombol B (Konfirmasi) | `STATE_BORROW_PROCESSING` |

---

#### `STATE_BORROW_PROCESSING`
```
┌──────────────────────────────────┐
│  Menyimpan...                    │
├──────────────────────────────────┤
│                                  │
│    Sedang memproses              │
│    pinjaman...                   │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Kirim MQTT `smartlab/session/create` ke server
- Kedua tombol diabaikan
- Timeout 5 detik → jika tidak ada respons → `STATE_ERROR`

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| MQTT `smartlab/session/response` success | `STATE_BORROW_SUCCESS` |
| MQTT `smartlab/session/response` error / timeout | `STATE_ERROR` |

---

#### `STATE_BORROW_SUCCESS`
```
┌──────────────────────────────────┐
│  Berhasil!                       │
├──────────────────────────────────┤
│                                  │
│  Peminjaman tercatat.            │
│  Jaga barang dengan baik!        │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 3 beep pendek (80ms, jeda 80ms, 3x)
- Foto pending dipindahkan ke permanen (`uploads/sessions/{session_id}.jpg`)
- Auto-kembali ke `STATE_HOME` setelah **3 detik**

---

#### `STATE_RETURN_SCAN`
```
┌──────────────────────────────────┐
│  Kembalikan Barang               │
├──────────────────────────────────┤
│  Scan barang yang               │
│  ingin dikembalikan...           │
│                                  │
│  Dikembalikan: [n] item          │
├──────────────────────────────────┤
│  [Batal]             [Selesai>]  │
└──────────────────────────────────┘
```
- Hanya aset yang **ada dalam sesi aktif user ini** yang diterima
- Scan aset yang bukan milik sesi ini → feedback error
- Label `[Selesai>]` aktif jika minimal 1 aset sudah di-scan untuk dikembalikan
- Tombol B diabaikan jika belum ada aset yang di-scan untuk dikembalikan

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| Scan RFID aset | `STATE_RETURN_SCAN_FEEDBACK` (flash 1s) → kembali `STATE_RETURN_SCAN` |
| Tombol A (Batal) | `STATE_HOME` + hapus foto pending |
| Tombol B (Selesai) + ≥ 1 aset | `STATE_RETURN_SUMMARY` |

---

#### `STATE_RETURN_SCAN_FEEDBACK`
Mirip `STATE_SCAN_ITEM_FEEDBACK`, tapi untuk konteks pengembalian.

**Skenario A — Aset diterima untuk dikembalikan:**
- Tampilkan: `✓ [nama aset]` + `([label])`
- Buzzer: 1 beep pendek

**Skenario B — Aset sudah di-mark untuk dikembalikan di sesi ini:**
- Tampilkan: `! Sudah di-scan`
- Buzzer: 2 beep pendek

**Skenario C — Aset bukan milik user ini:**
- Tampilkan: `X Bukan pinjaman Anda`
- Buzzer: 1 beep panjang

---

#### `STATE_RETURN_SUMMARY`
```
┌──────────────────────────────────┐
│  Konfirmasi Kembali              │
├──────────────────────────────────┤
│  Bolpen           x1             │
│  [item lain...]                  │
│                                  │
│  Sisa: [n] item blm kembali      │
├──────────────────────────────────┤
│  [Batal]          [Konfirmasi!]  │
└──────────────────────────────────┘
```
- Auto-scroll jika item > 2 baris
- "Sisa" = total item dalam sesi aktif − item yang akan dikembalikan sekarang
- Jika sisa = 0, tampilkan "Semua item dikembalikan"
- Label `[Konfirmasi!]` inverted

**Transisi:**
| Trigger | Target State |
|---------|-------------|
| Tombol A (Batal) | `STATE_HOME` + hapus foto pending |
| Tombol B (Konfirmasi) | `STATE_RETURN_PROCESSING` |

---

#### `STATE_RETURN_PROCESSING`
```
┌──────────────────────────────────┐
│  Menyimpan...                    │
├──────────────────────────────────┤
│                                  │
│    Memproses                     │
│    pengembalian...               │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Kirim MQTT `smartlab/return/confirm`
- Timeout 5 detik → `STATE_ERROR`

---

#### `STATE_RETURN_SUCCESS`
```
┌──────────────────────────────────┐
│  Berhasil!                       │
├──────────────────────────────────┤
│                                  │
│  Pengembalian tercatat.          │
│  Terima kasih!                   │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 2 beep pendek
- Auto-kembali ke `STATE_HOME` setelah **3 detik**
- Foto pending: tidak digunakan untuk return → **dihapus**

---

#### `STATE_ERROR`
```
┌──────────────────────────────────┐
│  Error                           │
├──────────────────────────────────┤
│                                  │
│  [pesan error]                   │
│                                  │
│                                  │
├──────────────────────────────────┤
│                                  │
└──────────────────────────────────┘
```
- Buzzer: 1 beep panjang (500ms)
- Auto-kembali ke `STATE_HOME` setelah **3 detik**
- Foto pending **dihapus** saat masuk state error

### 5.4 Buzzer Summary

| Event | Pola |
|-------|------|
| KTM valid (masuk STATE_ACTION_SELECT) | 1× pendek (100ms) |
| KTM tidak dikenal | 1× panjang (500ms) |
| Aset scan valid | 1× pendek (80ms) |
| Aset sudah di-scan / bukan milik user | 2× pendek (80ms, jeda 100ms) |
| Aset tidak dikenal / sedang dipinjam orang lain | 1× panjang (400ms) |
| Borrow sukses | 3× pendek (80ms, jeda 80ms) |
| Return sukses | 2× pendek (80ms, jeda 100ms) |
| Error / timeout | 1× panjang (500ms) |

### 5.5 Button Debounce
- Debounce: **50ms** hardware debounce via software (cek ulang setelah 50ms)
- Saat dalam STATE_PROCESSING atau STATE_*_FEEDBACK: tombol diabaikan

---

## 6. MQTT Protocol

### 6.1 Konfigurasi Broker
```
Host   : {SERVER_IP}
Port   : 1883
Auth   : None (jaringan lokal)
QoS    : 1 (at least once)
Retain : false (semua topic)
```

### 6.2 Topic Schema

Format: `smartlab/{modul}/{aksi}`

| Topic | Publisher | Subscriber | Payload |
|-------|-----------|------------|---------|
| `smartlab/ktm/scan` | ESP32-S3 | Backend | `{ "uid": "AABBCCDD", "session_token": "abc123" }` |
| `smartlab/ktm/response` | Backend | ESP32-S3 | [lihat 6.3] |
| `smartlab/asset/scan` | ESP32-S3 | Backend | `{ "uid": "AABBCCDD", "session_token": "abc123" }` |
| `smartlab/asset/response` | Backend | ESP32-S3 | [lihat 6.3] |
| `smartlab/session/create` | ESP32-S3 | Backend | [lihat 6.3] |
| `smartlab/session/response` | Backend | ESP32-S3 | `{ "success": true, "session_id": 42 }` |
| `smartlab/session/cancel` | ESP32-S3 | Backend | `{ "session_token": "abc123" }` |
| `smartlab/return/confirm` | ESP32-S3 | Backend | `{ "session_id": 42, "asset_ids": [1, 3] }` |
| `smartlab/return/result` | Backend | ESP32-S3 | `{ "success": true, "status": "partially_returned" }` |
| `smartlab/cam/trigger` | Backend | ESP32-CAM | `{ "session_token": "abc123" }` |
| `smartlab/heartbeat` | ESP32-S3 | Backend, Node-RED | `{ "status": "ok", "state": "STATE_HOME", "ts": 1234567890 }` |
| `smartlab/events` | Backend | Node-RED | [lihat 6.3] |

### 6.3 Payload Detail

**`smartlab/ktm/response`**
```json
// Sukses
{
  "valid": true,
  "user": {
    "id": 1,
    "name": "Budi Santoso",
    "nrp": "5023211001"
  },
  "has_active_loan": true,
  "active_session_id": 42,
  "session_token": "abc123"
}

// Gagal
{
  "valid": false,
  "reason": "USER_NOT_FOUND"
}
```

**`smartlab/asset/response`**
```json
// Sukses
{
  "valid": true,
  "asset": {
    "id": 7,
    "type_name": "Bolpen",
    "label": "Bolpen-003"
  },
  "already_in_session": false,
  "is_available": true
}

// Gagal
{
  "valid": false,
  "reason": "ASSET_NOT_FOUND" | "ASSET_UNAVAILABLE" | "ALREADY_IN_SESSION"
}
```

**`smartlab/session/create`**
```json
{
  "session_token": "abc123",
  "user_id": 1,
  "asset_ids": [7, 8, 12]
}
```

**`smartlab/events`** (untuk Node-RED)
```json
{
  "event": "BORROW_CREATED" | "RETURN_CONFIRMED" | "SESSION_CANCELLED" | "DEVICE_ONLINE" | "DEVICE_OFFLINE",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": { ... }
}
```

### 6.4 Session Token
- `session_token`: string UUID v4, di-generate oleh ESP32-S3 saat KTM valid
- Digunakan untuk mengkorelasikan request sebelum `session_id` DB ada
- Juga digunakan untuk penamaan file foto sementara

### 6.5 Timeout & Reconnect
- ESP32-S3 menunggu respons MQTT maksimal **5 detik**
- Jika timeout → masuk `STATE_ERROR`
- MQTT reconnect otomatis dengan exponential backoff (1s, 2s, 4s, max 30s)
- Saat reconnect, jika ada sesi lokal yang belum di-commit → batalkan + kembali ke `STATE_HOME`

---

## 7. REST API Specification

### 7.1 Base URL
```
http://{SERVER_IP}:3001/api
```

### 7.2 Authentication
- Endpoint `/api/auth/*`: public
- Semua endpoint lainnya: membutuhkan JWT Bearer token
- Header: `Authorization: Bearer {token}`
- Token expires: **24 jam**

### 7.3 Endpoints

#### Auth
```
POST   /api/auth/login
Body:  { "username": "admin", "password": "..." }
Resp:  { "token": "eyJ...", "expires_at": "..." }

POST   /api/auth/logout
Resp:  { "success": true }
```

#### Users
```
GET    /api/users?page=1&limit=20&search=budi
Resp:  { "data": [...users], "total": 100, "page": 1 }

POST   /api/users
Body:  { "nrp": "...", "name": "...", "rfid_uid": "..." }
Resp:  { "data": { ...user } }

GET    /api/users/:id
Resp:  { "data": { ...user, "active_session": {...} | null } }

PUT    /api/users/:id
Body:  { "name": "...", "rfid_uid": "..." }

DELETE /api/users/:id
-- Gagal jika user punya sesi aktif

GET    /api/users/:id/sessions?page=1&limit=10
Resp:  { "data": [...sessions with items and photos] }
```

#### Asset Types
```
GET    /api/asset-types
POST   /api/asset-types       Body: { "name": "...", "description": "..." }
PUT    /api/asset-types/:id
DELETE /api/asset-types/:id   -- Gagal jika ada aset dengan tipe ini
```

#### Assets
```
GET    /api/assets?type_id=1&available=true&page=1&limit=20
POST   /api/assets
Body:  { "asset_type_id": 1, "rfid_uid": "...", "label": "Bolpen-003" }
GET    /api/assets/:id
PUT    /api/assets/:id
DELETE /api/assets/:id        -- Gagal jika sedang dipinjam
```

#### Borrow Sessions
```
GET    /api/sessions?status=active&user_id=1&page=1&limit=20
Resp:  { "data": [...sessions], "total": ... }

GET    /api/sessions/:id
Resp:  {
  "data": {
    "id": 42,
    "user": { "nrp", "name" },
    "status": "active",
    "borrowed_at": "...",
    "photo_url": "/api/sessions/42/photo",
    "items": [
      { "asset_id": 7, "type_name": "Bolpen", "label": "Bolpen-003", "returned_at": null }
    ]
  }
}

PUT    /api/sessions/:id/return
Body:  { "asset_ids": [7, 8], "force_all": false }
-- Manual override oleh admin
Resp:  { "success": true, "new_status": "fully_returned" }

GET    /api/sessions/:id/photo
-- Mengembalikan file gambar JPEG (dengan auth)
Resp:  image/jpeg
```

#### Photo (ESP32-CAM → Backend)
```
POST   /api/photo/upload
Content-Type: multipart/form-data
Fields: photo (file), session_token (string)
-- Endpoint ini TIDAK memerlukan JWT (diakses oleh ESP32-CAM)
-- Diamankan dengan: hanya menerima dari IP lokal / shared secret header
Resp:  { "success": true, "temp_path": "uploads/temp/abc123.jpg" }

DELETE /api/photo/temp/:session_token
-- Hapus foto sementara saat sesi dibatalkan
Resp:  { "success": true }
```

#### Dashboard Stats
```
GET    /api/stats/overview
Resp:  {
  "total_assets": 50,
  "available_assets": 43,
  "active_sessions": 3,
  "borrows_today": 12,
  "borrows_this_week": 47
}

GET    /api/stats/activity?limit=20
Resp:  { "data": [...recent_events] }

GET    /api/stats/top-assets?days=30&limit=10
Resp:  { "data": [{ "type_name": "Bolpen", "borrow_count": 45 }] }
```

---

## 8. ESP32-S3 Firmware

### 8.1 Library Dependencies (Arduino)

| Library | Versi | Keperluan |
|---------|-------|-----------|
| Adafruit PN532 | ^1.3.0 | RFID reader |
| U8g2 | ^2.35.x | OLED SSD1306 |
| PubSubClient | ^2.8.0 | MQTT client |
| ArduinoJson | ^6.21.x | JSON parse/build |
| WiFi (built-in ESP32) | — | WiFi |

### 8.2 Konstanta Konfigurasi (top of .ino file)

```cpp
// === NETWORK ===
#define WIFI_SSID       "nama_wifi_lab"
#define WIFI_PASSWORD   "password_wifi"
#define SERVER_IP       "192.168.1.100"
#define MQTT_PORT       1883
#define DEVICE_ID       "esp32s3-smartlab-01"

// === PIN ASSIGNMENT ===
#define PIN_BTN_LEFT    0     // Button A (Cancel/Kiri)
#define PIN_BTN_RIGHT   1     // Button B (Next/Kanan)
#define PIN_BUZZER      2     // Active buzzer
#define PIN_I2C_SDA     8
#define PIN_I2C_SCL     9

// === I2C ADDRESS ===
#define OLED_ADDR       0x3C
#define PN532_I2C_ADDR  0x24

// === TIMEOUT ===
#define MQTT_RESPONSE_TIMEOUT_MS   5000
#define STATE_ERROR_DISPLAY_MS     3000
#define STATE_SUCCESS_DISPLAY_MS   3000
#define STATE_ACTION_TIMEOUT_MS    30000
#define SCROLL_INTERVAL_MS         2000
#define DEBOUNCE_MS                50
#define HEARTBEAT_INTERVAL_MS      30000
```

### 8.3 Struktur Data Lokal (RAM)

```cpp
struct ScannedItem {
    int asset_id;
    char type_name[32];
    char label[32];
};

struct SessionLocal {
    char session_token[37];     // UUID v4
    int user_id;
    char user_name[50];
    char user_nrp[20];
    bool has_active_loan;
    int active_session_id;
    ScannedItem items[20];      // max 20 item per sesi
    int item_count;
    int return_asset_ids[20];   // untuk return flow
    int return_count;
};
```

### 8.4 Alur Utama (loop)

```
loop():
  1. Handle WiFi reconnect jika disconnect
  2. mqttClient.loop()
  3. Cek button press (dengan debounce)
  4. Cek RFID scan (non-blocking polling)
  5. Cek timeout state aktif
  6. Heartbeat setiap HEARTBEAT_INTERVAL_MS
  7. Update OLED jika ada perubahan state (dirty flag)
```

### 8.5 UUID Generator
ESP32-S3 tidak punya hardware UUID generator. Gunakan kombinasi:
```cpp
// Gunakan esp_random() untuk generate UUID v4
String generateUUID() { ... }
```

---

## 9. ESP32-CAM Firmware

### 9.1 Library Dependencies

| Library | Versi | Keperluan |
|---------|-------|-----------|
| WiFi (built-in) | — | WiFi |
| HTTPClient (built-in) | — | HTTP POST |
| esp_camera (built-in ESP32) | — | OV2640 |
| PubSubClient | ^2.8.0 | MQTT (subscribe trigger) |
| ArduinoJson | ^6.21.x | JSON |

### 9.2 Konfigurasi Kamera (AI-Thinker ESP32-CAM)

```cpp
#define CAMERA_MODEL_AI_THINKER
// Pin kamera sudah fixed di modul AI-Thinker:
// PWDN=32, RESET=-1, XCLK=0, SIO_D=26, SIO_C=27
// D7=35, D6=34, D5=39, D4=36, D3=21, D2=19, D1=18, D0=5
// VSYNC=25, HREF=23, PCLK=22

// Konfigurasi capture
#define FRAME_SIZE    FRAMESIZE_VGA    // 640x480
#define JPEG_QUALITY  12               // 0-63, makin kecil makin bagus
```

### 9.3 Alur Firmware ESP32-CAM

```
1. Setup WiFi
2. Setup MQTT, subscribe ke "smartlab/cam/trigger"
3. Setup kamera
4. loop():
   a. mqttClient.loop()
   b. Jika terima trigger MQTT:
      - Ambil session_token dari payload
      - Capture foto (fb = esp_camera_fb_get())
      - HTTP POST ke http://{SERVER_IP}:3001/api/photo/upload
        - Multipart form: photo + session_token
      - esp_camera_fb_return(fb)
      - Reconnect MQTT jika disconnect
```

### 9.4 HTTP POST Format (dari ESP32-CAM)
```
POST /api/photo/upload HTTP/1.1
Content-Type: multipart/form-data; boundary=----boundary
X-Device-Secret: {SHARED_SECRET}   ← shared secret untuk autentikasi

------boundary
Content-Disposition: form-data; name="session_token"
abc123
------boundary
Content-Disposition: form-data; name="photo"; filename="photo.jpg"
Content-Type: image/jpeg
[binary JPEG data]
------boundary--
```

---

## 10. Backend (Node.js)

### 10.1 Dependency Utama

```json
{
  "dependencies": {
    "express": "^4.18.x",
    "pg": "^8.11.x",
    "mqtt": "^5.x",
    "jsonwebtoken": "^9.x",
    "bcryptjs": "^2.x",
    "multer": "^1.4.x",
    "uuid": "^9.x",
    "cors": "^2.x",
    "dotenv": "^16.x"
  }
}
```

### 10.2 Environment Variables (.env)

```env
PORT=3001
DATABASE_URL=postgresql://user:pass@localhost:5432/smartlab
JWT_SECRET=your_jwt_secret_here
MQTT_BROKER_URL=mqtt://localhost:1883
UPLOADS_DIR=./uploads
CAM_DEVICE_SECRET=your_cam_secret_here
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=$2b$10$...
```

### 10.3 Modul MQTT Handler (backend)

Backend subscribe ke semua topic `smartlab/#` dan merespons sesuai:

```
ON smartlab/ktm/scan:
  1. Query users WHERE rfid_uid = uid
  2. Jika tidak ditemukan → publish smartlab/ktm/response (valid:false)
  3. Jika ditemukan:
     a. Cek borrow_sessions WHERE user_id AND status='active'
     b. Publish smartlab/ktm/response (valid:true, user data, has_active_loan)
     c. Publish smartlab/cam/trigger (session_token)

ON smartlab/asset/scan:
  1. Query assets WHERE rfid_uid = uid
  2. Validasi: ada di DB? is_available?
  3. Cek apakah asset_id sudah ada di session (backend track via session_token cache)
  4. Publish smartlab/asset/response

ON smartlab/session/create:
  1. BEGIN transaction
  2. INSERT borrow_sessions
  3. UPDATE assets SET is_available=false
  4. INSERT borrow_items (semua asset_id)
  5. Pindahkan foto dari temp ke sessions/{session_id}.jpg
  6. UPDATE borrow_sessions SET photo_path
  7. COMMIT
  8. Publish smartlab/session/response
  9. Publish smartlab/events (BORROW_CREATED)

ON smartlab/session/cancel:
  1. Hapus file foto temp/{session_token}.jpg
  2. Publish smartlab/events (SESSION_CANCELLED)

ON smartlab/return/confirm:
  1. BEGIN transaction
  2. UPDATE borrow_items SET returned_at=NOW() WHERE id IN asset_ids
  3. UPDATE assets SET is_available=true WHERE id IN asset_ids
  4. Cek apakah semua item sudah returned
  5. UPDATE borrow_sessions SET status, last_updated
  6. COMMIT
  7. Publish smartlab/return/result
  8. Publish smartlab/events (RETURN_CONFIRMED)
```

### 10.4 Penyimpanan Foto

```
backend/
└── uploads/
    ├── temp/
    │   └── {session_token}.jpg    ← foto sementara
    └── sessions/
        └── {session_id}.jpg       ← foto permanen setelah borrow confirm
```

- Foto temp dihapus jika: sesi dibatalkan, timeout >10 menit (cron cleanup)
- Foto sessions diakses via `GET /api/sessions/:id/photo` (dengan JWT auth)

---

## 11. Frontend Admin (Next.js)

### 11.1 Halaman & Fitur

| Route | Halaman | Fitur |
|-------|---------|-------|
| `/login` | Login | Form login admin, JWT storage |
| `/` | Dashboard | Stats overview, activity feed real-time |
| `/users` | Daftar User | Tabel user, search, tambah/edit/hapus |
| `/users/[id]` | Detail User | Info user, riwayat pinjaman + foto |
| `/assets` | Daftar Aset | Tabel aset dengan filter tipe, status ketersediaan |
| `/assets/types` | Tipe Aset | CRUD tipe aset |
| `/sessions` | Sesi Pinjaman | Filter by status/user/tanggal, tabel |
| `/sessions/[id]` | Detail Sesi | Info lengkap + foto + tombol return manual |
| `/settings` | Pengaturan | Ganti password admin |

### 11.2 Dashboard Real-time
- Gunakan **polling** ke `GET /api/stats/overview` setiap **10 detik**
- Gunakan **polling** ke `GET /api/stats/activity` setiap **5 detik**
- (Opsional v2: ganti dengan WebSocket untuk live update)

### 11.3 Komponen Utama
- `StatsCard`: Kartu statistik (total aset, available, active loans, today)
- `ActivityFeed`: List event terbaru
- `SessionTable`: Tabel sesi dengan badge status berwarna
- `PhotoModal`: Modal untuk melihat foto peminjam
- `RFIDRegister`: Form untuk mendaftarkan UID baru via input manual

---

## 12. Node-RED Dashboard

### 12.1 MQTT Subscriptions
Node-RED subscribe ke:
- `smartlab/events` → semua event sistem
- `smartlab/heartbeat` → status device ESP32-S3

### 12.2 Panel Dashboard

| Panel | Tipe Node | Data Source |
|-------|-----------|-------------|
| Status Device | `ui_indicator` | `smartlab/heartbeat` |
| Event Feed | `ui_table` | `smartlab/events` |
| Aset Tersedia | `ui_gauge` | `GET /api/stats/overview` (inject timer) |
| Sesi Aktif | `ui_text` | `GET /api/stats/overview` |
| Peminjaman Hari Ini | `ui_chart` | `GET /api/stats/overview` |
| Aktivitas Terbaru | `ui_template` (HTML table) | `GET /api/stats/activity` |

### 12.3 Alert
- Jika `smartlab/heartbeat` tidak diterima >60 detik → tampilkan alert "Device offline" di dashboard

---

## 13. Non-Functional Requirements

### 13.1 Performa
| Metrik | Target |
|--------|--------|
| Respons MQTT (scan → feedback OLED) | < 500ms |
| Foto upload (ESP32-CAM → server) | < 3 detik |
| Response tombol OLED | < 50ms |
| API response time (admin dashboard) | < 200ms |

### 13.2 Keandalan
- ESP32-S3 harus auto-reconnect WiFi dan MQTT tanpa perlu restart manual
- Backend harus graceful restart jika crash (gunakan PM2)
- Data sesi yang sedang dalam proses tidak boleh hilang jika koneksi putus sesaat

### 13.3 Keamanan
- Admin dashboard dilindungi JWT
- Foto peminjam hanya dapat diakses via authenticated API (bukan file statis publik)
- ESP32-CAM foto upload menggunakan shared secret di header
- MQTT tidak menggunakan auth (acceptable untuk jaringan lokal terisolasi)
- Password admin di-hash dengan bcrypt

### 13.4 Skalabilitas (untuk versi ini)
- Single terminal (1x ESP32-S3 + 1x ESP32-CAM)
- Multi-terminal dapat ditambahkan di masa depan dengan menambahkan `device_id` pada MQTT topics

---

## 14. Error Handling

### 14.1 Error Codes (MQTT)

| Code | Deskripsi |
|------|-----------|
| `USER_NOT_FOUND` | UID KTM tidak terdaftar |
| `ASSET_NOT_FOUND` | UID aset tidak terdaftar |
| `ASSET_UNAVAILABLE` | Aset sedang dipinjam |
| `ALREADY_IN_SESSION` | Aset sudah di-scan di sesi ini |
| `NOT_USER_ASSET` | Aset bukan milik sesi user ini (untuk return) |
| `USER_HAS_ACTIVE_SESSION` | User mencoba borrow padahal punya sesi aktif |
| `SESSION_NOT_FOUND` | session_id tidak ditemukan |
| `DB_ERROR` | Error database internal |

### 14.2 Firmware Error Handling

| Kondisi | Handling |
|---------|---------|
| WiFi tidak terhubung saat startup | Retry setiap 5s, tampilkan "Connecting WiFi..." di OLED |
| MQTT tidak terhubung | Retry dengan backoff, tampilkan "Connecting Server..." |
| MQTT response timeout (>5s) | Masuk STATE_ERROR, tampilkan pesan, kembali HOME |
| Foto upload gagal | Log error, lanjutkan proses (foto tidak tersimpan, sistem tetap berjalan) |
| Scan RFID error (hardware) | Log error, tampilkan "RFID Error, restart" di OLED |

---

## 15. Struktur Folder Proyek

```
smartlab-borrowing/
│
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── users.js
│   │   │   ├── assets.js
│   │   │   ├── sessions.js
│   │   │   ├── photo.js
│   │   │   └── stats.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── usersController.js
│   │   │   ├── assetsController.js
│   │   │   ├── sessionsController.js
│   │   │   └── statsController.js
│   │   ├── mqtt/
│   │   │   ├── mqttClient.js        ← setup koneksi broker
│   │   │   └── handlers.js          ← semua logic handler MQTT
│   │   ├── db/
│   │   │   ├── index.js             ← pg pool setup
│   │   │   └── schema.sql           ← DDL lengkap
│   │   ├── middleware/
│   │   │   ├── auth.js              ← JWT verify middleware
│   │   │   └── upload.js            ← multer config
│   │   └── index.js                 ← entry point
│   ├── uploads/
│   │   ├── temp/
│   │   └── sessions/
│   ├── .env
│   ├── .env.example
│   └── package.json
│
├── frontend/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.jsx
│   │   ├── (dashboard)/
│   │   │   ├── layout.jsx
│   │   │   ├── page.jsx             ← dashboard overview
│   │   │   ├── users/
│   │   │   ├── assets/
│   │   │   ├── sessions/
│   │   │   └── settings/
│   │   └── layout.jsx
│   ├── components/
│   │   ├── ui/
│   │   ├── StatsCard.jsx
│   │   ├── ActivityFeed.jsx
│   │   ├── SessionTable.jsx
│   │   └── PhotoModal.jsx
│   ├── lib/
│   │   ├── api.js                   ← axios/fetch wrapper
│   │   └── auth.js                  ← JWT helpers
│   ├── .env.local
│   └── package.json
│
├── esp32s3firmware/
│   └── esp32s3firmware.ino          ← single file Arduino
│
├── esp32camfirmware/
│   └── esp32camfirmware.ino         ← single file Arduino
│
├── nodered/
│   └── flows.json                   ← export Node-RED flow
│
└── README.md
```

---

## Appendix A: Urutan Implementasi yang Disarankan

Karena proyek ini menggunakan **spec-driven development**, urutan ini memastikan setiap sesi chat memiliki konteks yang cukup:

```
Fase 1 — Foundation
  [1] Backend: schema.sql + db setup
  [2] Backend: MQTT handlers (KTM scan, asset scan, session create)
  [3] Backend: REST API (auth, users, assets, sessions, stats)

Fase 2 — Firmware
  [4] ESP32-CAM firmware (WiFi + MQTT subscribe + HTTP POST foto)
  [5] ESP32-S3 firmware (semua state machine + MQTT + OLED + buzzer + button)

Fase 3 — UI
  [6] Frontend Next.js admin dashboard
  [7] Node-RED flow export

Fase 4 — Integrasi & Testing
  [8] End-to-end test semua flow
  [9] Error handling & edge case
```

---

*SmartLab Asset Borrowing System — Requirements Specification v1.0*
*Dokumen ini menjadi acuan untuk semua sesi development selanjutnya.*
