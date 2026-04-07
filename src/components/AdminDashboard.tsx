import React, { useState, useEffect, useRef } from 'react';
import { LayoutDashboard, Package, ShoppingBag, User as UserIcon, Plus, Edit2, Trash2, X, ChevronDown, DollarSign, TrendingUp, Truck, Check, Ban, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Category, Order, User } from '../types';
import { useAuth } from '../AuthContext';
import { useToast } from './Toast';
import { ImageUpload } from './ImageUpload';

// ── Constants ──────────────────────────────────────────────────────────────
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

// ── StatusBadge (read-only) ─────────────────────────────────────────────
const StatusBadge = ({ status }: { status: string }) => {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {STATUS_LABELS[status] || status}
    </span>
  );
};

// ── OrderActions: Xác nhận / Hủy cho đơn pending ──────────────────────
const OrderActions = ({ order, onConfirm, onCancel }: {
  order: Order;
  onConfirm: (id: number) => void;
  onCancel: (id: number) => void;
}) => {
  if (order.status !== 'pending') return null;
  return (
    <div className="flex items-center gap-1.5">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onConfirm(order.id)}
        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-[11px] font-bold rounded-lg hover:bg-emerald-700 transition-colors"
      >
        <Check className="w-3.5 h-3.5" /> Xác nhận
      </motion.button>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => onCancel(order.id)}
        className="flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-100 border border-red-200 transition-colors"
      >
        <Ban className="w-3.5 h-3.5" /> Hủy
      </motion.button>
    </div>
  );
};

export const AdminDashboard = () => {
  const [stats, setStats] = useState<any>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'orders' | 'users'>('overview');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const { authHeaders } = useAuth();
  const { toast, confirm } = useToast();

  useEffect(() => {
    const headers = authHeaders();
    fetch('/api/admin/stats', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setStats).catch(() => {});
    fetch('/api/admin/orders', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setOrders).catch(() => {});
    fetch('/api/products?limit=1000').then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(r => setProducts(r.data || r)).catch(() => {});
    fetch('/api/categories').then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setCategories).catch(() => {});
    fetch('/api/admin/users', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setUsers).catch(() => {});
  }, []);

  // Auto-refresh đơn hàng mỗi 8 giây (để thấy trạng thái tự động chuyển trong demo mode)
  useEffect(() => {
    const interval = setInterval(() => {
      const headers = authHeaders();
      fetch('/api/admin/orders', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setOrders).catch(() => {});
      fetch('/api/admin/stats', { headers }).then(res => { if (!res.ok) throw new Error(); return res.json(); }).then(setStats).catch(() => {});
    }, 8000);
    return () => clearInterval(interval);
  }, []);

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

  const handleConfirmOrder = async (orderId: number) => {
    const ok = await confirm({ title: 'Xác nhận đơn hàng', message: 'Hệ thống sẽ tự động tạo vận đơn và giao hàng.', type: 'info', confirmText: 'Xác nhận' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'processing', tracking_code: data.tracking_code, shipping_provider: data.provider } : o));
        toast.success(`Đã xác nhận & tạo vận đơn: ${data.tracking_code}`);
      } else {
        toast.error(data.error || 'Xác nhận thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    const ok = await confirm({ title: 'Hủy đơn hàng', message: 'Sản phẩm sẽ được hoàn trả về kho. Hành động này không thể hoàn tác.', type: 'danger', confirmText: 'Hủy đơn' });
    if (!ok) return;
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
      });
      const data = await res.json();
      if (res.ok) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o));
        toast.success('Đã hủy đơn hàng & hoàn trả kho');
      } else {
        toast.error(data.error || 'Hủy thất bại');
      }
    } catch {
      toast.error('Lỗi kết nối server');
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
            <div className="space-y-8">
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
              
              <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                  <h3 className="font-bold text-slate-900">Đơn hàng mới nhất</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">Mã đơn</th>
                        <th className="px-6 py-4">Khách hàng</th>
                        <th className="px-6 py-4">Tổng tiền</th>
                        <th className="px-6 py-4">Vận đơn</th>
                        <th className="px-6 py-4">Trạng thái</th>
                        <th className="px-6 py-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {orders.slice(0, 5).map(order => (
                        <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-slate-500">#ORD-{order.id}</td>
                          <td className="px-6 py-4">
                            <div className="font-medium text-slate-900">{order.customer_name}</div>
                            <div className="text-xs text-slate-500">{order.customer_email}</div>
                          </td>
                          <td className="px-6 py-4 font-semibold text-slate-900">{order.total_amount.toLocaleString('vi-VN')}₫</td>
                          <td className="px-6 py-4">
                            {order.tracking_code ? (
                              <div>
                                <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-lg">{order.tracking_code}</span>
                                <span className="text-[10px] text-slate-400 block mt-0.5">{order.shipping_provider}</span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <StatusBadge status={order.status} />
                          </td>
                          <td className="px-6 py-4">
                            <OrderActions order={order} onConfirm={handleConfirmOrder} onCancel={handleCancelOrder} />
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
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-slate-500 font-medium">
                    <tr>
                      <th className="px-6 py-4">Mã đơn</th>
                      <th className="px-6 py-4">Khách hàng</th>
                      <th className="px-6 py-4">Ngày đặt</th>
                      <th className="px-6 py-4">Tổng tiền</th>
                      <th className="px-6 py-4">Vận đơn</th>
                      <th className="px-6 py-4">Trạng thái</th>
                      <th className="px-6 py-4">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {orders.map(order => (
                      <tr key={order.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs">#ORD-{order.id}</td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-slate-900">{order.customer_name}</div>
                          <div className="text-xs text-slate-500">{order.customer_email}</div>
                        </td>
                        <td className="px-6 py-4 text-slate-500">{new Date(order.created_at).toLocaleDateString('vi-VN')}</td>
                        <td className="px-6 py-4 font-semibold text-slate-900">{order.total_amount.toLocaleString('vi-VN')}đ</td>
                        <td className="px-6 py-4">
                          {order.tracking_code ? (
                            <div>
                              <span className="font-mono text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded-md">{order.tracking_code}</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">{order.shipping_provider}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <StatusBadge status={order.status} />
                        </td>
                        <td className="px-6 py-4">
                          <OrderActions order={order} onConfirm={handleConfirmOrder} onCancel={handleCancelOrder} />
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
        </div>
      </div>

      {/* Edit Product Modal */}
      <AnimatePresence>
        {editingProduct && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingProduct(null)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[80]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-3xl shadow-2xl z-[90] overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">{editingProduct.id ? 'Chỉnh sửa sản phẩm' : 'Thêm sản phẩm mới'}</h3>
                <button onClick={() => setEditingProduct(null)} className="p-2 hover:bg-slate-100 rounded-full"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Tên sản phẩm</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm"
                      value={editingProduct.name}
                      onChange={e => setEditingProduct({...editingProduct, name: e.target.value})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Slug</label>
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm"
                      value={editingProduct.slug}
                      onChange={e => setEditingProduct({...editingProduct, slug: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Mô tả</label>
                  <textarea 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm min-h-[100px]"
                    value={editingProduct.description}
                    onChange={e => setEditingProduct({...editingProduct, description: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Giá (VNĐ)</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm"
                      value={editingProduct.price}
                      onChange={e => setEditingProduct({...editingProduct, price: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-400 uppercase">Số lượng kho</label>
                    <input 
                      type="number" 
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm"
                      value={editingProduct.stock}
                      onChange={e => setEditingProduct({...editingProduct, stock: parseInt(e.target.value)})}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <ImageUpload
                    endpoint="/api/upload/product"
                    fieldName="image"
                    currentImage={editingProduct.image_url}
                    onUploadSuccess={(url) => setEditingProduct({...editingProduct, image_url: url})}
                    maxSizeMB={5}
                    shape="square"
                    label="Hình ảnh sản phẩm"
                  />
                  <input 
                    type="url" 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm mt-2"
                    value={editingProduct.image_url}
                    onChange={e => setEditingProduct({...editingProduct, image_url: e.target.value})}
                    placeholder="Hoặc nhập URL ảnh trực tiếp"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase">Danh mục</label>
                  <select 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl text-sm"
                    value={editingProduct.category_id}
                    onChange={e => setEditingProduct({...editingProduct, category_id: parseInt(e.target.value)})}
                  >
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div className="pt-4">
                  <button 
                    type="submit"
                    className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingProduct.id ? 'Lưu thay đổi' : 'Thêm sản phẩm'}
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
