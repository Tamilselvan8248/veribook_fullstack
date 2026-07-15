import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Star, Shield, ShoppingCart, CreditCard, MessageSquare, Loader, ChevronLeft, Check, BookOpen, User, CheckCircle2, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function BookDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { showToast } = useToast();
  const { isAuthenticated, user, updateCachedProfile } = useAuth();

  const [book, setBook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedImg, setSelectedImg] = useState(0);
  const [rating, setRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [buying, setBuying] = useState(false);

  useEffect(() => { fetchBook(); }, [id]);

  const fetchBook = async () => {
    try {
      const data = await api.get(`/books/${id}`);
      if (data.success) setBook(data.book);
    } catch (err) { showToast(err.message || 'Failed to load book', 'error'); navigate('/'); }
    finally { setLoading(false); }
  };

  const handleBuy = async () => {
    if (!isAuthenticated) { showToast('Sign in to buy books', 'warning'); navigate('/login'); return; }
    if (user._id === book.seller._id) { showToast('You cannot buy your own listing', 'error'); return; }
    if (!window.confirm(`Buy "${book.title}" for ${book.price} credits? Funds go into escrow.`)) return;
    setBuying(true);
    try {
      const res = await api.post('/transactions/buy', { bookId: book._id });
      if (res.success) { showToast('Order placed! Credits held in escrow.', 'success'); await updateCachedProfile(); navigate('/wallet'); }
    } catch (err) { showToast(err.message || 'Purchase failed', 'error'); }
    finally { setBuying(false); }
  };

  const submitReview = async () => {
    if (!isAuthenticated) { showToast('Sign in to leave a review', 'warning'); return; }
    if (!reviewText.trim()) { showToast('Please write your review', 'warning'); return; }
    setSubmittingReview(true);
    try {
      const res = await api.post(`/auth/profile/${book.seller._id}/review`, { rating, reviewText });
      if (res.success) { showToast('Review submitted!', 'success'); setReviewText(''); await fetchBook(); }
    } catch (err) { showToast(err.message || 'Review failed', 'error'); }
    finally { setSubmittingReview(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <Loader size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--text2)', fontSize: 14 }}>Loading book details...</span>
    </div>
  );
  if (!book) return null;

  const condBadgeClass = book.condition === 'Mint' ? 'badge-mint' : book.condition === 'Good' ? 'badge-good' : 'badge-damaged';
  const isSelf = user && user._id === book.seller._id;
  const allImages = [book.coverImage, ...book.images].filter(Boolean);

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '0 0 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>
        
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text3)', textDecoration: 'none', fontSize: 14 }}>
            <ChevronLeft size={16} /> Marketplace
          </Link>
          <span style={{ color: 'var(--border2)' }}>/</span>
          <span style={{ fontSize: 14, color: 'var(--text2)', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{book.title}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>

          {/* ── LEFT: Images ── */}
          <div>
            {/* Main Image */}
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', marginBottom: 12, height: 380, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={allImages[selectedImg] || book.coverImage} alt={book.title}
                   style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain', padding: 24 }} />
            </div>
            {/* Thumbnails */}
            {allImages.length > 1 && (
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {allImages.map((img, i) => (
                  <button key={i} onClick={() => setSelectedImg(i)}
                          style={{ width: 64, height: 64, borderRadius: 10, overflow: 'hidden', border: `2px solid ${selectedImg === i ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--surface)', flexShrink: 0, padding: 4, cursor: 'pointer', transition: 'border-color 0.15s' }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── RIGHT: Info ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Title + Meta */}
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span className={`badge ${condBadgeClass}`}><Shield size={11} /> AI: {book.condition} ({book.confidenceScore}%)</span>
                <span className="badge badge-blue">{book.category}</span>
                {book.keywords && <span className="badge badge-purple">{book.keywords}</span>}
              </div>
              <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'var(--text1)', lineHeight: 1.2, marginBottom: 8 }}>{book.title}</h1>
              <p style={{ fontSize: 15, color: 'var(--text2)' }}>by <span style={{ fontWeight: 600 }}>{book.author}</span></p>
            </div>

            {/* Key details grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { label: 'ISBN', val: book.isbn },
                { label: 'Publisher', val: book.publisher || 'Unknown' },
                { label: 'Edition', val: book.edition || 'Standard' },
                { label: 'Genre', val: book.genre },
              ].map(({ label, val }) => (
                <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600, marginBottom: 4 }}>{label}</p>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{val}</p>
                </div>
              ))}
            </div>

            {/* Price + Buy */}
            {book.status === 'AVAILABLE' && (
              <div className="card" style={{ padding: 20, background: 'var(--surface2)' }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 16 }}>
                  <div>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 4 }}>Asking Price</p>
                    <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 900, fontSize: 32, color: 'var(--text1)', lineHeight: 1 }}>
                      {book.price} <span style={{ fontSize: 16, fontWeight: 500, color: 'var(--text3)' }}>credits</span>
                    </p>
                  </div>
                </div>
                {!isSelf ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={handleBuy} disabled={buying} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
                      {buying ? <Loader size={16} className="animate-spin" /> : <><CreditCard size={16} /> Buy Now (Escrow)</>}
                    </button>
                    <button onClick={() => { addToCart({ id: book._id, title: book.title, author: book.author, price: book.price, coverImage: book.coverImage }); }}
                            className="btn btn-secondary btn-lg" style={{ padding: '14px 16px' }}>
                      <ShoppingCart size={18} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>This is your listing</p>
                    <button onClick={async () => {
                      if (!window.confirm('Are you sure you want to delete this listing?')) return;
                      try {
                        const res = await api.delete(`/books/${book._id}`);
                        if (res.success) {
                          showToast('Listing deleted', 'success');
                          navigate('/');
                        }
                      } catch (err) {
                        showToast(err.message || 'Failed to delete listing', 'error');
                      }
                    }} className="btn btn-danger btn-lg" style={{ width: '100%', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                      Delete Listing
                    </button>
                  </div>
                )}
                <p style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center', marginTop: 12 }}>
                  🔒 Credits held in secure escrow until delivery confirmed
                </p>
              </div>
            )}

            {/* Seller card */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <img src={book.seller.avatar} alt="" style={{ width: 44, height: 44, borderRadius: 12, border: '1px solid var(--border)' }} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>{book.seller.name}</p>
                      {book.seller.isVerified && <CheckCircle2 size={14} color="#6366f1" />}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      {[1,2,3,4,5].map(s => <Star key={s} size={13} fill={s <= Math.round(book.seller.rating) ? '#f59e0b' : 'none'} color={s <= Math.round(book.seller.rating) ? '#f59e0b' : 'var(--border2)'} />)}
                      <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 4 }}>{book.seller.rating?.toFixed(1)} ({book.seller.reviewsCount} reviews)</span>
                    </div>
                  </div>
                </div>
                {!isSelf && (
                  <Link to={`/chat?recipient=${book.seller._id}`} className="btn btn-secondary btn-sm">
                    <MessageSquare size={14} /> Chat
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom Section: AI Report + Description + Review ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
          
          {/* AI Report */}
          <div className="card" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Shield size={18} color="var(--green)" />
              </div>
              <div>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>AI Inspection Report</h3>
                <p style={{ fontSize: 12, color: 'var(--text3)' }}>TensorFlow.js analysis results</p>
              </div>
              <span className={`badge ${condBadgeClass} ml-auto`}>{book.condition}</span>
            </div>
            <div>
              {book.aiReport && book.aiReport.length > 0 ? book.aiReport.map((log, i) => (
                <div key={i} className="ai-report-item">
                  <span className="ai-dot" />
                  <span>{log}</span>
                </div>
              )) : (
                <div className="ai-report-item">
                  <span className="ai-dot" />
                  <span>No defects detected during neural network analysis</span>
                </div>
              )}
            </div>
            <div className="progress-bar" style={{ marginTop: 16 }}>
              <div className="fill" style={{ width: `${book.confidenceScore || 95}%` }} />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>Confidence: {book.confidenceScore || 95}%</p>
          </div>

          {/* Description + Review Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {book.description && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 12 }}>Description</h3>
                <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>{book.description}</p>
              </div>
            )}

            {book.seller.reviews && book.seller.reviews.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 16 }}>Seller Reviews</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {book.seller.reviews.map((rev, i) => (
                    <div key={i} style={{ borderBottom: i !== book.seller.reviews.length - 1 ? '1px solid var(--border)' : 'none', paddingBottom: i !== book.seller.reviews.length - 1 ? 16 : 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <img src={rev.reviewerAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(rev.reviewerName)}`} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{rev.reviewerName}</span>
                        <div style={{ display: 'flex', gap: 2, marginLeft: 'auto' }}>
                          {[1,2,3,4,5].map(s => <Star key={s} size={12} fill={s <= rev.rating ? '#f59e0b' : 'none'} color={s <= rev.rating ? '#f59e0b' : 'var(--border2)'} />)}
                        </div>
                      </div>
                      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{rev.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leave Review */}
            {!isSelf && (
              <div className="card" style={{ padding: 24 }}>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 16 }}>Leave a Review</h3>
                <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                  {[1,2,3,4,5].map(s => (
                    <button key={s} onClick={() => setRating(s)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', transition: 'transform 0.15s' }}
                            onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.2)'}
                            onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                      <Star size={22} fill={s <= rating ? '#f59e0b' : 'none'} color={s <= rating ? '#f59e0b' : 'var(--border2)'} />
                    </button>
                  ))}
                </div>
                <textarea
                  value={reviewText} onChange={e => setReviewText(e.target.value)}
                  className="input" placeholder="Share your experience with this seller..."
                  style={{ height: 100, resize: 'vertical', lineHeight: 1.6 }}
                />
                <button onClick={submitReview} disabled={submittingReview} className="btn btn-primary btn-md" style={{ marginTop: 12 }}>
                  {submittingReview ? <Loader size={14} className="animate-spin" /> : 'Submit Review'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
