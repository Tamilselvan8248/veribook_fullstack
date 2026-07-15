import React from 'react';
import { Link } from 'react-router-dom';
import { X, Trash2, ShoppingCart, BookOpen, CreditCard, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';

export default function CartPanel() {
  const { cart, isOpen, toggleCart, removeFromCart, cartTotal, checkout } = useCart();
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div onClick={toggleCart} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />

      {/* Panel */}
      <div className="scale-in" style={{
        position: 'fixed', right: 0, top: 0, bottom: 0, zIndex: 201,
        width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border2)',
        boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingCart size={17} color="var(--primary)" />
            </div>
            <div>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>Your Cart</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
          <button onClick={toggleCart} className="btn btn-ghost btn-sm" style={{ padding: '6px' }}>
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {cart.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16, textAlign: 'center' }}>
              <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={28} color="var(--text3)" />
              </div>
              <div>
                <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 6 }}>Cart is empty</p>
                <p style={{ fontSize: 13, color: 'var(--text3)' }}>Browse the marketplace to find verified books</p>
              </div>
              <Link to="/" onClick={toggleCart} className="btn btn-primary btn-md">
                Browse Marketplace
              </Link>
            </div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', gap: 14, padding: 14, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12 }}>
                <div style={{ width: 48, height: 60, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 4 }}>
                  <img src={item.coverImage} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{item.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>by {item.author}</p>
                  <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 16, color: 'var(--primary2)' }}>
                    {item.price} <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text3)' }}>cr</span>
                  </p>
                </div>
                <button onClick={() => removeFromCart(item.id)} className="btn btn-danger btn-sm" style={{ padding: '6px', alignSelf: 'flex-start' }}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: 'var(--text3)' }}>Total ({cart.length} items)</span>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 900, fontSize: 24, color: 'var(--text1)' }}>
                {cartTotal} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text3)' }}>credits</span>
              </span>
            </div>
            <button onClick={checkout} className="btn btn-primary btn-lg btn-full">
              <CreditCard size={16} /> Checkout via Escrow <ArrowRight size={16} />
            </button>
            <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              🔒 Funds held in escrow until both parties confirm delivery
            </p>
          </div>
        )}
      </div>
    </>
  );
}
