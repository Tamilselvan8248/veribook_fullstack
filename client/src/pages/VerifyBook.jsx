import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Upload, ShieldCheck, Loader, ArrowRight, Cpu, Sparkles, QrCode, Check, RotateCcw, BookOpen, AlertCircle } from 'lucide-react';
import { useScanner } from '../hooks/useScanner';
import { useClassifier } from '../hooks/useClassifier';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const STEPS = [
  { n: 1, label: 'Scan Barcode', desc: 'Scan or enter ISBN' },
  { n: 2, label: 'Verify Metadata', desc: 'Confirm book details' },
  { n: 3, label: 'AI Condition Audit', desc: 'Photo analysis' },
  { n: 4, label: 'Publish Listing', desc: 'Set price & tags' },
];

const CATEGORIES  = ['Textbooks','Reference Books','Exam Prep','Fiction','Non-Fiction','Academic Journal'];

export default function VerifyBook() {
  const { isAuthenticated } = useAuth();
  const { showToast }       = useToast();
  const navigate            = useNavigate();
  const scanner             = useScanner();
  const classifier          = useClassifier();

  const [step, setStep]               = useState(1);
  const [manualIsbn, setManualIsbn]   = useState('');
  const [bookMeta, setBookMeta]       = useState(null);
  const aiStreamRef                   = useRef(null);
  const [snappedFiles, setSnappedFiles] = useState([]);
  const [snappedUrls, setSnappedUrls]   = useState([]);
  const [genre, setGenre]             = useState('');
  const [category, setCategory]       = useState('');
  const [keywords, setKeywords]       = useState('');
  const [price, setPrice]             = useState('');
  const [submitting, setSubmitting]   = useState(false);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    goStep(1);
    return () => { scanner.stopScanning(); stopAICam(); };
  }, []);

  const goStep = (n) => {
    scanner.stopScanning();
    stopAICam();
    setStep(n);
    if (n === 1) setTimeout(startScanner, 150);
    if (n === 3) setTimeout(startAICam, 150);
  };

  const startScanner = () => {
    scanner.startScanning('scan-video', async (isbn) => {
      showToast(`ISBN detected: ${isbn}`, 'success');
      await lookupISBN(isbn);
    });
  };

  // ── ISBN Cache helpers ────────────────────────────────────────────────────
  const ISBN_CACHE_KEY  = 'veribook_isbn_cache';
  const CACHE_TTL_MS    = 30 * 24 * 60 * 60 * 1000; // 30 days

  const readCache = (isbn) => {
    try {
      const store = JSON.parse(localStorage.getItem(ISBN_CACHE_KEY) || '{}');
      const entry = store[isbn];
      if (entry && Date.now() - entry.cachedAt < CACHE_TTL_MS) return entry.data;
    } catch { /* ignore parse errors */ }
    return null;
  };

  const writeCache = (isbn, data) => {
    try {
      const store = JSON.parse(localStorage.getItem(ISBN_CACHE_KEY) || '{}');
      store[isbn] = { data, cachedAt: Date.now() };
      localStorage.setItem(ISBN_CACHE_KEY, JSON.stringify(store));
    } catch { /* ignore storage quota errors */ }
  };

  const lookupISBN = async (isbn) => {
    if (!isbn) return;

    // 1. Check offline cache first (instant, works without internet)
    const cached = readCache(isbn);
    if (cached) {
      showToast(`Book loaded from offline cache`, 'info');
      setBookMeta(cached);
      if (cached.categories && cached.categories.length > 0) setGenre(cached.categories[0]);
      goStep(2);
      return;
    }

    // 2. Live API lookup
    showToast('Looking up book catalog…', 'info');
    try {
      const res = await api.get(`/books/lookup/${isbn}`);
      if (res.success && res.data) {
        writeCache(isbn, res.data);   // Save to cache for offline use
        setBookMeta(res.data);
        if (res.data.categories && res.data.categories.length > 0) setGenre(res.data.categories[0]);
        goStep(2);
      } else {
        showToast('ISBN not found in catalog', 'warning');
      }
    } catch (err) {
      // 3. Network error — try falling back to cache even if stale
      try {
        const store = JSON.parse(localStorage.getItem(ISBN_CACHE_KEY) || '{}');
        const staleEntry = store[isbn];
        if (staleEntry) {
          showToast('Offline — loaded from cached data', 'warning');
          setBookMeta(staleEntry.data);
          if (staleEntry.data.categories && staleEntry.data.categories.length > 0) setGenre(staleEntry.data.categories[0]);
          goStep(2);
          return;
        }
      } catch { /* ignore */ }
      showToast(err.message || 'Lookup failed — no internet and no cached data', 'error');
    }
  };


  const startAICam = async () => {
    const vid = document.getElementById('ai-video');
    if (!vid) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } } });
      aiStreamRef.current = stream;
      vid.srcObject = stream;
      vid.setAttribute('playsinline', true);
      await vid.play();
    } catch (e) { console.warn('Camera unavailable, use upload', e); }
  };

  const stopAICam = () => {
    aiStreamRef.current?.getTracks().forEach(t => t.stop());
    aiStreamRef.current = null;
    const vid = document.getElementById('ai-video');
    if (vid) vid.srcObject = null;
  };

  const captureFrame = () => {
    const vid = document.getElementById('ai-video');
    if (!vid || !vid.videoWidth) { showToast('Camera not ready', 'warning'); return; }
    const canvas = document.createElement('canvas');
    canvas.width  = vid.videoWidth;
    canvas.height = vid.videoHeight;
    canvas.getContext('2d').drawImage(vid, 0, 0);
    canvas.toBlob(blob => processImage(new File([blob], `frame-${Date.now()}.png`, { type: 'image/png' })));
  };

  const processImage = async (file) => {
    if (snappedFiles.length >= 5) { showToast('Maximum 5 photos', 'warning'); return; }
    const url = URL.createObjectURL(file);
    setSnappedFiles(p => [...p, file]);
    setSnappedUrls(p => [...p, url]);
    const img = new Image();
    img.src = url;
    img.onload = async () => {
      const c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      await classifier.analyzeImage(c);
    };
    showToast('Photo captured — analyzing…', 'info');
  };

  const publish = async () => {
    if (!genre || !category || !price || Number(price) <= 0) {
      showToast('Please fill all required fields', 'warning'); return;
    }
    setSubmitting(true);
    try {
      const mediaRes = await api.uploadMultiple(snappedFiles);
      if (!mediaRes.success) throw new Error('Image upload failed');
      const payload = {
        ...bookMeta,
        category,
        genre,
        keywords,
        price: Number(price),
        condition:       classifier.result?.condition,
        confidenceScore: classifier.result?.confidenceScore,
        aiReport:        classifier.result?.aiReport,
        images:          mediaRes.urls,
      };
      const res = await api.post('/books/list', payload);
      if (res.success) {
        showToast('Listing published successfully!', 'success');
        snappedUrls.forEach(u => URL.revokeObjectURL(u));
        navigate('/');
      }
    } catch (err) { showToast(err.message || 'Publish failed', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div style={{ background: 'transparent', minHeight: '100vh', padding: '40px 16px 80px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Page title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 800, fontSize: 28, color: 'var(--text1)', marginBottom: 8 }}>
            List a Verified Book
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text3)' }}>
            Our 4-step wizard scans the ISBN and runs an AI condition check before publishing.
          </p>
        </div>

        {/* ── Wizard Progress ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0, marginBottom: 36 }}>
          {STEPS.map((s, i) => (
            <React.Fragment key={s.n}>
              <div className="wizard-step" style={{ flex: 1 }}>
                <div className={`step-num ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
                  {step > s.n ? <Check size={15} /> : s.n}
                </div>
                <span className={`step-label ${step === s.n ? 'active' : step > s.n ? 'done' : ''}`}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`step-connector ${step > s.n ? 'done' : ''}`} style={{ marginTop: 18 }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ── Step Card ── */}
        <div className="card" style={{ padding: 32 }}>

          {/* ─ STEP 1: Scan ─ */}
          {step === 1 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 20, color: 'var(--text1)', marginBottom: 6 }}>
                  Scan ISBN Barcode
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)' }}>
                  Point your camera at the barcode on the back cover. Or type the ISBN manually below.
                </p>
              </div>

              <div className="scanner-wrap" style={{ aspectRatio: '4/3', marginBottom: 20 }}>
                <video id="scan-video" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
                <div className="scan-laser" />
                <div className="scan-corner tl" /><div className="scan-corner tr" />
                <div className="scan-corner bl" /><div className="scan-corner br" />
                {scanner.loading && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: 'rgba(13,14,26,0.9)', zIndex: 20 }}>
                    <Loader size={24} className="animate-spin" style={{ color: 'var(--primary)' }} />
                    <p style={{ fontSize: 13, color: 'var(--text3)' }}>Opening camera…</p>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <input
                  value={manualIsbn}
                  onChange={e => setManualIsbn(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && manualIsbn && lookupISBN(manualIsbn)}
                  className="input"
                  placeholder="Enter ISBN manually (e.g. 9780132350884)"
                />
                <button onClick={() => lookupISBN(manualIsbn)} disabled={!manualIsbn} className="btn btn-primary btn-md" style={{ flexShrink: 0 }}>
                  Lookup
                </button>
              </div>
            </div>
          )}

          {/* ─ STEP 2: Metadata ─ */}
          {step === 2 && bookMeta && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 20, color: 'var(--text1)', marginBottom: 6 }}>
                  Verify Book Details
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)' }}>
                  Confirm the ISBN lookup data is correct before proceeding.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', padding: 20, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 14, marginBottom: 24 }}>
                <div style={{ width: 100, height: 130, borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {bookMeta.coverImage
                    ? <img src={bookMeta.coverImage} alt="Cover" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <BookOpen size={32} color="var(--text3)" />}
                </div>
                <div style={{ flex: 1 }}>
                  {[
                    { label: 'Title',     val: bookMeta.title },
                    { label: 'Author',    val: bookMeta.author },
                    { label: 'Publisher', val: bookMeta.publisher },
                    { label: 'Edition',   val: bookMeta.edition },
                    { label: 'ISBN',      val: bookMeta.isbn },
                  ].map(({ label, val }) => val && (
                    <div key={label} style={{ display: 'flex', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em', width: 70, flexShrink: 0, paddingTop: 1 }}>{label}</span>
                      <span style={{ fontSize: 14, color: 'var(--text1)', fontWeight: label === 'Title' ? 600 : 400 }}>{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <button onClick={() => goStep(1)} className="btn btn-secondary btn-md">
                  <RotateCcw size={15} /> Rescan
                </button>
                <button onClick={() => goStep(3)} className="btn btn-primary btn-md">
                  Continue to AI Audit <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ─ STEP 3: AI Audit ─ */}
          {step === 3 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 20, color: 'var(--text1)', marginBottom: 6 }}>
                  AI Condition Audit
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)' }}>
                  Capture clear photos of the book's cover and inner pages. Our TensorFlow.js model will grade the condition.
                </p>
              </div>

              {/* Camera */}
              <div className="scanner-wrap" style={{ aspectRatio: '4/3', marginBottom: 16 }}>
                <video id="ai-video" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} muted playsInline />
                {/* Capture button overlay */}
                <div style={{ position: 'absolute', bottom: 16, left: 0, right: 0, display: 'flex', justifyContent: 'center', zIndex: 10 }}>
                  <button onClick={captureFrame}
                          style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', border: '3px solid rgba(255,255,255,0.4)', boxShadow: '0 4px 20px rgba(0,0,0,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'transform 0.15s' }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.08)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <Camera size={24} color="#1a1b2e" />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '16px 0' }}>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>or upload from device</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              <input type="file" accept="image/*" id="ai-gallery" style={{ display: 'none' }} onChange={e => processImage(e.target.files[0])} />
              <button onClick={() => document.getElementById('ai-gallery').click()}
                      className="btn btn-secondary btn-md btn-full">
                <Upload size={16} /> Upload Photo from Gallery
              </button>

              {/* Thumbnail previews */}
              {snappedUrls.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>
                    Captured Photos ({snappedUrls.length}/5)
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {snappedUrls.map((url, i) => (
                      <div key={i} style={{ position: 'relative', width: 68, height: 80 }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                        <button
                          onClick={() => { URL.revokeObjectURL(url); setSnappedUrls(p => p.filter((_,j)=>j!==i)); setSnappedFiles(p => p.filter((_,j)=>j!==i)); }}
                          style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', border: 'none', color: 'white', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Analyzing */}
              {classifier.analyzing && (
                <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 12 }}>
                  <Cpu size={20} style={{ color: 'var(--primary)', flexShrink: 0 }} className="animate-spin" />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginBottom: 3 }}>TensorFlow.js analyzing photos…</p>
                    <p style={{ fontSize: 12, color: 'var(--text3)' }}>Running visual defect detection pipeline</p>
                  </div>
                </div>
              )}

              {/* AI Result */}
              {classifier.result && (
                <div style={{ marginTop: 16, padding: '16px 20px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <ShieldCheck size={18} color="var(--green)" />
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>AI Verdict</span>
                    </div>
                    <span className={`badge ${classifier.result.condition === 'Mint' ? 'badge-mint' : classifier.result.condition === 'Good' ? 'badge-good' : 'badge-damaged'}`}>
                      {classifier.result.condition} — {classifier.result.confidenceScore}% confidence
                    </span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 12 }}>
                    <div className="fill" style={{ width: `${classifier.result.confidenceScore}%` }} />
                  </div>
                  <div>
                    {classifier.result.aiReport?.map((log, i) => (
                      <div key={i} className="ai-report-item">{log}</div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 24, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
                <button onClick={() => goStep(2)} className="btn btn-secondary btn-md">Back</button>
                <button onClick={() => goStep(4)} disabled={!classifier.result} className="btn btn-primary btn-md" style={{ opacity: classifier.result ? 1 : 0.45 }}>
                  Continue to Publish <ArrowRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ─ STEP 4: Publish ─ */}
          {step === 4 && (
            <div>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 20, color: 'var(--text1)', marginBottom: 6 }}>
                  Set Listing Details
                </h2>
                <p style={{ fontSize: 14, color: 'var(--text3)' }}>
                  Tag your book to help buyers find it, then set your asking price in credits.
                </p>
              </div>

              {/* Book summary strip */}
              {bookMeta && (
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '14px 16px', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, marginBottom: 24 }}>
                  <div style={{ width: 44, height: 56, borderRadius: 8, background: 'var(--bg)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {bookMeta.coverImage ? <img src={bookMeta.coverImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <BookOpen size={20} color="var(--text3)" />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'Plus Jakarta Sans' }}>{bookMeta.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>by {bookMeta.author}</p>
                  </div>
                  {classifier.result && (
                    <span className={`badge ${classifier.result.condition === 'Mint' ? 'badge-mint' : classifier.result.condition === 'Good' ? 'badge-good' : 'badge-damaged'}`}>
                      {classifier.result.condition}
                    </span>
                  )}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div>
                  <label className="label">Genre <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="input" value={genre} onChange={e => setGenre(e.target.value)} placeholder="e.g. Science Fiction, Textbooks" />
                </div>
                <div>
                  <label className="label">Category <span style={{ color: '#ef4444' }}>*</span></label>
                  <select className="select" value={category} onChange={e => setCategory(e.target.value)}>
                    <option value="">Select category…</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Keywords / Tags <span style={{ color: 'var(--text3)', fontWeight: 400, textTransform: 'none', fontSize: 11 }}>(optional)</span></label>
                  <input className="input" value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. vintage, beginner-friendly" />
                </div>
                <div>
                  <label className="label">Asking Price (Credits) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input className="input" type="number" min="1" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 150" />
                </div>
              </div>

              <div style={{ padding: '14px 16px', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)', borderRadius: 10, marginBottom: 24, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <AlertCircle size={16} color="#fbbf24" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6 }}>
                  Once published, buyers can add your listing to their cart. Funds go into escrow and are released when both parties confirm delivery.
                </p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <button onClick={() => goStep(3)} className="btn btn-secondary btn-md">Back</button>
                <button onClick={publish} disabled={submitting} className="btn btn-primary btn-lg">
                  {submitting ? <><Loader size={16} className="animate-spin" /> Publishing…</> : <><Sparkles size={16} /> Publish Listing</>}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
