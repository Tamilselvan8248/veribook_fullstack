import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Lock, CheckCircle, Clock, Loader, Plus, HandshakeIcon, Check } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

const STATUS_CONFIG = {
  HELD_IN_ESCROW:      { label: 'In Escrow',      color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   icon: <Lock size={12} /> },
  READY_FOR_HANDOVER:  { label: 'Handover Ready', color: '#6366f1', bg: 'rgba(99,102,241,0.1)',   icon: <CheckCircle size={12} /> },
  DELIVERED:           { label: 'Pending Confirm', color: '#06b6d4', bg: 'rgba(6,182,212,0.1)',    icon: <Clock size={12} /> },
  COMPLETED:           { label: 'Completed',       color: '#10b981', bg: 'rgba(16,185,129,0.1)',   icon: <Check size={12} /> },
  CANCELLED:           { label: 'Cancelled',       color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    icon: <Lock size={12} /> },
};

export default function Wallet() {
  const { user, updateCachedProfile } = useAuth();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [depositAmt, setDepositAmt] = useState('');
  const [depositing, setDepositing] = useState(false);

  // Re-fetch transactions whenever the global wallet balance or escrow changes
  // (e.g. when CartContext calls updateCachedProfile after a checkout)
  useEffect(() => { 
    loadData(); 
  }, [user?.walletBalance, user?.pendingEscrow]);

  const loadData = async () => {
    try {
      const data = await api.get('/transactions/wallet');
      if (data.success) { 
        setTransactions(data.transactions); 
      }
    } catch (err) { 
      showToast(err.message || 'Failed to load wallet', 'error'); 
    } finally { 
      setLoading(false); 
    }
  };

  const deposit = async () => {
    if (!depositAmt || Number(depositAmt) <= 0) { showToast('Enter a valid amount', 'warning'); return; }
    setDepositing(true);
    try {
      const res = await api.post('/transactions/wallet/deposit', { amount: Number(depositAmt) });
      if (res.success) { showToast(`Topped up ${depositAmt} credits!`, 'success'); setDepositAmt(''); await updateCachedProfile(); await loadData(); }
    } catch (err) { showToast(err.message || 'Deposit failed', 'error'); }
    finally { setDepositing(false); }
  };

  const handover = async (txId) => {
    try {
      const res = await api.post(`/transactions/${txId}/handover`);
      if (res.success) { showToast('Handover status updated!', 'success'); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const confirmDelivery = async (txId) => {
    if (!window.confirm('Confirm you have received this book? This releases escrow funds.')) return;
    try {
      const res = await api.post(`/transactions/${txId}/confirm`);
      if (res.success) { showToast('Delivery confirmed! Funds released.', 'success'); await updateCachedProfile(); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '32px 0 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px' }}>
        
        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--text1)', marginBottom: 6 }}>Wallet & Escrow</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)' }}>Manage your credits and track all transactions</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
          
          {/* ── LEFT PANEL ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            
            {/* Balance card */}
            <div className="wallet-card">
              <p style={{ fontSize: 12, fontWeight: 600, color: 'rgba(167,139,250,0.7)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>Available Balance</p>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 900, fontSize: 40, color: 'white', lineHeight: 1, marginBottom: 4 }}>
                {loading && !user ? '–' : (user?.walletBalance || 0).toLocaleString()}
              </p>
              <p style={{ fontSize: 14, color: 'rgba(167,139,250,0.6)' }}>credits</p>
              <div style={{ marginTop: 24, padding: '12px 16px', borderRadius: 10, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Lock size={14} color="#fbbf24" />
                  <span style={{ fontSize: 13, color: '#fbbf24', fontWeight: 600 }}>In Escrow</span>
                </div>
                <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 16, color: '#fbbf24' }}>{(user?.pendingEscrow || 0).toLocaleString()} cr</span>
              </div>
            </div>

            {/* Deposit */}
            <div className="card" style={{ padding: 20 }}>
              <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, color: 'var(--text1)', marginBottom: 6 }}>Add Credits</h3>
              <p style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16, lineHeight: 1.5 }}>Simulate a top-up to test marketplace purchases.</p>
              
              {/* Quick amounts */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {[100, 250, 500, 1000].map(amt => (
                  <button key={amt} onClick={() => setDepositAmt(String(amt))}
                          className="btn btn-secondary btn-sm" style={{ flex: 1, padding: '6px 4px' }}>
                    +{amt}
                  </button>
                ))}
              </div>
              <input className="input" type="number" value={depositAmt} onChange={e => setDepositAmt(e.target.value)}
                     placeholder="Custom amount..." style={{ marginBottom: 10 }} />
              <button onClick={deposit} disabled={depositing} className="btn btn-primary btn-md btn-full">
                {depositing ? <Loader size={15} className="animate-spin" /> : <><Plus size={15} /> Add Credits</>}
              </button>
            </div>
          </div>

          {/* ── TRANSACTIONS LIST ── */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)' }}>Transaction History</h2>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>{transactions.length} records</span>
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, gap: 10 }}>
                <Loader size={18} className="animate-spin" style={{ color: 'var(--primary)' }} />
                <span style={{ color: 'var(--text3)', fontSize: 14 }}>Loading transactions...</span>
              </div>
            ) : transactions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {transactions.map(tx => {
                  const isBuyer = tx.buyer?._id === user?._id;
                  const status = STATUS_CONFIG[tx.status] || STATUS_CONFIG.HELD_IN_ESCROW;
                  const peerName = isBuyer ? (tx.seller?.name || 'Deleted User') : (tx.buyer?.name || 'Deleted User');
                  const userConfirmed = isBuyer ? tx.buyerConfirmed : tx.sellerConfirmed;

                  return (
                    <div key={tx._id} className="card" style={{ padding: 20 }}>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                        {/* Direction icon */}
                        <div style={{ width: 40, height: 40, borderRadius: 12, background: isBuyer ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {isBuyer ? <ArrowUpRight size={18} color="#f87171" /> : <ArrowDownLeft size={18} color="#34d399" />}
                        </div>
                        
                        {/* Book cover */}
                        <img src={tx.book?.coverImage} alt="" style={{ width: 40, height: 52, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface2)', flexShrink: 0 }} />
                        
                        {/* Details */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <Link to={`/book/${tx.book?._id}`} style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 15, color: 'var(--text1)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.book?.title || 'Book Deleted'}
                          </Link>
                          <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
                            {isBuyer ? 'Bought from' : 'Sold to'}: <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{peerName}</span>
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{new Date(tx.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                        </div>

                        {/* Price + Status */}
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: isBuyer ? '#f87171' : '#34d399', marginBottom: 6 }}>
                            {isBuyer ? '-' : '+'}{tx.price} cr
                          </p>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 99, fontSize: 11, fontWeight: 600, background: status.bg, color: status.color }}>
                            {status.icon} {status.label}
                          </span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      {tx.status !== 'COMPLETED' && tx.status !== 'CANCELLED' && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                          <div style={{ flex: 1, display: 'flex', gap: 6, fontSize: 12, color: 'var(--text3)' }}>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: tx.buyerConfirmed ? 'rgba(16,185,129,0.1)' : 'var(--surface2)', color: tx.buyerConfirmed ? 'var(--green)' : 'var(--text3)' }}>Buyer {tx.buyerConfirmed ? '✓' : '✗'}</span>
                            <span style={{ padding: '3px 8px', borderRadius: 6, background: tx.sellerConfirmed ? 'rgba(16,185,129,0.1)' : 'var(--surface2)', color: tx.sellerConfirmed ? 'var(--green)' : 'var(--text3)' }}>Seller {tx.sellerConfirmed ? '✓' : '✗'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {!isBuyer && tx.status === 'HELD_IN_ESCROW' && (
                              <button onClick={() => handover(tx._id)} className="btn btn-success btn-sm">
                                <HandshakeIcon size={13} /> Mark Handover
                              </button>
                            )}
                            {!userConfirmed && (
                              <button onClick={() => confirmDelivery(tx._id)} className="btn btn-primary btn-sm">
                                <Check size={13} /> Confirm Delivery
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 0' }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <WalletIcon size={24} color="var(--text3)" />
                </div>
                <h3 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 8 }}>No Transactions Yet</h3>
                <p style={{ fontSize: 14, color: 'var(--text3)' }}>Start buying or selling books to see your history</p>
                <Link to="/" className="btn btn-primary btn-md" style={{ marginTop: 20, display: 'inline-flex' }}>Browse Books</Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
