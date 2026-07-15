import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Loader, CheckCircle2 } from 'lucide-react';
import api from '../utils/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function Settings() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, navigate]);

  const update = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.currentPassword.trim() || !form.newPassword.trim() || !form.confirmPassword.trim()) {
      showToast('Please fill in all fields', 'warning');
      return;
    }
    if (form.newPassword.length < 6) {
      showToast('New password must be at least 6 characters', 'warning');
      return;
    }
    if (form.newPassword !== form.confirmPassword) {
      showToast('New passwords do not match', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.put('/auth/password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      if (res.success) {
        showToast('Password updated successfully!', 'success');
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      }
    } catch (err) {
      showToast(err.message || 'Failed to change password', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '40px 32px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--text1)', marginBottom: 8 }}>
          Account Settings
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 32 }}>
          Manage your account security and preferences.
        </p>

        <div className="card" style={{ padding: '32px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)' }}>Change Password</h2>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>Update your password to keep your account secure.</p>
            </div>
          </div>

          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 400 }}>
            <div>
              <label className="label">Current Password</label>
              <input 
                className="input" 
                type="password" 
                value={form.currentPassword} 
                onChange={update('currentPassword')} 
                placeholder="••••••••" 
                required 
              />
            </div>
            <div>
              <label className="label">New Password</label>
              <input 
                className="input" 
                type="password" 
                value={form.newPassword} 
                onChange={update('newPassword')} 
                placeholder="At least 6 characters" 
                minLength={6}
                required 
              />
            </div>
            <div>
              <label className="label">Confirm New Password</label>
              <input 
                className="input" 
                type="password" 
                value={form.confirmPassword} 
                onChange={update('confirmPassword')} 
                placeholder="At least 6 characters" 
                minLength={6}
                required 
              />
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-md" style={{ marginTop: 8, alignSelf: 'flex-start' }}>
              {loading ? <Loader size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Update Password</>}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
