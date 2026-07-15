import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Users, BookOpen, Lock, Coins, ShieldOff, CheckCircle, XCircle, Trash2, Loader, TrendingUp, Activity } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

export default function Admin() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState({});
  const [users, setUsers] = useState([]);
  const [books, setBooks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');

  useEffect(() => {
    if (!user?.isAdmin) { showToast('Admin access required', 'error'); navigate('/'); return; }
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    try {
      const d = await api.get('/admin/dashboard');
      if (d.success) { setMetrics(d.metrics); setUsers(d.users); setBooks(d.books); setTransactions(d.transactions); }
    } catch (err) { showToast(err.message || 'Failed to load admin data', 'error'); }
    finally { setLoading(false); }
  };

  const toggleVerify = async (uid) => {
    try {
      const res = await api.post(`/admin/users/${uid}/verify`);
      if (res.success) { showToast('User verification updated', 'success'); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const toggleBlock = async (uid) => {
    try {
      const res = await api.post(`/admin/users/${uid}/block`);
      if (res.success) { showToast(`User ${res.isBlocked ? 'blocked' : 'unblocked'}`, 'success'); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed to block user', 'error'); }
  };

  const deleteUser = async (uid) => {
    if (!window.confirm('Are you sure you want to permanently delete this user and all their listings? This cannot be undone.')) return;
    try {
      const res = await api.delete(`/admin/users/${uid}`);
      if (res.success) { showToast('User deleted', 'success'); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed to delete user', 'error'); }
  };

  const deleteBook = async (bid) => {
    if (!window.confirm('Remove this listing from the marketplace?')) return;
    try {
      const res = await api.delete(`/admin/books/${bid}`);
      if (res.success) { showToast('Listing removed', 'success'); await loadData(); }
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  const METRICS = [
    { label: 'Total Users', value: metrics.totalUsers, icon: <Users size={20} />, color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Book Listings', value: metrics.totalBooks, icon: <BookOpen size={20} />, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Active Escrows', value: metrics.activeEscrows, icon: <Lock size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'Escrow Volume', value: `${metrics.escrowVolume || 0} cr`, icon: <Coins size={20} />, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)' },
  ];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 12 }}>
      <Loader size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
      <span style={{ color: 'var(--text2)', fontSize: 14 }}>Loading admin panel...</span>
    </div>
  );

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '32px 0 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--text1)', marginBottom: 6 }}>Admin Panel</h1>
          <p style={{ fontSize: 14, color: 'var(--text3)' }}>Monitor platform activity and manage users and listings</p>
        </div>

        {/* Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
          {METRICS.map(m => (
            <div key={m.label} className="metric-card">
              <div className="metric-icon" style={{ background: m.bg, color: m.color }}>{m.icon}</div>
              <p className="metric-value">{m.value ?? '–'}</p>
              <p className="metric-label">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24 }}>
          {[['users', 'Users', <Users size={15} />], ['books', 'Listings', <BookOpen size={15} />], ['transactions', 'Transactions', <Activity size={15} />]].map(([id, label, icon]) => (
            <button key={id} onClick={() => setActiveTab(id)}
                    className="btn btn-md" style={{
                      background: activeTab === id ? 'rgba(99,102,241,0.12)' : 'transparent',
                      border: activeTab === id ? '1px solid rgba(99,102,241,0.3)' : '1px solid transparent',
                      color: activeTab === id ? 'var(--primary2)' : 'var(--text3)',
                      gap: 7
                    }}>
              {icon} {label}
            </button>
          ))}
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>Registered Users</h2>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>{users.length} total</span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Wallet</th>
                  <th>Role</th>
                  <th>Verified</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={u.avatar} alt="" style={{ width: 32, height: 32, borderRadius: 10, border: '1px solid var(--border)' }} />
                        <span style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 14 }}>{u.name}</span>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{u.email}</td>
                    <td><span style={{ fontWeight: 700, color: 'var(--text1)' }}>{u.walletBalance}</span> <span style={{ fontSize: 11, color: 'var(--text3)' }}>cr</span></td>
                    <td>{u.isAdmin ? <span className="badge badge-red">Admin</span> : <span className="badge badge-blue">User</span>}</td>
                    <td>
                      {u.isVerified
                        ? <span className="badge badge-mint"><CheckCircle size={10} /> Verified</span>
                        : <span style={{ fontSize: 12, color: 'var(--text3)' }}>Not verified</span>}
                    </td>
                    <td>
                      {u.isBlocked
                        ? <span className="badge badge-red">Blocked</span>
                        : <span className="badge badge-blue">Active</span>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => toggleVerify(u._id)} className={`btn btn-sm ${u.isVerified ? 'btn-danger' : 'btn-success'}`}>
                          {u.isVerified ? <><XCircle size={13} /> Unverify</> : <><CheckCircle size={13} /> Verify</>}
                        </button>
                        {!u.isAdmin && (
                          <>
                            <button onClick={() => toggleBlock(u._id)} className={`btn btn-sm ${u.isBlocked ? 'btn-secondary' : 'btn-danger'}`}>
                              {u.isBlocked ? <><CheckCircle size={13} /> Unblock</> : <><ShieldOff size={13} /> Block</>}
                            </button>
                            <button onClick={() => deleteUser(u._id)} className="btn btn-sm btn-danger" style={{ background: 'transparent', color: '#f87171', border: '1px solid #f87171' }}>
                              <Trash2 size={13} /> Delete
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Books Tab */}
        {activeTab === 'books' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>Book Listings</h2>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>{books.length} listings</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Book</th><th>Original Seller</th><th>Current Owner</th><th>Price</th><th>Condition</th><th>Status</th><th>Action</th></tr></thead>
              <tbody>
                {books.map(b => (
                  <tr key={b._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={b.coverImage} alt="" style={{ width: 28, height: 36, objectFit: 'contain', borderRadius: 4, background: 'var(--surface2)', border: '1px solid var(--border)' }} />
                        <Link to={`/book/${b._id}`} style={{ fontWeight: 600, color: 'var(--text1)', fontSize: 13, textDecoration: 'none', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>{b.title}</Link>
                      </div>
                    </td>
                    <td style={{ fontSize: 13 }}>{b.seller?.name}</td>
                    <td style={{ fontSize: 13, fontWeight: 600 }}>{b.currentOwner?.name || b.seller?.name}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text1)' }}>{b.price} cr</td>
                    <td><span className={`badge ${b.condition === 'Mint' ? 'badge-mint' : b.condition === 'Good' ? 'badge-good' : 'badge-damaged'}`}>{b.condition}</span></td>
                    <td><span className={`badge ${b.status === 'AVAILABLE' ? 'badge-blue' : 'badge-purple'}`}>{b.status}</span></td>
                    <td>
                      <button onClick={() => deleteBook(b._id)} className="btn btn-danger btn-sm">
                        <Trash2 size={13} /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)' }}>All Transactions</h2>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>{transactions.length} total</span>
            </div>
            <table className="data-table">
              <thead><tr><th>Buyer</th><th>Seller</th><th>Book</th><th>Value</th><th>Status</th><th>Date</th></tr></thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx._id}>
                    <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{tx.buyer?.name}</td>
                    <td style={{ fontWeight: 600, fontSize: 13, color: 'var(--text1)' }}>{tx.seller?.name}</td>
                    <td style={{ fontSize: 13, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tx.book?.title || 'Deleted'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--text1)' }}>{tx.price} cr</td>
                    <td>
                      <span className={`badge ${tx.status === 'COMPLETED' ? 'badge-mint' : tx.status === 'CANCELLED' ? 'badge-red' : 'badge-good'}`}>
                        {tx.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{new Date(tx.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}
