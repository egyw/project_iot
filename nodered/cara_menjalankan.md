# Cara Menjalankan Node-RED

### 1. Install Node-RED (sekali saja)
```bash
npm install -g node-red@5.0.0
```

### 2. Jalankan Node-RED
```bash
node-red
```
Buka browser → [http://localhost:1880](http://localhost:1880)

### 3. Install Dashboard 2.0 (sekali saja, setelah Node-RED pertama kali jalan)

**Cara A — via Terminal:**
```bash
# Masuk ke direktori Node-RED
cd ~/.node-red               # Linux/macOS
cd %USERPROFILE%\.node-red   # Windows

npm install @flowfuse/node-red-dashboard@1.30.2
```
Lalu restart Node-RED.

**Cara B — via UI (lebih mudah):**
1. Buka http://localhost:1880
2. Klik menu `≡` (kanan atas) → **Manage Palette**
3. Tab **Install** → search `@flowfuse/node-red-dashboard`
4. Klik **Install** → tunggu selesai → restart otomatis

### 4. Import Flow Proyek
Setelah `nodered/flows.json` sudah ada:
1. Di Node-RED UI → menu `≡` → **Import**
2. Pilih file `nodered/flows.json`
3. Klik **Import** → **Deploy**

Dashboard bisa diakses di [http://localhost:1880/dashboard](http://localhost:1880/dashboard)

---

## Jalankan Bersamaan dengan Backend
Buka 4 terminal terpisah:

```bash
# Terminal 1 — Mosquitto MQTT Broker
mosquitto -c mosquitto.conf

# Terminal 2 — Backend Node.js
cd backend
npm run dev  # atau: node src/index.js

# Terminal 3 — Frontend Next.js
cd frontend
npm run dev

# Terminal 4 — Node-RED
node-red
```
