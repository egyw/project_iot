/* ──────────────────────────────────────────────────────────
 *  Sessions Routes — /api/sessions
 * ────────────────────────────────────────────────────────── */

const { Router } = require('express');
const { param, body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const sessionsController = require('../controllers/sessionsController');

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

// ── GET /api/sessions ─────────────────────────────────────
router.get('/', sessionsController.listSessions);

// ── GET /api/sessions/:id ─────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  sessionsController.getSession,
);

// ── GET /api/sessions/:id/photo ───────────────────────────
router.get(
  '/:id/photo',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  sessionsController.getSessionPhoto,
);

// ── PUT /api/sessions/:id/return ──────────────────────────
router.put(
  '/:id/return',
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('force_all').optional().isBoolean().withMessage('force_all must be a boolean'),
    body('asset_ids').optional().isArray().withMessage('asset_ids must be an array'),
  ],
  validate,
  sessionsController.returnItems,
);

module.exports = router;
