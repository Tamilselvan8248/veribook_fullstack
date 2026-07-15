import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Navbar from './components/Navbar';
import CartPanel from './components/CartPanel';
import Marketplace from './pages/Marketplace';
import Login from './pages/Login';
import VerifyBook from './pages/VerifyBook';
import BookDetails from './pages/BookDetails';
import Wallet from './pages/Wallet';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import MyLibrary from './pages/MyLibrary';
import Settings from './pages/Settings';
import { useAuth } from './context/AuthContext';

import { SocketProvider } from './context/SocketContext';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

export default function App() {
  return (
    <SocketProvider>
      <Router>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'transparent', color: 'var(--text1)' }}>
        <Navbar />
        <CartPanel />

        <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/"         element={<Marketplace />} />
            <Route path="/login"    element={<Login />} />
            <Route path="/book/:id" element={<BookDetails />} />
            <Route path="/verify"   element={<ProtectedRoute><VerifyBook /></ProtectedRoute>} />
            <Route path="/wallet"   element={<ProtectedRoute><Wallet /></ProtectedRoute>} />
            <Route path="/my-library" element={<ProtectedRoute><MyLibrary /></ProtectedRoute>} />
            <Route path="/chat"     element={<ProtectedRoute><Chat /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
            <Route path="/admin"    element={<ProtectedRoute><Admin /></ProtectedRoute>} />
            <Route path="*"         element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer style={{
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          padding: '24px 32px',
        }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: 'white' }}>V</span>
              </div>
              <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                © {new Date().getFullYear()} VeriBook — Peer-to-peer book marketplace
              </span>
            </div>
            <nav style={{ display: 'flex', gap: 24 }}>
              {[['/', 'Marketplace'], ['/verify', 'Sell a Book'], ['/wallet', 'Wallet']].map(([href, label]) => (
                <a key={href} href={href}
                   style={{ fontSize: 13, color: 'var(--text3)', textDecoration: 'none', transition: 'color 0.15s' }}
                   onMouseEnter={e => e.currentTarget.style.color = 'var(--text1)'}
                   onMouseLeave={e => e.currentTarget.style.color = 'var(--text3)'}>
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </footer>
      </div>
    </Router>
    </SocketProvider>
  );
}
