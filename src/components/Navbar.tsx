import React, { useState, useEffect } from 'react';
import { ShoppingCart, LayoutDashboard, Package, ShoppingBag, LogOut, LogIn } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { CartDrawer } from './CartDrawer';

export const Navbar = ({ onAdminToggle, isAdmin, onBackToStore, onAuthOpen }: { onAdminToggle: () => void, isAdmin: boolean, onBackToStore: () => void, onAuthOpen: () => void }) => {
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
    <nav className={`sticky top-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-xl shadow-lg shadow-zinc-100/50 border-b border-zinc-100' : 'bg-white/80 backdrop-blur-md border-b border-zinc-200'}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-8">
            <motion.button 
              onClick={onBackToStore} 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="text-xl font-bold tracking-tighter text-zinc-900 flex items-center gap-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-lg flex items-center justify-center shadow-md shadow-indigo-200">
                <Package className="w-4 h-4 text-white" />
              </div>
              PC MASTER
            </motion.button>
            <div className="hidden md:flex items-center gap-1 text-sm font-medium text-zinc-600">
              <motion.button 
                whileHover={{ y: -1 }}
                onClick={onBackToStore} 
                className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Sản phẩm
              </motion.button>
              <motion.a 
                whileHover={{ y: -1 }}
                href="#" 
                className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Khuyến mãi
              </motion.a>
              <motion.a 
                whileHover={{ y: -1 }}
                href="#" 
                className="px-3 py-2 rounded-lg hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
              >
                Liên hệ
              </motion.a>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 bg-zinc-50 rounded-full">
                  <div className="w-7 h-7 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                    {user?.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-xs font-bold text-zinc-900 leading-tight">{user?.name}</span>
                    <span className="text-[10px] text-zinc-400 leading-tight">{user?.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}</span>
                  </div>
                </div>
                {user?.role === 'admin' && (
                  <motion.button 
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onAdminToggle}
                    className="p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    title={isAdmin ? "Về trang chủ" : "Trang quản trị"}
                  >
                    {isAdmin ? <ShoppingBag className="w-5 h-5" /> : <LayoutDashboard className="w-5 h-5" />}
                  </motion.button>
                )}
                <motion.button 
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={logout}
                  className="p-2 text-zinc-500 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Đăng xuất"
                >
                  <LogOut className="w-5 h-5" />
                </motion.button>
              </div>
            ) : (
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onAuthOpen}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-lg hover:shadow-lg hover:shadow-indigo-200 transition-shadow"
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
                className="relative p-2 text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <ShoppingCart className="w-5 h-5" />
                <AnimatePresence>
                  {items.length > 0 && (
                    <motion.span 
                      key={items.length}
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                      className="absolute -top-0.5 -right-0.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full shadow-md"
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
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </nav>
  );
};
