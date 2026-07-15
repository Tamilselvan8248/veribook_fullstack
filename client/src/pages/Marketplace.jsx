import React, { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Search, Eye, ShoppingCart, Heart, CheckCircle2, Zap, BookOpen, Users, Shield, ChevronRight, ChevronLeft, Plus } from 'lucide-react';
import api from '../utils/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const CATEGORIES = ['All', 'Textbooks', 'Reference Books', 'Exam Prep', 'Computer Science', 'Mathematics', 'Engineering', 'Fiction'];
const STATS = [
  { icon: <BookOpen size={18} />, value: '12,400+', label: 'Verified Books', color: '#6366f1' },
  { icon: <Users size={18} />, value: '3,200+', label: 'Active Sellers', color: '#06b6d4' },
  { icon: <Shield size={18} />, value: '99.4%', label: 'Community Trust', color: '#10b981' },
];

const GENRES = ['All Genres', 'Fiction', 'Non-Fiction', 'Science', 'Mathematics', 'Computers', 'Technology', 'Self-Help', 'History', 'Biography', 'Business', 'Art', 'Romance', 'General'];
const BOOKS_PER_PAGE = 12;

export default function Marketplace() {
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [books, setBooks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [totalCount, setTotalCount]     = useState(0);
  const [totalPages, setTotalPages]     = useState(1);
  const [currentPage, setCurrentPage]   = useState(1);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchVal, setSearchVal]       = useState(searchParams.get('search') || '');
  const [genre, setGenre]               = useState('All Genres');
  const [condition, setCondition]       = useState('All');
  const [minPrice, setMinPrice]         = useState('');
  const [maxPrice, setMaxPrice]         = useState('');
  const [sort, setSort]                 = useState('newest');
  const [filtersOpen, setFiltersOpen]   = useState(false);
  const [wishlist, setWishlist]         = useState(() => {
    try { return JSON.parse(localStorage.getItem('wishlist') || '[]'); } catch { return []; }
  });

  // Fetch books — accepts explicit page so filter/search reset can pass 1
  const fetchBooks = useCallback(async (q = searchVal, page = 1) => {
    setLoading(true);
    try {
      let qs = `?sort=${sort}&page=${page}&limit=${BOOKS_PER_PAGE}`;
      if (q) qs += `&search=${encodeURIComponent(q)}`;
      if (activeCategory !== 'All') qs += `&category=${encodeURIComponent(activeCategory)}`;
      if (genre !== 'All Genres') qs += `&genre=${encodeURIComponent(genre)}`;
      if (condition !== 'All') qs += `&condition=${encodeURIComponent(condition)}`;
      if (minPrice) qs += `&minPrice=${minPrice}`;
      if (maxPrice) qs += `&maxPrice=${maxPrice}`;
      const res = await api.get(`/books${qs}`);
      if (res.success) {
        setBooks(res.books);
        setTotalCount(res.totalCount ?? res.count);
        setTotalPages(res.totalPages ?? 1);
        setCurrentPage(res.currentPage ?? page);
      }
    } catch (err) { showToast(err.message || 'Error loading books', 'error'); }
    finally { setLoading(false); }
  }, [sort, activeCategory, genre, condition, minPrice, maxPrice]);

  // Reset to page 1 whenever filters / search / sort change
  useEffect(() => {
    fetchBooks(searchParams.get('search') || '', 1);
    setCurrentPage(1);
  }, [searchParams, activeCategory, genre, condition, sort]);

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchBooks(searchParams.get('search') || searchVal, page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearch = (e) => {
    if (e.key === 'Enter') { setSearchParams({ search: searchVal }); }
  };

  const toggleWishlist = (id) => {
    if (!isAuthenticated) { showToast('Sign in to save books', 'warning'); return; }
    const updated = wishlist.includes(id) ? wishlist.filter(x => x !== id) : [...wishlist, id];
    setWishlist(updated);
    localStorage.setItem('wishlist', JSON.stringify(updated));
    showToast(wishlist.includes(id) ? 'Removed from wishlist' : 'Saved to wishlist', 'success');
  };

  const condBadgeClass = (c) => c === 'Mint' ? 'badge-mint' : c === 'Good' ? 'badge-good' : 'badge-damaged';

  const resetFilters = () => {
    setGenre('All Genres'); setCondition('All'); setMinPrice(''); setMaxPrice('');
    setActiveCategory('All'); setSearchParams({});
  };

  // Build page number list with ellipsis (e.g. 1 … 4 5 6 … 12)
  const getPageNumbers = () => {
    const pages = [];
    const delta = 2;
    const left = currentPage - delta;
    const right = currentPage + delta;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= left && i <= right)) {
        pages.push(i);
      } else if (pages[pages.length - 1] !== '…') {
        pages.push('…');
      }
    }
    return pages;
  };

  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * BOOKS_PER_PAGE + 1;
  const endItem   = Math.min(currentPage * BOOKS_PER_PAGE, totalCount);

  return (
    <div style={{ background: 'transparent', minHeight: '100vh' }}>

      {/* ── HERO ─────────────────────────────────────── */}
      <section className="hero">
        <div className="page-wrap" style={{ maxWidth: 800 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <span className="hero-eyebrow">
              <Zap size={12} /> Peer-to-Peer Book Sharing Community
            </span>
          </div>
          <h1 className="hero-title">
            Buy &amp; Sell Books You Can <span>Actually Trust</span>
          </h1>
          <p className="hero-subtitle">
            Join a sustainable community of readers and students. Buy, sell, and share books directly with your peers, reducing waste and saving money.
          </p>
          <div className="search-bar" style={{ maxWidth: 600, margin: '0 auto 32px', borderRadius: 14 }}>
            <Search size={18} color="var(--text3)" />
            <input
              value={searchVal}
              onChange={e => setSearchVal(e.target.value)}
              onKeyDown={handleSearch}
              placeholder="Search by title, author, or ISBN..."
              style={{ fontSize: 15, padding: '14px 0' }}
            />
            <button className="btn btn-primary btn-sm" onClick={() => setSearchParams({ search: searchVal })} style={{ flexShrink: 0 }}>
              Search
            </button>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            {STATS.map(s => (
              <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${s.color}18`, color: s.color }}>
                  {s.icon}
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 800, fontSize: 18, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans', lineHeight: 1 }}>{s.value}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1, marginTop: 3 }}>{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CATEGORY CHIPS ───────────────────────────── */}
      <div style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)', padding: '0 32px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, overflowX: 'auto', padding: '12px 0', scrollbarWidth: 'none' }}>
          {CATEGORIES.map(cat => (
            <button key={cat} className={`chip ${activeCategory === cat ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '32px 32px', display: 'flex', gap: 28, alignItems: 'flex-start' }}>

        {/* ── FILTER SIDEBAR ── */}
        <aside className="filter-sidebar" style={{ display: window.innerWidth < 1024 && !filtersOpen ? 'none' : 'block' }}>
          <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>Filters</h3>
              <button onClick={resetFilters} style={{ fontSize: 12, color: 'var(--text3)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>Reset all</button>
            </div>

            {/* Genre */}
            <div className="filter-section">
              <label className="label">Genre</label>
              <select className="select" value={genre} onChange={e => setGenre(e.target.value)}>
                {GENRES.map(g => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>

            {/* Book Condition */}
            <div className="filter-section">
              <label className="label">Book Condition</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {['All', 'Mint', 'Good', 'Damaged'].map(c => (
                  <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '6px 10px', borderRadius: 8, background: condition === c ? 'rgba(99,102,241,0.08)' : 'transparent', transition: 'background 0.15s' }}>
                    <input type="radio" checked={condition === c} onChange={() => setCondition(c)}
                           style={{ accentColor: '#6366f1', width: 15, height: 15 }} />
                    <span style={{ fontSize: 14, color: condition === c ? '#a5b4fc' : 'var(--text2)', fontWeight: condition === c ? 600 : 400 }}>{c === 'All' ? 'All Conditions' : c}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Price Range */}
            <div className="filter-section">
              <label className="label">Price Range (Credits)</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input className="input" value={minPrice} onChange={e => setMinPrice(e.target.value)}
                       onBlur={() => fetchBooks(searchParams.get('search') || searchVal, 1)} placeholder="Min" style={{ textAlign: 'center', padding: '8px' }} />
                <span style={{ color: 'var(--text3)', fontSize: 13 }}>–</span>
                <input className="input" value={maxPrice} onChange={e => setMaxPrice(e.target.value)}
                       onBlur={() => fetchBooks(searchParams.get('search') || searchVal, 1)} placeholder="Max" style={{ textAlign: 'center', padding: '8px' }} />
              </div>
            </div>
          </div>
        </aside>

        {/* ── BOOK GRID ── */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <p style={{ fontSize: 14, color: 'var(--text3)' }}>
              {loading ? (
                <span>Loading…</span>
              ) : totalCount > 0 ? (
                <>Showing <span style={{ fontWeight: 700, color: 'var(--text1)' }}>{startItem}–{endItem}</span> of <span style={{ fontWeight: 700, color: 'var(--text1)' }}>{totalCount}</span> books</>
              ) : (
                <span style={{ fontWeight: 700, color: 'var(--text1)' }}>0 books found</span>
              )}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Sort by</span>
              <select className="select" value={sort} onChange={e => setSort(e.target.value)}
                      style={{ padding: '6px 12px', width: 'auto' }}>
                <option value="newest">Newest</option>
                <option value="lowest">Lowest Price</option>
                <option value="highest">Highest Price</option>
                <option value="condition">Best Condition</option>
              </select>
            </div>
          </div>

          {/* Grid */}
          {loading ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {Array(BOOKS_PER_PAGE).fill(0).map((_, i) => (
                <div key={i} style={{ borderRadius: 16, overflow: 'hidden', background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div className="skeleton" style={{ height: 200 }} />
                  <div style={{ padding: 16 }}>
                    <div className="skeleton" style={{ height: 14, marginBottom: 8, borderRadius: 4 }} />
                    <div className="skeleton" style={{ height: 12, width: '60%', borderRadius: 4 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : books.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 20 }}>
              {books.map((book, idx) => (
                <div key={book._id} className="book-card fade-up" style={{ animationDelay: `${idx * 50}ms` }}>
                  {/* Cover */}
                  <div className="book-cover-area">
                    <img src={book.coverImage} alt={book.title} />
                    <button
                      onClick={() => toggleWishlist(book._id)}
                      style={{
                        position: 'absolute', top: 10, right: 10,
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(13,14,26,0.85)', border: '1px solid var(--border2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', transition: 'transform 0.2s'
                      }}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                      <Heart size={14} fill={wishlist.includes(book._id) ? '#ef4444' : 'none'}
                             color={wishlist.includes(book._id) ? '#ef4444' : 'var(--text3)'} />
                    </button>
                    <span className={`badge ${condBadgeClass(book.condition)}`}
                          style={{ position: 'absolute', bottom: 10, left: 10 }}>
                      {book.condition}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="book-info">
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                        {book.category}
                      </p>
                      <Link to={`/book/${book._id}`} style={{ textDecoration: 'none' }}>
                        <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, color: 'var(--text1)', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {book.title}
                        </h3>
                      </Link>
                      <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>by {book.author}</p>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <img src={book.seller.avatar} alt="" style={{ width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--border2)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {book.seller.name}
                      </span>
                      {book.seller.isVerified && <CheckCircle2 size={13} color="#6366f1" />}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="book-actions">
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 2 }}>Price</p>
                      <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: 'var(--text1)', lineHeight: 1 }}>
                        {book.price} <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text3)' }}>cr</span>
                      </p>
                    </div>
                    <Link to={`/book/${book._id}`} className="btn btn-ghost btn-sm" style={{ padding: '7px 10px' }}>
                      <Eye size={15} />
                    </Link>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => { addToCart({ id: book._id, title: book.title, author: book.author, price: book.price, coverImage: book.coverImage }); }}>
                      <Plus size={14} /> Add
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '80px 0' }}>
              <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <ShoppingCart size={24} color="var(--text3)" />
              </div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>No Books Found</h3>
              <p style={{ fontSize: 14, color: 'var(--text3)' }}>Try adjusting your filters or search query</p>
              <button className="btn btn-secondary btn-md" style={{ marginTop: 20 }} onClick={resetFilters}>Clear Filters</button>
            </div>
          )}

          {/* ── PAGINATION CONTROLS ── */}
          {!loading && totalPages > 1 && (
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 6, marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)'
            }}>
              {/* Previous */}
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 14px', borderRadius: 10,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: currentPage === 1 ? 'var(--text3)' : 'var(--text1)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  opacity: currentPage === 1 ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}>
                <ChevronLeft size={15} /> Prev
              </button>

              {/* Page numbers */}
              {getPageNumbers().map((pg, i) =>
                pg === '…' ? (
                  <span key={`ellipsis-${i}`} style={{ color: 'var(--text3)', fontSize: 14, padding: '0 4px' }}>…</span>
                ) : (
                  <button
                    key={pg}
                    onClick={() => handlePageChange(pg)}
                    style={{
                      width: 38, height: 38, borderRadius: 10,
                      border: '1px solid',
                      borderColor: currentPage === pg ? 'var(--primary)' : 'var(--border)',
                      background: currentPage === pg ? 'var(--primary)' : 'var(--surface)',
                      color: currentPage === pg ? '#fff' : 'var(--text2)',
                      fontWeight: currentPage === pg ? 700 : 500,
                      fontSize: 14, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { if (currentPage !== pg) e.currentTarget.style.borderColor = 'var(--primary)'; }}
                    onMouseLeave={e => { if (currentPage !== pg) e.currentTarget.style.borderColor = 'var(--border)'; }}>
                    {pg}
                  </button>
                )
              )}

              {/* Next */}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '8px 14px', borderRadius: 10,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  color: currentPage === totalPages ? 'var(--text3)' : 'var(--text1)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: 13, fontWeight: 600,
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  transition: 'all 0.15s',
                }}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
