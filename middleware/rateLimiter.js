const rateLimit = require('express-rate-limit');

// Skip all rate limiting in development or for localhost requests.
// This prevents false-positive 429s during local development while
// keeping production fully protected.
const skipInDev = (req) => {
  if (process.env.NODE_ENV !== 'production') return true;
  const ip = req.ip || req.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip.startsWith('::ffff:127.');
};

// Helper to build a standard rate limit response
const makeHandler = (windowMin, max, message) => {
  // Completely bypass rate limiting in local dev to prevent false positives
  if (process.env.NODE_ENV !== 'production') {
    return (req, res, next) => next();
  }

  return rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,  // Return rate limit info in RateLimit-* headers
    legacyHeaders: false,
    message: { success: false, message },
    skipSuccessfulRequests: false,
  });
};

// ─── Auth routes: login + register ───────────────────────────────────────────
// Tight limit to prevent brute-force attacks
const authLimiter = makeHandler(
  15,   // 15-minute window
  10,   // max 10 attempts per IP
  'Too many authentication attempts. Please try again in 15 minutes.'
);

// ─── ISBN Lookup ──────────────────────────────────────────────────────────────
// Google Books + Open Library both have rate limits; protect against hammering
const isbnLimiter = makeHandler(
  1,    // 1-minute window
  20,   // max 20 lookups per IP per minute
  'Too many ISBN lookups. Please slow down and try again shortly.'
);

// ─── Book listing creation ────────────────────────────────────────────────────
// Prevent spam listings; a real user won't post more than 5 books in 10 min
const listingLimiter = makeHandler(
  10,   // 10-minute window
  5,    // max 5 listings per IP per 10 min
  'Too many listing submissions. Please wait before posting another book.'
);

// ─── Transactions: buy ────────────────────────────────────────────────────────
// Prevent purchase flooding / race-condition exploitation
const transactionLimiter = makeHandler(
  5,    // 5-minute window
  10,   // max 10 purchases per IP per 5 min
  'Too many transaction requests. Please wait before making another purchase.'
);

// ─── File uploads ─────────────────────────────────────────────────────────────
// Prevent Cloudinary / disk storage abuse
const uploadLimiter = makeHandler(
  10,   // 10-minute window
  15,   // max 15 uploads per IP per 10 min
  'Too many upload requests. Please wait before uploading more files.'
);

// ─── Global API fallback ──────────────────────────────────────────────────────
// Applied to all /api/* as a last-resort safeguard
const generalLimiter = makeHandler(
  15,   // 15-minute window
  200,  // max 200 requests per IP per 15 min
  'Too many requests from this IP. Please try again later.'
);

// Keep apiLimiter as an alias for backward compatibility
const apiLimiter = generalLimiter;

module.exports = {
  authLimiter,
  isbnLimiter,
  listingLimiter,
  transactionLimiter,
  uploadLimiter,
  generalLimiter,
  apiLimiter,
};
