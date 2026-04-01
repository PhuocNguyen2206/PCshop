import React, { useState, useEffect } from 'react';
import { ShoppingCart, LayoutDashboard, Package, ShoppingBag, LogOut, LogIn, ClipboardList, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { CartDrawer } from './CartDrawer';

export const Navbar = ({ onAdminToggle, isAdmin, onBackToStore, onAuthOpen, onViewOrders }: { onAdminToggle: () => void, isAdmin: boolean, onBackToStore: () => void, onAuthOpen: () => void, onViewOrders: () => void }) => {
  const { items } = useCart();
  const { user, logout, isAuthenticated } = useAuth();
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <>
    <nav className={`sticky top-0 z-50 transition-all duration-500 ${scrolled ? 'glass shadow-lg shadow-slate-200/50 border-b border-slate-200/50' : 'bg-white/60 backdrop-blur-md border-b border-slate-100/50'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <motion.button 
              onClick={onBackToStore} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2.5"
            >
              <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/25 rotate-3 hover:rotate-0 transition-transform duration-300">
                <Cpu className="w-4.5 h-4.5 text-white" />
              </div>
              <span className="hidden sm:inline">PC <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">MASTER</span></span>
            </motion.button>
            <div className="hidden md:flex items-center gap-1 text-sm font-medium text-slate-500">
              <motion.button 
                whileHover={{ y: -1 }}
                onClick={onBackToStore} 
                className="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-indigo-50/80 transition-all duration-200"
              >
                Sản phẩm
              </motion.button>
              {isAuthenticated && (
                <motion.button 
                  whileHover={{ y: -1 }}
                  onClick={onViewOrders}
                  className="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-indigo-50/80 transition-all duration-200"
                >
                  Đơn hàng
                </motion.button>
              )}
              <motion.a 
                whileHover={{ y: -1 }}
                href="#" 
                className="px-3.5 py-2 rounded-xl hover:text-indigo-600 hover:bg-indigo-50/80 transition-all duration-200"
              >
                Liên hệ
              </motion.a>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <div className="flex items-center gap-2.5">
                <div className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 bg-slate-50/80 rounded-full border border-slate-100">
                  <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-indigo-500/20">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-slate-800 leading-tight">{user?.name}</span>
                    <span className="text-[10px] text-slate-400 leading-tight">{user?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</span>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onAdminToggle}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all duration-200"
                    title={isAdmin ? "Về trang chủ" : "Trang quản trị"}
                  >
                    {isAdmin ? <ShoppingBag className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={onViewOrders}
                  className="sm:hidden p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all duration-200"
                  title="Đơn hàng của tôi"
                >
                  <ClipboardList className="w-5 h-5" />
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={logout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50/80 rounded-xl transition-all duration-200"
                  title="Đăng xuất"
                >
                  <LogOut className="w-5 h-5" />
                </motion.button>
              </div>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.03, y: -1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onAuthOpen}
                className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-xl hover:shadow-xl hover:shadow-indigo-500/25 transition-all duration-300"
              >
                <LogIn className="w-4 h-4" />
                Đăng nhập
              </motion.button>
            )}
            
            {!isAdmin && (
              <motion.button 
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => {
                  if (!isAuthenticated) {
                    onAuthOpen();
                  } else {
                    setIsCartOpen(true);
                  }
                }}
                className="relative p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50/80 rounded-xl transition-all duration-200"
              >
                <ShoppingCart className="w-5 h-5" />
                <AnimatePresence>
                  {items.length > 0 && (
                    <motion.span 
                      key={items.length}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-lg shadow-indigo-500/30"
                    >
                      {items.length}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </nav>
    <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
  </>
  );
};
