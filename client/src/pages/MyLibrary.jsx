import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, RefreshCw, Loader, ExternalLink } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';

export default function MyLibrary() {
  const { showToast } = useToast();
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLibrary();
  }, []);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const res = await api.get('/books/my-library/list');
      if (res.success) {
        setBooks(res.books);
      }
    } catch (err) {
      showToast(err.message || 'Failed to load library', 'error');
    } finally {
      setLoading(false);
    }
  };

  const resellBook = async (bookId) => {
    const priceStr = prompt('Enter the new asking price for this book (in credits):');
    if (!priceStr) return;
    
    const newPrice = Number(priceStr);
    if (isNaN(newPrice) || newPrice <= 0) {
      showToast('Please enter a valid price', 'warning');
      return;
    }

    if (!window.confirm(`Are you sure you want to list this book for ${newPrice} credits? It will use the existing AI verification.`)) return;

    try {
      const res = await api.post(`/books/${bookId}/resell`, { newPrice });
      if (res.success) {
        showToast('Book successfully relisted on the marketplace!', 'success');
        loadLibrary();
      }
    } catch (err) {
      showToast(err.message || 'Failed to resell book', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
        <Loader size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
        <span style={{ color: 'var(--text2)', fontSize: 14 }}>Loading your library...</span>
      </div>
    );
  }

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '32px 0 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--text1)', marginBottom: 6 }}>My Library</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)' }}>Books you currently own. Read them or resell them on the marketplace.</p>
        </div>

        {books.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {books.map(book => (
              <div key={book._id} className="card" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
                <div style={{ padding: 20, background: 'var(--surface2)', display: 'flex', justifyContent: 'center' }}>
                  <img src={book.coverImage} alt={book.title} style={{ height: 180, objectFit: 'contain', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                </div>
                <div style={{ padding: 20, display: 'flex', flexDirection: 'column', flex: 1 }}>
                  <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 4 }}>{book.title}</h3>
                  <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12 }}>by {book.author}</p>
                  
                  <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                      <span className={`badge ${book.condition === 'Mint' ? 'badge-mint' : book.condition === 'Good' ? 'badge-good' : 'badge-damaged'}`}>
                        {book.condition}
                      </span>
                      <span>{book.confidenceScore}% verified</span>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button onClick={() => resellBook(book._id)} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                        <RefreshCw size={14} /> Resell
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <BookOpen size={24} color="var(--text3)" />
            </div>
            <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>Your Library is Empty</h3>
            <p style={{ fontSize: 14, color: 'var(--text3)' }}>Books you successfully purchase and confirm delivery for will appear here.</p>
            <Link to="/" className="btn btn-primary btn-md" style={{ marginTop: 20, display: 'inline-flex' }}>Browse Marketplace</Link>
          </div>
        )}

      </div>
    </div>
  );
}
