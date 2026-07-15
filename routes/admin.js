const express = require('express');
const User = require('../models/User');
const Book = require('../models/Book');
const Transaction = require('../models/Transaction');
const { protect, admin } = require('../middleware/auth');

const router = express.Router();

// @desc    Get Admin Dashboard Stats & Metrics
// @route   GET /api/admin/dashboard
// @access  Private/Admin
router.get('/dashboard', protect, admin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalBooks = await Book.countDocuments();
    const activeEscrows = await Transaction.countDocuments({ status: { $ne: 'COMPLETED' } });
    const completedTransactions = await Transaction.find({ status: 'COMPLETED' });
    
    // Calculate total escrow financial volume
    const escrowVolume = completedTransactions.reduce((acc, curr) => acc + curr.price, 0);

    const users = await User.find().sort('-createdAt');
    const books = await Book.find().populate('seller', 'name email').populate('currentOwner', 'name email').sort('-createdAt');
    const transactions = await Transaction.find()
      .populate('buyer', 'name')
      .populate('seller', 'name')
      .populate('book', 'title')
      .sort('-createdAt');

    res.json({
      success: true,
      metrics: {
        totalUsers,
        totalBooks,
        activeEscrows,
        escrowVolume,
      },
      users,
      books,
      transactions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error retrieving dashboard metrics' });
  }
});

// @desc    Verify/unverify user
// @route   POST /api/admin/users/:id/verify
// @access  Private/Admin
router.post('/users/:id/verify', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    user.isVerified = !user.isVerified;
    await user.save();

    res.json({ success: true, isVerified: user.isVerified, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during user verification status change' });
  }
});

// @desc    Moderate book listing (Delete/Reject)
// @route   DELETE /api/admin/books/:id
// @access  Private/Admin
router.delete('/books/:id', protect, admin, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Book listing removed from marketplace' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during book moderation' });
  }
});

// @desc    Block/unblock user
// @route   POST /api/admin/users/:id/block
// @access  Private/Admin
router.post('/users/:id/block', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isAdmin) {
      return res.status(400).json({ success: false, message: 'Cannot block an admin user' });
    }

    user.isBlocked = !user.isBlocked;
    await user.save();

    res.json({ success: true, isBlocked: user.isBlocked, user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during user block status change' });
  }
});

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
router.delete('/users/:id', protect, admin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (user.isAdmin) {
      return res.status(400).json({ success: false, message: 'Cannot delete an admin user' });
    }

    // Optionally delete user's books/transactions here
    await Book.deleteMany({ seller: user._id });

    await User.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during user deletion' });
  }
});

module.exports = router;
