import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, Image, MessageSquare, Search, Loader } from 'lucide-react';
import api from '../utils/api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';

export default function Chat() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();
  const endRef = useRef(null);
  const [rooms, setRooms] = useState([]);
  const [activeId, setActiveId] = useState(searchParams.get('recipient') || null);
  const [activePeer, setActivePeer] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerOnline, setPeerOnline] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreview, setAttachPreview] = useState('');
  const typingTimer = useRef(null);

  const fetchRooms = async () => {
    try { const d = await api.get('/chat/rooms'); if (d.success) setRooms(d.rooms); }
    catch (e) { console.error(e); }
    finally { setLoadingRooms(false); }
  };

  const loadConversation = async (recipientId) => {
    setLoadingMsgs(true);
    try {
      socket?.emit('join_room', { userId: user._id, recipientId });
      const [msgData, profileData] = await Promise.all([
        api.get(`/chat/messages/${recipientId}`),
        api.get(`/auth/profile/${recipientId}`)
      ]);
      if (msgData.success) { setMessages(msgData.messages); setTimeout(() => endRef.current?.scrollIntoView(), 100); }
      if (profileData.success) setActivePeer(profileData.user);
    } catch (err) { showToast(err.message || 'Failed to load chat', 'error'); }
    finally { setLoadingMsgs(false); }
  };

  useEffect(() => {
    if (!socket) return;
    socket.on('receive_msg', msg => {
      if (msg.sender._id === activeId || msg.sender._id === user._id) {
        setMessages(p => [...p, msg]);
        setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth' }), 80);
      }
      fetchRooms();
    });
    socket.on('typing_status', ({ senderId, isTyping }) => { if (senderId === activeId) setPeerTyping(isTyping); });
    socket.on('user_status_change', ({ userId, status }) => {
      if (userId === activeId) setPeerOnline(status === 'online');
      setRooms(p => p.map(r => r.recipient._id === userId ? { ...r, isOnline: status === 'online' } : r));
    });
    fetchRooms();
    return () => {
      socket.off('receive_msg');
      socket.off('typing_status');
      socket.off('user_status_change');
    };
  }, [socket, activeId, user._id]);

  useEffect(() => { if (activeId) loadConversation(activeId); }, [activeId]);

  const handleTyping = (val) => {
    setInputText(val);
    socket?.emit('typing', { senderId: user._id, recipientId: activeId, isTyping: true });
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => socket?.emit('typing', { senderId: user._id, recipientId: activeId, isTyping: false }), 1500);
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !attachFile) return;
    setSending(true);
    let imageUrl = null;
    try {
      if (attachFile) {
        const r = await api.uploadSingle(attachFile);
        if (r.success) { imageUrl = r.url; setAttachFile(null); if (attachPreview) { URL.revokeObjectURL(attachPreview); setAttachPreview(''); } }
      }
      socket?.emit('send_msg', { senderId: user._id, recipientId: activeId, text: inputText.trim(), imageUrl });
      setInputText('');
    } catch (err) { showToast(err.message || 'Send failed', 'error'); }
    finally { setSending(false); }
  };

  const handleAttach = (e) => {
    const f = e.target.files?.[0];
    if (f) { setAttachFile(f); setAttachPreview(URL.createObjectURL(f)); }
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', background: 'transparent' }}>

      {/* ── SIDEBAR ── */}
      <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', background: 'var(--surface)' }}>
        {/* Header */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 16, color: 'var(--text1)', marginBottom: 12 }}>Messages</h2>
          <div className="search-bar" style={{ borderRadius: 10 }}>
            <Search size={14} color="var(--text3)" />
            <input placeholder="Search conversations..." style={{ fontSize: 13 }} />
          </div>
        </div>

        {/* Room list */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingRooms ? (
            <div style={{ padding: 32, textAlign: 'center' }}>
              <Loader size={20} className="animate-spin" style={{ color: 'var(--text3)' }} />
            </div>
          ) : rooms.length > 0 ? rooms.map(room => (
            <div key={room.roomId} onClick={() => setActiveId(room.recipient._id)}
                 style={{
                   display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer',
                   background: activeId === room.recipient._id ? 'rgba(99,102,241,0.08)' : 'transparent',
                   borderLeft: activeId === room.recipient._id ? '3px solid var(--primary)' : '3px solid transparent',
                   transition: 'all 0.15s'
                 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <img src={room.recipient.avatar} alt="" style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)' }} />
                <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: room.isOnline ? 'var(--green)' : 'var(--text3)', border: '2px solid var(--surface)' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, color: activeId === room.recipient._id ? 'var(--primary2)' : 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{room.recipient.name}</p>
                  <span style={{ fontSize: 10, color: 'var(--text3)', flexShrink: 0, marginLeft: 6 }}>{new Date(room.lastMessageTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{room.lastMessageText}</p>
                  {room.unreadCount > 0 && <span style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--primary)', color: 'white', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 6 }}>{room.unreadCount}</span>}
                </div>
              </div>
            </div>
          )) : (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <MessageSquare size={32} color="var(--text3)" style={{ margin: '0 auto 12px', opacity: 0.4 }} />
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* ── CHAT AREA ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {!activeId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
            <div style={{ width: 64, height: 64, borderRadius: 20, background: 'var(--surface2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageSquare size={28} color="var(--text3)" />
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontFamily: 'Plus Jakarta Sans', fontWeight: 700, fontSize: 18, color: 'var(--text1)', marginBottom: 6 }}>Select a Conversation</p>
              <p style={{ fontSize: 14, color: 'var(--text3)' }}>Choose a conversation or start messaging a seller from a book listing</p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
              {activePeer ? (
                <>
                  <div style={{ position: 'relative' }}>
                    <img src={activePeer.avatar} alt="" style={{ width: 40, height: 40, borderRadius: 12, border: '1px solid var(--border)' }} />
                    <span style={{ position: 'absolute', bottom: 1, right: 1, width: 9, height: 9, borderRadius: '50%', background: peerOnline ? 'var(--green)' : 'var(--text3)', border: '2px solid var(--surface)' }} />
                  </div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text1)', fontFamily: 'Plus Jakarta Sans' }}>{activePeer.name}</p>
                    <p style={{ fontSize: 12, color: peerOnline ? 'var(--green)' : 'var(--text3)' }}>
                      {peerTyping ? 'typing...' : peerOnline ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                </>
              ) : <Loader size={16} className="animate-spin" style={{ color: 'var(--text3)' }} />}
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {loadingMsgs ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, gap: 10 }}>
                  <Loader size={18} className="animate-spin" style={{ color: 'var(--text3)' }} />
                  <span style={{ fontSize: 14, color: 'var(--text3)' }}>Loading messages...</span>
                </div>
              ) : messages.length === 0 ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                  <p style={{ fontSize: 14, color: 'var(--text3)' }}>Send a message to start the conversation</p>
                </div>
              ) : messages.map((msg, i) => {
                const isMine = msg.sender._id === user._id;
                return (
                  <div key={i} style={{ display: 'flex', gap: 10, justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end' }}>
                    {!isMine && <img src={msg.sender.avatar} alt="" style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', flexShrink: 0 }} />}
                    <div>
                      {msg.text && <div className={isMine ? 'bubble-mine' : 'bubble-peer'} style={{ maxWidth: 380 }}>{msg.text}</div>}
                      {msg.imageUrl && <img src={msg.imageUrl} alt="Attachment" onClick={() => window.open(msg.imageUrl, '_blank')} style={{ maxWidth: 200, borderRadius: 12, marginTop: msg.text ? 6 : 0, cursor: 'pointer', border: '1px solid var(--border)' }} />}
                      <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, textAlign: isMine ? 'right' : 'left' }}>{new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>

            {/* Attachment preview */}
            {attachPreview && (
              <div style={{ padding: '8px 20px', background: 'var(--surface2)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={attachPreview} alt="Attachment" style={{ width: 40, height: 48, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>Image attached</span>
                <button onClick={() => { setAttachFile(null); URL.revokeObjectURL(attachPreview); setAttachPreview(''); }} className="btn btn-danger btn-sm">Remove</button>
              </div>
            )}

            {/* Input */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid var(--border)', background: 'var(--surface)', display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="file" accept="image/*" id="chat-img" className="hidden" onChange={handleAttach} />
              <button onClick={() => document.getElementById('chat-img').click()} className="btn btn-ghost btn-sm" style={{ padding: '8px 10px', flexShrink: 0 }}>
                <Image size={18} />
              </button>
              <input value={inputText} onChange={e => handleTyping(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                     className="input" placeholder="Type a message..." style={{ flex: 1, borderRadius: 10 }} />
              <button onClick={sendMessage} disabled={sending || (!inputText.trim() && !attachFile)} className="btn btn-primary btn-sm" style={{ padding: '9px 14px', flexShrink: 0 }}>
                {sending ? <Loader size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
