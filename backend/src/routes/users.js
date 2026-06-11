/* ──────────────────────────────────────────────────────────
 *  Users Routes — /api/users
 * ────────────────────────────────────────────────────────── */

const { Router } = require('express');
const { body, param, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const usersController = require('../controllers/usersController');

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

// ── GET /api/users ─────────────────────────────────────────
router.get('/', usersController.listUsers);

// ── POST /api/users ────────────────────────────────────────
router.post(
  '/',
  [
    body('nrp').notEmpty().withMessage('nrp is required').isLength({ max: 20 }),
    body('name').notEmpty().withMessage('name is required').isLength({ max: 100 }),
    body('rfid_uid').notEmpty().withMessage('rfid_uid is required').isLength({ max: 50 }),
  ],
  validate,
  usersController.createUser,
);

// ── GET /api/users/:id ─────────────────────────────────────
router.get(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  usersController.getUser,
);

// ── PUT /api/users/:id ─────────────────────────────────────
router.put(
  '/:id',
  [
    param('id').isInt().withMessage('id must be an integer'),
    body('name').optional().isLength({ max: 100 }),
    body('rfid_uid').optional().isLength({ max: 50 }),
  ],
  validate,
  usersController.updateUser,
);

// ── DELETE /api/users/:id ──────────────────────────────────
router.delete(
  '/:id',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  usersController.deleteUser,
);

// ── GET /api/users/:id/sessions ────────────────────────────
router.get(
  '/:id/sessions',
  [param('id').isInt().withMessage('id must be an integer')],
  validate,
  usersController.getUserSessions,
);

module.exports = router;
