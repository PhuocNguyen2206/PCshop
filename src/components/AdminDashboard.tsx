import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Package, ShoppingBag, User as UserIcon, Plus, Edit2, Trash2, X, ChevronDown, ChevronUp, DollarSign, Cpu, FolderOpen, AlertTriangle, ArrowUpDown, Check, MessageCircle, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { format, subDays } from 'date-fns';
import { Product, Category, Order, User, Conversation, Message } from '../types';
import { useAuth } from '../AuthContext';
import { useToast } from './Toast';
import { ImageUpload } from './ImageUpload';

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  pending:    { bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   dot: 'bg-amber-400'   },
  processing: { bg: 'bg-blue-50 border-blue-200',       text: 'text-blue-700',    dot: 'bg-blue-400'    },
  shipped:    { bg: 'bg-violet-50 border-violet-200',   text: 'text-violet-700',  dot: 'bg-violet-400'  },
  delivered:  { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  cancelled:  { bg: 'bg-red-50 border-red-200',         text: 'text-red-700',     dot: 'bg-red-400'     },
};

const STATUS_LABELS: Record<string, string> = {
  pending:    'Chờ xử lý',
  processing: 'Đang xử lý',
  shipped:    'Đang giao',
  delivered:  'Đã giao',
  cancelled:  'Đã hủy',
};

const CHART_COLORS = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981'];

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const OrderStatusDropdown = ({ status, onChange }: { status: string; onChange: (s: string) => void }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const transitions = ALLOWED_TRANSITIONS[status] || [];

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => transitions.length > 0 && setOpen(!open)}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${s.bg} ${s.text} ${transitions.length > 0 ? 'cursor-pointer hover:shadow-sm' : 'cursor-default opacity-80'}`}
      >
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {STATUS_LABELS[status] || status}
        {transitions.length > 0 && <ChevronDown className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`} />}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-40 bg-white border border-slate-200 rounded-xl shadow-xl shadow-slate-200/50 py-1 z-50 overflow-hidden"
          >
            {transitions.map((t) => {
              const ts = STATUS_STYLES[t] || STATUS_STYLES.pending;
              return (
                <button
                  key={t}
                  onClick={() => { onChange(t); setOpen(false); }}
                  className="w-full px-3 py-2 text-left text-xs font-medium flex items-center gap-2 hover:bg-slate-50 transition-colors"
                >
                  <span className={`w-2 h-2 rounded-full ${ts.dot}`} />
                  <span className={ts.text}>{STATUS_LABELS[t]}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

type SortDir = 'asc' | 'desc';
type SortConfig = { key: string; dir: SortDir };

const SortHeader = ({ label, sortKey, sort, onSort, className = '' }: { label: string; sortKey: string; sort: SortConfig; onSort: (key: string) => void; className?: string }) => (
  <th
    className={`px-6 py-4 cursor-pointer select-none hover:text-slate-700 transition-colors group whitespace-nowrap ${className}`}
    onClick={() => onSort(sortKey)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sort.key === sortKey ? (
        sort.dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
      ) : (
        <ArrowUpDown className="w-3 h-3 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </span>
  </th>
);

const SortHeaderSm = ({ label, sortKey, sort, onSort, className = '' }: { label: string; sortKey: string; sort: SortConfig; onSort: (key: string) => void; className?: string }) => (
  <th
    className={`px-3 py-3 whitespace-nowrap cursor-pointer select-none hover:text-slate-700 transition-colors group ${className}`}
    onClick={() => onSort(sortKey)}
  >
    <span className="inline-flex items-center gap-1">
      {label}
      {sort.key === sortKey ? (
        sort.dir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
      ) : (
        <ArrowUpDown className="w-2.5 h-2.5 opacity-0 group-hover:opacity-40 transition-opacity" />
      )}
    </span>
  </th>
);

export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'users' | 'categories' | 'chat'>('overview');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  
  // Analytics state
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom'>('month');
  const [customStartDate, setCustomStartDate] = useState<string>(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [customEndDate, setCustomEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [funnelData, setFunnelData] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topCategories, setTopCategories] = useState<any[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [userMetrics, setUserMetrics] = useState<any[]>([]);
  const [realtimeOrders, setRealtimeOrders] = useState<any[]>([]);
  const [productSort, setProductSort] = useState<SortConfig>({ key: 'name', dir: 'asc' });
  const [orderSort, setOrderSort] = useState<SortConfig>({ key: 'created_at', dir: 'desc' });
  
  const { authHeaders } = useAuth();
  const { toast, confirm } = useToast();
  const sseRef = useRef<EventSource | null>(null);

  // Chat state
  const [chatConversations, setChatConversations] = useState<Conversation[]>([]);
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null);
  const [chatMessages, setChatMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const chatPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chatPollErrorCount = useRef(0);

  const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortConfig>>) => (key: string) => {
    setter(prev => prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' });
  };

  const sortedProducts = [...products].sort((a, b) => {
    const dir = productSort.dir === 'asc' ? 1 : -1;
    switch (productSort.key) {
      case 'name': return dir * a.name.localeCompare(b.name, 'vi');
      case 'category': return dir * (a.category_name || '').localeCompare(b.category_name || '', 'vi');
      case 'price': return dir * (a.price - b.price);
      case 'stock': return dir * (a.stock - b.stock);
      default: return 0;
    }
  });

  const sortedOrders = [...orders].sort((a, b) => {
    const dir = orderSort.dir === 'asc' ? 1 : -1;
    switch (orderSort.key) {
      case 'id': return dir * (a.id - b.id);
      case 'customer': return dir * (a.customer_name || '').localeCompare(b.customer_name || '', 'vi');
      case 'created_at': return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      case 'total': return dir * (a.total_amount - b.total_amount);
      case 'payment': return dir * (a.payment_status || '').localeCompare(b.payment_status || '');
      case 'status': return dir * (a.status || '').localeCompare(b.status || '');
      default: return 0;
    }
  });

  // Helper: Calculate start/end dates based on time range
  const getDateRange = () => {
    const today = new Date();
    let start, end = format(today, 'yyyy-MM-dd');
    
    switch(timeRange) {
      case 'today':
        start = end;
        break;
      case 'week':
        start = format(subDays(today, 7), 'yyyy-MM-dd');
        break;
      case 'month':
        start = format(subDays(today, 30), 'yyyy-MM-dd');
        break;
      case 'quarter':
        start = format(subDays(today, 90), 'yyyy-MM-dd');
        break;
      case 'year':
        start = format(subDays(today, 365), 'yyyy-MM-dd');
        break;
      case 'custom':
        start = customStartDate;
        end = customEndDate;
        break;
    }
    return { start, end };
  };

  // Load all analytics data
  const loadAnalyticsData = async (headers: any) => {
    const { start, end } = getDateRange();
    
    try {
      // Stats (main numbers)
      const statsRes = await fetch('/api/admin/stats', { headers });
      if (statsRes.ok) setStats(await statsRes.json());
      else console.error('Stats error:', statsRes.status, await statsRes.text());

      // Revenue timeseries
      const revRes = await fetch(`/api/admin/revenue?start_date=${start}&end_date=${end}&group_by=day`, { headers });
      if (revRes.ok) setRevenueData(await revRes.json());
      else console.error('Revenue error:', revRes.status, await revRes.text());
      
      // Order funnel (API returns {pending: 0, ...} object, convert to array)
      const funnelRes = await fetch('/api/admin/orders/funnel', { headers });
      if (funnelRes.ok) {
        const funnelObj = await funnelRes.json();
        const funnelArr = Object.entries(funnelObj).map(([status, count]) => ({ status: STATUS_LABELS[status] || status, count }));
        setFunnelData(funnelArr);
      } else console.error('Funnel error:', funnelRes.status, await funnelRes.text());
      
      // Top products
      const prodRes = await fetch('/api/admin/top-products?limit=5', { headers });
      if (prodRes.ok) setTopProducts(await prodRes.json());
      else console.error('Top products error:', prodRes.status, await prodRes.text());
      
      // Top categories
      const catRes = await fetch('/api/admin/top-categories?limit=5', { headers });
      if (catRes.ok) setTopCategories(await catRes.json());
      else console.error('Top categories error:', catRes.status, await catRes.text());
      
      // Low stock alerts
      const stockRes = await fetch('/api/admin/low-stock?threshold=5', { headers });
      if (stockRes.ok) setLowStockItems(await stockRes.json());
      else console.error('Low stock error:', stockRes.status, await stockRes.text());
      
      // User metrics (API returns {newUsers: [...], aov: ...})
      const userRes = await fetch(`/api/admin/users/metrics?start_date=${start}&end_date=${end}`, { headers });
      if (userRes.ok) {
        const userMetricsData = await userRes.json();
        setUserMetrics(userMetricsData.newUsers || []);
      } else console.error('User metrics error:', userRes.status, await userRes.text());
      
    } catch (err) {
      console.error('Analytics load error:', err);
    }
  };

  // Setup SSE for real-time orders
  const setupSSE = () => {
    if (sseRef.current) sseRef.current.close();
    
    const authHeader = authHeaders().Authorization;
    const token = authHeader?.replace(/^Bearer\s+/, '');
    if (!token) {
      console.warn('Admin SSE skipped because no auth token is available');
      return;
    }

    const eventSource = new EventSource(`/api/admin/orders/stream?token=${encodeURIComponent(token)}`);
    
    eventSource.addEventListener('new_order', (e) => {
      try {
        const order = JSON.parse(e.data);
        setRealtimeOrders(prev => [order, ...prev.slice(0, 9)]);
        toast.success(`🔔 Đơn hàng mới: ${order.customer_name}`);
      } catch (err) {
        console.error('SSE parse error:', err);
      }
    });
    
    eventSource.addEventListener('error', () => {
      eventSource.close();
    });
    
    sseRef.current = eventSource;
  };

  useEffect(() => {
    const headers = authHeaders();
    fetch('/api/admin/stats', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setStats).catch(() => toast.error('Không tải được thống kê'));
    fetch('/api/admin/orders', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setOrders).catch(() => toast.error('Không tải được đơn hàng'));
    fetch('/api/products?limit=1000').then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(r => setProducts(r.data || r)).catch(() => toast.error('Không tải được sản phẩm'));
    fetch('/api/categories').then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setCategories).catch(() => toast.error('Không tải được danh mục'));
    fetch('/api/admin/users', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setUsers).catch(() => toast.error('Không tải được người dùng'));
    
    // Load analytics
    loadAnalyticsData(headers);
    
    // Setup SSE for real-time orders
    setupSSE();
    
    return () => {
      if (sseRef.current) sseRef.current.close();
    };
  }, []);

  // Auto-refresh khi time range thay đổi
  useEffect(() => {
    const headers = authHeaders();
    loadAnalyticsData(headers);
  }, [timeRange, customStartDate, customEndDate]);

  const handleDeleteProduct = async (id: number) => {
    const ok = await confirm({ title: 'Xóa sản phẩm', message: 'Bạn có chắc chắn muốn xóa sản phẩm này?', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      const res = await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setProducts(prev => prev.filter(p => p.id !== id));
        toast.success('Đã xóa sản phẩm');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Không thể xóa sản phẩm');
      }
    }
  };

  const handleDeleteUser = async (id: number) => {
    const ok = await confirm({ title: 'Xóa người dùng', message: 'Bạn có chắc chắn muốn xóa người dùng này?', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setUsers(prev => prev.filter(u => u.id !== id));
        toast.success('Đã xóa người dùng');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Không thể xóa người dùng');
      }
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    const isNew = !editingProduct.id;
    const url = isNew ? '/api/admin/products' : `/api/admin/products/${editingProduct.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editingProduct)
      });
      if (res.ok) {
        if (isNew) {
          const data = await res.json();
          const newProduct = { ...editingProduct, id: data.id, category_name: categories.find(c => c.id === editingProduct.category_id)?.name || '' };
          setProducts(prev => [...prev, newProduct]);
        } else {
          setProducts(prev => prev.map(p => p.id === editingProduct.id ? { ...editingProduct, category_name: categories.find(c => c.id === editingProduct.category_id)?.name || '' } : p));
        }
        setEditingProduct(null);
        toast.success(isNew ? 'Thêm sản phẩm thành công!' : 'Cập nhật sản phẩm thành công!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (res.ok) {
        // Refresh orders from server to ensure we have latest data
        const ordersRes = await fetch('/api/admin/orders', { headers: authHeaders() });
        if (ordersRes.ok) {
          const freshOrders = await ordersRes.json();
          setOrders(freshOrders);
        } else {
          // Fallback to local update
          setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
        }
        // Refetch analytics to update revenue, stats, and charts
        loadAnalyticsData(authHeaders());
        toast.success(`Cập nhật trạng thái thành ${STATUS_LABELS[newStatus]}`);
      } else {
        toast.error(data.error || 'Cập nhật thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    const isNew = !editingCategory.id;
    const url = isNew ? '/api/admin/categories' : `/api/admin/categories/${editingCategory.id}`;
    const method = isNew ? 'POST' : 'PUT';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(editingCategory)
      });
      if (res.ok) {
        if (isNew) {
          const data = await res.json();
          setCategories(prev => [...prev, { ...editingCategory, id: data.id }]);
        } else {
          setCategories(prev => prev.map(c => c.id === editingCategory.id ? editingCategory : c));
        }
        setEditingCategory(null);
        toast.success(isNew ? 'Thêm danh mục thành công!' : 'Cập nhật danh mục thành công!');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleDeleteCategory = async (id: number) => {
    const ok = await confirm({ title: 'Xóa danh mục', message: 'Bạn có chắc chắn muốn xóa danh mục này? Chỉ xóa được nếu danh mục không chứa sản phẩm nào.', type: 'danger', confirmText: 'Xóa' });
    if (ok) {
      const res = await fetch(`/api/admin/categories/${id}`, { method: 'DELETE', headers: authHeaders() });
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== id));
        toast.success('Đã xóa danh mục');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Không thể xóa danh mục');
      }
    }
  };

  // ============ CHAT FUNCTIONS ============
  const loadChatConversations = async () => {
    try {
      const res = await fetch('/api/chat/conversations', { headers: authHeaders() });
      if (res.ok) setChatConversations(await res.json());
    } catch {
      // Silently ignore — server may be restarting
    }
  };

  const loadChatMessages = async (convId: number) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/messages`, { headers: authHeaders() });
      if (res.ok) {
        chatPollErrorCount.current = 0;
        setChatMessages(await res.json());
        loadChatConversations();
      }
    } catch {
      chatPollErrorCount.current += 1;
      if (chatPollErrorCount.current >= 3 && chatPollRef.current) {
        clearInterval(chatPollRef.current);
        chatPollRef.current = null;
      }
    }
  };

  const handleSelectConv = (conv: Conversation) => {
    setSelectedConv(conv);
    loadChatMessages(conv.id);
    // Clear existing poll and start new one
    if (chatPollRef.current) clearInterval(chatPollRef.current);
    chatPollErrorCount.current = 0;
    chatPollRef.current = setInterval(() => loadChatMessages(conv.id), 3000);
    setTimeout(() => chatInputRef.current?.focus(), 100);
  };

  const handleSendChatMessage = async () => {
    if (!chatInput.trim() || !selectedConv || chatSending) return;
    const content = chatInput.trim();
    setChatInput('');
    setChatSending(true);
    try {
      const res = await fetch(`/api/chat/conversations/${selectedConv.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setChatMessages(prev => [...prev, newMsg]);
        setTimeout(() => { const el = chatMessagesContainerRef.current; if (el) el.scrollTop = el.scrollHeight; }, 50);
      }
    } catch (e) {
      console.error('Failed to send message:', e);
    } finally {
      setChatSending(false);
      chatInputRef.current?.focus();
    }
  };

  const handleCloseConv = async (convId: number) => {
    try {
      const res = await fetch(`/api/chat/conversations/${convId}/close`, {
        method: 'PUT',
        headers: authHeaders(),
      });
      if (res.ok) {
        toast.success('Đã đóng cuộc hội thoại');
        loadChatConversations();
        if (selectedConv?.id === convId) {
          setSelectedConv(null);
          setChatMessages([]);
          if (chatPollRef.current) clearInterval(chatPollRef.current);
        }
      }
    } catch (e) {
      toast.error('Lỗi đóng cuộc hội thoại');
    }
  };

  // Load conversations when switching to chat tab
  useEffect(() => {
    if (activeTab === 'chat') {
      loadChatConversations();
      const interval = setInterval(loadChatConversations, 5000);
      return () => clearInterval(interval);
    } else {
      // Clean up chat poll when leaving chat tab
      if (chatPollRef.current) clearInterval(chatPollRef.current);
    }
  }, [activeTab]);

  // Auto-scroll chat messages
  useEffect(() => {
    const el = chatMessagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages]);

  const chatFormatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  const chatFormatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hôm nay';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Hôm qua';
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  };

  const totalChatUnread = chatConversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Admin Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-black text-slate-900">Bảng điều khiển</h1>
          <p className="text-xs text-slate-400">Quản lý cửa hàng PC MASTER</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar */}
        <div className="w-full md:w-64 space-y-1.5">
          {[
            { key: 'overview', icon: LayoutDashboard, label: 'Tổng quan' },
            { key: 'products', icon: Package, label: 'Sản phẩm' },
            { key: 'categories', icon: FolderOpen, label: 'Danh mục' },
            { key: 'orders', icon: ShoppingBag, label: 'Đơn hàng' },
            { key: 'users', icon: UserIcon, label: 'Khách hàng' },
            { key: 'chat', icon: MessageCircle, label: 'Tin nhắn', badge: totalChatUnread },
          ].map(tab => (
            <motion.button 
              key={tab.key}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.key as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
              {'badge' in tab && (tab as any).badge > 0 && (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-red-100 text-red-600'}`}>
                  {(tab as any).badge > 99 ? '99+' : (tab as any).badge}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-[70vh]">
          {activeTab === 'overview' && stats && (
            <div className="space-y-6">
              {/* Time Range Filter */}
              <div className="flex flex-wrap items-center gap-2 bg-white p-4 rounded-xl border border-slate-200">
                {['today', 'week', 'month', 'quarter', 'year'].map(range => (
                  <button
                    key={range}
                    onClick={() => setTimeRange(range as any)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${timeRange === range ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                  >
                    {range === 'today' ? 'Hôm nay' : range === 'week' ? '7 ngày' : range === 'month' ? '30 ngày' : range === 'quarter' ? 'Quý' : 'Năm'}
                  </button>
                ))}
                <button
                  onClick={() => setTimeRange('custom')}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${timeRange === 'custom' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                >
                  Tùy chỉnh
                </button>
                
                {timeRange === 'custom' && (
                  <div className="flex gap-2 ml-2">
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
                    />
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="px-2 py-1 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0 }}
                  className="stat-card-revenue p-6 rounded-2xl relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 w-10 h-10 bg-indigo-200/50 rounded-xl flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-xs font-bold text-indigo-500/70 uppercase tracking-wider mb-2">Doanh thu</p>
                  <p className="text-2xl font-black text-indigo-900">{stats.totalRevenue.toLocaleString('vi-VN')}đ</p>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.07 }}
                  className="stat-card-orders p-6 rounded-2xl relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 w-10 h-10 bg-emerald-200/50 rounded-xl flex items-center justify-center">
                    <ShoppingBag className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-xs font-bold text-emerald-600/70 uppercase tracking-wider mb-2">Đơn hàng</p>
                  <p className="text-2xl font-black text-emerald-900">{stats.totalOrders}</p>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.14 }}
                  className="stat-card-products p-6 rounded-2xl relative overflow-hidden"
                >
                  <div className="absolute top-4 right-4 w-10 h-10 bg-amber-200/50 rounded-xl flex items-center justify-center">
                    <Package className="w-5 h-5 text-amber-600" />
                  </div>
                  <p className="text-xs font-bold text-amber-600/70 uppercase tracking-wider mb-2">Sản phẩm</p>
                  <p className="text-2xl font-black text-amber-900">{stats.totalProducts}</p>
                </motion.div>
              </div>

              {/* Revenue Chart */}
              {revenueData.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h3 className="font-bold text-slate-900 text-lg">Doanh thu theo ngày</h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Tổng: {revenueData.reduce((s, d) => s + Number(d.revenue || 0), 0).toLocaleString('vi-VN')}đ
                        &nbsp;·&nbsp; {revenueData.reduce((s, d) => s + Number(d.orders || 0), 0)} đơn hàng
                      </p>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={revenueData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <defs>
                        <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="ordersGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="period"
                        stroke="#cbd5e1"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => {
                          const d = new Date(v);
                          return isNaN(d.getTime()) ? v : `${d.getDate()}/${d.getMonth() + 1}`;
                        }}
                      />
                      <YAxis
                        stroke="#cbd5e1"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        yAxisId="revenue"
                        orientation="left"
                        tickFormatter={(v) => v >= 1_000_000 ? `${(v / 1_000_000).toFixed(0)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v}
                      />
                      <YAxis
                        yAxisId="orders"
                        orientation="right"
                        stroke="#cbd5e1"
                        tick={{ fill: '#94a3b8', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                        labelStyle={{ color: '#475569', fontWeight: 600, marginBottom: 6 }}
                        labelFormatter={(v) => {
                          const d = new Date(v);
                          return isNaN(d.getTime()) ? v : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        }}
                        formatter={(value: any, name: any) => {
                          if (name === 'Doanh thu') return [value.toLocaleString('vi-VN') + 'đ', name];
                          return [value, name];
                        }}
                      />
                      <Legend
                        wrapperStyle={{ paddingTop: 16, fontSize: 12 }}
                        formatter={(value) => <span style={{ color: '#64748b' }}>{value}</span>}
                      />
                      <Area yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#4f46e5" strokeWidth={2.5} fill="url(#revenueGradient)" name="Doanh thu" dot={false} activeDot={{ r: 5, fill: '#4f46e5', strokeWidth: 2, stroke: '#fff' }} />
                      <Area yAxisId="orders" type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} fill="url(#ordersGradient)" name="Đơn hàng" dot={false} activeDot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#fff' }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Charts Row: Funnel & Top Products */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Order Funnel */}
                {funnelData.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Quy trình đơn hàng</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={funnelData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="status" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                        <Bar dataKey="count" fill="#4f46e5" name="Số đơn">
                          {funnelData.map((_, idx) => (
                            <Cell key={`cell-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Top Products */}
                {topProducts.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Sản phẩm bán chạy nhất</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topProducts}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} width={50} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                        <Bar dataKey="units_sold" fill="#10b981" name="Bán được (cái)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Top Categories & User Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {topCategories.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Danh mục hàng đầu</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={topCategories}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="name" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                        <Bar dataKey="revenue" fill="#f59e0b" name="Doanh thu (đ)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {userMetrics.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-slate-900">Khách hàng mới</h3>
                        <p className="text-sm text-slate-500 mt-0.5">
                          Tổng: <span className="font-semibold text-pink-600">{userMetrics.reduce((s, d) => s + Number(d.count || 0), 0)}</span> khách hàng mới
                        </p>
                      </div>
                      <div className="w-10 h-10 bg-pink-100 rounded-xl flex items-center justify-center">
                        <UserIcon className="w-5 h-5 text-pink-600" />
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={userMetrics} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                        <defs>
                          <linearGradient id="userGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis
                          dataKey="date"
                          stroke="#cbd5e1"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => {
                            const d = new Date(v);
                            return isNaN(d.getTime()) ? v : `${d.getDate()}/${d.getMonth() + 1}`;
                          }}
                        />
                        <YAxis
                          stroke="#cbd5e1"
                          tick={{ fill: '#94a3b8', fontSize: 11 }}
                          tickLine={false}
                          axisLine={false}
                          allowDecimals={false}
                        />
                        <Tooltip
                          contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '12px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', padding: '10px 14px' }}
                          labelStyle={{ color: '#475569', fontWeight: 600, marginBottom: 6 }}
                          labelFormatter={(v) => {
                            const d = new Date(v);
                            return isNaN(d.getTime()) ? v : d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
                          }}
                          formatter={(value: any) => [`${value} khách hàng`, 'Đăng ký mới']}
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#ec4899"
                          strokeWidth={2.5}
                          fill="url(#userGradient)"
                          name="Khách hàng mới"
                          dot={{ fill: '#ec4899', r: 3, strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6, fill: '#ec4899', strokeWidth: 2, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Low Stock Alerts */}
              {lowStockItems.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                    <h3 className="font-bold text-slate-900">Sản phẩm tồn kho thấp</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                          <th className="px-6 py-4">Sản phẩm</th>
                          <th className="px-6 py-4">Tồn kho</th>
                          <th className="px-6 py-4">Cảnh báo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lowStockItems.slice(0, 10).map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="px-6 py-4 font-medium text-slate-900">{item.name}</td>
                            <td className="px-6 py-4 text-slate-500">{item.stock} cái</td>
                            <td className="px-6 py-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-bold ${item.stock <= 2 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                {item.stock <= 2 ? 'Cực thấp' : 'Thấp'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}



              {/* Real-time Orders */}
              {realtimeOrders.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="p-6 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900">🔔 Đơn hàng thời gian thực</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-500 font-medium">
                        <tr>
                          <th className="px-6 py-4">Mã đơn</th>
                          <th className="px-6 py-4">Khách hàng</th>
                          <th className="px-6 py-4">Tổng tiền</th>
                          <th className="px-6 py-4">Thời gian</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {realtimeOrders.map(order => (
                          <tr key={order.id} className="hover:bg-slate-50 animate-pulse">
                            <td className="px-6 py-4 font-mono text-xs">#ORD-{order.id}</td>
                            <td className="px-6 py-4 font-medium text-slate-900">{order.customer_name}</td>
                            <td className="px-6 py-4 font-semibold text-slate-900">{order.total_amount.toLocaleString('vi-VN')}đ</td>
                            <td className="px-6 py-4 text-slate-500 text-xs">{new Date(order.created_at).toLocaleTimeString('vi-VN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">Đơn hàng gần đây</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-3 py-3 whitespace-nowrap">Mã đơn</th>
                        <th className="px-3 py-3 whitespace-nowrap">Khách hàng</th>
                        <th className="px-3 py-3 whitespace-nowrap text-right">Tổng tiền</th>
                        <th className="px-3 py-3 whitespace-nowrap">TT</th>
                        <th className="px-3 py-3 whitespace-nowrap">Vận đơn</th>
                        <th className="px-3 py-3 whitespace-nowrap">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-3 font-mono text-slate-500">#ORD-{order.id}</td>
                          <td className="px-3 py-3">
                            <div className="font-medium text-slate-900 text-xs">{order.customer_name}</div>
                            <div className="text-xs text-slate-500">{order.customer_email}</div>
                          </td>
                          <td className="px-3 py-3 font-semibold text-slate-900 text-right whitespace-nowrap">{(order.total_amount / 1000000).toFixed(1)}M</td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                              order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                            }`}>
                              {order.payment_status === 'paid' ? '✓' : '✕'}
                            </span>
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            {order.tracking_code ? (
                              <div>
                                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{order.tracking_code}</span>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3 whitespace-nowrap">
                            <OrderStatusDropdown status={order.status} onChange={(s) => handleUpdateOrderStatus(order.id, s)} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Danh sách sản phẩm</h3>
                <button 
                  onClick={() => setEditingProduct({ id: 0, name: '', slug: '', description: '', price: 0, stock: 0, image_url: 'https://picsum.photos/seed/pc/400/400', category_id: categories[0]?.id || 1, category_name: '' })}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Thêm mới
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <SortHeader label="Sản phẩm" sortKey="name" sort={productSort} onSort={toggleSort(setProductSort)} />
                      <SortHeader label="Danh mục" sortKey="category" sort={productSort} onSort={toggleSort(setProductSort)} />
                      <SortHeader label="Giá" sortKey="price" sort={productSort} onSort={toggleSort(setProductSort)} />
                      <SortHeader label="Kho" sortKey="stock" sort={productSort} onSort={toggleSort(setProductSort)} />
                      <th className="px-6 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedProducts.map(product => (
                      <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-slate-50" referrerPolicy="no-referrer" />
                            <div className="font-medium text-slate-900">{product.name}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{product.category_name}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{product.price.toLocaleString('vi-VN')}đ</td>
                        <td className="px-6 py-4 text-slate-500">{product.stock}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingProduct(product)}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Tất cả đơn hàng</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <SortHeaderSm label="Mã đơn" sortKey="id" sort={orderSort} onSort={toggleSort(setOrderSort)} />
                      <SortHeaderSm label="Khách hàng" sortKey="customer" sort={orderSort} onSort={toggleSort(setOrderSort)} />
                      <SortHeaderSm label="Ngày đặt" sortKey="created_at" sort={orderSort} onSort={toggleSort(setOrderSort)} />
                      <SortHeaderSm label="Tổng tiền" sortKey="total" sort={orderSort} onSort={toggleSort(setOrderSort)} className="text-right" />
                      <SortHeaderSm label="TT" sortKey="payment" sort={orderSort} onSort={toggleSort(setOrderSort)} />
                      <th className="px-3 py-3 whitespace-nowrap">Vận đơn</th>
                      <SortHeaderSm label="Trạng thái" sortKey="status" sort={orderSort} onSort={toggleSort(setOrderSort)} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedOrders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-3 py-3 font-mono text-slate-500 whitespace-nowrap">#ORD-{order.id}</td>
                        <td className="px-3 py-3">
                          <div className="font-medium text-slate-900">{order.customer_name}</div>
                          <div className="text-xs text-slate-500">{order.customer_email}</div>
                        </td>
                        <td className="px-3 py-3 text-slate-500 whitespace-nowrap">{new Date(order.created_at).toLocaleDateString('vi-VN')}</td>
                        <td className="px-3 py-3 font-semibold text-slate-900 text-right whitespace-nowrap">{(order.total_amount / 1000000).toFixed(1)}M</td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                            order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {order.payment_status === 'paid' ? '✓' : '✕'}
                          </span>
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          {order.tracking_code ? (
                            <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{order.tracking_code}</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap">
                          <OrderStatusDropdown status={order.status} onChange={(s) => handleUpdateOrderStatus(order.id, s)} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'users' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h3 className="font-bold text-slate-900">Danh sách khách hàng</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Khách hàng</th>
                      <th className="px-6 py-4">Vai trò</th>
                      <th className="px-6 py-4">Ngày tham gia</th>
                      <th className="px-6 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {users.map(user => (
                      <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{user.name}</div>
                          <div className="text-xs text-slate-500">{user.email}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-700'}`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-slate-500">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('vi-VN') : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleDeleteUser(user.id)}
                            disabled={user.role === 'admin'}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">Quản lý danh mục</h3>
                <button 
                  onClick={() => setEditingCategory({ id: 0, name: '', slug: '' })}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" /> Thêm danh mục
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Danh mục</th>
                      <th className="px-6 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map(category => (
                      <tr key={category.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-slate-900">{category.name}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setEditingCategory(category)}
                              className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => handleDeleteCategory(category.id)}
                              className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============ CHAT TAB ============ */}
          {activeTab === 'chat' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden" style={{ height: '70vh' }}>
              <div className="flex h-full">
                {/* Conversation list */}
                <div className="w-80 border-r border-slate-100 flex flex-col shrink-0">
                  <div className="p-4 border-b border-slate-100">
                    <h3 className="font-bold text-slate-900 flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-indigo-600" />
                      Tin nhắn
                      {totalChatUnread > 0 && (
                        <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{totalChatUnread}</span>
                      )}
                    </h3>
                  </div>
                  <div className="flex-1 overflow-y-auto">
                    {chatConversations.length === 0 && (
                      <div className="p-6 text-center text-slate-400 text-sm">Chưa có cuộc hội thoại nào</div>
                    )}
                    {chatConversations.map(conv => (
                      <button
                        key={conv.id}
                        onClick={() => handleSelectConv(conv)}
                        className={`w-full px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 ${selectedConv?.id === conv.id ? 'bg-indigo-50 border-l-2 border-l-indigo-600' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs shrink-0 overflow-hidden">
                            {conv.user_avatar
                              ? <img src={conv.user_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                              : (conv.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-semibold text-slate-800 truncate">{conv.user_name || `User #${conv.user_id}`}</span>
                              {conv.last_message_at && (
                                <span className="text-[10px] text-slate-400 shrink-0 ml-2">{chatFormatDate(conv.last_message_at)}</span>
                              )}
                            </div>
                            <div className="flex items-center justify-between mt-0.5">
                              <p className="text-xs text-slate-500 truncate">{conv.last_message || 'Chưa có tin nhắn'}</p>
                              {(conv.unread_count || 0) > 0 && (
                                <span className="w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shrink-0 ml-2">
                                  {conv.unread_count! > 9 ? '9+' : conv.unread_count}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {conv.status === 'closed' && (
                          <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">Đã đóng</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex-1 flex flex-col min-w-0">
                  {!selectedConv ? (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                      <div className="text-center">
                        <MessageCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                        <p className="text-sm">Chọn cuộc hội thoại để bắt đầu</p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Chat header */}
                      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white font-bold text-xs overflow-hidden">
                            {selectedConv.user_avatar
                              ? <img src={selectedConv.user_avatar} alt="" className="w-full h-full object-cover rounded-full" />
                              : (selectedConv.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <span className="text-sm font-semibold text-slate-800">{selectedConv.user_name || `User #${selectedConv.user_id}`}</span>
                            <p className="text-[10px] text-slate-400">{selectedConv.user_email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {selectedConv.status === 'open' && (
                            <button
                              onClick={() => handleCloseConv(selectedConv.id)}
                              className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              Đóng hội thoại
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Messages */}
                      <div ref={chatMessagesContainerRef} className="flex-1 overflow-y-auto px-5 py-3 space-y-1 bg-slate-50/50">
                        {chatMessages.length === 0 && (
                          <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                            Chưa có tin nhắn
                          </div>
                        )}
                        {chatMessages.map((msg) => {
                          const isAdmin = msg.sender_role === 'admin';
                          return (
                            <div key={msg.id} className={`flex mb-2 ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                              <div className="max-w-[70%]">
                                <span className={`text-[10px] text-slate-400 font-medium mb-0.5 block ${isAdmin ? 'text-right mr-1' : 'ml-1'}`}>
                                  {msg.sender_name}
                                </span>
                                <div className={`px-3.5 py-2 rounded-2xl text-sm leading-relaxed break-words ${
                                  isAdmin
                                    ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-md'
                                    : 'bg-white text-slate-700 border border-slate-200 rounded-bl-md shadow-sm'
                                }`}>
                                  {msg.content}
                                </div>
                                <span className={`text-[10px] text-slate-400 mt-0.5 block ${isAdmin ? 'text-right mr-1' : 'ml-1'}`}>
                                  {chatFormatTime(msg.created_at)}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Input */}
                      <div className="px-5 py-3 border-t border-slate-100 bg-white shrink-0">
                        <div className="flex items-end gap-2">
                          <textarea
                            ref={chatInputRef}
                            value={chatInput}
                            onChange={(e) => setChatInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendChatMessage(); } }}
                            placeholder="Nhập tin nhắn phản hồi..."
                            rows={1}
                            className="flex-1 resize-none bg-slate-100 rounded-xl px-4 py-2.5 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:bg-white border border-transparent focus:border-indigo-300 transition-all max-h-20"
                            style={{ minHeight: '40px' }}
                          />
                          <button
                            onClick={handleSendChatMessage}
                            disabled={!chatInput.trim() || chatSending}
                            className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-xl flex items-center justify-center hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                          >
                            <Send className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          <AnimatePresence>
            {editingProduct && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setEditingProduct(null)}
              >
                <motion.div 
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900">{editingProduct.id ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                    <button 
                      onClick={() => setEditingProduct(null)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveProduct} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Tên sản phẩm</label>
                      <input 
                        type="text"
                        value={editingProduct.name}
                        onChange={e => {
                          const name = e.target.value;
                          const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                          setEditingProduct({ ...editingProduct, name, slug });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Giá (đ)</label>
                      <input 
                        type="number"
                        value={editingProduct.price}
                        onChange={e => setEditingProduct({ ...editingProduct, price: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Tồn kho</label>
                      <input 
                        type="number"
                        value={editingProduct.stock}
                        onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) || 0 })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Danh mục</label>
                      <select 
                        value={editingProduct.category_id}
                        onChange={e => setEditingProduct({ ...editingProduct, category_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      >
                        {categories.map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Mô tả</label>
                      <textarea 
                        value={editingProduct.description}
                        onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={3}
                      />
                    </div>
                    <div>
                      <ImageUpload 
                        endpoint="/api/upload/product"
                        fieldName="image"
                        currentImage={editingProduct.image_url}
                        onUploadSuccess={url => setEditingProduct({ ...editingProduct, image_url: url })}
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setEditingProduct(null)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                      >
                        Lưu
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}

            {editingCategory && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                onClick={() => setEditingCategory(null)}
              >
                <motion.div 
                  initial={{ scale: 0.95 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0.95 }}
                  onClick={e => e.stopPropagation()}
                  className="bg-white rounded-2xl p-6 max-w-md w-full"
                >
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-slate-900">{editingCategory.id ? 'Sửa danh mục' : 'Thêm danh mục mới'}</h3>
                    <button 
                      onClick={() => setEditingCategory(null)}
                      className="p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  <form onSubmit={handleSaveCategory} className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Tên danh mục</label>
                      <input 
                        type="text"
                        value={editingCategory.name}
                        onChange={e => {
                          const name = e.target.value;
                          const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
                          setEditingCategory({ ...editingCategory, name, slug });
                        }}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => setEditingCategory(null)}
                        className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50"
                      >
                        Hủy
                      </button>
                      <button 
                        type="submit"
                        className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
                      >
                        Lưu
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
