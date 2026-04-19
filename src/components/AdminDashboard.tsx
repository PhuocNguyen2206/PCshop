import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Package, ShoppingBag, User as UserIcon, Plus, Edit2, Trash2, X, ChevronDown, DollarSign, TrendingUp, Truck, Cpu, FolderOpen, AlertTriangle, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { format, subDays } from 'date-fns';
import { Product, Category, Order, User } from '../types';
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

const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
};

const CHART_COLORS = ['#4f46e5', '#7c3aed', '#ec4899', '#f59e0b', '#10b981'];

export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'users' | 'categories'>('overview');
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
  const [alerts, setAlerts] = useState<any[]>([]);
  const [realtimeOrders, setRealtimeOrders] = useState<any[]>([]);
  
  const { authHeaders } = useAuth();
  const { toast, confirm } = useToast();
  const sseRef = useRef<EventSource | null>(null);

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
      // Revenue timeseries
      const revRes = await fetch(`/api/admin/revenue?start_date=${start}&end_date=${end}&group_by=day`, { headers });
      if (revRes.ok) setRevenueData(await revRes.json());
      
      // Order funnel
      const funnelRes = await fetch('/api/admin/orders/funnel', { headers });
      if (funnelRes.ok) setFunnelData(await funnelRes.json());
      
      // Top products
      const prodRes = await fetch('/api/admin/top-products?limit=5', { headers });
      if (prodRes.ok) setTopProducts(await prodRes.json());
      
      // Top categories
      const catRes = await fetch('/api/admin/top-categories?limit=5', { headers });
      if (catRes.ok) setTopCategories(await catRes.json());
      
      // Low stock alerts
      const stockRes = await fetch('/api/admin/low-stock?threshold=5', { headers });
      if (stockRes.ok) setLowStockItems(await stockRes.json());
      
      // User metrics
      const userRes = await fetch(`/api/admin/users/metrics?start_date=${start}&end_date=${end}`, { headers });
      if (userRes.ok) setUserMetrics(await userRes.json());
      
      // Alerts (low-stock + traffic spikes)
      const alertRes = await fetch('/api/admin/alerts', { headers });
      if (alertRes.ok) setAlerts(await alertRes.json());
    } catch (err) {
      console.error('Analytics load error:', err);
    }
  };

  // Setup SSE for real-time orders
  const setupSSE = () => {
    if (sseRef.current) sseRef.current.close();
    
    const eventSource = new EventSource('/api/admin/orders/stream');
    
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
      await fetch(`/api/admin/products/${id}`, { method: 'DELETE', headers: authHeaders() });
      setProducts(prev => prev.filter(p => p.id !== id));
      toast.success('Đã xóa sản phẩm');
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
      }
    } catch (err) {
      console.error(err);
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
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
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
          ].map(tab => (
            <motion.button 
              key={tab.key}
              whileHover={{ x: 2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.key as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'}`}
            >
              <tab.icon className="w-4 h-4" /> {tab.label}
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
                  <h3 className="font-bold text-slate-900 mb-4">Doanh thu theo ngày</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={revenueData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                      <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                      <Legend />
                      <Line type="monotone" dataKey="revenue" stroke="#4f46e5" name="Doanh thu (đ)" strokeWidth={2} dot={{ fill: '#4f46e5', r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
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
                        <XAxis dataKey="product_name" stroke="#94a3b8" style={{ fontSize: '11px' }} width={50} />
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
                        <XAxis dataKey="category_name" stroke="#94a3b8" style={{ fontSize: '11px' }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                        <Bar dataKey="total_revenue" fill="#f59e0b" name="Doanh thu (đ)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {userMetrics.length > 0 && (
                  <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <h3 className="font-bold text-slate-900 mb-4">Khách hàng mới hàng ngày</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={userMetrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="date" stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <YAxis stroke="#94a3b8" style={{ fontSize: '12px' }} />
                        <Tooltip contentStyle={{ backgroundColor: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '8px' }} />
                        <Legend />
                        <Line type="monotone" dataKey="new_users" stroke="#ec4899" name="Khách hàng mới" strokeWidth={2} dot={{ fill: '#ec4899', r: 4 }} />
                        <Line type="monotone" dataKey="avg_order_value" stroke="#8b5cf6" name="AOV (đ)" strokeWidth={2} dot={{ fill: '#8b5cf6', r: 4 }} />
                      </LineChart>
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
                            <td className="px-6 py-4 font-medium text-slate-900">{item.product_name}</td>
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

              {/* Alerts Section */}
              {alerts.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <h3 className="font-bold text-slate-900">Cảnh báo</h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.map((alert, idx) => (
                      <div key={idx} className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                        {alert.message}
                      </div>
                    ))}
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
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              className={`text-xs font-semibold border rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 transition-all ${STATUS_STYLES[order.status]?.bg || ''} ${STATUS_STYLES[order.status]?.text || ''}`}
                            >
                              <option value="pending">Chờ xử lý</option>
                              <option value="processing">Đang xử lý</option>
                              <option value="shipped">Đang giao</option>
                              <option value="delivered">Đã giao</option>
                              <option value="cancelled">Đã hủy</option>
                            </select>
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
                      <th className="px-6 py-4">Sản phẩm</th>
                      <th className="px-6 py-4">Danh mục</th>
                      <th className="px-6 py-4">Giá</th>
                      <th className="px-6 py-4">Kho</th>
                      <th className="px-6 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {products.map(product => (
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
                      <th className="px-3 py-3 whitespace-nowrap">Mã đơn</th>
                      <th className="px-3 py-3 whitespace-nowrap">Khách hàng</th>
                      <th className="px-3 py-3 whitespace-nowrap">Ngày đặt</th>
                      <th className="px-3 py-3 whitespace-nowrap text-right">Tổng tiền</th>
                      <th className="px-3 py-3 whitespace-nowrap">TT</th>
                      <th className="px-3 py-3 whitespace-nowrap">Vận đơn</th>
                      <th className="px-3 py-3 whitespace-nowrap">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
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
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                            className={`text-xs font-semibold border rounded px-2 py-1 cursor-pointer focus:outline-none focus:ring-1 transition-all ${STATUS_STYLES[order.status]?.bg || ''} ${STATUS_STYLES[order.status]?.text || ''}`}
                          >
                            <option value="pending">Chờ xử lý</option>
                            <option value="processing">Đang xử lý</option>
                            <option value="shipped">Đang giao</option>
                            <option value="delivered">Đã giao</option>
                            <option value="cancelled">Đã hủy</option>
                          </select>
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
                        onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Giá (đ)</label>
                      <input 
                        type="number"
                        value={editingProduct.price}
                        onChange={e => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-2">Tồn kho</label>
                      <input 
                        type="number"
                        value={editingProduct.stock}
                        onChange={e => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value) })}
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
                        endpoint="/api/admin/upload-product-image"
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
                        onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })}
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
