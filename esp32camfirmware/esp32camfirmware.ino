/*
 * ============================================================
 *  SmartLab ESP32-CAM Firmware
 * ============================================================
 *  Board   : AI-Thinker ESP32-CAM
 *  Camera  : OV2640 (onboard)
 *  Purpose : MQTT-triggered photo capture & HTTP upload
 *
 *  Libraries (version wajib):
 *    - ESP32 Arduino Core 3.3.3
 *    - PubSubClient 2.8
 *    - ArduinoJson 7.4.3
 * ============================================================
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <WiFiClient.h>
#include <HTTPClient.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// ============================================================
//  KONFIGURASI — ganti sesuai setup
// ============================================================
#define WIFI_SSID      "eggy"
#define WIFI_PASSWORD  "@Wangarry88"
#define MQTT_BROKER_IP "192.168.137.1" //ganti sesuai ipconfig
#define MQTT_PORT      1883
#define BACKEND_URL    "http://192.168.137.1:3001" //ganti sesuai ipconfig
#define CAM_SECRET     "df0e2ab03c65aa8094193b9d5ae90711d0996356581e08682bf34af6731e6bcd"
#define DEVICE_ID      "esp32cam-smartlab-01"

// ============================================================
//  PIN KAMERA AI-THINKER (fixed — jangan ubah)
// ============================================================
#define PWDN_GPIO_NUM    32
#define RESET_GPIO_NUM   -1
#define XCLK_GPIO_NUM     0
#define SIOD_GPIO_NUM    26
#define SIOC_GPIO_NUM    27
#define Y9_GPIO_NUM      35
#define Y8_GPIO_NUM      34
#define Y7_GPIO_NUM      39
#define Y6_GPIO_NUM      36
#define Y5_GPIO_NUM      21
#define Y4_GPIO_NUM      19
#define Y3_GPIO_NUM      18
#define Y2_GPIO_NUM       5
#define VSYNC_GPIO_NUM   25
#define HREF_GPIO_NUM    23
#define PCLK_GPIO_NUM    22

// GPIO4 = Flash LED (reserved, jangan pakai untuk I/O lain)
#define FLASH_LED_PIN     4

// ============================================================
//  MQTT topic
// ============================================================
#define MQTT_TOPIC_TRIGGER "smartlab/cam/trigger"

// ============================================================
//  Global variables
// ============================================================
WiFiClient   wifiClient;
PubSubClient mqttClient(wifiClient);

volatile bool captureRequested = false;
char pendingSessionToken[37] = {0};   // UUID v4 = 36 chars + null

// ============================================================
//  Backend server host & port (parsed dari BACKEND_URL)
// ============================================================
static const char* SERVER_HOST = "192.168.137.1"; //ganti sesuai ipconfig
static const uint16_t SERVER_PORT = 3001;
static const char* UPLOAD_PATH = "/api/photo/upload";

// ============================================================
//  1. initCamera()
// ============================================================
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
  config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;

  // Conditional PSRAM / DRAM
  if (psramFound()) {
    Serial.println("[CAM] PSRAM detected — using VGA, quality=12, fb_count=2");
    config.frame_size  = FRAMESIZE_VGA;
    config.jpeg_quality = 12;
    config.fb_count    = 2;
    config.fb_location = CAMERA_FB_IN_PSRAM;
  } else {
    Serial.println("[CAM] No PSRAM — using QVGA, quality=20, fb_count=1");
    config.frame_size  = FRAMESIZE_QVGA;
    config.jpeg_quality = 20;
    config.fb_count    = 1;
    config.fb_location = CAMERA_FB_IN_DRAM;
  }

  // Inisialisasi kamera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[CAM] Init FAILED (0x%x). Restarting...\n", err);
    delay(1000);
    ESP.restart();
  }

  // Atur brightness +1, contrast +1
  sensor_t* s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
  }

  Serial.println("[CAM] Camera initialized OK");
}

// ============================================================
//  2. connectWiFi()
// ============================================================
void connectWiFi() {
  Serial.printf("[WIFI] Connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("\n[WIFI] Connection FAILED. Restarting...");
    delay(1000);
    ESP.restart();
  }

  Serial.printf("\n[WIFI] Connected! IP: %s\n", WiFi.localIP().toString().c_str());
}

// ============================================================
//  3. connectMQTT()
// ============================================================
void connectMQTT() {
  int attempts = 0;

  while (!mqttClient.connected() && attempts < 5) {
    Serial.printf("[MQTT] Connecting to %s:%d (attempt %d/5)...\n",
                  MQTT_BROKER_IP, MQTT_PORT, attempts + 1);

    if (mqttClient.connect(DEVICE_ID)) {
      Serial.println("[MQTT] Connected!");
      mqttClient.subscribe(MQTT_TOPIC_TRIGGER);
      Serial.printf("[MQTT] Subscribed to: %s\n", MQTT_TOPIC_TRIGGER);
      return;
    } else {
      Serial.printf("[MQTT] Failed, rc=%d. Retrying in 2s...\n",
                    mqttClient.state());
      delay(2000);
      attempts++;
    }
  }

  Serial.println("[MQTT] Could not connect after 5 attempts.");
}

// ============================================================
//  4. captureAndUpload(sessionToken)
//     — Manual multipart/form-data via WiFiClient
// ============================================================
void captureAndUpload(const char* sessionToken) {
  Serial.println("[UPLOAD] Capturing photo...");

  // ---------- FLUSH FRAME BUFFER ----------
  // Karena fb_count = 2, frame yang ada di buffer kemungkinan adalah gambar lama.
  // Buang 1-2 frame awal agar gambar yang didapat benar-benar "real-time".
  for (int i = 0; i < 2; i++) {
    camera_fb_t* old_fb = esp_camera_fb_get();
    if (old_fb) esp_camera_fb_return(old_fb);
  }

  // Ambil frame buffer dari kamera (REAL FRAME)
  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[UPLOAD] Camera capture FAILED (fb is null)");
    return;
  }

  Serial.printf("[UPLOAD] Photo captured: %u bytes\n", fb->len);

  // ---------- Bangun multipart body ----------
  String boundary = "----ESP32CamBoundary";

  // Part 1: text field "session_token"
  String headerPart = "--" + boundary + "\r\n";
  headerPart += "Content-Disposition: form-data; name=\"session_token\"\r\n\r\n";
  headerPart += String(sessionToken) + "\r\n";

  // Part 2: file field "photo" header
  headerPart += "--" + boundary + "\r\n";
  headerPart += "Content-Disposition: form-data; name=\"photo\"; filename=\"photo.jpg\"\r\n";
  headerPart += "Content-Type: image/jpeg\r\n\r\n";

  // Closing boundary (setelah binary data)
  String closingPart = "\r\n--" + boundary + "--\r\n";

  // Total Content-Length
  size_t totalLength = headerPart.length() + fb->len + closingPart.length();

  // ---------- Kirim HTTP request manual ----------
  WiFiClient uploadClient;

  if (!uploadClient.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[UPLOAD] Connection to server FAILED");
    esp_camera_fb_return(fb);
    return;
  }

  Serial.println("[UPLOAD] Connected to server, sending request...");

  // HTTP request line & headers
  uploadClient.print("POST " + String(UPLOAD_PATH) + " HTTP/1.1\r\n");
  uploadClient.print("Host: " + String(SERVER_HOST) + ":" + String(SERVER_PORT) + "\r\n");
  uploadClient.print("X-Device-Secret: " + String(CAM_SECRET) + "\r\n");
  uploadClient.print("X-Session-Token: " + String(sessionToken) + "\r\n");
  uploadClient.print("Content-Type: multipart/form-data; boundary=" + boundary + "\r\n");
  uploadClient.print("Content-Length: " + String(totalLength) + "\r\n");
  uploadClient.print("Connection: close\r\n");
  uploadClient.print("\r\n");

  // Body: text field + file header
  uploadClient.print(headerPart);

  // Body: binary JPEG data (stream dalam chunk untuk menghindari timeout)
  const size_t CHUNK_SIZE = 1024;
  size_t remaining = fb->len;
  uint8_t* bufPtr = fb->buf;

  while (remaining > 0) {
    size_t toSend = (remaining > CHUNK_SIZE) ? CHUNK_SIZE : remaining;
    uploadClient.write(bufPtr, toSend);
    bufPtr += toSend;
    remaining -= toSend;
  }

  // Body: closing boundary
  uploadClient.print(closingPart);

  // ---------- Baca response ----------
  // Tunggu response max 10 detik
  unsigned long timeout = millis() + 10000;
  while (uploadClient.available() == 0) {
    if (millis() > timeout) {
      Serial.println("[UPLOAD] Response timeout!");
      uploadClient.stop();
      esp_camera_fb_return(fb);
      return;
    }
    delay(10);
  }

  // Parse HTTP status code dari response line
  int httpCode = 0;
  if (uploadClient.available()) {
    String statusLine = uploadClient.readStringUntil('\n');
    // Format: "HTTP/1.1 200 OK"
    int spaceIdx = statusLine.indexOf(' ');
    if (spaceIdx > 0) {
      httpCode = statusLine.substring(spaceIdx + 1, spaceIdx + 4).toInt();
    }
  }

  // Drain remaining response
  while (uploadClient.available()) {
    uploadClient.read();
  }

  uploadClient.stop();

  // Return frame buffer — WAJIB
  esp_camera_fb_return(fb);

  Serial.printf("[UPLOAD] Upload result: %d\n", httpCode);
}

// ============================================================
//  5. mqttCallback()
// ============================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  Serial.printf("[MQTT] Message on topic: %s (%u bytes)\n", topic, length);

  if (strcmp(topic, MQTT_TOPIC_TRIGGER) != 0) {
    Serial.println("[MQTT] Ignored — topic mismatch");
    return;
  }

  // Parse JSON — ArduinoJson v7 (tanpa parameter ukuran)
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, payload, length);

  if (error) {
    Serial.printf("[MQTT] JSON parse error: %s\n", error.c_str());
    return;
  }

  const char* token = doc["session_token"];
  if (token == nullptr || strlen(token) == 0) {
    Serial.println("[MQTT] No session_token in payload");
    return;
  }

  // Copy token dan set flag (aman karena loop() baca di main thread)
  strncpy(pendingSessionToken, token, sizeof(pendingSessionToken) - 1);
  pendingSessionToken[sizeof(pendingSessionToken) - 1] = '\0';
  captureRequested = true;

  Serial.printf("[MQTT] Capture requested, token: %s\n", pendingSessionToken);
}

// ============================================================
//  6. setup()
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println("==============================");
  Serial.println("  SmartLab ESP32-CAM Firmware");
  Serial.println("==============================");

  // GPIO0 HIGH untuk operasi normal
  pinMode(0, OUTPUT);
  digitalWrite(0, HIGH);

  // Flash LED pin sebagai output (mati default)
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);

  // 1. Koneksi WiFi
  connectWiFi();

  // 2. Inisialisasi kamera
  initCamera();

  // 3. Setup MQTT
  mqttClient.setBufferSize(1024);  // WAJIB sebelum connect
  mqttClient.setServer(MQTT_BROKER_IP, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);

  // 4. Koneksi MQTT
  connectMQTT();

  Serial.println("[SETUP] Ready. Waiting for MQTT trigger...");
}

// ============================================================
//  7. loop()
// ============================================================
void loop() {
  // Reconnect WiFi jika terputus
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[LOOP] WiFi disconnected. Reconnecting...");
    connectWiFi();
  }

  // Reconnect MQTT jika terputus
  if (!mqttClient.connected()) {
    Serial.println("[LOOP] MQTT disconnected. Reconnecting...");
    connectMQTT();
  }

  // Process MQTT messages
  mqttClient.loop();

  // Handle capture request dari callback
  if (captureRequested && pendingSessionToken[0] != '\0') {
    captureRequested = false;
    captureAndUpload(pendingSessionToken);
    pendingSessionToken[0] = '\0';
  }

  delay(10);  // Yield ke RTOS task lain
}
