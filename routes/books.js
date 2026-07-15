const express = require('express');
const Book = require('../models/Book');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { isbnLimiter, listingLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Helper to lookup book info by ISBN (Google Books with Open Library Fallback)
const lookupISBN = async (isbn) => {
  const cleanIsbn = isbn.replace(/[- ]/g, '');
  
  // 1. Google Books API
  try {
    console.log(`Querying Google Books for ISBN: ${cleanIsbn}`);
    const googleRes = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleanIsbn}`
    );
    const googleData = await googleRes.json();

    if (googleData.items && googleData.items.length > 0) {
      const volumeInfo = googleData.items[0].volumeInfo;
      return {
        title: volumeInfo.title || '',
        author: volumeInfo.authors ? volumeInfo.authors.join(', ') : 'Unknown Author',
        publisher: volumeInfo.publisher || 'Unknown Publisher',
        edition: volumeInfo.contentVersion ? 'Standard Edition' : 'First Edition', // Fallback edition estimation
        description: volumeInfo.description || 'No description available.',
        categories: volumeInfo.categories || ['General'],
        coverImage: volumeInfo.imageLinks ? volumeInfo.imageLinks.thumbnail.replace('http:', 'https:') : '/uploads/default-book-cover.png',
        isbn: cleanIsbn,
        source: 'Google Books',
      };
    }
  } catch (error) {
    console.error('Google Books API Error: ', error.message);
  }

  // 2. Open Library API Fallback
  try {
    console.log(`Querying Open Library for ISBN: ${cleanIsbn}`);
    const olRes = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${cleanIsbn}&format=json&jscmd=data`
    );
    const olData = await olRes.json();
    const olKey = `ISBN:${cleanIsbn}`;

    if (olData[olKey]) {
      const bookInfo = olData[olKey];
      return {
        title: bookInfo.title || '',
        author: bookInfo.authors ? bookInfo.authors.map(a => a.name).join(', ') : 'Unknown Author',
        publisher: bookInfo.publishers ? bookInfo.publishers.map(p => p.name).join(', ') : 'Unknown Publisher',
        edition: bookInfo.excerpts ? 'Standard Edition' : 'First Edition',
        description: bookInfo.notes || (bookInfo.excerpts ? bookInfo.excerpts[0].text : 'No description available.'),
        categories: bookInfo.subjects ? bookInfo.subjects.map(s => s.name).slice(0, 3) : ['General'],
        coverImage: bookInfo.cover ? bookInfo.cover.large || bookInfo.cover.medium : '/uploads/default-book-cover.png',
        isbn: cleanIsbn,
        source: 'Open Library',
      };
    }
  } catch (error) {
    console.error('Open Library API Error: ', error.message);
  }

  return null;
};

// @desc    Lookup book details by ISBN
// @route   GET /api/books/lookup/:isbn
// @access  Private
router.get('/lookup/:isbn', protect, isbnLimiter, async (req, res) => {
  try {
    const bookData = await lookupISBN(req.params.isbn);
    if (bookData) {
      res.json({ success: true, data: bookData });
    } else {
      res.status(404).json({ success: false, message: 'Book metadata not found for this ISBN' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during ISBN lookup' });
  }
});

// @desc    Get all books in the marketplace (with filters, search & pagination)
// @route   GET /api/books
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { search, category, genre, keywords, condition, minPrice, maxPrice, sort, page, limit } = req.query;

    // Pagination
    const currentPage  = Math.max(1, parseInt(page)  || 1);
    const itemsPerPage = Math.min(50, Math.max(1, parseInt(limit) || 12));
    const skip         = (currentPage - 1) * itemsPerPage;

    let query = { status: 'AVAILABLE' };

    // Text search
    if (search) {
      query.$text = { $search: search };
    }

    // Filter by Category
    if (category && category !== 'All') {
      query.category = category;
    }

    // Filter by Genre
    if (genre && genre !== 'All Genres') {
      query.genre = { $regex: new RegExp(`^${genre}$`, 'i') };
    }

    // Filter by Keywords
    if (keywords) {
      query.keywords = { $regex: keywords, $options: 'i' };
    }

    // Filter by Condition
    if (condition && condition !== 'All') {
      query.condition = condition;
    }

    // Price Range Filter
    if (minPrice || maxPrice) {
      query.price = {};
      if (minPrice) query.price.$gte = Number(minPrice);
      if (maxPrice) query.price.$lte = Number(maxPrice);
    }

    // Get total count for pagination metadata (before skip/limit)
    const totalCount = await Book.countDocuments(query);
    const totalPages = Math.ceil(totalCount / itemsPerPage);

    let booksQuery = Book.find(query)
      .populate('seller', 'name rating reviewsCount isVerified avatar');

    // Sorting
    switch (sort) {
      case 'lowest':
        booksQuery = booksQuery.sort({ price: 1 });
        break;
      case 'highest':
        booksQuery = booksQuery.sort({ price: -1 });
        break;
      case 'condition':
        // Condition sort is done in JS after fetch (enum ordering not native to Mongo)
        booksQuery = booksQuery.sort({ createdAt: -1 });
        break;
      case 'newest':
      default:
        booksQuery = booksQuery.sort({ createdAt: -1 });
        break;
    }

    // Apply pagination
    booksQuery = booksQuery.skip(skip).limit(itemsPerPage);

    let books = await booksQuery;

    // Custom sorting for condition after pagination slice: Mint -> Good -> Damaged
    if (sort === 'condition') {
      const conditionOrder = { 'Mint': 3, 'Good': 2, 'Damaged': 1 };
      books = books.sort((a, b) => conditionOrder[b.condition] - conditionOrder[a.condition]);
    }

    res.json({
      success: true,
      count: books.length,
      totalCount,
      totalPages,
      currentPage,
      books,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get book details
// @route   GET /api/books/:id
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const book = await Book.findById(req.params.id).populate('seller', 'name email avatar rating reviewsCount isVerified reviews');
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    res.json({ success: true, book });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    List a verified book to marketplace
// @route   POST /api/books/list
// @access  Private
router.post('/list', protect, listingLimiter, async (req, res) => {
  try {
    const {
      title,
      author,
      publisher,
      edition,
      description,
      isbn,
      coverImage,
      category,
      genre,
      keywords,
      price,
      condition,
      confidenceScore,
      aiReport,
      images,
    } = req.body;

    // Validate read-only elements aren't spoofed by doing a backend re-validation if necessary,
    // but at minimum, check that all required fields are present.
    if (
      !title ||
      !author ||
      !isbn ||
      !coverImage ||
      !category ||
      !genre ||
      !price ||
      !condition ||
      !confidenceScore ||
      !images ||
      images.length === 0
    ) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    const book = await Book.create({
      title,
      author,
      publisher,
      edition,
      description,
      isbn,
      coverImage,
      category,
      genre: genre || 'General',
      keywords,
      price: Number(price),
      condition,
      confidenceScore: Number(confidenceScore),
      aiReport: aiReport || [],
      images,
      seller: req.user._id,
      currentOwner: req.user._id,
      status: 'AVAILABLE',
    });

    res.status(201).json({ success: true, data: book });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during listing creation' });
  }
});

// @desc    Delete a listing (Seller only)
// @route   DELETE /api/books/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
    if (!book) return res.status(404).json({ success: false, message: 'Book not found' });
    
    // Only the seller can delete their book
    if (book.seller.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this book' });
    }

    if (book.status !== 'AVAILABLE') {
      return res.status(400).json({ success: false, message: 'Cannot delete a book that is in escrow or sold' });
    }

    await book.deleteOne();
    res.json({ success: true, message: 'Book deleted' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Get user's purchased books (My Library)
// @route   GET /api/books/my-library
// @access  Private
router.get('/my-library/list', protect, async (req, res) => {
  try {
    const books = await Book.find({ currentOwner: req.user._id, status: 'SOLD' })
      .populate('seller', 'name avatar')
      .sort('-updatedAt');
    res.json({ success: true, books });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @desc    Resell a purchased book
// @route   POST /api/books/:id/resell
// @access  Private
router.post('/:id/resell', protect, async (req, res) => {
  try {
    const { newPrice } = req.body;
    if (!newPrice || Number(newPrice) <= 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid price' });
    }

    const oldBook = await Book.findById(req.params.id);
    if (!oldBook) return res.status(404).json({ success: false, message: 'Book not found' });
    
    if (oldBook.currentOwner?.toString() !== req.user._id.toString() || oldBook.status !== 'SOLD') {
      return res.status(403).json({ success: false, message: 'You can only resell books you currently own' });
    }

    const newBook = await Book.create({
      title: oldBook.title,
      author: oldBook.author,
      publisher: oldBook.publisher,
      edition: oldBook.edition,
      description: oldBook.description,
      isbn: oldBook.isbn,
      coverImage: oldBook.coverImage,
      category: oldBook.category,
      genre: oldBook.genre,
      keywords: oldBook.keywords,
      price: Number(newPrice),
      condition: oldBook.condition,
      confidenceScore: oldBook.confidenceScore,
      aiReport: oldBook.aiReport,
      images: oldBook.images,
      seller: req.user._id,
      currentOwner: req.user._id,
      status: 'AVAILABLE',
    });

    oldBook.status = 'RESOLD';
    await oldBook.save();

    res.status(201).json({ success: true, book: newBook });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error during resell' });
  }
});

module.exports = router;
