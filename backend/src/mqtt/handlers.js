/* ──────────────────────────────────────────────────────────
 *  SmartLab MQTT Handlers — Business Logic
 * ────────────────────────────────────────────────────────── */

const fs = require('node:fs');
const path = require('node:path');
const pool = require('../db/index.js');

// ── Upload paths (relative to project root from src/mqtt/) ─
const UPLOADS_TEMP = path.join(__dirname, '../../uploads/temp');
const UPLOADS_SESSIONS = path.join(__dirname, '../../uploads/sessions');

// ── In-memory tracking: session_token → Set<asset_id> ──────
const sessionAssetMap = new Map();

/* ────────────────────────────────────────────────────────────
 *  Helper: publish JSON to a topic
 * ──────────────────────────────────────────────────────────── */
function pub(client, topic, payload) {
  client.publish(topic, JSON.stringify(payload), { qos: 1 });
}

/* ════════════════════════════════════════════════════════════
 *  1. KTM SCAN
 * ════════════════════════════════════════════════════════════ */
async function handleKTMScan(client, payload) {
  const { uid, session_token } = payload;

  // 1. Look up user by RFID UID
  const userResult = await pool.query(
    'SELECT id, nrp, name FROM users WHERE rfid_uid = $1',
    [uid],
  );

  if (userResult.rows.length === 0) {
    pub(client, 'smartlab/ktm/response', {
      valid: false,
      session_token,
      reason: 'USER_NOT_FOUND',
    });
    return;
  }

  const user = userResult.rows[0];

  // 2. Check for active borrow session & fetch borrowed items
  const loanResult = await pool.query(
    `SELECT bs.id   AS session_id,
            bi.asset_id,
            at.name AS type_name,
            a.label
     FROM   borrow_sessions bs
     JOIN   borrow_items bi  ON bi.session_id = bs.id AND bi.returned_at IS NULL
     JOIN   assets a         ON a.id = bi.asset_id
     JOIN   asset_types at   ON at.id = a.asset_type_id
     WHERE  bs.user_id = $1 AND bs.status = 'active'`,
    [user.id],
  );

  const hasActiveLoan = loanResult.rows.length > 0;
  const activeSessionId = hasActiveLoan ? loanResult.rows[0].session_id : null;
  const borrowedItems = loanResult.rows.map((r) => ({
    asset_id: r.asset_id,
    type_name: r.type_name,
    label: r.label,
  }));

  // 3. Trigger ESP32-CAM to capture photo
  pub(client, 'smartlab/cam/trigger', { session_token });

  // 4. Respond — flat fields agar ESP32 bisa langsung baca
  pub(client, 'smartlab/ktm/response', {
    valid: true,
    session_token,
    user_id: user.id,
    user_name: user.name,
    user_nrp: user.nrp,
    has_active_loan: hasActiveLoan,
    active_session_id: activeSessionId,
    borrowed_items: borrowedItems,
  });

  console.log(`[MQTT] KTM scan OK — user ${user.nrp} (${user.name})`);
}

/* ════════════════════════════════════════════════════════════
 *  2. ASSET SCAN
 * ════════════════════════════════════════════════════════════ */
async function handleAssetScan(client, payload) {
  const { uid, session_token } = payload;

  // 1. Look up asset by RFID UID
  const assetResult = await pool.query(
    `SELECT a.id, a.is_available, at.name AS type_name, a.label
     FROM   assets a
     JOIN   asset_types at ON at.id = a.asset_type_id
     WHERE  a.rfid_uid = $1`,
    [uid],
  );

  if (assetResult.rows.length === 0) {
    pub(client, 'smartlab/asset/response', {
      valid: false,
      session_token,
      error: 'Aset tidak dikenal',
    });
    return;
  }

  const asset = assetResult.rows[0];

  // 2. Check availability
  if (!asset.is_available) {
    pub(client, 'smartlab/asset/response', {
      valid: false,
      session_token,
      error: 'Aset sedang dipinjam',
    });
    return;
  }

  // 3. Check duplicate within current session
  if (!sessionAssetMap.has(session_token)) {
    sessionAssetMap.set(session_token, new Set());
  }
  const sessionAssets = sessionAssetMap.get(session_token);

  if (sessionAssets.has(asset.id)) {
    pub(client, 'smartlab/asset/response', {
      valid: false,
      session_token,
      error: 'Item sudah discan',
    });
    return;
  }

  // 4. Track & respond
  sessionAssets.add(asset.id);

  pub(client, 'smartlab/asset/response', {
    valid: true,
    session_token,
    asset_id: asset.id,
    type_name: asset.type_name,
    label: asset.label,
  });

  console.log(`[MQTT] Asset scanned — ${asset.type_name} "${asset.label}"`);
}

/* ════════════════════════════════════════════════════════════
 *  3. SESSION CREATE (borrow)
 * ════════════════════════════════════════════════════════════ */
async function handleSessionCreate(client, payload) {
  const { session_token, user_id, asset_ids } = payload;
  const db = await pool.connect();

  try {
    await db.query('BEGIN');

    // 1. Create borrow session
    const sessionResult = await db.query(
      "INSERT INTO borrow_sessions (user_id, status) VALUES ($1, 'active') RETURNING id",
      [user_id],
    );
    const sessionId = sessionResult.rows[0].id;

    // 2. Insert items & mark assets unavailable
    for (const assetId of asset_ids) {
      await db.query(
        'INSERT INTO borrow_items (session_id, asset_id) VALUES ($1, $2)',
        [sessionId, assetId],
      );
      await db.query(
        'UPDATE assets SET is_available = false WHERE id = $1',
        [assetId],
      );
    }

    // 3. Move temp photo → sessions folder
    const tempPath = path.join(UPLOADS_TEMP, `${session_token}.jpg`);
    const finalPath = path.join(UPLOADS_SESSIONS, `${sessionId}.jpg`);

    if (fs.existsSync(tempPath)) {
      fs.renameSync(tempPath, finalPath);
      await db.query(
        'UPDATE borrow_sessions SET photo_path = $1, last_updated = NOW() WHERE id = $2',
        [`uploads/sessions/${sessionId}.jpg`, sessionId],
      );
    }

    await db.query('COMMIT');

    // 4. Cleanup in-memory tracking
    sessionAssetMap.delete(session_token);

    // 5. Broadcast event
    pub(client, 'smartlab/events', {
      event: 'BORROW_CREATED',
      timestamp: new Date().toISOString(),
      data: { session_id: sessionId, user_id, asset_count: asset_ids.length },
    });

    // 6. Respond to ESP32
    pub(client, 'smartlab/session/response', {
      success: true,
      session_id: sessionId,
    });

    console.log(`[MQTT] Session #${sessionId} created — ${asset_ids.length} asset(s)`);
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('[MQTT] handleSessionCreate error:', err.message);

    pub(client, 'smartlab/session/response', {
      success: false,
      reason: 'DB_ERROR',
    });
  } finally {
    db.release();
  }
}

/* ════════════════════════════════════════════════════════════
 *  4. SESSION CANCEL
 * ════════════════════════════════════════════════════════════ */
function handleSessionCancel(_client, payload) {
  const { session_token } = payload;

  // 1. Remove temp photo if it exists
  const tempPath = path.join(UPLOADS_TEMP, `${session_token}.jpg`);
  if (fs.existsSync(tempPath)) {
    fs.unlinkSync(tempPath);
    console.log(`[MQTT] Deleted temp photo for session ${session_token}`);
  }

  // 2. Cleanup in-memory tracking
  sessionAssetMap.delete(session_token);

  console.log(`[MQTT] Session ${session_token} cancelled`);
}

/* ════════════════════════════════════════════════════════════
 *  5. RETURN CONFIRM
 * ════════════════════════════════════════════════════════════ */
async function handleReturnConfirm(client, payload) {
  const { session_id, asset_ids } = payload;
  const db = await pool.connect();

  try {
    await db.query('BEGIN');

    // 1. Mark each item as returned & make asset available again
    for (const assetId of asset_ids) {
      await db.query(
        `UPDATE borrow_items
         SET    returned_at = NOW()
         WHERE  session_id = $1 AND asset_id = $2 AND returned_at IS NULL`,
        [session_id, assetId],
      );
      await db.query(
        'UPDATE assets SET is_available = true WHERE id = $1',
        [assetId],
      );
    }

    // 2. Count remaining unreturned items
    const remaining = await db.query(
      'SELECT COUNT(*) FROM borrow_items WHERE session_id = $1 AND returned_at IS NULL',
      [session_id],
    );
    const remainingCount = parseInt(remaining.rows[0].count, 10);
    const newStatus = remainingCount === 0 ? 'fully_returned' : 'partially_returned';

    // 3. Update session status
    await db.query(
      'UPDATE borrow_sessions SET status = $1, last_updated = NOW() WHERE id = $2',
      [newStatus, session_id],
    );

    await db.query('COMMIT');

    // 4. Broadcast event
    pub(client, 'smartlab/events', {
      event: 'RETURN_CONFIRMED',
      timestamp: new Date().toISOString(),
      data: {
        session_id,
        returned_count: asset_ids.length,
        new_status: newStatus,
      },
    });

    // 5. Respond to ESP32
    pub(client, 'smartlab/return/result', {
      success: true,
      status: newStatus,
    });

    console.log(
      `[MQTT] Return confirmed — session #${session_id}, ${asset_ids.length} item(s), status: ${newStatus}`,
    );
  } catch (err) {
    await db.query('ROLLBACK');
    console.error('[MQTT] handleReturnConfirm error:', err.message);

    pub(client, 'smartlab/return/result', {
      success: false,
      reason: 'DB_ERROR',
    });
  } finally {
    db.release();
  }
}

/* ════════════════════════════════════════════════════════════
 *  6. HEARTBEAT
 * ════════════════════════════════════════════════════════════ */
function handleHeartbeat(payload) {
  console.log(`[MQTT] Heartbeat: ${payload.state} at ${new Date().toISOString()}`);
}

/* ── Exports ────────────────────────────────────────────────── */
module.exports = {
  handleKTMScan,
  handleAssetScan,
  handleSessionCreate,
  handleSessionCancel,
  handleReturnConfirm,
  handleHeartbeat,
};
