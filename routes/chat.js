const express = require('express');
const Message = require('../models/Message');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Helper to generate standard sorted room ID
const getRoomId = (uid1, uid2) => {
  return [uid1.toString(), uid2.toString()].sort().join('_');
};

// @desc    Get message history between current user and recipient
// @route   GET /api/chat/messages/:recipientId
// @access  Private
router.get('/messages/:recipientId', protect, async (req, res) => {
  try {
    const room = getRoomId(req.user._id, req.params.recipientId);
    
    // Fetch all messages in the room
    const messages = await Message.find({ room })
      .populate('sender', 'name avatar')
      .populate('receiver', 'name avatar')
      .sort('createdAt');

    // Mark these messages as read if the recipient is the current user
    await Message.updateMany(
      { room, receiver: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );

    res.json({ success: true, messages });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get all chat rooms/conversations for current user
// @route   GET /api/chat/rooms
// @access  Private
router.get('/rooms', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Retrieve unique room configurations from messages where the user was sender or receiver
    const roomsData = await Message.aggregate([
      {
        $match: {
          $or: [{ sender: userId }, { receiver: userId }],
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: '$room',
          lastMessage: { $first: '$$ROOT' },
        },
      },
    ]);

    const activeRooms = [];

    for (const data of roomsData) {
      const lastMsg = data.lastMessage;
      
      // Determine recipient user ID
      const recipientId = lastMsg.sender.toString() === userId.toString() 
        ? lastMsg.receiver 
        : lastMsg.sender;

      const recipient = await User.findById(recipientId).select('name avatar rating reviewsCount isVerified');
      
      if (recipient) {
        // Count unread messages in this room
        const unreadCount = await Message.countDocuments({
          room: data._id,
          receiver: userId,
          isRead: false,
        });

        activeRooms.push({
          roomId: data._id,
          recipient,
          lastMessageText: lastMsg.text || 'Sent an image',
          lastMessageTime: lastMsg.createdAt,
          unreadCount,
        });
      }
    }

    // Sort conversations by latest message timestamp
    activeRooms.sort((a, b) => new Date(b.lastMessageTime) - new Date(a.lastMessageTime));

    res.json({ success: true, rooms: activeRooms });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get total unread messages count
// @route   GET /api/chat/unread-count
// @access  Private
router.get('/unread-count', protect, async (req, res) => {
  try {
    const count = await Message.countDocuments({
      receiver: req.user._id,
      isRead: false,
    });
    res.json({ success: true, count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
