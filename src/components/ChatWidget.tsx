import { useState, useEffect, useRef, useCallback } from 'react';
import { MessageCircle, X, Send, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';
import { Conversation, Message } from '../types';

export const ChatWidget = ({ onAuthOpen }: { onAuthOpen: () => void }) => {
  const { user, isAuthenticated, authHeaders } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  // Handle scroll to detect if user scrolled up
  const handleScroll = () => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const isNearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    setShowScrollBtn(!isNearBottom);
  };

  // Fetch or create conversation
  const initConversation = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/chat/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      if (res.ok) {
        const conv = await res.json();
        setConversation(conv);
      }
    } catch (e) {
      console.error('Failed to init conversation:', e);
    }
  }, [isAuthenticated, authHeaders]);

  // Fetch messages
  const fetchMessages = useCallback(async () => {
    if (!conversation) return;
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
        headers: authHeaders(),
      });
      if (res.ok) {
        const msgs = await res.json();
        setMessages(prev => {
          if (JSON.stringify(prev.map(m => m.id)) !== JSON.stringify(msgs.map((m: Message) => m.id))) {
            return msgs;
          }
          return prev;
        });
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  }, [conversation, authHeaders]);

  // Fetch unread count
  const fetchUnread = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await fetch('/api/chat/unread', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setUnreadCount(data.count);
      }
    } catch { /* ignore */ }
  }, [isAuthenticated, authHeaders]);

  // Init conversation when opened
  useEffect(() => {
    if (isOpen && isAuthenticated && !conversation) {
      initConversation();
    }
  }, [isOpen, isAuthenticated, conversation, initConversation]);

  // Fetch messages when conversation is ready
  useEffect(() => {
    if (isOpen && conversation) {
      fetchMessages();
    }
  }, [isOpen, conversation, fetchMessages]);

  // Poll for new messages when chat is open
  useEffect(() => {
    if (isOpen && conversation) {
      pollRef.current = setInterval(fetchMessages, 3000);
      return () => { if (pollRef.current) clearInterval(pollRef.current); };
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isOpen, conversation, fetchMessages]);

  // Poll unread count when chat is closed
  useEffect(() => {
    if (!isOpen && isAuthenticated) {
      fetchUnread();
      const interval = setInterval(fetchUnread, 10000);
      return () => clearInterval(interval);
    }
  }, [isOpen, isAuthenticated, fetchUnread]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > 0 && !showScrollBtn) {
      scrollToBottom();
    }
  }, [messages, showScrollBtn, scrollToBottom]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  const handleSend = async () => {
    if (!input.trim() || !conversation || sending) return;
    const content = input.trim();
    setInput('');
    setSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${conversation.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setShowScrollBtn(false);
        setTimeout(() => scrollToBottom(), 50);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleOpen = () => {
    if (!isAuthenticated) {
      onAuthOpen();
      return;
    }
    setIsOpen(true);
    setUnreadCount(0);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hôm nay';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  // Group messages by date
  const groupedMessages: { date: string; msgs: Message[] }[] = [];
  let lastDate = '';
  for (const msg of messages) {
    const d = new Date(msg.created_at).toDateString();
    if (d !== lastDate) {
      groupedMessages.push({ date: msg.created_at, msgs: [msg] });
      lastDate = d;
    } else {
      groupedMessages[groupedMessages.length - 1].msgs.push(msg);
    }
  }

  // Don't show for admin users
  if (user?.role === 'admin') return null;

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleOpen}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-600 text-white rounded-full shadow-xl shadow-indigo-500/30 flex items-center justify-center hover:shadow-2xl hover:shadow-indigo-500/40 transition-shadow"
          >
            <MessageCircle className="w-6 h-6" />
            {unreadCount > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </motion.span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-6 right-6 z-50 w-[380px] h-[520px] bg-white rounded-2xl shadow-2xl shadow-slate-300/50 border border-slate-200 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 px-5 py-4 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                  <MessageCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Hỗ trợ trực tuyến</h3>
                  <p className="text-white/70 text-xs">PC Master • Sẵn sàng hỗ trợ</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-1 bg-slate-50/50 relative"
            >
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <div className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center mb-3">
                    <MessageCircle className="w-7 h-7 text-indigo-500" />
                  </div>
                  <p className="text-slate-600 font-medium text-sm">Xin chào {user?.name}!</p>
                  <p className="text-slate-400 text-xs mt-1">Hãy gửi tin nhắn, chúng tôi sẽ phản hồi sớm nhất.</p>
                </div>
              )}

              {groupedMessages.map((group, gi) => (
                <div key={gi}>
                  <div className="flex justify-center my-3">
                    <span className="text-[10px] text-slate-400 bg-white px-3 py-1 rounded-full shadow-sm border border-slate-100">
                      {formatDate(group.date)}
                    </span>
                  </div>
                  {group.msgs.map((msg) => {
                    const isMe = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={`flex mb-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] ${isMe ? 'order-1' : ''}`}>
                          <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                            isMe
                              ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-md'
                              : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                          }`}>
                            {msg.content}
                          </div>
                          <span className={`text-[10px] text-slate-400 mt-0.5 block ${isMe ? 'text-right mr-1' : 'ml-1'}`}>
                            {formatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Scroll to bottom button */}
            <AnimatePresence>
              {showScrollBtn && (
                <motion.button
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 5 }}
                  onClick={() => { scrollToBottom(); setShowScrollBtn(false); }}
                  className="absolute bottom-[72px] left-1/2 -translate-x-1/2 bg-white border border-slate-200 shadow-lg rounded-full px-3 py-1.5 text-xs text-slate-500 flex items-center gap-1 hover:bg-slate-50 transition-colors z-10"
                >
                  <ChevronDown className="w-3 h-3" /> Tin nhắn mới
                </motion.button>
              )}
            </AnimatePresence>

            {/* Input area */}
            <div className="px-4 py-3 border-t border-slate-100 bg-white shrink-0">
              <div className="flex items-end gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập tin nhắn..."
                  rows={1}
                  className="flex-1 resize-none bg-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white border border-transparent focus:border-indigo-300 transition-all max-h-20"
                  style={{ minHeight: '40px' }}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:shadow-none shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
