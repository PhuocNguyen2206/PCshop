import React, { useState, useEffect } from 'react';
import { ShoppingCart, X, Trash2, Plus, Minus, ChevronRight, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';

export const CartDrawer = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { items, total, removeFromCart, updateQuantity, clearCart } = useCart();
  const { user } = useAuth();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);
  const [customerInfo, setCustomerInfo] = useState({ name: user?.name || '', email: user?.email || '' });

  useEffect(() => {
    if (user) setCustomerInfo({ name: user.name, email: user.email });
  }, [user]);

  // Lock body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleCheckout = async () => {
    if (!customerInfo.name || !customerInfo.email) {
      alert('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user?.id,
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          items,
          total_amount: total,
        }),
      });
      if (res.ok) {
        setOrderSuccess(true);
        clearCart();
        setIsCheckingOut(false);
        setTimeout(() => { setOrderSuccess(false); onClose(); }, 2000);
      }
    } catch (err) {
      console.error(err);
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
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed right-0 top-16 h-[calc(100vh-4rem)] w-full max-w-sm bg-white shadow-2xl z-50 flex flex-col border-l border-zinc-100"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-indigo-600" />
                <span className="font-bold text-zinc-900">Giỏ hàng</span>
                {itemCount > 0 && (
                  <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">{itemCount}</span>
                )}
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-zinc-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {/* Success state */}
            <AnimatePresence>
              {orderSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mx-4 mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-3"
                >
                  <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                    <span className="text-emerald-600 text-lg">✓</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Đặt hàng thành công!</p>
                    <p className="text-xs text-emerald-600">Đơn hàng của bạn đang được xử lý</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Items */}
            <div className="flex-1 overflow-y-auto">
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400 px-6">
                  <div className="w-16 h-16 bg-zinc-50 rounded-2xl flex items-center justify-center">
                    <Package className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="text-sm">Giỏ hàng đang trống</p>
                  <button onClick={onClose} className="text-xs text-indigo-600 font-medium hover:underline">Tiếp tục mua sắm →</button>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {items.map(item => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex gap-3 p-3 bg-zinc-50 rounded-xl"
                    >
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-16 h-16 object-cover rounded-lg bg-white border border-zinc-100 shrink-0"
                        referrerPolicy="no-referrer"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="text-xs font-semibold text-zinc-900 line-clamp-2 leading-snug">{item.name}</h3>
                        <p className="text-sm font-bold text-indigo-600 mt-1">{item.price.toLocaleString('vi-VN')}đ</p>
                        <div className="flex items-center justify-between mt-2">
                          <div className="flex items-center bg-white border border-zinc-200 rounded-lg overflow-hidden">
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 text-zinc-500 transition-colors"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-semibold w-7 text-center">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center hover:bg-zinc-50 text-zinc-500 transition-colors"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="p-1.5 text-zinc-300 hover:text-red-400 transition-colors"
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
              <div className="border-t border-zinc-100 p-4 space-y-3 bg-white">
                {/* Subtotal */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-zinc-500">{itemCount} sản phẩm</span>
                  <span className="font-bold text-zinc-900 text-base">{total.toLocaleString('vi-VN')}đ</span>
                </div>

                <AnimatePresence mode="wait">
                  {isCheckingOut ? (
                    <motion.div
                      key="checkout"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-2"
                    >
                      <input
                        type="text"
                        placeholder="Họ và tên"
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                        value={customerInfo.name}
                        onChange={e => setCustomerInfo({ ...customerInfo, name: e.target.value })}
                      />
                      <input
                        type="email"
                        placeholder="Email nhận đơn hàng"
                        className="w-full px-3 py-2.5 border border-zinc-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent"
                        value={customerInfo.email}
                        onChange={e => setCustomerInfo({ ...customerInfo, email: e.target.value })}
                      />
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => setIsCheckingOut(false)}
                          className="flex-1 py-2.5 text-sm font-medium text-zinc-600 bg-zinc-100 rounded-lg hover:bg-zinc-200 transition-colors"
                        >
                          Quay lại
                        </button>
                        <button
                          onClick={handleCheckout}
                          className="flex-[2] py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-md shadow-indigo-200 transition-all"
                        >
                          Xác nhận đặt hàng
                        </button>
                      </div>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="pay"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      onClick={() => setIsCheckingOut(true)}
                      className="w-full py-3 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl hover:shadow-lg hover:shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                    >
                      Thanh toán
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
