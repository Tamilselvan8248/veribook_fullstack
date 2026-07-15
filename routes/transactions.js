const express = require('express');
const Transaction = require('../models/Transaction');
const Book = require('../models/Book');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/auth');
const { transactionLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// @desc    Initiate purchase (Move funds to escrow)
// @route   POST /api/transactions/buy
// @access  Private
router.post('/buy', protect, transactionLimiter, async (req, res) => {
  try {
    const { bookId } = req.body;

    const book = await Book.findById(bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    if (book.status !== 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Book is not available for purchase' });
    }

    if (book.seller.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot purchase your own book' });
    }

    const buyer = await User.findById(req.user._id);
    if (buyer.walletBalance < book.price) {
      return res.status(400).json({ success: false, message: 'Insufficient wallet balance' });
    }

    // Process escrow hold
    buyer.walletBalance -= book.price;
    buyer.pendingEscrow += book.price;
    await buyer.save();

    book.status = 'HELD_IN_ESCROW';
    await book.save();

    // Create Transaction
    const transaction = await Transaction.create({
      buyer: buyer._id,
      seller: book.seller,
      book: book._id,
      price: book.price,
      status: 'HELD_IN_ESCROW',
    });

    // Create Notifications
    await Notification.create({
      user: book.seller,
      type: 'SOLD',
      title: 'Book Ordered!',
      message: `Your book "${book.title}" has been ordered. Funds are held in escrow. Please arrange a handover.`,
      relatedLink: `/chat.html?recipient=${buyer._id}`,
    });

    await Notification.create({
      user: buyer._id,
      type: 'PURCHASED',
      title: 'Order Placed!',
      message: `You ordered "${book.title}". ${book.price} credits are held in escrow. Contact the seller to meet.`,
      relatedLink: `/chat.html?recipient=${book.seller}`,
    });

    res.status(201).json({ success: true, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Seller signals book is ready for physical handover
// @route   POST /api/transactions/:id/handover
// @access  Private
router.post('/:id/handover', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('book buyer');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    transaction.status = 'READY_FOR_HANDOVER';
    await transaction.save();

    // Notify Buyer
    await Notification.create({
      user: transaction.buyer._id,
      type: 'ESCROW_START',
      title: 'Ready for Handover',
      message: `The seller is ready to hand over "${transaction.book.title}". Please meet and confirm delivery.`,
      relatedLink: `/wallet.html`,
    });

    res.json({ success: true, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Confirm delivery (Buyer/Seller release escrow)
// @route   POST /api/transactions/:id/confirm
// @access  Private
router.post('/:id/confirm', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('book buyer seller');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const userId = req.user._id.toString();
    const isBuyer = transaction.buyer._id.toString() === userId;
    const isSeller = transaction.seller._id.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    // Prevent double-spend / double-confirm on finalized transactions
    if (transaction.status === 'COMPLETED' || transaction.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Transaction is already finalized' });
    }

    // Also prevent a user from confirming twice and accidentally triggering logic 
    if (isBuyer && transaction.buyerConfirmed) {
      return res.status(400).json({ success: false, message: 'You have already confirmed this transaction' });
    }
    if (isSeller && transaction.sellerConfirmed) {
      return res.status(400).json({ success: false, message: 'You have already confirmed this transaction' });
    }

    if (isBuyer) {
      transaction.buyerConfirmed = true;
    }
    if (isSeller) {
      transaction.sellerConfirmed = true;
    }

    // Save initial update
    if (transaction.status === 'HELD_IN_ESCROW' || transaction.status === 'READY_FOR_HANDOVER') {
      transaction.status = 'DELIVERED';
    }
    await transaction.save();

    // Check if both confirmed
    if (transaction.buyerConfirmed && transaction.sellerConfirmed) {
      const seller = await User.findById(transaction.seller._id);
      const buyer = await User.findById(transaction.buyer._id);
      const book = await Book.findById(transaction.book._id);

      // Release Escrow
      buyer.pendingEscrow -= transaction.price;
      await buyer.save();

      seller.walletBalance += transaction.price;
      await seller.save();

      book.status = 'SOLD';
      book.currentOwner = buyer._id;
      await book.save();

      transaction.status = 'COMPLETED';
      await transaction.save();

      // Create Success Notifications
      await Notification.create({
        user: seller._id,
        type: 'ESCROW_COMPLETE',
        title: 'Payment Received!',
        message: `Escrow complete! ${transaction.price} credits released to your wallet for "${book.title}".`,
        relatedLink: `/wallet.html`,
      });

      await Notification.create({
        user: buyer._id,
        type: 'ESCROW_COMPLETE',
        title: 'Transaction Finalized!',
        message: `You successfully received "${book.title}". Thank you for trading on VeriBook!`,
        relatedLink: `/wallet.html`,
      });
    } else {
      // If only one side confirmed, notify the other side
      const targetUser = isBuyer ? transaction.seller._id : transaction.buyer._id;
      const targetRole = isBuyer ? 'Buyer' : 'Seller';
      await Notification.create({
        user: targetUser,
        type: 'SYSTEM',
        title: 'Delivery Confirmation Pending',
        message: `The ${targetRole} has confirmed delivery of "${transaction.book.title}". Please confirm on your end.`,
        relatedLink: `/wallet.html`,
      });
    }

    res.json({ success: true, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Cancel a transaction (Buyer/Seller)
// @route   POST /api/transactions/:id/cancel
// @access  Private
router.post('/:id/cancel', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id).populate('book buyer seller');
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const userId = req.user._id.toString();
    const isBuyer = transaction.buyer._id.toString() === userId;
    const isSeller = transaction.seller._id.toString() === userId;

    if (!isBuyer && !isSeller) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (transaction.status === 'COMPLETED' || transaction.status === 'CANCELLED') {
      return res.status(400).json({ success: false, message: 'Transaction is already finalized' });
    }

    const buyer = await User.findById(transaction.buyer._id);
    const book = await Book.findById(transaction.book._id);

    // Refund buyer
    buyer.pendingEscrow -= transaction.price;
    buyer.walletBalance += transaction.price;
    await buyer.save();

    // Reset book status
    book.status = 'AVAILABLE';
    await book.save();

    // Update transaction status
    transaction.status = 'CANCELLED';
    await transaction.save();

    // Notify other party
    const targetUser = isBuyer ? transaction.seller._id : transaction.buyer._id;
    const cancelledBy = isBuyer ? 'Buyer' : 'Seller';
    await Notification.create({
      user: targetUser,
      type: 'SYSTEM',
      title: 'Transaction Cancelled',
      message: `The ${cancelledBy.toLowerCase()} cancelled the transaction for "${book.title}". Your book is back on the marketplace.`,
      relatedLink: `/wallet.html`,
    });

    res.json({ success: true, transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get current user wallet status & transactions list
// @route   GET /api/transactions/wallet
// @access  Private
router.get('/wallet', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    // Get all user escrow transactions
    const transactions = await Transaction.find({
      $or: [{ buyer: req.user._id }, { seller: req.user._id }],
    })
      .populate('book buyer seller')
      .sort('-updatedAt');

    res.json({
      success: true,
      walletBalance: user.walletBalance,
      pendingEscrow: user.pendingEscrow,
      transactions,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Deposit simulated credits (Top-up)
// @route   POST /api/transactions/wallet/deposit
// @access  Private
router.post('/wallet/deposit', protect, async (req, res) => {
  try {
    const { amount } = req.body;
    const depositAmt = Number(amount);

    if (!depositAmt || depositAmt <= 0) {
      return res.status(400).json({ success: false, message: 'Please specify a valid positive amount' });
    }

    const user = await User.findById(req.user._id);
    user.walletBalance += depositAmt;
    await user.save();

    await Notification.create({
      user: user._id,
      type: 'SYSTEM',
      title: 'Credits Deposited',
      message: `You successfully topped up ${depositAmt} credits. New balance: ${user.walletBalance}.`,
      relatedLink: `/wallet.html`,
    });

    res.json({ success: true, walletBalance: user.walletBalance });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
