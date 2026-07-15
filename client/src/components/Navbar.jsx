import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, ShoppingCart, MessageSquare, ShieldAlert, ChevronDown, Wallet, LogOut, Search, Plus, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSocket } from '../context/SocketContext';
import api from '../utils/api';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const { cart, toggleCart } = useCart();
  const navigate = useNavigate();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [unreadMsgCount, setUnreadMsgCount] = useState(0);
  const { socket } = useSocket();

  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    if (isAuthenticated) {
      fetchNotifications();
      fetchUnreadMessages();
      const interval = setInterval(() => {
        fetchNotifications();
        fetchUnreadMessages();
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (socket) {
      const handleBadgeUpdate = () => {
        fetchUnreadMessages();
      };
      socket.on('msg_badge_update', handleBadgeUpdate);
      return () => {
        socket.off('msg_badge_update', handleBadgeUpdate);
      };
    }
  }, [socket]);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.success) {
        setNotifications(res.notifications);
      }
    } catch (err) {
      console.error('Failed to fetch notifications', err);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const res = await api.get('/chat/unread-count');
      if (res.success) {
        setUnreadMsgCount(res.count);
      }
    } catch (err) {
      console.error('Failed to fetch unread messages count', err);
    }
  };

  const markAsRead = async (id, link) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
      if (link) {
        navigate(link.replace('.html', ''));
      }
      setNotifDropdownOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <nav className="navbar">
      <div className="page-wrap w-full flex items-center gap-4" style={{ maxWidth: '100%', padding: '0 32px' }}>
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0" style={{ textDecoration: 'none' }}>
          <div className="flex items-center justify-center w-8 h-8 rounded-lg"
               style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>
            <BookOpen size={16} color="white" />
          </div>
          <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: '#f1f5f9', letterSpacing: '-0.02em' }}>
            VeriBook
          </span>
        </Link>

        {/* Search bar */}
        <div className="search-bar flex-1" style={{ maxWidth: 420 }}>
          <Search size={16} color="var(--text3)" />
          <input
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && searchVal && navigate(`/?search=${encodeURIComponent(searchVal)}`)}
            placeholder="Search books, authors, ISBN..."
          />
        </div>

        {/* Right actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          
          {/* Cart */}
          <button onClick={toggleCart} className="btn btn-ghost btn-md" style={{ position: 'relative', padding: '8px 12px' }}>
            <ShoppingCart size={18} />
            {cart.length > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4,
                width: 18, height: 18, borderRadius: '50%',
                background: '#6366f1', color: 'white', fontSize: 10,
                fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>{cart.length}</span>
            )}
          </button>

          {/* List Book */}
          <Link to="/verify" className="btn btn-primary btn-md">
            <Plus size={15} /> List Book
          </Link>

          {isAuthenticated && user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Wallet */}
              <Link to="/wallet"
                    className="btn btn-secondary btn-sm"
                    style={{ gap: 5, padding: '7px 12px' }}>
                <Wallet size={14} />
                <span style={{ fontWeight: 700 }}>{user.walletBalance}</span>
                <span style={{ color: 'var(--text3)', fontWeight: 400 }}>cr</span>
              </Link>

              {/* Chat */}
              <Link to="/chat" className="btn btn-ghost btn-md" style={{ position: 'relative', padding: '8px 10px' }}>
                <MessageSquare size={18} />
                {unreadMsgCount > 0 && (
                  <span style={{
                    position: 'absolute', top: 4, right: 4,
                    width: 18, height: 18, borderRadius: '50%',
                    background: '#6366f1', color: 'white', fontSize: 10,
                    fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>{unreadMsgCount}</span>
                )}
              </Link>

              {/* Notifications */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setNotifDropdownOpen(p => !p);
                    setDropdownOpen(false);
                  }}
                  className="btn btn-ghost btn-md" style={{ position: 'relative', padding: '8px 10px' }}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 18, height: 18, borderRadius: '50%',
                      background: '#ef4444', color: 'white', fontSize: 10,
                      fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>{unreadCount}</span>
                  )}
                </button>

                {notifDropdownOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setNotifDropdownOpen(false)} />
                    <div className="scale-in" style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
                      width: 340, background: 'var(--surface2)',
                      border: '1px solid var(--border2)', borderRadius: 14,
                      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                      maxHeight: 450, overflowY: 'auto'
                    }}>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'var(--surface2)', zIndex: 2 }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>Notifications</p>
                        {unreadCount > 0 && (
                          <button onClick={async () => {
                            await api.put('/notifications/read-all');
                            fetchNotifications();
                          }} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {notifications.length > 0 ? notifications.map(notif => (
                          <div key={notif._id} 
                               onClick={() => markAsRead(notif._id, notif.relatedLink)}
                               style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', background: notif.isRead ? 'transparent' : 'rgba(99, 102, 241, 0.05)', transition: 'background 0.2s' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                              <p style={{ fontSize: 13, fontWeight: notif.isRead ? 600 : 700, color: 'var(--text1)' }}>{notif.title}</p>
                              {!notif.isRead && <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ef4444', flexShrink: 0, marginTop: 4 }} />}
                            </div>
                            <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.4 }}>{notif.message}</p>
                            <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 6 }}>{new Date(notif.createdAt).toLocaleString()}</p>
                          </div>
                        )) : (
                          <div style={{ padding: 40, textAlign: 'center' }}>
                            <Bell size={24} color="var(--text3)" style={{ margin: '0 auto 12px', opacity: 0.3 }} />
                            <p style={{ fontSize: 13, color: 'var(--text3)' }}>No notifications yet</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {user.isAdmin && (
                <Link to="/admin" className="btn btn-danger btn-sm">
                  <ShieldAlert size={13} /> Admin
                </Link>
              )}

              {/* Avatar dropdown */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => {
                    setDropdownOpen(p => !p);
                    setNotifDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    background: 'none', border: '1px solid var(--border2)',
                    borderRadius: 10, padding: '5px 10px 5px 6px',
                    cursor: 'pointer'
                  }}>
                  <img src={user.avatar} alt="avatar"
                       style={{ width: 28, height: 28, borderRadius: 8, objectFit: 'cover' }} />
                  <ChevronDown size={13} color="var(--text3)" />
                </button>

                {dropdownOpen && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setDropdownOpen(false)} />
                    <div className="scale-in" style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100,
                      width: 220, background: 'var(--surface2)',
                      border: '1px solid var(--border2)', borderRadius: 14,
                      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
                      overflow: 'hidden'
                    }}>
                      <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
                        <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>{user.name}</p>
                        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{user.email}</p>
                      </div>
                      {[{ to: '/wallet', icon: <Wallet size={15} />, label: 'Wallet' }, { to: '/my-library', icon: <BookOpen size={15} />, label: 'My Library' }, { to: '/chat', icon: <MessageSquare size={15} />, label: 'Messages' }, { to: '/settings', icon: <div style={{width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center'}}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg></div>, label: 'Settings' }].map(item => (
                        <Link key={item.to} to={item.to} onClick={() => setDropdownOpen(false)}
                              className="sidebar-item" style={{ margin: '4px', borderRadius: 8, textDecoration: 'none' }}>
                          <span style={{ color: 'var(--text3)' }}>{item.icon}</span> {item.label}
                        </Link>
                      ))}
                      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                      <button onClick={() => { setDropdownOpen(false); logout(); navigate('/'); }}
                              className="sidebar-item" style={{ width: '100%', margin: '4px', borderRadius: 8, color: '#f87171', background: 'none', border: 'none', cursor: 'pointer' }}>
                        <LogOut size={15} /> Logout
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link to="/login" className="btn btn-ghost btn-md">Sign In</Link>
              <Link to="/login?register=true" className="btn btn-primary btn-md">Get Started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
