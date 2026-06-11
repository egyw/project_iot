/* ──────────────────────────────────────────────────────────
 *  Assets Routes — /api/assets (includes /api/assets/types)
 * ────────────────────────────────────────────────────────── */

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const assetsController = require('../controllers/assetsController');

const router = Router();

// ── All routes require authentication ──────────────────────
router.use(authenticateToken);

// ── Shared validation runner ───────────────────────────────
function validate(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
}

/* ════════════════════════════════════════════════════════════
 *  Asset Types — /api/assets/types
 * ════════════════════════════════════════════════════════════ */

// ── GET /api/assets/types ──────────────────────────────────
router.get('/types', assetsController.listTypes);

// ── POST /api/assets/types ─────────────────────────────────
router.post(
  '/types',
  [
    body('name').notEmpty().withMessage('name is required').isLength({ max: 100 }),
    body('description').optional(),
  ],
  validate,
  assetsController.createType,
);

// ── PUT /api/assets/types/:id ──────────────────────────────
router.put(
  '/types/:id',
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('name').optional().isLength({ max: 100 }),
    body('description').optional(),
  ],
  validate,
  assetsController.updateType,
);

// ── DELETE /api/assets/types/:id ───────────────────────────
router.delete(
  '/types/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  assetsController.deleteType,
);

/* ════════════════════════════════════════════════════════════
 *  Assets — /api/assets
 * ════════════════════════════════════════════════════════════ */

// ── GET /api/assets ────────────────────────────────────────
router.get('/', assetsController.listAssets);

// ── POST /api/assets ───────────────────────────────────────
router.post(
  '/',
  [
    body('asset_type_id').isInt().withMessage('asset_type_id must be an integer'),
    body('rfid_uid').notEmpty().withMessage('rfid_uid is required').isLength({ max: 50 }),
    body('label').notEmpty().withMessage('label is required').isLength({ max: 100 }),
  ],
  validate,
  assetsController.createAsset,
);

// ── GET /api/assets/:id ────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  assetsController.getAsset,
);

// ── PUT /api/assets/:id ────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('rfid_uid').optional().isLength({ max: 50 }),
    body('label').optional().isLength({ max: 100 }),
  ],
  validate,
  assetsController.updateAsset,
);

// ── DELETE /api/assets/:id ─────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  assetsController.deleteAsset,
);

module.exports = router;
