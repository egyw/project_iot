/* ──────────────────────────────────────────────────────────
 *  Photo Routes — /api/photo (ESP32-CAM endpoints)
 * ────────────────────────────────────────────────────────── */

const fs = require('node:fs');
const path = require('node:path');
const { Router } = require('express');
const { uploadPhoto } = require('../middleware/upload');

const router = Router();

const uploadsDir = process.env.UPLOADS_DIR || './uploads';

/* ════════════════════════════════════════════════════════════
 *  POST /api/photo/upload — device-authenticated photo upload
 *  No JWT — uses X-Device-Secret header instead
 * ════════════════════════════════════════════════════════════ */
function verifyDeviceSecret(req, res, next) {
  const secret = req.headers['x-device-secret'];
  if (!secret || secret !== process.env.CAM_DEVICE_SECRET) {
    return res.status(403).json({ error: 'Unauthorized device' });
  }
  next();
}

router.post(
  '/upload',
  verifyDeviceSecret,
  uploadPhoto,
  (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    res.json({
      success: true,
      token: req.headers['x-session-token'],
    });
  },
);

/* ════════════════════════════════════════════════════════════
 *  DELETE /api/photo/temp/:token — clean up temp photo
 *  No JWT — called from ESP32 on cancel
 * ════════════════════════════════════════════════════════════ */
router.delete('/temp/:token', (req, res) => {
  const { token } = req.params;
  const filePath = path.join(uploadsDir, 'temp', `${token}.jpg`);

  // Best-effort delete; always return success
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    // Silently ignore — file may already be gone
  }

  res.json({ success: true });
});

module.exports = router;
