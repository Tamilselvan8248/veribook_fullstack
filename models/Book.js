const mongoose = require('mongoose');

const BookSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please add a book title'],
      trim: true,
    },
    author: {
      type: String,
      required: [true, 'Please add the author'],
      trim: true,
    },
    publisher: {
      type: String,
      trim: true,
    },
    edition: {
      type: String,
      default: 'First Edition',
    },
    description: {
      type: String,
      trim: true,
    },
    isbn: {
      type: String,
      required: [true, 'Please add the ISBN barcode number'],
      trim: true,
    },
    coverImage: {
      type: String,
      required: [true, 'Please add the cover image'],
    },
    category: {
      type: String,
      required: [true, 'Please select a category'],
      trim: true,
      index: true,
    },
    genre: {
      type: String,
      required: [true, 'Please provide a genre'],
      trim: true,
      index: true,
    },
    keywords: {
      type: String,
      trim: true,
    },
    price: {
      type: Number,
      required: [true, 'Please specify the price in credits'],
      min: [0, 'Price cannot be negative'],
    },
    condition: {
      type: String,
      enum: ['Mint', 'Good', 'Damaged'],
      required: [true, 'AI Condition classification is required'],
    },
    confidenceScore: {
      type: Number,
      required: [true, 'AI confidence score is required'],
      min: 0,
      max: 100,
    },
    aiReport: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      required: [true, 'Please upload at least one image showing the book condition'],
      validate: [v => Array.isArray(v) && v.length > 0, 'Please upload at least one image'],
    },
    seller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    currentOwner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'HELD_IN_ESCROW', 'SOLD', 'RESOLD'],
      default: 'AVAILABLE',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for search performance
BookSchema.index({ title: 'text', author: 'text', isbn: 'text' });

module.exports = mongoose.model('Book', BookSchema);
