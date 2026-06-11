/* ──────────────────────────────────────────────────────────
 *  SmartLab MQTT Client — Connection & Message Dispatcher
 * ────────────────────────────────────────────────────────── */

const mqtt = require('mqtt');
const handlers = require('./handlers');

// ── Broker URL ─────────────────────────────────────────────
const brokerUrl = `mqtt://${process.env.MQTT_BROKER_IP || 'localhost'}:1883`;

// ── Topics to subscribe ────────────────────────────────────
const TOPICS = [
  'smartlab/ktm/scan',
  'smartlab/asset/scan',
  'smartlab/session/create',
  'smartlab/session/cancel',
  'smartlab/return/confirm',
  'smartlab/heartbeat',
];

// ── Connect ────────────────────────────────────────────────
const client = mqtt.connect(brokerUrl, {
  clientId: `smartlab-backend-${Date.now()}`,
  keepalive: 30,
  reconnectPeriod: 5000,
  clean: true,
});

// ── On connect: subscribe to all topics ────────────────────
client.on('connect', () => {
  console.log('[MQTT] Connected to broker:', brokerUrl);

  client.subscribe(TOPICS, { qos: 1 }, (err, granted) => {
    if (err) {
      console.error('[MQTT] Subscribe error:', err.message);
      return;
    }
    console.log(
      '[MQTT] Subscribed to:',
      granted.map((g) => g.topic).join(', '),
    );
  });
});

// ── On message: parse & dispatch ───────────────────────────
client.on('message', (topic, message) => {
  let payload;
  try {
    payload = JSON.parse(message.toString());
  } catch (parseErr) {
    console.error('[MQTT] Invalid JSON on', topic, ':', parseErr.message);
    return;
  }

  try {
    switch (topic) {
      case 'smartlab/ktm/scan':
        handlers.handleKTMScan(client, payload);
        break;
      case 'smartlab/asset/scan':
        handlers.handleAssetScan(client, payload);
        break;
      case 'smartlab/session/create':
        handlers.handleSessionCreate(client, payload);
        break;
      case 'smartlab/session/cancel':
        handlers.handleSessionCancel(client, payload);
        break;
      case 'smartlab/return/confirm':
        handlers.handleReturnConfirm(client, payload);
        break;
      case 'smartlab/heartbeat':
        handlers.handleHeartbeat(payload);
        break;
      default:
        console.warn('[MQTT] Unhandled topic:', topic);
    }
  } catch (handlerErr) {
    console.error(`[MQTT] Handler error on ${topic}:`, handlerErr.message);
  }
});

// ── Connection lifecycle events ────────────────────────────
client.on('error', (err) => {
  console.error('[MQTT] Connection error:', err.message);
});

client.on('reconnect', () => {
  console.log('[MQTT] Reconnecting to broker…');
});

client.on('close', () => {
  console.log('[MQTT] Connection closed');
});

module.exports = client;
