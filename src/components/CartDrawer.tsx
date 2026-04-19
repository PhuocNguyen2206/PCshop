import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, Trash2, Plus, Minus, ChevronRight, Package, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { useToast } from './Toast';

export const CartDrawer = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { items, total, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user, authHeaders } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: user?.name || '', email: user?.email || '', phone: user?.phone || '', address: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'unpaid' | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (user) setCustomerInfo({ name: user.name, email: user.email, phone: user.phone || '', address: '' });
  }, [user]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCheckout = async (status: 'paid' | 'unpaid') => {
    if (!customerInfo.name || !customerInfo.email || !customerInfo.phone || !customerInfo.address) {
      toast.warning('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setIsSubmitting(true);
    setPaymentStatus(status);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_phone: customerInfo.phone,
          shipping_address: customerInfo.address,
          items,
          payment_status: status,
        }),
      });
      if (res.ok) {
        setOrderSuccess(true);
        clearCart();
        setIsCheckingOut(false);
        setPaymentStatus(null);
        setTimeout(() => { setOrderSuccess(false); onClose(); }, 4000);
        const statusText = status === 'paid' ? 'Thanh toán thành công!' : 'Đặt hàng thành công!';
        toast.success(statusText);
      } else {
        const data = await res.json();
        toast.error(data.error || 'Thao tác thất bại');
      }
    } catch (err) {
      toast.error('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setIsSubmitting(false);
      setPaymentStatus(null);
    }
  };

  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <ShoppingCart className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-bold text-slate-900 text-base">Giỏ hàng</span>
                  {itemCount > 0 && (
                    <span className="ml-2 bg-indigo-100 text-indigo-700 text-[11px] font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
                  )}
                </div>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            {/* Success state */}
            <AnimatePresence>
              {orderSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-5 mt-5 p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center gap-4"
                >
                  <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
                    <span className="text-emerald-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-emerald-700">Đặt hàng thành công!</p>
                    <p className="text-xs text-emerald-600 mt-0.5">Đơn hàng của bạn đang được xử lý</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-4 text-slate-400 px-6">
                  <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center border border-slate-100">
                    <Package className="w-9 h-9 opacity-30" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500">Giỏ hàng đang trống</p>
                    <p className="text-xs text-slate-400 mt-1">Thêm sản phẩm để bắt đầu mua sắm</p>
                  </div>
                  <button onClick={onClose} className="text-xs text-indigo-600 font-semibold hover:text-indigo-700 mt-2 flex items-center gap-1">
                    Tiếp tục mua sắm <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-4 p-3.5 bg-slate-50/80 rounded-2xl border border-slate-100/50 hover:border-slate-200 transition-colors"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-18 h-18 object-cover rounded-xl bg-white border border-slate-100 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-snug">{item.name}</h3>
                        <p className="text-sm font-bold text-indigo-600 mt-1.5">{item.price.toLocaleString('vi-VN')}₫</p>
                        <div className="flex items-center justify-between mt-2.5">
                          <div className="flex items-center bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 text-slate-400 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-bold w-8 text-center text-slate-700">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center hover:bg-slate-50 text-slate-400 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-2 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {items.length > 0 && (
              <div className="border-t border-slate-100 p-5 space-y-4 bg-white">
                {/* Security badge */}
                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Thanh toán an toàn & bảo mật</span>
                </div>

                {/* Total */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm text-slate-500">{itemCount} sản phẩm</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xl font-black text-slate-900">{total.toLocaleString('vi-VN')}</span>
                    <span className="text-sm font-bold text-slate-400 ml-0.5">₫</span>
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {isCheckingOut ? (
                    <motion.div
                      key="checkout"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-3"
                    >
                      <input
                        type="text"
                        placeholder="Họ và tên"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={customerInfo.name}
                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      />
                      <input
                        type="email"
                        placeholder="Email nhận đơn hàng"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={customerInfo.email}
                        onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      />
                      <input
                        type="tel"
                        placeholder="Số điện thoại"
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={customerInfo.phone}
                        onChange={e => setCustomerInfo({ ...customerInfo, phone: e.target.value })}
                      />
                      <textarea
                        placeholder="Địa chỉ giao hàng"
                        rows={2}
                        className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all resize-none"
                        value={customerInfo.address}
                        onChange={e => setCustomerInfo({ ...customerInfo, address: e.target.value })}
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setIsCheckingOut(false)}
                          disabled={isSubmitting}
                          className="flex-1 py-3 text-sm font-semibold text-slate-600 bg-slate-100 rounded-xl hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Quay lại
                        </button>
                        <button
                          onClick={() => handleCheckout('unpaid')}
                          disabled={isSubmitting}
                          className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSubmitting && paymentStatus === 'unpaid' ? (
                            <>
                              <span className="inline-block animate-spin">⏳</span>
                              Đang xử lý...
                            </>
                          ) : (
                            'Đặt hàng'
                          )}
                        </button>
                        <button
                          onClick={() => handleCheckout('paid')}
                          disabled={isSubmitting}
                          className="flex-1 py-3 text-sm font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 rounded-xl hover:shadow-lg hover:shadow-emerald-500/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isSubmitting && paymentStatus === 'paid' ? (
                            <>
                              <span className="inline-block animate-spin">⏳</span>
                              Thanh toán...
                            </>
                          ) : (
                            'Thanh toán'
                          )}
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="checkout"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      whileHover={{ scale: 1.01, y: -1 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsCheckingOut(true)}
                      className="w-full py-3.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl shadow-lg shadow-indigo-500/20 hover:shadow-xl hover:shadow-indigo-500/25 transition-all flex items-center justify-center gap-2"
                    >
                      Đặt hàng
                      <ChevronRight className="w-4 h-4" />
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
