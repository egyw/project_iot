const fs = require('node:fs');
const path = require('node:path');
const multer = require('multer');

// Resolve upload temp directory and ensure it exists
const tempDir = path.join(process.env.UPLOADS_DIR || './uploads', 'temp');
fs.mkdirSync(tempDir, { recursive: true });

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, tempDir);
  },

  filename(req, _file, cb) {
    // IMPORTANT: req.body is NOT populated yet when multer calls filename()
    // because multipart parsing is still in progress. Read from headers instead.
    const name = req.headers['x-session-token'] || Date.now().toString();
    cb(null, `${name}.jpg`);
  },
});

function fileFilter(_req, file, cb) {
  const allowed = ['image/jpeg', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG images are allowed'), false);
  }
}

const uploadPhoto = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
}).single('photo');

module.exports = { uploadPhoto };
