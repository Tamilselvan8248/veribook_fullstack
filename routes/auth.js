const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Book = require('../models/Book');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'veribook_super_secure_jwt_secret_key_change_me', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide name, email, and password' });
    }

    const userExists = await User.findOne({ email });

    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Assign default avatar
    const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    const user = await User.create({
      name,
      email,
      password,
      avatar,
      walletBalance: 1000, // Preload with 1000 credits
    });

    if (user) {
      res.status(201).json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          walletBalance: user.walletBalance,
          pendingEscrow: user.pendingEscrow,
          rating: user.rating,
          reviewsCount: user.reviewsCount,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } else {
      res.status(400).json({ success: false, message: 'Invalid user data' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please enter email and password' });
    }

    // Get user and select password
    const user = await User.findOne({ email }).select('+password');

    if (user && user.isBlocked) {
      return res.status(403).json({ success: false, message: 'Your account has been blocked by an admin.' });
    }

    if (user && (await user.matchPassword(password))) {
      res.json({
        success: true,
        token: generateToken(user._id),
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          walletBalance: user.walletBalance,
          pendingEscrow: user.pendingEscrow,
          rating: user.rating,
          reviewsCount: user.reviewsCount,
          isVerified: user.isVerified,
          isAdmin: user.isAdmin,
        },
      });
    } else {
      res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get user profile (current)
// @route   GET /api/auth/profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(404).json({ success: false, message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get public profile of another user/seller
// @route   GET /api/auth/profile/:id
// @access  Public
router.get('/profile/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Find books listed by this seller
    const books = await Book.find({ seller: req.params.id }).sort('-createdAt');

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        rating: user.rating,
        reviewsCount: user.reviewsCount,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
      },
      books,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Leave rating / review for a user/seller
// @route   POST /api/auth/profile/:id/review
// @access  Private
router.post('/profile/:id/review', protect, async (req, res) => {
  try {
    const { rating, reviewText } = req.body;
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const seller = await User.findById(req.params.id);
    if (!seller) {
      return res.status(404).json({ success: false, message: 'Seller not found' });
    }

    if (seller._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot review yourself' });
    }

    const review = {
      reviewer: req.user._id,
      reviewerName: req.user.name,
      reviewerAvatar: req.user.avatar,
      rating: Number(rating),
      comment: reviewText,
    };

    if (!seller.reviews) {
        seller.reviews = [];
    }
    seller.reviews.push(review);

    // Recalculate average rating
    const currentTotalRating = seller.rating * seller.reviewsCount;
    const newReviewsCount = seller.reviewsCount + 1;
    const newRating = (currentTotalRating + Number(rating)) / newReviewsCount;

    seller.reviewsCount = newReviewsCount;
    seller.rating = Math.round(newRating * 10) / 10; // Round to 1 decimal place

    await seller.save();

    res.json({
      success: true,
      message: 'Review submitted successfully',
      rating: seller.rating,
      reviewsCount: seller.reviewsCount,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Change user password
// @route   PUT /api/auth/password
// @access  Private
router.put('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!(await user.matchPassword(currentPassword))) {
      return res.status(401).json({ success: false, message: 'Incorrect current password' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
