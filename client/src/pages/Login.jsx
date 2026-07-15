import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, BookOpen, Zap, Shield, Star, Loader, ArrowRight } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isRegister, setIsRegister] = useState(searchParams.get('register') === 'true');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '' });

  useEffect(() => { if (isAuthenticated) navigate('/'); }, [isAuthenticated]);

  const update = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.email.trim() || !form.password.trim()) { showToast('Please fill in all fields', 'warning'); return; }
    if (isRegister && !form.name.trim()) { showToast('Name is required', 'warning'); return; }
    setLoading(true);
    try {
      const res = await api.post(isRegister ? '/auth/register' : '/auth/login',
        isRegister ? form : { email: form.email, password: form.password });
      if (res.success) {
        login(res.user, res.token);
        showToast(`Welcome${isRegister ? ' to VeriBook' : ' back'}, ${res.user.name}!`, 'success');
        navigate('/');
      }
    } catch (err) { showToast(err.message || 'Authentication failed', 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="auth-page">
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', gap: 0, borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border2)', boxShadow: '0 40px 80px rgba(0,0,0,0.5)' }}>

        {/* Left Brand Panel */}
        <div style={{
          width: '42%', flexShrink: 0,
          background: 'linear-gradient(145deg, #1a1b38 0%, #0f1028 100%)',
          padding: '48px 40px',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          position: 'relative', overflow: 'hidden'
        }}
          className="hidden sm:flex">
          {/* Decorative orb */}
          <div style={{ position: 'absolute', top: -80, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', filter: 'blur(40px)', pointerEvents: 'none' }} />

          <div style={{ marginBottom: 48 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <BookOpen size={18} color="white" />
              </div>
              <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 20, color: 'var(--text1)' }}>VeriBook</span>
            </div>

            <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'var(--text1)', lineHeight: 1.25, marginBottom: 12 }}>
              The smarter way<br />to trade books
            </h2>
            <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7 }}>
              Join students, universities, and readers who trust AI-verified listings over blind guesswork.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {[
              { icon: <Zap size={16} />, color: '#6366f1', title: 'AI Condition Scan', desc: 'Every book photo is analyzed by TensorFlow.js for honest grading' },
              { icon: <Shield size={16} />, color: '#10b981', title: 'Escrow Protection', desc: 'Your credits are held safely until delivery is confirmed by both parties' },
              { icon: <Star size={16} />, color: '#f59e0b', title: '1,000 Free Credits', desc: 'New accounts start with 1,000 credits to buy books right away' },
            ].map(f => (
              <div key={f.title} style={{ display: 'flex', gap: 12, padding: '14px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: `${f.color}18`, color: f.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {f.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans', marginBottom: 3 }}>{f.title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Form Panel */}
        <div style={{ flex: 1, background: 'var(--surface)', padding: '48px 40px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          
          {/* Logo (mobile only) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 32 }} className="flex sm:hidden">
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={16} color="white" />
            </div>
            <span style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 18, color: 'var(--text1)' }}>VeriBook</span>
          </div>

          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 26, color: 'var(--text1)', marginBottom: 8 }}>
              {isRegister ? 'Create your account' : 'Welcome back'}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text3)' }}>
              {isRegister ? 'Join thousands of students on VeriBook.' : 'Sign in to continue to your account.'}
            </p>
          </div>

          {/* Tab toggle */}
          <div className="tab-bar" style={{ marginBottom: 28 }}>
            <div className={`tab-item ${!isRegister ? 'active' : ''}`} onClick={() => setIsRegister(false)}>Sign In</div>
            <div className={`tab-item ${isRegister ? 'active' : ''}`} onClick={() => setIsRegister(true)}>Create Account</div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {isRegister && (
              <div>
                <label className="label">Full Name</label>
                <input className="input" value={form.name} onChange={update('name')} placeholder="e.g. John Doe" required />
              </div>
            )}
            <div>
              <label className="label">Email Address</label>
              <input className="input" type="email" value={form.email} onChange={update('email')} placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">
                Password {isRegister && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(min 6 characters)</span>}
              </label>
              <div style={{ position: 'relative' }}>
                <input className="input" type={showPass ? 'text' : 'password'} value={form.password}
                       onChange={update('password')} placeholder={isRegister ? "At least 6 characters" : "••••••••"} required
                       minLength={isRegister ? 6 : undefined}
                       style={{ paddingRight: 42 }} />
                <button type="button" onClick={() => setShowPass(p => !p)}
                        style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg btn-full" style={{ marginTop: 4 }}>
              {loading ? <Loader size={16} className="animate-spin" /> : <>
                {isRegister ? 'Create Account' : 'Sign In'} <ArrowRight size={16} />
              </>}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 14, color: 'var(--text3)' }}>
            {isRegister ? 'Already have an account? ' : "Don't have an account? "}
            <button onClick={() => setIsRegister(p => !p)}
                    style={{ color: '#818cf8', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontSize: 14 }}>
              {isRegister ? 'Sign in' : 'Sign up free'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
