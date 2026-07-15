const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { cloudinary, isCloudinaryConfigured } = require('../config/cloudinary');
const { protect } = require('../middleware/auth');
const { uploadLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Define local upload directory
const LOCAL_UPLOAD_DIR = path.join(__dirname, '../public/uploads');

// Ensure local directory exists
if (!fs.existsSync(LOCAL_UPLOAD_DIR)) {
  fs.mkdirSync(LOCAL_UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
// Memory storage is used for Cloudinary stream uploading; disk storage is used for local fallback.
const getMulterConfig = () => {
  if (isCloudinaryConfigured) {
    return multer.memoryStorage();
  } else {
    return multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, LOCAL_UPLOAD_DIR);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
      },
    });
  }
};

const storage = getMulterConfig();

const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images only (jpeg, jpg, png, webp)!'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter,
});

// Helper to stream upload memory buffer to Cloudinary
const uploadToCloudinary = (fileBuffer) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'veribook' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );
    uploadStream.end(fileBuffer);
  });
};

// @desc    Upload a single image (e.g. for avatar)
// @route   POST /api/upload/single
// @access  Private
router.post('/single', protect, uploadLimiter, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Please upload a file' });
    }

    if (isCloudinaryConfigured) {
      const url = await uploadToCloudinary(req.file.buffer);
      res.json({ success: true, url });
    } else {
      // Local fallback url
      const relativePath = `/uploads/${req.file.filename}`;
      res.json({ success: true, url: relativePath });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload' });
  }
});

// @desc    Upload multiple images (e.g. for book listing)
// @route   POST /api/upload/multiple
// @access  Private
router.post('/multiple', protect, uploadLimiter, upload.array('images', 5), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'Please upload files' });
    }

    const urls = [];

    if (isCloudinaryConfigured) {
      for (const file of req.files) {
        const url = await uploadToCloudinary(file.buffer);
        urls.push(url);
      }
    } else {
      // Local fallback urls
      for (const file of req.files) {
        urls.push(`/uploads/${file.filename}`);
      }
    }

    res.json({ success: true, urls });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: error.message || 'Server error during upload' });
  }
});

module.exports = router;
