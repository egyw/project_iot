/*******************************************************************************
 * SmartLab ESP32-S3 Terminal Firmware
 * ===================================
 * Sistem Peminjaman Aset Lab — Terminal Utama
 *
 * Hardware:
 *   - ESP32-S3 Dev Module
 *   - PN532 RFID (I2C, addr 0x24)
 *   - SSD1306 OLED 128x64 (I2C, addr 0x3C)
 *   - Shared I2C bus: SDA=GPIO8, SCL=GPIO9
 *   - Button A (GPIO0, INPUT_PULLUP, active LOW) = Cancel/Kiri
 *   - Button B (GPIO1, INPUT_PULLUP, active LOW) = Next/Confirm/Kanan
 *   - Active Buzzer (GPIO2, active HIGH)
 *
 * Libraries:
 *   ESP32 Core 3.3.3, Adafruit PN532 1.3.4, U8g2 2.36.19,
 *   PubSubClient 2.8, ArduinoJson 7.4.3
 ******************************************************************************/

#include <Wire.h>
#include <WiFi.h>
#include <Adafruit_PN532.h>
#include <U8g2lib.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// =============================================================================
// PIN DEFINITIONS
// =============================================================================
#define PIN_SDA        8
#define PIN_SCL        9
#define PIN_BTN_LEFT   4   // GPIO0 tidak boleh — pin boot mode
#define PIN_BTN_RIGHT  7   // GPIO5 floating di board ini
#define PIN_BUZZER     6   // GPIO2 tidak boleh — USB D+

// =============================================================================
// WIFI & MQTT CONFIG — sesuaikan dengan jaringan Anda
// =============================================================================
const char* WIFI_SSID     = "eggy";
const char* WIFI_PASSWORD = "@Wangarry88";
const char* MQTT_SERVER   = "192.168.137.1"; // ganti sesuai ipconfig
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";   // kosongkan jika tanpa auth
const char* MQTT_PASS     = "";

// =============================================================================
// MQTT TOPICS
// =============================================================================
const char* TOPIC_KTM_SCAN       = "smartlab/ktm/scan";
const char* TOPIC_KTM_RESP       = "smartlab/ktm/response";
const char* TOPIC_ASSET_SCAN     = "smartlab/asset/scan";
const char* TOPIC_ASSET_RESP     = "smartlab/asset/response";
const char* TOPIC_SESSION_CREATE = "smartlab/session/create";
const char* TOPIC_SESSION_RESP   = "smartlab/session/response";
const char* TOPIC_SESSION_CANCEL = "smartlab/session/cancel";
const char* TOPIC_RETURN_CONFIRM = "smartlab/return/confirm";
const char* TOPIC_RETURN_RESULT  = "smartlab/return/result";
const char* TOPIC_HEARTBEAT      = "smartlab/heartbeat";

// =============================================================================
// TIMING CONSTANTS
// =============================================================================
#define MQTT_TIMEOUT_MS     5000
#define AUTO_RETURN_MS      3000
#define IDLE_TIMEOUT_MS     30000
#define HEARTBEAT_INTERVAL  30000
#define SCROLL_INTERVAL     2000
#define DEBOUNCE_MS         300

// =============================================================================
// STATE MACHINE
// =============================================================================
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

// =============================================================================
// DATA STRUCTURES
// =============================================================================
struct ScannedItem {
  int  assetId;
  char typeName[32];
  char label[32];
};

struct SummaryEntry {
  char typeName[32];
  int  qty;
};

struct ActiveSession {
  int  userId;
  char userName[50];
  char userNrp[20];
  bool hasActiveLoan;
  int  activeSessionId;

  ScannedItem items[20];
  int         itemCount;

  int  returnAssetIds[20];
  char returnTypeNames[20][32];
  int  returnCount;

  ScannedItem borrowedItems[20];
  int         borrowedCount;

  char sessionToken[37];
};

// =============================================================================
// GLOBAL OBJECTS
// =============================================================================
Adafruit_PN532 nfc(PIN_SDA, PIN_SCL);   // I2C constructor (uses Wire)
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /* reset=*/ U8X8_PIN_NONE);

WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

// =============================================================================
// GLOBAL STATE
// =============================================================================
AppState      currentState      = STATE_HOME;
unsigned long stateEnteredAt    = 0;
bool          oledNeedsRedraw   = true;

ActiveSession session;

// Feedback strings (scan item)
bool feedbackIsSuccess          = false;
char feedbackSuccessItem[64]    = "";
char feedbackErrorMsg[64]       = "";

// Error message
char errorMsg[64]               = "";

// Scroll
int           scrollOffset      = 0;
unsigned long lastScrollTime    = 0;

// Button debounce + edge detection
unsigned long lastBtnLeftPress  = 0;
unsigned long lastBtnRightPress = 0;
bool          prevBtnLeftState  = false;   // track previous read for edge detection
bool          prevBtnRightState = false;

// Heartbeat
unsigned long lastHeartbeat     = 0;

// MQTT response wait flag
bool          waitingMqttResp   = false;
unsigned long mqttReqSentAt     = 0;

// RFID scan cooldown (prevent repeated reads)
char          lastScannedUID[15] = "";
unsigned long lastScanTime       = 0;
#define RFID_COOLDOWN_MS  3000

// =============================================================================
// FORWARD DECLARATIONS
// =============================================================================
void connectWiFi();
void connectMQTT();
void mqttCallback(char* topic, byte* payload, unsigned int length);
void transitionTo(AppState newState);
void handleButtons();
void handleRFIDScan();
void checkStateTimeout();
void handleScroll();
void sendHeartbeat();
void renderOLED();

void onKTMScanned(const char* uid);
void onAssetScanned(const char* uid);
void confirmBorrow();
void confirmReturn();
void cancelSession();

void handleKTMResponse(JsonDocument& doc);
void handleAssetResponse(JsonDocument& doc);
void handleSessionResponse(JsonDocument& doc);
void handleReturnResult(JsonDocument& doc);

void generateUUID(char* out);
void uidToHexString(uint8_t* uid, uint8_t len, char* out);

void beepShort(int count);
void beepLong();

void drawTitleBar(const char* title);
void drawContentLine(const char* text, int lineIndex);
void drawButtonBar(const char* leftLabel, const char* rightLabel,
                   bool invertLeft, bool invertRight);
void drawHome();
void drawKTMInvalid();
void drawActionSelect();
void drawScanItems();
void drawScanItemFeedback();
void drawBorrowSummary();
void drawBorrowProcessing();
void drawBorrowSuccess();
void drawReturnScan();
void drawReturnScanFeedback();
void drawReturnSummary();
void drawReturnProcessing();
void drawReturnSuccess();
void drawError();

const char* stateNameString(AppState s);

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println(F("[BOOT] SmartLab ESP32-S3 Terminal"));

  // GPIO
  pinMode(PIN_BTN_LEFT,  INPUT);
  pinMode(PIN_BTN_RIGHT, INPUT);
  pinMode(PIN_BUZZER,    OUTPUT);
  digitalWrite(PIN_BUZZER, LOW);

  // I2C — MUST be called BEFORE nfc.begin() and u8g2.begin()
  Wire.begin(PIN_SDA, PIN_SCL);

  // OLED init
  u8g2.begin();
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.clearBuffer();
  u8g2.drawStr(10, 30, "Booting...");
  u8g2.sendBuffer();

  // PN532 init
  nfc.begin();
  uint32_t versiondata = nfc.getFirmwareVersion();
  if (!versiondata) {
    Serial.println(F("[ERROR] PN532 not found!"));
    u8g2.clearBuffer();
    u8g2.drawStr(10, 30, "RFID Error!");
    u8g2.sendBuffer();
    while (1) { delay(1000); }
  }
  Serial.print(F("[NFC] PN532 FW v"));
  Serial.print((versiondata >> 24) & 0xFF, DEC);
  Serial.print('.');
  Serial.println((versiondata >> 16) & 0xFF, DEC);
  nfc.SAMConfig();
  Serial.println(F("[NFC] SAM configured"));

  // MQTT — setBufferSize BEFORE connect
  mqttClient.setBufferSize(1024);
  mqttClient.setServer(MQTT_SERVER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  // Network
  connectWiFi();
  connectMQTT();

  // Clear session
  memset(&session, 0, sizeof(session));

  // Initial state
  transitionTo(STATE_HOME);
  beepShort(1);

  Serial.println(F("[BOOT] Ready"));
}

// =============================================================================
// MAIN LOOP
// =============================================================================
void loop() {
  // Reconnect MQTT if needed
  if (!mqttClient.connected()) {
    connectMQTT();
  }
  mqttClient.loop();

  // Handle inputs
  handleButtons();

  // RFID only in states that accept card scans
  if (currentState == STATE_HOME ||
      currentState == STATE_SCAN_ITEMS ||
      currentState == STATE_RETURN_SCAN) {
    handleRFIDScan();
  }

  // Timeouts
  checkStateTimeout();

  // Scroll in summary states
  if (currentState == STATE_BORROW_SUMMARY ||
      currentState == STATE_RETURN_SUMMARY) {
    handleScroll();
  }

  // Heartbeat
  sendHeartbeat();

  // Render OLED when dirty
  if (oledNeedsRedraw) {
    renderOLED();
    oledNeedsRedraw = false;
  }
}

// =============================================================================
// WIFI
// =============================================================================
void connectWiFi() {
  Serial.print(F("[WIFI] Connecting to "));
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int retries = 0;
  while (WiFi.status() != WL_CONNECTED && retries < 20) {
    delay(500);
    Serial.print('.');
    retries++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println(F("\n[WIFI] Failed! Restarting..."));
    u8g2.clearBuffer();
    u8g2.drawStr(10, 30, "WiFi gagal!");
    u8g2.drawStr(10, 44, "Restart...");
    u8g2.sendBuffer();
    delay(2000);
    ESP.restart();
  }

  Serial.print(F("\n[WIFI] Connected, IP: "));
  Serial.println(WiFi.localIP());
}

// =============================================================================
// MQTT CONNECT
// =============================================================================
void connectMQTT() {
  int retries = 0;
  while (!mqttClient.connected() && retries < 5) {
    Serial.print(F("[MQTT] Connecting..."));
    String clientId = "smartlab-esp32s3-" + String(esp_random() % 10000);

    bool connected;
    if (strlen(MQTT_USER) > 0) {
      connected = mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS);
    } else {
      connected = mqttClient.connect(clientId.c_str());
    }

    if (connected) {
      Serial.println(F(" OK"));
      // Subscribe to all response topics
      mqttClient.subscribe(TOPIC_KTM_RESP);
      mqttClient.subscribe(TOPIC_ASSET_RESP);
      mqttClient.subscribe(TOPIC_SESSION_RESP);
      mqttClient.subscribe(TOPIC_RETURN_RESULT);
      Serial.println(F("[MQTT] Subscribed to response topics"));
    } else {
      Serial.print(F(" FAIL rc="));
      Serial.println(mqttClient.state());
      retries++;
      delay(2000);
    }
  }

  if (!mqttClient.connected()) {
    Serial.println(F("[MQTT] Could not connect after 5 retries"));
  }
}

// =============================================================================
// MQTT CALLBACK
// =============================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.print(F("[MQTT] Msg on: "));
  Serial.println(topic);

  // Parse JSON
  JsonDocument doc;
  DeserializationError err = deserializeJson(doc, payload, length);
  if (err) {
    Serial.print(F("[MQTT] JSON parse error: "));
    Serial.println(err.c_str());
    return;
  }

  // Dispatch to handler
  if (strcmp(topic, TOPIC_KTM_RESP) == 0) {
    handleKTMResponse(doc);
  } else if (strcmp(topic, TOPIC_ASSET_RESP) == 0) {
    handleAssetResponse(doc);
  } else if (strcmp(topic, TOPIC_SESSION_RESP) == 0) {
    handleSessionResponse(doc);
  } else if (strcmp(topic, TOPIC_RETURN_RESULT) == 0) {
    handleReturnResult(doc);
  }
}

// =============================================================================
// MQTT RESPONSE HANDLERS
// =============================================================================
void handleKTMResponse(JsonDocument& doc) {
  waitingMqttResp = false;

  // Verify session token matches
  const char* respToken = doc["session_token"] | "";
  if (strlen(session.sessionToken) > 0 && strcmp(respToken, session.sessionToken) != 0) {
    Serial.println(F("[KTM] Token mismatch, ignoring"));
    return;
  }

  bool valid = doc["valid"] | false;
  if (!valid) {
    beepShort(3);
    transitionTo(STATE_KTM_INVALID);
    return;
  }

  // Fill session data
  session.userId = doc["user_id"] | 0;
  strlcpy(session.userName, doc["user_name"] | "User", sizeof(session.userName));
  strlcpy(session.userNrp,  doc["user_nrp"]  | "-",    sizeof(session.userNrp));
  session.hasActiveLoan   = doc["has_active_loan"] | false;
  session.activeSessionId = doc["active_session_id"] | 0;
  session.itemCount       = 0;
  session.returnCount     = 0;

  // Parse borrowed items if available
  session.borrowedCount = 0;
  if (doc["borrowed_items"].is<JsonArray>()) {
    JsonArray arr = doc["borrowed_items"].as<JsonArray>();
    for (JsonVariant v : arr) {
      if (session.borrowedCount < 20) {
        session.borrowedItems[session.borrowedCount].assetId = v["asset_id"] | 0;
        strlcpy(session.borrowedItems[session.borrowedCount].typeName,
                v["type_name"] | "", sizeof(ScannedItem::typeName));
        strlcpy(session.borrowedItems[session.borrowedCount].label,
                v["label"] | "", sizeof(ScannedItem::label));
        session.borrowedCount++;
      }
    }
  }

  beepShort(1);
  transitionTo(STATE_ACTION_SELECT);
}

void handleAssetResponse(JsonDocument& doc) {
  waitingMqttResp = false;

  // Verify session token
  const char* respToken = doc["session_token"] | "";
  if (strcmp(respToken, session.sessionToken) != 0) {
    Serial.println(F("[ASSET] Token mismatch, ignoring"));
    return;
  }

  bool valid = doc["valid"] | false;
  if (!valid) {
    // Error feedback
    feedbackIsSuccess = false;
    strlcpy(feedbackErrorMsg, doc["error"] | "Aset tidak dikenal", sizeof(feedbackErrorMsg));
    beepShort(2);

    if (currentState == STATE_SCAN_ITEMS) {
      transitionTo(STATE_SCAN_ITEM_FEEDBACK);
    } else if (currentState == STATE_RETURN_SCAN) {
      transitionTo(STATE_RETURN_SCAN_FEEDBACK);
    }
    return;
  }

  int assetId = doc["asset_id"] | 0;
  const char* typeName = doc["type_name"] | "Unknown";
  const char* label    = doc["label"]     | "";

  if (currentState == STATE_SCAN_ITEMS) {
    // Check duplicate
    for (int i = 0; i < session.itemCount; i++) {
      if (session.items[i].assetId == assetId) {
        feedbackIsSuccess = false;
        strlcpy(feedbackErrorMsg, "Item sudah discan", sizeof(feedbackErrorMsg));
        beepShort(2);
        transitionTo(STATE_SCAN_ITEM_FEEDBACK);
        return;
      }
    }

    if (session.itemCount < 20) {
      session.items[session.itemCount].assetId = assetId;
      strlcpy(session.items[session.itemCount].typeName, typeName, sizeof(ScannedItem::typeName));
      strlcpy(session.items[session.itemCount].label,    label,    sizeof(ScannedItem::label));
      session.itemCount++;

      feedbackIsSuccess = true;
      snprintf(feedbackSuccessItem, sizeof(feedbackSuccessItem), "%s", label);
      beepShort(1);
      transitionTo(STATE_SCAN_ITEM_FEEDBACK);
    }
  } else if (currentState == STATE_RETURN_SCAN) {
    // Check duplicate in return list
    for (int i = 0; i < session.returnCount; i++) {
      if (session.returnAssetIds[i] == assetId) {
        feedbackIsSuccess = false;
        strlcpy(feedbackErrorMsg, "Item sudah discan", sizeof(feedbackErrorMsg));
        beepShort(2);
        transitionTo(STATE_RETURN_SCAN_FEEDBACK);
        return;
      }
    }

    if (session.returnCount < 20) {
      session.returnAssetIds[session.returnCount] = assetId;
      strlcpy(session.returnTypeNames[session.returnCount], typeName, 32);
      session.returnCount++;

      feedbackIsSuccess = true;
      snprintf(feedbackSuccessItem, sizeof(feedbackSuccessItem), "%s", label);
      beepShort(1);
      transitionTo(STATE_RETURN_SCAN_FEEDBACK);
    }
  }
}

void handleSessionResponse(JsonDocument& doc) {
  waitingMqttResp = false;

  bool success = doc["success"] | false;
  if (success) {
    transitionTo(STATE_BORROW_SUCCESS);
  } else {
    strlcpy(errorMsg, doc["error"] | "Gagal menyimpan", sizeof(errorMsg));
    transitionTo(STATE_ERROR);
  }
}

void handleReturnResult(JsonDocument& doc) {
  waitingMqttResp = false;

  bool success = doc["success"] | false;
  if (success) {
    transitionTo(STATE_RETURN_SUCCESS);
  } else {
    strlcpy(errorMsg, doc["error"] | "Gagal mengembalikan", sizeof(errorMsg));
    transitionTo(STATE_ERROR);
  }
}

// =============================================================================
// RFID HANDLING
// =============================================================================
void handleRFIDScan() {
  uint8_t uid[7] = {0};
  uint8_t uidLength = 0;

  // Non-blocking read with 100ms timeout
  bool success = nfc.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLength, 100);
  if (!success) return;

  char uidStr[15] = "";
  uidToHexString(uid, uidLength, uidStr);

  // Cooldown: abaikan jika UID sama dan belum lewat 3 detik
  if (strcmp(uidStr, lastScannedUID) == 0 && (millis() - lastScanTime < RFID_COOLDOWN_MS)) {
    return;  // Masih kartu yang sama, skip
  }

  // Simpan UID dan waktu scan terakhir
  strlcpy(lastScannedUID, uidStr, sizeof(lastScannedUID));
  lastScanTime = millis();

  Serial.print(F("[RFID] UID: "));
  Serial.println(uidStr);

  if (currentState == STATE_HOME) {
    onKTMScanned(uidStr);
  } else if (currentState == STATE_SCAN_ITEMS) {
    onAssetScanned(uidStr);
  } else if (currentState == STATE_RETURN_SCAN) {
    onAssetScanned(uidStr);
  }
}

void uidToHexString(uint8_t* uid, uint8_t len, char* out) {
  out[0] = '\0';
  for (uint8_t i = 0; i < len; i++) {
    char tmp[3];
    snprintf(tmp, sizeof(tmp), "%02x", uid[i]);
    strcat(out, tmp);
  }
}

// =============================================================================
// MQTT PUBLISH FUNCTIONS
// =============================================================================
void onKTMScanned(const char* uid) {
  generateUUID(session.sessionToken);
  session.itemCount   = 0;
  session.returnCount = 0;

  JsonDocument doc;
  doc["uid"]           = uid;
  doc["session_token"] = session.sessionToken;

  char buffer[256];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqttClient.publish(TOPIC_KTM_SCAN, buffer, len);

  waitingMqttResp = true;
  mqttReqSentAt   = millis();

  Serial.print(F("[PUB] KTM scan: "));
  Serial.println(buffer);
}

void onAssetScanned(const char* uid) {
  JsonDocument doc;
  doc["uid"]           = uid;
  doc["session_token"] = session.sessionToken;

  // Tell backend whether we're borrowing or returning
  if (currentState == STATE_RETURN_SCAN) {
    doc["mode"]    = "return";
    doc["user_id"] = session.userId;
  } else {
    doc["mode"]    = "borrow";
  }

  char buffer[256];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqttClient.publish(TOPIC_ASSET_SCAN, buffer, len);

  waitingMqttResp = true;
  mqttReqSentAt   = millis();

  Serial.print(F("[PUB] Asset scan: "));
  Serial.println(buffer);
}

void confirmBorrow() {
  JsonDocument doc;
  doc["session_token"] = session.sessionToken;
  doc["user_id"]       = session.userId;

  JsonArray assetIds = doc["asset_ids"].to<JsonArray>();
  for (int i = 0; i < session.itemCount; i++) {
    assetIds.add(session.items[i].assetId);
  }

  char buffer[512];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqttClient.publish(TOPIC_SESSION_CREATE, buffer, len);

  waitingMqttResp = true;
  mqttReqSentAt   = millis();
  transitionTo(STATE_BORROW_PROCESSING);

  Serial.print(F("[PUB] Session create: "));
  Serial.println(buffer);
}

void confirmReturn() {
  JsonDocument doc;
  doc["session_id"] = session.activeSessionId;

  JsonArray assetIds = doc["asset_ids"].to<JsonArray>();
  for (int i = 0; i < session.returnCount; i++) {
    assetIds.add(session.returnAssetIds[i]);
  }

  char buffer[512];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqttClient.publish(TOPIC_RETURN_CONFIRM, buffer, len);

  waitingMqttResp = true;
  mqttReqSentAt   = millis();
  transitionTo(STATE_RETURN_PROCESSING);

  Serial.print(F("[PUB] Return confirm: "));
  Serial.println(buffer);
}

void cancelSession() {
  if (currentState == STATE_HOME) return;

  if (strlen(session.sessionToken) > 0) {
    JsonDocument doc;
    doc["session_token"] = session.sessionToken;

    char buffer[128];
    size_t len = serializeJson(doc, buffer, sizeof(buffer));
    mqttClient.publish(TOPIC_SESSION_CANCEL, buffer, len);

    Serial.println(F("[PUB] Session cancelled"));
  }

  memset(&session, 0, sizeof(session));
  waitingMqttResp = false;
  transitionTo(STATE_HOME);
}

// =============================================================================
// UUID GENERATOR (byte-by-byte with esp_random)
// =============================================================================
void generateUUID(char* out) {
  uint8_t b[16];
  for (int i = 0; i < 4; i++) {
    uint32_t r  = esp_random();
    b[i*4]     = r & 0xFF;
    b[i*4 + 1] = (r >> 8)  & 0xFF;
    b[i*4 + 2] = (r >> 16) & 0xFF;
    b[i*4 + 3] = (r >> 24) & 0xFF;
  }
  b[6] = (b[6] & 0x0F) | 0x40;  // Version 4
  b[8] = (b[8] & 0x3F) | 0x80;  // Variant 1

  snprintf(out, 37,
    "%02x%02x%02x%02x-%02x%02x-%02x%02x-%02x%02x-%02x%02x%02x%02x%02x%02x",
    b[0], b[1], b[2],  b[3],  b[4],  b[5],  b[6],  b[7],
    b[8], b[9], b[10], b[11], b[12], b[13], b[14], b[15]);
}

// =============================================================================
// BUZZER
// =============================================================================
void beepShort(int count) {
  for (int i = 0; i < count; i++) {
    digitalWrite(PIN_BUZZER, HIGH);
    delay(80);
    digitalWrite(PIN_BUZZER, LOW);
    if (i < count - 1) delay(100);
  }
}

void beepLong() {
  digitalWrite(PIN_BUZZER, HIGH);
  delay(450);
  digitalWrite(PIN_BUZZER, LOW);
}

// =============================================================================
// STATE TRANSITION
// =============================================================================
void transitionTo(AppState newState) {
  Serial.print(F("[STATE] "));
  Serial.print(stateNameString(currentState));
  Serial.print(F(" -> "));
  Serial.println(stateNameString(newState));

  currentState    = newState;
  stateEnteredAt  = millis();
  oledNeedsRedraw = true;
  scrollOffset    = 0;
  lastScrollTime  = millis();

  // Reset RFID cooldown saat kembali ke HOME
  if (newState == STATE_HOME) {
    lastScannedUID[0] = '\0';
  }

  // Reset cooldown timer saat masuk state scanning baru
  // agar KTM yang masih nempel tidak terbaca sebagai aset
  if (newState == STATE_ACTION_SELECT ||
      newState == STATE_SCAN_ITEMS ||
      newState == STATE_RETURN_SCAN) {
    lastScanTime = millis();
  }

  // Buzzer feedback on success states
  if (newState == STATE_BORROW_SUCCESS) {
    beepLong();
  } else if (newState == STATE_RETURN_SUCCESS) {
    beepLong();
  }
}

const char* stateNameString(AppState s) {
  switch (s) {
    case STATE_HOME:               return "HOME";
    case STATE_KTM_INVALID:        return "KTM_INVALID";
    case STATE_ACTION_SELECT:      return "ACTION_SELECT";
    case STATE_SCAN_ITEMS:         return "SCAN_ITEMS";
    case STATE_SCAN_ITEM_FEEDBACK: return "SCAN_ITEM_FEEDBACK";
    case STATE_BORROW_SUMMARY:     return "BORROW_SUMMARY";
    case STATE_BORROW_PROCESSING:  return "BORROW_PROCESSING";
    case STATE_BORROW_SUCCESS:     return "BORROW_SUCCESS";
    case STATE_RETURN_SCAN:        return "RETURN_SCAN";
    case STATE_RETURN_SCAN_FEEDBACK: return "RETURN_SCAN_FEEDBACK";
    case STATE_RETURN_SUMMARY:     return "RETURN_SUMMARY";
    case STATE_RETURN_PROCESSING:  return "RETURN_PROCESSING";
    case STATE_RETURN_SUCCESS:     return "RETURN_SUCCESS";
    case STATE_ERROR:              return "ERROR";
    default:                       return "UNKNOWN";
  }
}

// =============================================================================
// TIMEOUT CHECK
// =============================================================================
void checkStateTimeout() {
  unsigned long elapsed = millis() - stateEnteredAt;

  // MQTT response timeout (for waiting states)
  if (waitingMqttResp && (millis() - mqttReqSentAt > MQTT_TIMEOUT_MS)) {
    waitingMqttResp = false;
    strlcpy(errorMsg, "Timeout: server tidak merespons", sizeof(errorMsg));
    transitionTo(STATE_ERROR);
    return;
  }

  // Auto-return to HOME
  switch (currentState) {
    case STATE_ERROR:
    case STATE_KTM_INVALID:
    case STATE_BORROW_SUCCESS:
    case STATE_RETURN_SUCCESS:
      if (elapsed > AUTO_RETURN_MS) {
        memset(&session, 0, sizeof(session));
        transitionTo(STATE_HOME);
      }
      break;

    case STATE_SCAN_ITEM_FEEDBACK:
    case STATE_RETURN_SCAN_FEEDBACK:
      // Short feedback display, then return to scan state
      if (elapsed > 1500) {
        if (currentState == STATE_SCAN_ITEM_FEEDBACK) {
          transitionTo(STATE_SCAN_ITEMS);
        } else {
          transitionTo(STATE_RETURN_SCAN);
        }
      }
      break;

    case STATE_ACTION_SELECT:
      if (elapsed > IDLE_TIMEOUT_MS) {
        cancelSession();
      }
      break;

    default:
      break;
  }
}

// =============================================================================
// HEARTBEAT
// =============================================================================
void sendHeartbeat() {
  if (millis() - lastHeartbeat < HEARTBEAT_INTERVAL) return;
  lastHeartbeat = millis();

  JsonDocument doc;
  doc["status"] = "ok";
  doc["state"]  = stateNameString(currentState);
  doc["ts"]     = millis();

  char buffer[128];
  size_t len = serializeJson(doc, buffer, sizeof(buffer));
  mqttClient.publish(TOPIC_HEARTBEAT, buffer, len);
}

// =============================================================================
// BUTTON HANDLING
// =============================================================================
void handleButtons() {
  bool leftPressed  = false;
  bool rightPressed = false;

  bool curLeft  = (digitalRead(PIN_BTN_LEFT)  == HIGH);
  bool curRight = (digitalRead(PIN_BTN_RIGHT) == HIGH);

  // Rising-edge detection + debounce cooldown:
  // Register press ONLY when button transitions from released → pressed,
  // AND enough time has passed since the last registered press.
  // This prevents repeated inputs when the button is held down.
  if (curLeft && !prevBtnLeftState) {
    if (millis() - lastBtnLeftPress > DEBOUNCE_MS) {
      leftPressed = true;
      lastBtnLeftPress = millis();
    }
  }
  if (curRight && !prevBtnRightState) {
    if (millis() - lastBtnRightPress > DEBOUNCE_MS) {
      rightPressed = true;
      lastBtnRightPress = millis();
    }
  }

  // Update previous state for next iteration
  prevBtnLeftState  = curLeft;
  prevBtnRightState = curRight;

  if (!leftPressed && !rightPressed) return;

  switch (currentState) {
    case STATE_HOME:
      // Ignore buttons at home
      break;

    case STATE_ACTION_SELECT:
      if (leftPressed) {
        // PINJAM
        transitionTo(STATE_SCAN_ITEMS);
      }
      if (rightPressed) {
        // KEMBALI
        if (session.hasActiveLoan) {
          transitionTo(STATE_RETURN_SCAN);
        } else {
          strlcpy(errorMsg, "Tidak ada pinjaman aktif", sizeof(errorMsg));
          transitionTo(STATE_ERROR);
        }
      }
      break;

    case STATE_SCAN_ITEMS:
      if (leftPressed) {
        cancelSession();
      }
      if (rightPressed && session.itemCount > 0) {
        transitionTo(STATE_BORROW_SUMMARY);
      }
      break;

    case STATE_BORROW_SUMMARY:
      if (leftPressed) {
        cancelSession();
      }
      if (rightPressed) {
        confirmBorrow();
      }
      break;

    case STATE_RETURN_SCAN:
      if (leftPressed) {
        cancelSession();
      }
      if (rightPressed && session.returnCount > 0) {
        transitionTo(STATE_RETURN_SUMMARY);
      }
      break;

    case STATE_RETURN_SUMMARY:
      if (leftPressed) {
        cancelSession();
      }
      if (rightPressed) {
        confirmReturn();
      }
      break;

    case STATE_BORROW_PROCESSING:
    case STATE_RETURN_PROCESSING:
      // Ignore buttons during processing
      break;

    default:
      break;
  }
}

// =============================================================================
// SCROLL HANDLING
// =============================================================================
void handleScroll() {
  if (millis() - lastScrollTime < SCROLL_INTERVAL) return;
  lastScrollTime = millis();
  scrollOffset++;
  oledNeedsRedraw = true;
}

// =============================================================================
// SUMMARY BUILDER (used by drawBorrowSummary & drawReturnSummary)
// =============================================================================
int buildBorrowSummary(SummaryEntry* entries, int maxEntries) {
  int count = 0;
  for (int i = 0; i < session.itemCount; i++) {
    bool found = false;
    for (int j = 0; j < count; j++) {
      if (strcmp(entries[j].typeName, session.items[i].typeName) == 0) {
        entries[j].qty++;
        found = true;
        break;
      }
    }
    if (!found && count < maxEntries) {
      strlcpy(entries[count].typeName, session.items[i].typeName, sizeof(SummaryEntry::typeName));
      entries[count].qty = 1;
      count++;
    }
  }
  return count;
}

int buildReturnSummary(SummaryEntry* entries, int maxEntries) {
  int count = 0;
  for (int i = 0; i < session.returnCount; i++) {
    bool found = false;
    for (int j = 0; j < count; j++) {
      if (strcmp(entries[j].typeName, session.returnTypeNames[i]) == 0) {
        entries[j].qty++;
        found = true;
        break;
      }
    }
    if (!found && count < maxEntries) {
      strlcpy(entries[count].typeName, session.returnTypeNames[i], sizeof(SummaryEntry::typeName));
      entries[count].qty = 1;
      count++;
    }
  }
  return count;
}

// =============================================================================
// OLED RENDERING
// =============================================================================
void renderOLED() {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setFontMode(0);
  u8g2.setDrawColor(1);

  // Divider lines
  u8g2.drawHLine(0, 13, 128);
  u8g2.drawHLine(0, 51, 128);

  switch (currentState) {
    case STATE_HOME:               drawHome();               break;
    case STATE_KTM_INVALID:        drawKTMInvalid();         break;
    case STATE_ACTION_SELECT:      drawActionSelect();       break;
    case STATE_SCAN_ITEMS:         drawScanItems();          break;
    case STATE_SCAN_ITEM_FEEDBACK: drawScanItemFeedback();   break;
    case STATE_BORROW_SUMMARY:     drawBorrowSummary();      break;
    case STATE_BORROW_PROCESSING:  drawBorrowProcessing();   break;
    case STATE_BORROW_SUCCESS:     drawBorrowSuccess();      break;
    case STATE_RETURN_SCAN:        drawReturnScan();         break;
    case STATE_RETURN_SCAN_FEEDBACK: drawReturnScanFeedback(); break;
    case STATE_RETURN_SUMMARY:     drawReturnSummary();      break;
    case STATE_RETURN_PROCESSING:  drawReturnProcessing();   break;
    case STATE_RETURN_SUCCESS:     drawReturnSuccess();      break;
    case STATE_ERROR:              drawError();              break;
  }

  u8g2.sendBuffer();
}

// --- Drawing Helpers ---

void drawTitleBar(const char* title) {
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setDrawColor(1);
  u8g2.setFontMode(0);
  u8g2.drawStr(2, 10, title);
}

void drawContentLine(const char* text, int lineIndex) {
  if (lineIndex < 0 || lineIndex > 3) return;
  int y = 14 + (lineIndex * 10) + 10;  // baseline offset
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setDrawColor(1);
  u8g2.setFontMode(0);
  u8g2.drawStr(2, y, text);
}

void drawButtonBar(const char* leftLabel, const char* rightLabel,
                   bool invertLeft, bool invertRight) {
  u8g2.setFont(u8g2_font_6x10_tf);

  // Left button
  if (leftLabel && strlen(leftLabel) > 0) {
    int lw = u8g2.getStrWidth(leftLabel);
    if (invertLeft) {
      u8g2.setDrawColor(1);
      u8g2.drawBox(0, 52, lw + 4, 12);
      u8g2.setDrawColor(0);
      u8g2.setFontMode(1);
      u8g2.drawStr(2, 62, leftLabel);
      // Restore
      u8g2.setDrawColor(1);
      u8g2.setFontMode(0);
    } else {
      u8g2.setDrawColor(1);
      u8g2.setFontMode(0);
      u8g2.drawStr(2, 62, leftLabel);
    }
  }

  // Right button
  if (rightLabel && strlen(rightLabel) > 0) {
    int rw = u8g2.getStrWidth(rightLabel);
    int rx = 128 - rw - 4;
    if (invertRight) {
      u8g2.setDrawColor(1);
      u8g2.drawBox(rx, 52, rw + 4, 12);
      u8g2.setDrawColor(0);
      u8g2.setFontMode(1);
      u8g2.drawStr(rx + 2, 62, rightLabel);
      // Restore
      u8g2.setDrawColor(1);
      u8g2.setFontMode(0);
    } else {
      u8g2.setDrawColor(1);
      u8g2.setFontMode(0);
      u8g2.drawStr(rx + 2, 62, rightLabel);
    }
  }
}

// --- State Draw Functions ---

void drawHome() {
  drawTitleBar("SmartLab");
  drawContentLine("Scan KTM Anda", 0);
  drawContentLine("untuk memulai...", 1);
  drawButtonBar("", "", false, false);
}

void drawKTMInvalid() {
  drawTitleBar("KTM Tidak Dikenal");
  drawContentLine("UID tidak terdaftar", 0);
  drawContentLine("dalam sistem.", 1);
  drawButtonBar("", "", false, false);
}

void drawActionSelect() {
  // Title: "Halo, userName" truncated to 18 chars
  char title[24];
  char truncName[19];
  strlcpy(truncName, session.userName, sizeof(truncName));
  snprintf(title, sizeof(title), "Halo, %s", truncName);
  drawTitleBar(title);

  // Content
  char nrpLine[32];
  snprintf(nrpLine, sizeof(nrpLine), "NRP: %s", session.userNrp);
  drawContentLine(nrpLine, 0);

  if (session.hasActiveLoan) {
    drawContentLine("Ada pinjaman aktif", 1);
  }

  // Button bar: PEMINJAMAN left, PENGEMBALIAN right
  drawButtonBar("PEMINJAMAN", "PENGEMBALIAN", false, session.hasActiveLoan);
}

void drawScanItems() {
  drawTitleBar("Scan Barang");

  // Line 0: last scanned item type
  char line0[32];
  if (session.itemCount > 0) {
    snprintf(line0, sizeof(line0), "Item: %s", session.items[session.itemCount - 1].typeName);
  } else {
    strlcpy(line0, "Item: -", sizeof(line0));
  }
  drawContentLine(line0, 0);

  // Line 1: qty of last type
  int qtyLast = 0;
  if (session.itemCount > 0) {
    const char* lastType = session.items[session.itemCount - 1].typeName;
    for (int i = 0; i < session.itemCount; i++) {
      if (strcmp(session.items[i].typeName, lastType) == 0) {
        qtyLast++;
      }
    }
  }
  char line1[16];
  snprintf(line1, sizeof(line1), "Qty : %d", qtyLast);
  drawContentLine(line1, 1);

  // Line 3: total
  char line3[16];
  snprintf(line3, sizeof(line3), "Total: %d", session.itemCount);
  drawContentLine(line3, 3);

  // Button bar
  const char* rightLabel = (session.itemCount > 0) ? "Selesai>" : "";
  drawButtonBar("Batal", rightLabel, false, false);
}

void drawScanItemFeedback() {
  if (feedbackIsSuccess) {
    drawTitleBar("Item Ditemukan");
    drawContentLine(feedbackSuccessItem, 0);
    drawContentLine("Berhasil ditambahkan", 1);
  } else {
    drawTitleBar("Scan Gagal");
    drawContentLine(feedbackErrorMsg, 0);
  }
  drawButtonBar("", "", false, false);
}

void drawBorrowSummary() {
  drawTitleBar("Ringkasan");

  SummaryEntry entries[20];
  int count = buildBorrowSummary(entries, 20);

  // Auto-scroll: show up to 3 lines in content area (lines 0-2)
  int maxVisible = 3;
  int offset = (count > maxVisible) ? (scrollOffset % count) : 0;

  for (int i = 0; i < maxVisible && i < count; i++) {
    int idx = (offset + i) % count;
    char line[32];
    snprintf(line, sizeof(line), "%s x%d", entries[idx].typeName, entries[idx].qty);
    drawContentLine(line, i);
  }

  // Total on line 3
  char totalLine[16];
  snprintf(totalLine, sizeof(totalLine), "Total: %d item", session.itemCount);
  drawContentLine(totalLine, 3);

  drawButtonBar("Batal", "Konfirmasi!", false, true);
}

void drawBorrowProcessing() {
  drawTitleBar("Menyimpan...");
  drawContentLine("Sedang memproses...", 1);
  drawButtonBar("", "", false, false);
}

void drawBorrowSuccess() {
  drawTitleBar("Berhasil!");
  drawContentLine("Peminjaman tercatat", 1);
  drawButtonBar("", "", false, false);
}

void drawReturnScan() {
  drawTitleBar("Kembalikan Barang");

  drawContentLine("Scan item yang", 0);
  drawContentLine("akan dikembalikan", 1);

  char countLine[24];
  snprintf(countLine, sizeof(countLine), "Dikembalikan: %d item", session.returnCount);
  drawContentLine(countLine, 3);

  const char* rightLabel = (session.returnCount > 0) ? "Selesai>" : "";
  drawButtonBar("Batal", rightLabel, false, false);
}

void drawReturnScanFeedback() {
  if (feedbackIsSuccess) {
    drawTitleBar("Item Ditemukan");
    drawContentLine(feedbackSuccessItem, 0);
    drawContentLine("Ditandai dikembalikan", 1);
  } else {
    drawTitleBar("Scan Gagal");
    drawContentLine(feedbackErrorMsg, 0);
  }
  drawButtonBar("", "", false, false);
}

void drawReturnSummary() {
  drawTitleBar("Ringkasan");

  SummaryEntry entries[20];
  int count = buildReturnSummary(entries, 20);

  int maxVisible = 3;
  int offset = (count > maxVisible) ? (scrollOffset % count) : 0;

  for (int i = 0; i < maxVisible && i < count; i++) {
    int idx = (offset + i) % count;
    char line[32];
    snprintf(line, sizeof(line), "%s x%d", entries[idx].typeName, entries[idx].qty);
    drawContentLine(line, i);
  }

  char totalLine[24];
  snprintf(totalLine, sizeof(totalLine), "Total: %d item", session.returnCount);
  drawContentLine(totalLine, 3);

  drawButtonBar("Batal", "Konfirmasi!", false, true);
}

void drawReturnProcessing() {
  drawTitleBar("Memproses...");
  drawContentLine("Memproses", 0);
  drawContentLine("pengembalian...", 1);
  drawButtonBar("", "", false, false);
}

void drawReturnSuccess() {
  drawTitleBar("Berhasil!");
  drawContentLine("Pengembalian tercatat", 1);
  drawButtonBar("", "", false, false);
}

void drawError() {
  drawTitleBar("Error");
  drawContentLine(errorMsg, 1);
  drawButtonBar("", "", false, false);
}
