import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CartProvider } from './CartContext';
import { AuthProvider, useAuth } from './AuthContext';
import { Navbar } from './components/Navbar';
import { UserStore } from './components/UserStore';
import { ProductDetail } from './components/ProductDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';
import { OrderHistory } from './components/OrderHistory';
import { ProfilePage } from './components/ProfilePage';
import { ProductsPage } from './components/ProductsPage';
import { ChatWidget } from './components/ChatWidget';
import { ToastProvider } from './components/Toast';

const AppContent = () => {
  const [view, setView] = useState<'store' | 'admin' | 'product' | 'products' | 'orders' | 'profile'>('store');
  const [selectedProductSlug, setSelectedProductSlug] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (view === 'admin' && user?.role !== 'admin') {
      setView('store');
    }
  }, [user, view]);

  const handleAdminToggle = () => {
    if (user?.role !== 'admin') return;
    setView(view === 'admin' ? 'store' : 'admin');
  };

  const handleProductClick = (slug: string) => {
    setSelectedProductSlug(slug);
    setView('product');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleBackToStore = () => {
    setView('store');
    setSelectedProductSlug(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewOrders = () => {
    setView('orders');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewProfile = () => {
    setView('profile');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewProducts = () => {
    setView('products');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white font-sans flex flex-col">
      <Navbar 
        onAdminToggle={handleAdminToggle}
        isAdmin={view === 'admin'}
        onBackToStore={handleBackToStore}
        onAuthOpen={() => setIsAuthOpen(true)}
        onViewOrders={handleViewOrders}
        onViewProfile={handleViewProfile}
        onViewProducts={handleViewProducts}
      />

      <main className="flex-1">
        <AnimatePresence mode="wait">
          {view === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <UserStore onProductClick={handleProductClick} onAuthOpen={() => setIsAuthOpen(true)} onViewProducts={handleViewProducts} />
            </motion.div>
          )}
          {view === 'product' && selectedProductSlug && (
            <motion.div key="product" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ProductDetail slug={selectedProductSlug} onBack={handleBackToStore} onAuthOpen={() => setIsAuthOpen(true)} />
            </motion.div>
          )}
          {view === 'admin' && user?.role === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <AdminDashboard />
            </motion.div>
          )}
          {view === 'products' && (
            <motion.div key="products" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ProductsPage onProductClick={handleProductClick} onAuthOpen={() => setIsAuthOpen(true)} />
            </motion.div>
          )}
          {view === 'orders' && (
            <motion.div key="orders" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <OrderHistory />
            </motion.div>
          )}
          {view === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ProfilePage />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
      <ChatWidget onAuthOpen={() => setIsAuthOpen(true)} />

      <footer className="bg-slate-950 text-slate-400 pt-16 pb-8 mt-24 relative overflow-hidden">
        {/* Decorative gradient */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            {/* Brand */}
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                  <span className="text-white font-black text-sm">PC</span>
                </div>
                <span className="font-extrabold text-white text-lg">PC MASTER</span>
              </div>
              <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
                Cung cấp linh kiện máy tính chính hãng, hiệu năng cao cho game thủ và chuyên gia đồ họa trên toàn quốc.
              </p>
            </div>

            {/* Links */}
            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Sản phẩm</h4>
              <div className="space-y-2.5">
                <button onClick={handleBackToStore} className="block text-sm text-slate-500 hover:text-indigo-400 transition-colors">Linh kiện PC</button>
                <span className="block text-sm text-slate-600 cursor-default">Khuyến mãi</span>
                <span className="block text-sm text-slate-600 cursor-default">Mới nhất</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4">Hỗ trợ</h4>
              <div className="space-y-2.5">
                <span className="block text-sm text-slate-600 cursor-default">Liên hệ</span>
                <span className="block text-sm text-slate-600 cursor-default">Chính sách</span>
                <span className="block text-sm text-slate-600 cursor-default">FAQ</span>
              </div>
            </div>
          </div>

          {/* Bottom */}
          <div className="border-t border-slate-800 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-slate-600">© 2026 PC MASTER. All rights reserved.</p>
            <div className="flex items-center gap-4">
              <span className="text-[11px] text-slate-600 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                Hệ thống hoạt động bình thường
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <CartProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
