# SmartLab Asset Borrowing System
## Technical Specification v1.2

> Dokumen ini adalah acuan implementasi teknis. Baca tuntas sebelum membuka IDE.

---

## Daftar Isi
1. [Version Manifest](#1-version-manifest)
2. [Compatibility Warnings](#2-compatibility-warnings)
3. [Environment Setup](#3-environment-setup)
4. [ESP32-S3 Firmware Spec](#4-esp32-s3-firmware-spec)
5. [ESP32-CAM Firmware Spec](#5-esp32-cam-firmware-spec)
6. [Backend Spec (Node.js)](#6-backend-spec-nodejs)
7. [Frontend Spec (Next.js)](#7-frontend-spec-nextjs)
8. [Node-RED Spec](#8-node-red-spec)
9. [Environment Variables](#9-environment-variables)

---

## 1. Version Manifest

### 1.1 Arduino / Firmware

| Library | Versi | Install Via | Catatan |
|---------|-------|-------------|---------|
| **esp32 by Espressif Systems** (Board Package) | **3.3.3** | Arduino Board Manager | Board URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json` |
| **Adafruit PN532** | **1.3.4** | Arduino Library Manager | Untuk PN532 RFID |
| **Adafruit BusIO** | **1.17.2** | Arduino Library Manager | Dependency wajib Adafruit PN532 — install terpisah |
| **U8g2** | **2.36.19** | Arduino Library Manager | OLED SSD1306 |
| **PubSubClient** | **2.8** | Arduino Library Manager | MQTT client |
| **ArduinoJson** | **7.4.3** | Arduino Library Manager | ⚠️ Breaking changes dari v6 — lihat §2 |

### 1.2 Backend

| Package | Versi | Catatan |
|---------|-------|---------|
| **Node.js** | **22.x LTS** | Runtime |
| express | 5.2.1 | ⚠️ Breaking changes dari v4 — lihat §2 |
| pg | 8.21.0 | PostgreSQL client |
| mqtt | 5.15.1 | MQTT client (server-side) |
| jsonwebtoken | 9.0.3 | JWT auth |
| bcryptjs | 3.0.3 | Password hashing |
| multer | 2.1.1 | File upload middleware ⚠️ |
| uuid | 14.0.0 | UUID generator |
| cors | 2.8.6 | CORS middleware |
| dotenv | 17.4.2 | Environment variables |
| helmet | 8.2.0 | HTTP security headers |
| express-validator | 7.3.2 | Input validation |
| morgan | 1.11.0 | HTTP request logger |
| compression | 1.8.1 | Response compression |
| pm2 | 7.0.1 | Process manager (global install) |

### 1.3 Frontend

| Package | Versi | Catatan |
|---------|-------|---------|
| next | 16.2.9 | App Router (default) |
| react | (bundled dengan Next) | — |
| react-dom | (bundled dengan Next) | — |

### 1.4 Infrastructure

| Software | Versi | Keperluan |
|----------|-------|-----------|
| **PostgreSQL** | **17.x** | Database |
| **Mosquitto** | **2.0.x** | MQTT Broker |
| **Node-RED** | **5.0.0** | Monitoring dashboard |

---

## 2. Compatibility Warnings

### ⚠️ WAJIB BACA SEBELUM CODING

---

### 2.1 ArduinoJson v7 — Breaking Changes dari v6

| v6 (LAMA — JANGAN PAKAI) | v7 (GUNAKAN INI) |
|--------------------------|------------------|
| `StaticJsonDocument<256> doc;` | `JsonDocument doc;` |
| `DynamicJsonDocument doc(1024);` | `JsonDocument doc;` |
| `doc.capacity()` | Tidak ada — v7 auto-resize |
| Zero-copy mode (mengubah payload buffer) | Tidak ada di v7 |

**Pattern yang benar untuk v7:**
```cpp
// PARSING (misalnya di MQTT callback)
JsonDocument doc;
DeserializationError err = deserializeJson(doc, payload, length);
if (err) { /* handle error */ return; }
const char* name = doc["user"]["name"];
int userId = doc["user"]["id"];

// BUILDING
JsonDocument outDoc;
outDoc["uid"] = "AABBCCDD";
outDoc["session_token"] = sessionToken;
char buf[256];
serializeJson(outDoc, buf);
mqttClient.publish("smartlab/ktm/scan", buf);
```

---

### 2.2 PubSubClient v2.8 — Buffer Size

Default `MQTT_MAX_PACKET_SIZE` adalah **256 bytes** — terlalu kecil untuk payload JSON kita.
Wajib dipanggil di `setup()`:
```cpp
mqttClient.setBufferSize(1024);
```
Atau define sebelum include:
```cpp
#define MQTT_MAX_PACKET_SIZE 1024
#include <PubSubClient.h>
```

---

### 2.3 ESP32 Core 3.x — Wire dengan Custom Pins

Di core 3.x, cara init I2C dengan pin custom tetap sama:
```cpp
Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);  // HARUS dipanggil SEBELUM nfc.begin() dan u8g2.begin()
```
PN532 dan SSD1306 bisa share satu I2C bus karena alamat berbeda (0x24 vs 0x3C).

---

### 2.4 Express 5 — Breaking Changes dari v4

| v4 | v5 |
|----|-----|
| Async error tidak otomatis di-catch | Async error otomatis diteruskan ke error handler |
| `app.listen(port, cb)` sync | `app.listen(port, cb)` tetap sync — kembalikan `net.Server`, BUKAN Promise |
| `req.param()` | Hapus — gunakan `req.params`, `req.query`, `req.body` |
| `res.json(obj)` setelah response dikirim = crash | v5 menangani lebih graceful |

Error handler di v5 tetap butuh 4 parameter:
```js
app.use((err, req, res, next) => {
  res.status(err.status || 500).json({ error: err.message });
});
```

Async route di v5 tidak perlu try/catch untuk forward ke error handler:
```js
// v5: jika async throw, otomatis ke error handler
app.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users.rows);
});
```

---

### 2.5 multer v2.x — Perubahan

API utama (`single`, `array`, `fields`, `none`) **tidak berubah**.
Yang berubah:
- `fileFilter` callback: error handling berbeda jika melempar error
- Minimum Node.js: 10.16.0 (tidak relevan karena kita pakai 22 LTS)
- Fix CVE-2025-47944: jangan pakai v1.x

Penggunaan normal tidak perlu perubahan dari pola v1.

---

### 2.6 uuid v14 — API

```js
// Import
import { v4 as uuidv4 } from 'uuid';       // ESM
const { v4: uuidv4 } = require('uuid');    // CJS

// Usage (sama seperti sebelumnya)
const id = uuidv4();  // "550e8400-e29b-41d4-a716-446655440000"
```

---

### 2.7 ESP32-CAM — Pin Conflict

Pada AI-Thinker ESP32-CAM:
- **GPIO4** = Flash LED (HIGH = ON) — jangan pakai untuk I/O lain
- **GPIO0** = Mode select: **LOW saat upload**, HIGH saat normal operation
- SD Card dan camera berbagi beberapa GPIO — jangan pakai SD Card bersamaan dengan camera

---

### 2.8 PN532 I2C Mode Setup

Pada modul breakout PN532, pastikan DIP switch di-set ke mode I2C:
- **SW1 = OFF (0)**
- **SW2 = OFF (0)**

---

## 3. Environment Setup

### 3.1 Prasyarat

```
Node.js 22.x LTS      → https://nodejs.org/
PostgreSQL 17.x       → https://www.postgresql.org/download/
Mosquitto 2.0.x       → https://mosquitto.org/download/
Arduino IDE 2.x       → https://www.arduino.cc/en/software
```

### 3.2 Install Arduino Board & Libraries

**Step 1 — Tambah ESP32 Board URL ke Arduino IDE:**
```
File → Preferences → Additional Boards Manager URLs:
https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
```

**Step 2 — Install Board Package:**
```
Tools → Board → Boards Manager → cari "esp32" by Espressif → Install versi 3.3.3
```

**Step 3 — Install Libraries via Library Manager:**
```
Tools → Manage Libraries → install masing-masing:
- "Adafruit PN532" by Adafruit → versi 1.3.4
- "Adafruit BusIO" by Adafruit → versi 1.17.2
- "U8g2" by oliver → versi 2.36.19
- "PubSubClient" by Nick O'Leary → versi 2.8
- "ArduinoJson" by Benoit Blanchon → versi 7.4.3
```

**Step 4 — Board Selection:**
- ESP32-S3: `Tools → Board → esp32 → ESP32S3 Dev Module`
  - Flash Size: 4MB (atau sesuai modul)
  - PSRAM: Disabled (kecuali board Anda punya PSRAM)
  - USB CDC On Boot: Enabled (untuk Serial monitor via USB)
- ESP32-CAM: `Tools → Board → esp32 → AI Thinker ESP32-CAM`
  - Upload via FTDI: GPIO0 dihubungkan ke GND saat upload, lepas untuk operasi normal

### 3.3 Install & Konfigurasi Mosquitto

**Windows:**
Download installer dari mosquitto.org, install as service.

**Konfigurasi** (`mosquitto.conf`):
```conf
# Izinkan koneksi tanpa auth (untuk jaringan lokal)
listener 1883
allow_anonymous true

# Log (opsional, untuk debug)
log_type all
log_dest file C:/mosquitto/log/mosquitto.log
```

**Start:**
```bash
# Windows (setelah install sebagai service)
net start mosquitto

# Linux/macOS
mosquitto -c /etc/mosquitto/mosquitto.conf -d
```

### 3.4 Setup PostgreSQL

```bash
# Buat database dan user
psql -U postgres

CREATE DATABASE smartlab;
CREATE USER smartlab_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE smartlab TO smartlab_user;
\c smartlab
GRANT ALL ON SCHEMA public TO smartlab_user;
\q

# Jalankan DDL schema (dari backend/src/db/schema.sql)
psql -U smartlab_user -d smartlab -f backend/src/db/schema.sql
```

### 3.5 Install Backend Dependencies

```bash
cd backend
npm install express@5.2.1 pg@8.21.0 mqtt@5.15.1 jsonwebtoken@9.0.3 bcryptjs@3.0.3 multer@2.1.1 uuid@14.0.0 cors@2.8.6 dotenv@17.4.2 helmet@8.2.0 express-validator@7.3.2 morgan@1.11.0 compression@1.8.1
npm install -g pm2@7.0.1
```

### 3.6 Install Frontend Dependencies

```bash
cd frontend
npx create-next-app@16.2.9 . --app --no-src-dir --no-tailwind --import-alias "@/*"
# Atau jika sudah ada package.json, cukup:
npm install next@16.2.9
```

### 3.7 Install Node-RED

```bash
npm install -g node-red@5.0.0
node-red   # Akses via http://localhost:1880
```

### 3.8 Jalankan Semua Service (Development)

```bash
# Terminal 1: Mosquitto
mosquitto -c mosquitto.conf

# Terminal 2: Backend
cd backend && node src/index.js
# atau dengan PM2:
pm2 start src/index.js --name smartlab-backend

# Terminal 3: Frontend
cd frontend && npm run dev

# Terminal 4: Node-RED
node-red
```

---

## 4. ESP32-S3 Firmware Spec

### 4.1 File: `esp32s3firmware/esp32s3firmware.ino`

### 4.2 Library Includes & Order

```cpp
// Urutan include PENTING
#include <Wire.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <Adafruit_PN532.h>
#include <U8g2lib.h>
#include <ArduinoJson.h>  // v7: tidak perlu parameter kapasitas
```

### 4.3 Konstanta & Pin (Top of File)

```cpp
// ============================================================
// NETWORK CONFIGURATION
// ============================================================
#define WIFI_SSID         "nama_wifi_lab"
#define WIFI_PASSWORD     "password_wifi"
#define MQTT_BROKER_IP    "192.168.1.100"   // IP statis PC server
#define MQTT_PORT         1883
#define DEVICE_ID         "esp32s3-smartlab-01"

// ============================================================
// SERVER
// ============================================================
#define BACKEND_URL       "http://192.168.1.100:3001"

// ============================================================
// PIN ASSIGNMENT
// ============================================================
#define PIN_I2C_SDA       8
#define PIN_I2C_SCL       9
#define PIN_BTN_LEFT      0    // Button A: Cancel / Kiri
#define PIN_BTN_RIGHT     1    // Button B: Next/Confirm / Kanan
#define PIN_BUZZER        2    // Active buzzer

// ============================================================
// I2C ADDRESSES
// ============================================================
// PN532  → 0x24 (fixed by hardware, I2C mode: SW1=OFF, SW2=OFF)
// SSD1306 → 0x3C (paling umum; jika tidak work coba 0x3D)

// ============================================================
// MQTT TOPICS
// ============================================================
#define TOPIC_KTM_SCAN      "smartlab/ktm/scan"
#define TOPIC_KTM_RESP      "smartlab/ktm/response"
#define TOPIC_ASSET_SCAN    "smartlab/asset/scan"
#define TOPIC_ASSET_RESP    "smartlab/asset/response"
#define TOPIC_SESSION_CREATE "smartlab/session/create"
#define TOPIC_SESSION_RESP   "smartlab/session/response"
#define TOPIC_SESSION_CANCEL "smartlab/session/cancel"
#define TOPIC_RETURN_CONFIRM "smartlab/return/confirm"
#define TOPIC_RETURN_RESULT  "smartlab/return/result"
#define TOPIC_HEARTBEAT      "smartlab/heartbeat"

// ============================================================
// TIMING (milliseconds)
// ============================================================
#define MQTT_RESPONSE_TIMEOUT   5000
#define STATE_DISPLAY_DURATION  3000   // SUCCESS / ERROR / KTM_INVALID
#define ACTION_IDLE_TIMEOUT     30000  // Timeout di ACTION_SELECT
#define SCROLL_INTERVAL         2000   // Auto-scroll summary
#define DEBOUNCE_DELAY          50
#define HEARTBEAT_INTERVAL      30000

// ============================================================
// LIMITS
// ============================================================
#define MAX_ITEMS_PER_SESSION   20
```

### 4.4 Object Declarations

```cpp
// I2C Wire object (shared antara PN532 dan OLED)
// Tidak perlu deklarasi eksplisit — pakai Wire global

// OLED: SSD1306 128x64 I2C, full buffer mode (_F_)
// U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);

// PN532 — I2C mode: constructor pakai IRQ dan RESET pin
// Gunakan -1 jika pin IRQ/RESET tidak dipakai
#define PN532_IRQ_PIN   -1   // Opsional: sambungkan ke GPIO jika punya
#define PN532_RESET_PIN -1
Adafruit_PN532 nfc(PN532_IRQ_PIN, PN532_RESET_PIN);

// WiFi dan MQTT
WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
```

### 4.5 State Machine Definition

```cpp
enum AppState {
  STATE_HOME,
  STATE_KTM_INVALID,
  STATE_ACTION_SELECT,
  STATE_SCAN_ITEMS,
  STATE_SCAN_ITEM_FEEDBACK,
  STATE_BORROW_SUMMARY,
  STATE_BORROW_PROCESSING,
  STATE_BORROW_SUCCESS,
  STATE_RETURN_SCAN,
  STATE_RETURN_SCAN_FEEDBACK,
  STATE_RETURN_SUMMARY,
  STATE_RETURN_PROCESSING,
  STATE_RETURN_SUCCESS,
  STATE_ERROR
};
```

### 4.6 Session Data Structs

```cpp
struct ScannedItem {
  int    assetId;
  char   typeName[32];  // misal: "Bolpen"
  char   label[32];     // misal: "Bolpen-003"
};

struct ActiveSession {
  // User
  int    userId;
  char   userName[50];
  char   userNrp[20];
  bool   hasActiveLoan;
  int    activeSessionId;   // session_id di DB jika hasActiveLoan=true

  // Borrow items (dikumpulkan saat SCAN_ITEMS)
  ScannedItem items[MAX_ITEMS_PER_SESSION];
  int         itemCount;

  // Return items (dikumpulkan saat RETURN_SCAN)
  int  returnAssetIds[MAX_ITEMS_PER_SESSION];
  char returnTypeNames[MAX_ITEMS_PER_SESSION][32];
  int  returnCount;

  // Borrowed items dari server (untuk return flow)
  // Diisi saat masuk STATE_ACTION_SELECT dengan hasActiveLoan=true
  ScannedItem borrowedItems[MAX_ITEMS_PER_SESSION];
  int         borrowedCount;

  // Token
  char sessionToken[37];   // UUID v4: "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx\0"
};
```

### 4.7 Session Summary untuk OLED

Untuk menampilkan ringkasan di `STATE_BORROW_SUMMARY`, data perlu di-aggregate:
```cpp
struct SummaryEntry {
  char typeName[32];
  int  qty;
};

// Fungsi aggregate items → summary
// Iterasi items[], grouping by typeName
// Hasilnya: SummaryEntry summaryList[MAX_ITEMS_PER_SESSION]
// int summaryCount
```

### 4.8 Setup Function

```cpp
void setup() {
  Serial.begin(115200);

  // GPIO
  pinMode(PIN_BTN_LEFT,  INPUT_PULLUP);
  pinMode(PIN_BTN_RIGHT, INPUT_PULLUP);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // I2C — WAJIB dipanggil sebelum nfc.begin() dan u8g2.begin()
  Wire.begin(PIN_I2C_SDA, PIN_I2C_SCL);

  // OLED
  u8g2.begin();

  // PN532
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    showErrorScreen("PN532 tidak\nditemukan!");
    while (1) delay(10);
  }
  nfc.SAMConfig();  // Normal mode

  // MQTT buffer size — WAJIB sebelum connect
  mqttClient.setBufferSize(1024);
  mqttClient.setServer(MQTT_BROKER_IP, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  // WiFi
  connectWiFi();
  connectMQTT();

  // Initial state
  currentState = STATE_HOME;
  renderOLED();
}
```

### 4.9 WiFi & MQTT Connection Helpers

```cpp
void connectWiFi() {
  showConnectingScreen("WiFi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    attempts++;
  }
  if (WiFi.status() != WL_CONNECTED) {
    showErrorScreen("WiFi gagal!\nCek SSID/pass");
    delay(3000);
    ESP.restart();
  }
}

void connectMQTT() {
  showConnectingScreen("Server...");
  int attempts = 0;
  while (!mqttClient.connected() && attempts < 5) {
    mqttClient.connect(DEVICE_ID);
    delay(1000);
    attempts++;
  }
  if (!mqttClient.connected()) {
    showErrorScreen("Server offline!\nCek IP/Mosquitto");
    delay(3000);
    return;  // Akan retry di loop()
  }
  // Subscribe semua response topics
  mqttClient.subscribe(TOPIC_KTM_RESP);
  mqttClient.subscribe(TOPIC_ASSET_RESP);
  mqttClient.subscribe(TOPIC_SESSION_RESP);
  mqttClient.subscribe(TOPIC_RETURN_RESULT);
}
```

### 4.10 Main Loop

```cpp
void loop() {
  // 1. Reconnect jika perlu
  if (WiFi.status() != WL_CONNECTED) connectWiFi();
  if (!mqttClient.connected()) connectMQTT();
  mqttClient.loop();

  // 2. Button handling (dengan debounce)
  handleButtons();

  // 3. RFID scan (hanya di state yang relevan)
  if (currentState == STATE_HOME ||
      currentState == STATE_SCAN_ITEMS ||
      currentState == STATE_RETURN_SCAN) {
    handleRFIDScan();
  }

  // 4. State timeout checks
  checkStateTimeout();

  // 5. Auto-scroll di summary states
  if (currentState == STATE_BORROW_SUMMARY ||
      currentState == STATE_RETURN_SUMMARY) {
    handleScroll();
  }

  // 6. Heartbeat
  sendHeartbeat();

  // 7. Redraw OLED jika perlu (dirty flag)
  if (oledNeedsRedraw) {
    renderOLED();
    oledNeedsRedraw = false;
  }
}
```

### 4.11 RFID Scan (Non-Blocking)

```cpp
void handleRFIDScan() {
  uint8_t uid[7];
  uint8_t uidLength;

  // timeout=100ms: cukup cepat untuk polling responsif,
  // JANGAN gunakan 0 (= tunggu selamanya di beberapa versi library)
  if (nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100)) {
    // Konversi UID ke hex string
    char uidStr[15];  // max 7 bytes = 14 hex chars + null
    uidToHexString(uid, uidLength, uidStr);

    if (currentState == STATE_HOME) {
      onKTMScanned(uidStr);
    } else if (currentState == STATE_SCAN_ITEMS) {
      onAssetScanned(uidStr);
    } else if (currentState == STATE_RETURN_SCAN) {
      onReturnAssetScanned(uidStr);
    }

    // Anti-double scan: tunggu kartu diangkat (~1 detik)
    delay(1000);
  }
}
```

### 4.12 MQTT Publish — KTM Scan

```cpp
void onKTMScanned(const char* uid) {
  // Generate session token baru
  generateUUID(session.sessionToken);

  // Build JSON (ArduinoJson v7)
  JsonDocument doc;
  doc["uid"]           = uid;
  doc["session_token"] = session.sessionToken;

  char buf[128];
  serializeJson(doc, buf);
  mqttClient.publish(TOPIC_KTM_SCAN, buf);

  // Simpan waktu untuk timeout detection
  mqttWaitStart = millis();
  waitingForMQTTResponse = true;
}
```

### 4.13 MQTT Callback

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  // Parse JSON (ArduinoJson v7)
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) return;

  if (strcmp(topic, TOPIC_KTM_RESP) == 0) {
    handleKTMResponse(doc);
  } else if (strcmp(topic, TOPIC_ASSET_RESP) == 0) {
    handleAssetResponse(doc);
  } else if (strcmp(topic, TOPIC_SESSION_RESP) == 0) {
    handleSessionResponse(doc);
  } else if (strcmp(topic, TOPIC_RETURN_RESULT) == 0) {
    handleReturnResult(doc);
  }

  waitingForMQTTResponse = false;
}
```

### 4.14 KTM Response Handler

```cpp
void handleKTMResponse(JsonDocument& doc) {
  if (!doc["valid"].as<bool>()) {
    transitionTo(STATE_KTM_INVALID);
    return;
  }

  // Simpan data user ke session struct
  session.userId        = doc["user"]["id"].as<int>();
  strlcpy(session.userName, doc["user"]["name"].as<const char*>(), 50);
  strlcpy(session.userNrp,  doc["user"]["nrp"].as<const char*>(), 20);
  session.hasActiveLoan = doc["has_active_loan"].as<bool>();
  session.activeSessionId = doc["active_session_id"] | 0;

  // Jika ada active loan, parse borrowed items
  if (session.hasActiveLoan && doc["borrowed_items"].is<JsonArray>()) {
    JsonArray arr = doc["borrowed_items"].as<JsonArray>();
    session.borrowedCount = 0;
    for (JsonObject item : arr) {
      if (session.borrowedCount >= MAX_ITEMS_PER_SESSION) break;
      session.borrowedItems[session.borrowedCount].assetId = item["asset_id"].as<int>();
      strlcpy(session.borrowedItems[session.borrowedCount].typeName,
              item["type_name"].as<const char*>(), 32);
      strlcpy(session.borrowedItems[session.borrowedCount].label,
              item["label"].as<const char*>(), 32);
      session.borrowedCount++;
    }
  }

  beepShort(1);
  transitionTo(STATE_ACTION_SELECT);
}
```

### 4.15 Asset Scan — MQTT Publish

```cpp
void onAssetScanned(const char* uid) {
  JsonDocument doc;
  doc["uid"]           = uid;
  doc["session_token"] = session.sessionToken;

  char buf[128];
  serializeJson(doc, buf);
  mqttClient.publish(TOPIC_ASSET_SCAN, buf);

  mqttWaitStart = millis();
  waitingForMQTTResponse = true;
}
```

### 4.16 Asset Response Handler

```cpp
void handleAssetResponse(JsonDocument& doc) {
  feedbackSuccessItem[0] = '\0';
  feedbackErrorMsg[0]    = '\0';

  if (!doc["valid"].as<bool>()) {
    const char* reason = doc["reason"].as<const char*>();
    if (strcmp(reason, "ALREADY_IN_SESSION") == 0) {
      strlcpy(feedbackErrorMsg, "Sudah di-scan!", sizeof(feedbackErrorMsg));
      beepShort(2);
    } else if (strcmp(reason, "ASSET_UNAVAILABLE") == 0) {
      strlcpy(feedbackErrorMsg, "Sedang dipinjam!", sizeof(feedbackErrorMsg));
      beepShort(2);
    } else {
      strlcpy(feedbackErrorMsg, "Tidak dikenal", sizeof(feedbackErrorMsg));
      beepLong();
    }
    strlcpy(feedbackItemName, doc["asset"]["type_name"] | "???", 32);
    transitionTo(STATE_SCAN_ITEM_FEEDBACK);
    return;
  }

  // Tambah ke session items
  if (session.itemCount < MAX_ITEMS_PER_SESSION) {
    session.items[session.itemCount].assetId = doc["asset"]["id"].as<int>();
    strlcpy(session.items[session.itemCount].typeName,
            doc["asset"]["type_name"].as<const char*>(), 32);
    strlcpy(session.items[session.itemCount].label,
            doc["asset"]["label"].as<const char*>(), 32);
    session.itemCount++;
  }

  strlcpy(feedbackSuccessItem, doc["asset"]["type_name"].as<const char*>(), 32);
  strlcpy(feedbackItemLabel, doc["asset"]["label"].as<const char*>(), 32);
  beepShort(1);
  transitionTo(STATE_SCAN_ITEM_FEEDBACK);
}
```

### 4.17 Session Confirm — MQTT Publish

```cpp
void confirmBorrow() {
  JsonDocument doc;
  doc["session_token"] = session.sessionToken;
  doc["user_id"]       = session.userId;

  JsonArray arr = doc["asset_ids"].to<JsonArray>();
  for (int i = 0; i < session.itemCount; i++) {
    arr.add(session.items[i].assetId);
  }

  char buf[512];
  serializeJson(doc, buf);
  mqttClient.publish(TOPIC_SESSION_CREATE, buf);

  mqttWaitStart = millis();
  waitingForMQTTResponse = true;
  transitionTo(STATE_BORROW_PROCESSING);
}
```

### 4.18 Return Confirm — MQTT Publish

```cpp
void confirmReturn() {
  JsonDocument doc;
  doc["session_id"] = session.activeSessionId;

  JsonArray arr = doc["asset_ids"].to<JsonArray>();
  for (int i = 0; i < session.returnCount; i++) {
    arr.add(session.returnAssetIds[i]);
  }

  char buf[256];
  serializeJson(doc, buf);
  mqttClient.publish(TOPIC_RETURN_CONFIRM, buf);

  mqttWaitStart = millis();
  waitingForMQTTResponse = true;
  transitionTo(STATE_RETURN_PROCESSING);
}
```

### 4.19 Cancel Handler

```cpp
void cancelSession() {
  // Beritahu server untuk hapus foto pending
  if (currentState != STATE_HOME && session.sessionToken[0] != '\0') {
    JsonDocument doc;
    doc["session_token"] = session.sessionToken;
    char buf[64];
    serializeJson(doc, buf);
    mqttClient.publish(TOPIC_SESSION_CANCEL, buf);
  }

  // Reset session data
  memset(&session, 0, sizeof(session));
  transitionTo(STATE_HOME);
}
```

### 4.20 UUID Generator untuk ESP32

```cpp
void generateUUID(char* out) {
  // UUID v4 — byte-by-byte approach, bebas operator precedence bug
  uint8_t b[16];
  for (int i = 0; i < 4; i++) {
    uint32_t r = esp_random();
    b[i*4]   =  r        & 0xFF;
    b[i*4+1] = (r >>  8) & 0xFF;
    b[i*4+2] = (r >> 16) & 0xFF;
    b[i*4+3] = (r >> 24) & 0xFF;
  }
  b[6] = (b[6] & 0x0F) | 0x40;   // version 4
  b[8] = (b[8] & 0x3F) | 0x80;   // variant RFC 4122

  snprintf(out, 37,
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    b[0],b[1],b[2],b[3], b[4],b[5], b[6],b[7],
    b[8],b[9], b[10],b[11],b[12],b[13],b[14],b[15]
  );
}
```

### 4.21 Buzzer Patterns

```cpp
#define BUZZER_SHORT_MS   80
#define BUZZER_LONG_MS    450
#define BUZZER_GAP_MS     100

void beepShort(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(BUZZER_SHORT_MS);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(BUZZER_GAP_MS);
  }
}

void beepLong() {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(BUZZER_LONG_MS);
  digitalWrite(PIN_BUZZER, LOW);
}
```

### 4.22 OLED Render Engine

```cpp
void renderOLED() {
  u8g2.clearBuffer();
  drawDividerLines();

  switch (currentState) {
    case STATE_HOME:          drawHome();          break;
    case STATE_KTM_INVALID:   drawKTMInvalid();    break;
    case STATE_ACTION_SELECT: drawActionSelect();  break;
    case STATE_SCAN_ITEMS:    drawScanItems();     break;
    // ... dst
  }

  u8g2.sendBuffer();
}

void drawDividerLines() {
  // Title/content divider
  u8g2.drawHLine(0, 13, 128);
  // Content/button divider
  u8g2.drawHLine(0, 51, 128);
}

void drawButtonBar(const char* leftLabel, const char* rightLabel,
                   bool invertLeft, bool invertRight) {
  const uint8_t* font = u8g2_font_6x10_tf;
  u8g2.setFont(font);

  if (leftLabel && strlen(leftLabel) > 0) {
    if (invertLeft) {
      // Inverted: white background, black text
      int w = u8g2.getStrWidth(leftLabel) + 4;
      u8g2.setDrawColor(1);   // white fill
      u8g2.drawBox(0, 52, w, 12);
      u8g2.setDrawColor(0);   // black text
      u8g2.setFontMode(1);    // transparent — jangan overwrite pixel selain teks
      u8g2.drawStr(2, 62, leftLabel);
      u8g2.setDrawColor(1);   // restore
      u8g2.setFontMode(0);
    } else {
      u8g2.drawStr(2, 62, leftLabel);
    }
  }

  if (rightLabel && strlen(rightLabel) > 0) {
    int rw = u8g2.getStrWidth(rightLabel);
    int x = 128 - rw - 2;
    if (invertRight) {
      // Inverted: white background, black text
      u8g2.setDrawColor(1);   // white fill
      u8g2.drawBox(x - 2, 52, rw + 4, 12);
      u8g2.setDrawColor(0);   // black text
      u8g2.setFontMode(1);
      u8g2.drawStr(x, 62, rightLabel);
      u8g2.setDrawColor(1);   // restore
      u8g2.setFontMode(0);
    } else {
      u8g2.drawStr(x, 62, rightLabel);
    }
  }
}

void drawTitleBar(const char* title) {
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(2, 10, title);
}

void drawContentLine(const char* text, int lineIndex) {
  // lineIndex 0,1,2,3 → y = 24, 34, 44 (dalam content area y:14..51)
  int y = 24 + (lineIndex * 12);
  if (y > 50) return;
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(2, y, text);
}
```

### 4.23 State Timeout Check

```cpp
void checkStateTimeout() {
  unsigned long now = millis();

  // MQTT response timeout
  if (waitingForMQTTResponse && (now - mqttWaitStart > MQTT_RESPONSE_TIMEOUT)) {
    waitingForMQTTResponse = false;
    strlcpy(errorMsg, "Server tidak\nmerespons", sizeof(errorMsg));
    beepLong();
    cancelSession();
    transitionTo(STATE_ERROR);
  }

  // Timed display states: auto-return ke HOME
  if ((currentState == STATE_ERROR ||
       currentState == STATE_KTM_INVALID ||
       currentState == STATE_BORROW_SUCCESS ||
       currentState == STATE_RETURN_SUCCESS) &&
      (now - stateEnteredAt > STATE_DISPLAY_DURATION)) {
    if (currentState == STATE_BORROW_SUCCESS ||
        currentState == STATE_RETURN_SUCCESS) {
      // Sudah berhasil, tidak perlu cancel (foto sudah disimpan)
      memset(&session, 0, sizeof(session));
    }
    transitionTo(STATE_HOME);
  }

  // Action select idle timeout
  if (currentState == STATE_ACTION_SELECT &&
      (now - stateEnteredAt > ACTION_IDLE_TIMEOUT)) {
    cancelSession();
  }
}
```

---

## 5. ESP32-CAM Firmware Spec

### 5.1 File: `esp32camfirmware/esp32camfirmware.ino`

### 5.2 Library Includes

```cpp
#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
```

### 5.3 Konstanta

```cpp
#define WIFI_SSID       "nama_wifi_lab"
#define WIFI_PASSWORD   "password_wifi"
#define MQTT_BROKER_IP  "192.168.1.100"
#define MQTT_PORT       1883
#define DEVICE_ID       "esp32cam-smartlab-01"
#define BACKEND_URL     "http://192.168.1.100:3001"
#define CAM_SECRET      "your_cam_shared_secret"  // Harus sama dengan .env backend

// Topic
#define TOPIC_CAM_TRIGGER "smartlab/cam/trigger"
```

### 5.4 Konfigurasi Pin AI-Thinker ESP32-CAM

```cpp
// Pin kamera AI-Thinker — JANGAN UBAH
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22
```

### 5.5 Konfigurasi Kamera

```cpp
void initCamera() {
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Konfigurasi resolusi dan kualitas — SESUAIKAN dengan ketersediaan PSRAM
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA;      // 640x480
    config.jpeg_quality = 12;                 // 0-63, makin kecil = makin bagus
    config.fb_count     = 2;
    config.fb_location  = CAMERA_FB_IN_PSRAM; // gunakan PSRAM untuk framebuffer
  } else {
    config.frame_size   = FRAMESIZE_QVGA;     // 320x240 fallback
    config.jpeg_quality = 20;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;  // ⚠️ WAJIB DRAM jika tidak ada PSRAM
  }
  config.grab_mode = CAMERA_GRAB_WHEN_EMPTY;

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("Camera init failed: 0x%x\n", err);
    ESP.restart();
  }

  // Sensor setting opsional (brightness, contrast, dll)
  sensor_t* s = esp_camera_sensor_get();
  s->set_brightness(s, 1);  // -2 to 2
  s->set_contrast(s, 1);
}
```

### 5.6 Capture dan Upload Foto

```cpp
char pendingSessionToken[37] = {0};
bool captureRequested = false;

void captureAndUpload(const char* sessionToken) {
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("Camera capture failed");
    return;
  }

  // Upload via HTTP multipart
  WiFiClient client;
  HTTPClient http;

  String url = String(BACKEND_URL) + "/api/photo/upload";
  http.begin(client, url);
  http.addHeader("X-Device-Secret", CAM_SECRET);
  // ⚠️ Kirim session_token via HEADER, bukan form field
  // karena multer filename() callback berjalan sebelum req.body terisi
  http.addHeader("X-Session-Token", String(sessionToken));

  // Build multipart body
  String boundary = "----SmartLabBoundary";
  String bodyBegin = "";
  bodyBegin += "--" + boundary + "\r\n";
  bodyBegin += "Content-Disposition: form-data; name=\"session_token\"\r\n\r\n";
  bodyBegin += String(sessionToken) + "\r\n";
  bodyBegin += "--" + boundary + "\r\n";
  bodyBegin += "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n";
  bodyBegin += "Content-Type: image/jpeg\r\n\r\n";

  String bodyEnd = "\r\n--" + boundary + "--\r\n";

  int totalLen = bodyBegin.length() + fb->len + bodyEnd.length();
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
  http.addHeader("Content-Length", String(totalLen));

  // Stream upload
  // Karena HTTPClient tidak mendukung streaming langsung untuk multipart,
  // gunakan WiFiClient secara manual jika foto > ~60KB
  // Untuk QVGA/VGA JPEG dengan quality 12, biasanya 15-40KB — cukup buffer ke String

  // Catatan: Jika foto > available heap, gunakan streaming manual via WiFiClient
  int httpCode = http.POST((uint8_t*)fb->buf, fb->len); // fallback sederhana

  // Alternatif yang lebih benar untuk multipart:
  // lihat implementasi di modul coding session

  esp_camera_fb_return(fb);
  http.end();

  Serial.printf("Upload HTTP code: %d\n", httpCode);
}
```

> **Catatan**: Implementasi lengkap multipart upload via WiFiClient streaming akan ditulis di modul coding session. Pattern di atas adalah pseudocode.

### 5.7 MQTT Callback ESP32-CAM

```cpp
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  if (strcmp(topic, TOPIC_CAM_TRIGGER) == 0) {
    JsonDocument doc;
    deserializeJson(doc, payload, length);
    const char* token = doc["session_token"].as<const char*>();
    if (token) {
      strlcpy(pendingSessionToken, token, 37);
      captureRequested = true;
    }
  }
}

void loop() {
  if (!mqttClient.connected()) reconnectMQTT();
  mqttClient.loop();

  if (captureRequested && pendingSessionToken[0] != '\0') {
    captureRequested = false;
    captureAndUpload(pendingSessionToken);
    pendingSessionToken[0] = '\0';
  }
}
```

---

## 6. Backend Spec (Node.js)

### 6.1 Struktur File

```
backend/
├── src/
│   ├── db/
│   │   ├── index.js         ← pg Pool setup
│   │   └── schema.sql       ← DDL (lihat Requirements doc §4)
│   ├── mqtt/
│   │   ├── client.js        ← Mosquitto connection + subscribe
│   │   └── handlers.js      ← Logic handler per topic
│   ├── routes/
│   │   ├── auth.js
│   │   ├── users.js
│   │   ├── assets.js
│   │   ├── sessions.js
│   │   ├── photo.js
│   │   └── stats.js
│   ├── controllers/         ← Business logic (dipanggil dari routes)
│   ├── middleware/
│   │   ├── auth.js          ← JWT verify middleware
│   │   └── upload.js        ← multer config
│   └── index.js             ← Entry point
├── uploads/
│   ├── temp/                ← Foto pending (sebelum confirm)
│   └── sessions/            ← Foto permanen
├── .env
├── .env.example
└── package.json
```

### 6.2 Database Pool (`src/db/index.js`)

```js
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected DB pool error', err);
});

module.exports = pool;
```

### 6.3 Express 5 Entry Point (`src/index.js`)

```js
const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');
const compression = require('compression');
const path     = require('path');
require('dotenv').config({ quiet: process.env.NODE_ENV === 'production' });

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file serving untuk foto (dilindungi auth di route)
// Jangan expose /uploads langsung sebagai static!

// Routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/users',    require('./routes/users'));
app.use('/api/assets',   require('./routes/assets'));
app.use('/api/sessions', require('./routes/sessions'));
app.use('/api/photo',    require('./routes/photo'));
app.use('/api/stats',    require('./routes/stats'));

// Error handler (Express 5: wajib 4 parameter)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});

// Start MQTT handler
require('./mqtt/client');
```

### 6.4 multer Upload Config (`src/middleware/upload.js`)

```js
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');

// Storage untuk photo upload dari ESP32-CAM
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../uploads/temp');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // ⚠️ JANGAN gunakan req.body.session_token di sini!
    // req.body belum terisi saat filename() dipanggil (multipart parsing belum selesai).
    // Gunakan header X-Session-Token yang dikirim ESP32-CAM sebagai gantinya.
    const token = req.headers['x-session-token'] || Date.now().toString();
    cb(null, `${token}.jpg`);
  }
});

// multer v2: fileFilter signature sama dengan v1
const photoFilter = (req, file, cb) => {
  if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg') {
    cb(null, true);
  } else {
    // multer v2: error handling berubah; error diteruskan ke Express error handler
    cb(new Error('Hanya JPEG yang diterima'));
  }
};

const uploadPhoto = multer({
  storage: photoStorage,
  fileFilter: photoFilter,
  limits: { fileSize: 5 * 1024 * 1024 }  // 5MB max
});

module.exports = { uploadPhoto };
```

### 6.5 MQTT Client (`src/mqtt/client.js`)

```js
const mqtt    = require('mqtt');
const handlers = require('./handlers');

const client = mqtt.connect(`mqtt://${process.env.MQTT_BROKER_IP}:1883`, {
  clientId: `smartlab-backend-${Date.now()}`,
  keepalive: 30,
  reconnectPeriod: 5000,
});

client.on('connect', () => {
  console.log('MQTT connected');
  client.subscribe([
    'smartlab/ktm/scan',
    'smartlab/asset/scan',
    'smartlab/session/create',
    'smartlab/session/cancel',
    'smartlab/return/confirm',
    'smartlab/heartbeat',
  ]);
});

client.on('message', async (topic, message) => {
  let payload;
  try { payload = JSON.parse(message.toString()); }
  catch { return; }

  try {
    switch (topic) {
      case 'smartlab/ktm/scan':        await handlers.handleKTMScan(client, payload);       break;
      case 'smartlab/asset/scan':      await handlers.handleAssetScan(client, payload);     break;
      case 'smartlab/session/create':  await handlers.handleSessionCreate(client, payload); break;
      case 'smartlab/session/cancel':  await handlers.handleSessionCancel(client, payload); break;
      case 'smartlab/return/confirm':  await handlers.handleReturnConfirm(client, payload); break;
      case 'smartlab/heartbeat':       handlers.handleHeartbeat(payload);                   break;
    }
  } catch (err) {
    console.error(`MQTT handler error [${topic}]:`, err);
  }
});

client.on('error', (err) => console.error('MQTT error:', err));

module.exports = client;
```

### 6.6 MQTT Handlers (`src/mqtt/handlers.js`)

```js
const db   = require('../db');
const fs   = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');  // uuid v14: API tidak berubah

// ─── handleKTMScan ────────────────────────────────────────────
async function handleKTMScan(mqttClient, payload) {
  const { uid, session_token } = payload;

  const userResult = await db.query(
    'SELECT id, nrp, name FROM users WHERE rfid_uid = $1',
    [uid]
  );

  if (userResult.rows.length === 0) {
    return mqttClient.publish('smartlab/ktm/response',
      JSON.stringify({ valid: false, reason: 'USER_NOT_FOUND' }));
  }

  const user = userResult.rows[0];

  // Cek sesi aktif
  const sessionResult = await db.query(
    `SELECT bs.id, bi.asset_id, at.name AS type_name, a.label
     FROM borrow_sessions bs
     JOIN borrow_items bi ON bi.session_id = bs.id AND bi.returned_at IS NULL
     JOIN assets a ON a.id = bi.asset_id
     JOIN asset_types at ON at.id = a.asset_type_id
     WHERE bs.user_id = $1 AND bs.status = 'active'`,
    [user.id]
  );

  const hasActiveLoan = sessionResult.rows.length > 0;
  const activeSessionId = hasActiveLoan
    ? sessionResult.rows[0].id : null;

  const borrowedItems = sessionResult.rows.map(r => ({
    asset_id:  r.asset_id,
    type_name: r.type_name,
    label:     r.label
  }));

  // Trigger ESP32-CAM
  mqttClient.publish('smartlab/cam/trigger',
    JSON.stringify({ session_token }));

  // Kirim respons ke ESP32-S3
  mqttClient.publish('smartlab/ktm/response', JSON.stringify({
    valid: true,
    user: { id: user.id, name: user.name, nrp: user.nrp },
    has_active_loan:   hasActiveLoan,
    active_session_id: activeSessionId,
    borrowed_items:    borrowedItems,
    session_token
  }));
}

// ─── handleAssetScan ──────────────────────────────────────────
// Catatan: backend menyimpan in-memory map session_token → Set(asset_ids)
// untuk deteksi ALREADY_IN_SESSION
const sessionAssetMap = new Map();  // session_token → Set<asset_id>

async function handleAssetScan(mqttClient, payload) {
  const { uid, session_token } = payload;

  const assetResult = await db.query(
    `SELECT a.id, a.is_available, at.name AS type_name, a.label
     FROM assets a JOIN asset_types at ON at.id = a.asset_type_id
     WHERE a.rfid_uid = $1`,
    [uid]
  );

  if (assetResult.rows.length === 0) {
    return mqttClient.publish('smartlab/asset/response',
      JSON.stringify({ valid: false, reason: 'ASSET_NOT_FOUND' }));
  }

  const asset = assetResult.rows[0];

  if (!asset.is_available) {
    return mqttClient.publish('smartlab/asset/response',
      JSON.stringify({ valid: false, reason: 'ASSET_UNAVAILABLE',
        asset: { type_name: asset.type_name, label: asset.label } }));
  }

  // Cek duplikat dalam sesi ini
  if (!sessionAssetMap.has(session_token)) {
    sessionAssetMap.set(session_token, new Set());
  }
  const scannedSet = sessionAssetMap.get(session_token);

  if (scannedSet.has(asset.id)) {
    return mqttClient.publish('smartlab/asset/response',
      JSON.stringify({ valid: false, reason: 'ALREADY_IN_SESSION',
        asset: { type_name: asset.type_name, label: asset.label } }));
  }

  scannedSet.add(asset.id);

  mqttClient.publish('smartlab/asset/response', JSON.stringify({
    valid: true,
    asset: { id: asset.id, type_name: asset.type_name, label: asset.label }
  }));
}

// ─── handleSessionCreate ─────────────────────────────────────
async function handleSessionCreate(mqttClient, payload) {
  const { session_token, user_id, asset_ids } = payload;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Insert session
    const sessResult = await client.query(
      `INSERT INTO borrow_sessions (user_id, status)
       VALUES ($1, 'active') RETURNING id`,
      [user_id]
    );
    const sessionId = sessResult.rows[0].id;

    // Insert items + update availability
    for (const assetId of asset_ids) {
      await client.query(
        'INSERT INTO borrow_items (session_id, asset_id) VALUES ($1, $2)',
        [sessionId, assetId]
      );
      await client.query(
        'UPDATE assets SET is_available = false WHERE id = $1',
        [assetId]
      );
    }

    // Pindahkan foto dari temp ke sessions
    const tempPath    = path.join(__dirname, `../../uploads/temp/${session_token}.jpg`);
    const finalPath   = path.join(__dirname, `../../uploads/sessions/${sessionId}.jpg`);
    const photoExists = fs.existsSync(tempPath);

    if (photoExists) {
      fs.renameSync(tempPath, finalPath);
      await client.query(
        'UPDATE borrow_sessions SET photo_path = $1 WHERE id = $2',
        [`uploads/sessions/${sessionId}.jpg`, sessionId]
      );
    }

    await client.query('COMMIT');

    // Bersihkan in-memory map
    sessionAssetMap.delete(session_token);

    // Publish event ke Node-RED
    mqttClient.publish('smartlab/events', JSON.stringify({
      event: 'BORROW_CREATED',
      timestamp: new Date().toISOString(),
      data: { session_id: sessionId, user_id, asset_count: asset_ids.length }
    }));

    mqttClient.publish('smartlab/session/response',
      JSON.stringify({ success: true, session_id: sessionId }));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Session create error:', err);
    mqttClient.publish('smartlab/session/response',
      JSON.stringify({ success: false, reason: 'DB_ERROR' }));
  } finally {
    client.release();
  }
}

// ─── handleSessionCancel ─────────────────────────────────────
async function handleSessionCancel(mqttClient, payload) {
  const { session_token } = payload;
  const tempPath = path.join(__dirname, `../../uploads/temp/${session_token}.jpg`);
  if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
  sessionAssetMap.delete(session_token);
}

// ─── handleReturnConfirm ─────────────────────────────────────
async function handleReturnConfirm(mqttClient, payload) {
  const { session_id, asset_ids } = payload;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const now = new Date();
    for (const assetId of asset_ids) {
      await client.query(
        `UPDATE borrow_items SET returned_at = $1
         WHERE session_id = $2 AND asset_id = $3 AND returned_at IS NULL`,
        [now, session_id, assetId]
      );
      await client.query(
        'UPDATE assets SET is_available = true WHERE id = $1',
        [assetId]
      );
    }

    // Tentukan status sesi baru
    const remaining = await client.query(
      'SELECT COUNT(*) FROM borrow_items WHERE session_id=$1 AND returned_at IS NULL',
      [session_id]
    );
    const remainingCount = parseInt(remaining.rows[0].count);
    const newStatus = remainingCount === 0 ? 'fully_returned' : 'partially_returned';

    await client.query(
      'UPDATE borrow_sessions SET status=$1, last_updated=$2 WHERE id=$3',
      [newStatus, now, session_id]
    );

    await client.query('COMMIT');

    mqttClient.publish('smartlab/events', JSON.stringify({
      event: 'RETURN_CONFIRMED',
      timestamp: now.toISOString(),
      data: { session_id, returned_count: asset_ids.length, new_status: newStatus }
    }));

    mqttClient.publish('smartlab/return/result',
      JSON.stringify({ success: true, status: newStatus }));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Return confirm error:', err);
    mqttClient.publish('smartlab/return/result',
      JSON.stringify({ success: false, reason: 'DB_ERROR' }));
  } finally {
    client.release();
  }
}

function handleHeartbeat(payload) {
  // Optional: log atau update device status di DB
  console.log(`Heartbeat from ${payload.state} at ${new Date().toISOString()}`);
}

module.exports = {
  handleKTMScan, handleAssetScan, handleSessionCreate,
  handleSessionCancel, handleReturnConfirm, handleHeartbeat
};
```

### 6.7 Photo Upload Route (`src/routes/photo.js`)

```js
const express = require('express');
const router  = express.Router();
const path    = require('path');
const { uploadPhoto } = require('../middleware/upload');

// Endpoint untuk ESP32-CAM — tidak pakai JWT, pakai shared secret
router.post('/upload', (req, res, next) => {
  // Verifikasi shared secret dari header
  if (req.headers['x-device-secret'] !== process.env.CAM_DEVICE_SECRET) {
    return res.status(403).json({ error: 'Unauthorized device' });
  }
  next();
}, uploadPhoto.single('photo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  res.json({ success: true, temp_path: req.file.path });
});

// Hapus foto temp (dipanggil saat cancel — opsional, bisa dari MQTT)
router.delete('/temp/:token', (req, res) => {
  const filePath = path.join(__dirname, '../../uploads/temp', `${req.params.token}.jpg`);
  if (require('fs').existsSync(filePath)) {
    require('fs').unlinkSync(filePath);
  }
  res.json({ success: true });
});

module.exports = router;
```

### 6.8 Auth Middleware (`src/middleware/auth.js`)

```js
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token required' });
  }
  const token = authHeader.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
};
```

### 6.9 Input Validation Pattern (express-validator 7.x)

```js
const { body, param, validationResult } = require('express-validator');

// Contoh untuk POST /api/users
const validateCreateUser = [
  body('nrp').notEmpty().trim().isLength({ max: 20 }),
  body('name').notEmpty().trim().isLength({ max: 100 }),
  body('rfid_uid').notEmpty().trim().isLength({ max: 50 }),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ errors: errors.array() });
    }
    next();
  }
];
```

---

## 7. Frontend Spec (Next.js)

### 7.1 Struktur

```
frontend/
├── app/
│   ├── layout.js              ← Root layout
│   ├── page.js                ← Redirect ke /login atau /dashboard
│   ├── login/page.js
│   └── (dashboard)/
│       ├── layout.js          ← Sidebar + nav (dengan auth check)
│       ├── page.js            ← Dashboard overview
│       ├── users/
│       │   ├── page.js        ← List users
│       │   └── [id]/page.js   ← Detail user
│       ├── assets/
│       │   ├── page.js
│       │   └── types/page.js
│       ├── sessions/
│       │   ├── page.js
│       │   └── [id]/page.js
│       └── settings/page.js
├── lib/
│   ├── api.js                 ← Fetch wrapper dengan JWT
│   └── auth.js                ← Token storage & check
└── .env.local
```

### 7.2 Environment Variables Frontend (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:3001/api
```

### 7.3 API Client Pattern (`lib/api.js`)

```js
const BASE_URL = process.env.NEXT_PUBLIC_API_URL;

async function apiRequest(endpoint, options = {}) {
  // Ambil token dari localStorage (client-only)
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('smartlab_token') : null;

  const res = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...options.headers,
    }
  });

  if (res.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('smartlab_token');
      window.location.href = '/login';
    }
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  get:    (url)         => apiRequest(url),
  post:   (url, body)   => apiRequest(url, { method: 'POST', body: JSON.stringify(body) }),
  put:    (url, body)   => apiRequest(url, { method: 'PUT',  body: JSON.stringify(body) }),
  delete: (url)         => apiRequest(url, { method: 'DELETE' }),
};
```

### 7.4 Dashboard Polling

```js
// Gunakan polling karena tidak ada WebSocket di versi ini
// Di halaman dashboard utama:

'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const s = await api.get('/stats/overview');
      const a = await api.get('/stats/activity?limit=10');
      setStats(s.data);
      setActivity(a.data);
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // Poll setiap 10s
    return () => clearInterval(interval);
  }, []);

  // ...
}
```

---

## 8. Node-RED Spec

### 8.1 Flow Utama

Setelah Node-RED jalan (`node-red`), import flow via `nodered/flows.json`.

### 8.2 Nodes yang Dibutuhkan

| Node | Package | Keperluan |
|------|---------|-----------|
| Dashboard 2.0 | `@flowfuse/node-red-dashboard@1.30.2` | UI panels — **gunakan ini** |
| MQTT in/out | built-in | MQTT subscribe/publish |

> ⚠️ **Jangan gunakan `node-red-dashboard` (versi lama)**. Paket itu berbasis Angular v1 yang sudah tidak di-maintain dan dinyatakan "life support" oleh tim Node-RED. Gunakan `@flowfuse/node-red-dashboard` (Dashboard 2.0) yang aktif di-maintain.

Install Dashboard 2.0:
```bash
# Di direktori ~/.node-red
cd ~/.node-red
npm install @flowfuse/node-red-dashboard@1.30.2
# Restart Node-RED setelah install
```

Atau via **Manage Palette** di UI Node-RED → cari `@flowfuse/node-red-dashboard`.

### 8.3 MQTT Config Node

```
Server: localhost (127.0.0.1)
Port: 1883
Client ID: nodered-smartlab
```

### 8.4 Flow Structure

```
[MQTT in: smartlab/events]  → [Function: Parse event]  → [Dashboard Table: Activity Feed]
                                                        → [Function: Filter BORROW]  → [Dashboard Chart: Borrow Count]
[MQTT in: smartlab/heartbeat] → [Function: Check online] → [Dashboard Indicator: Device Status]
[inject: every 10s]           → [HTTP Request: GET /api/stats/overview] → [Function: Parse]
                                                                         → [Dashboard Gauge: Available Assets]
                                                                         → [Dashboard Text: Active Sessions]
```

---

## 9. Environment Variables

### 9.1 Backend (`.env`)

```env
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://smartlab_user:your_secure_password@localhost:5432/smartlab

# Auth
JWT_SECRET=ganti_dengan_string_random_minimal_32_karakter
JWT_EXPIRES_IN=24h

# MQTT
MQTT_BROKER_IP=127.0.0.1

# Uploads
UPLOADS_DIR=./uploads

# Security
CAM_DEVICE_SECRET=ganti_dengan_string_random_untuk_esp32cam

# Admin credentials (untuk inisialisasi)
ADMIN_USERNAME=admin
ADMIN_INITIAL_PASSWORD=admin123

# Frontend URL (untuk CORS)
FRONTEND_URL=http://localhost:3000
```

### 9.2 Backend (`.env.example`) — commit ini, jangan commit `.env`

Sama dengan `.env` tapi semua value diganti placeholder.

### 9.3 Firmware Constants

Nilai-nilai berikut perlu diupdate di kedua firmware sebelum upload:

```cpp
// esp32s3firmware.ino dan esp32camfirmware.ino:
#define WIFI_SSID       "isi_nama_wifi"
#define WIFI_PASSWORD   "isi_password_wifi"
#define MQTT_BROKER_IP  "isi_ip_server_pc"  // lihat ipconfig / ip addr

// esp32camfirmware.ino:
#define CAM_SECRET      "sama_dengan_CAM_DEVICE_SECRET_di_.env"
#define BACKEND_URL     "http://isi_ip_server_pc:3001"
```

---

## Appendix: Urutan Implementasi

```
[Sesi 1]  backend/src/db/schema.sql         → DDL + seed data
[Sesi 2]  backend/src/mqtt/handlers.js       → KTM scan + asset scan + session create
[Sesi 3]  backend/src/mqtt/handlers.js       → Return confirm + cancel
[Sesi 4]  backend/src/routes/ + controllers  → REST API (users, assets, sessions, stats)
[Sesi 5]  backend/src/routes/auth.js         → Login/logout JWT
[Sesi 6]  backend/src/routes/photo.js        → Photo upload endpoint
[Sesi 7]  esp32camfirmware/                  → WiFi + MQTT + camera capture + HTTP upload
[Sesi 8]  esp32s3firmware/                   → State machine + OLED + RFID + MQTT + buttons
[Sesi 9]  frontend/                          → Next.js admin dashboard semua halaman
[Sesi 10] nodered/                           → Node-RED flows
```

---

*SmartLab Asset Borrowing System — Technical Specification v1.2*
*Library versions terverifikasi per Juni 2026. Cek ulang versi terbaru sebelum mulai coding.*
