import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CartProvider } from './CartContext';
import { AuthProvider, useAuth } from './AuthContext';
import { Navbar } from './components/Navbar';
import { UserStore } from './components/UserStore';
import { ProductDetail } from './components/ProductDetail';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthModal } from './components/AuthModal';

const AppContent = () => {
  const [view, setView] = useState<'store' | 'admin' | 'product'>('store');
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

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar 
        onAdminToggle={handleAdminToggle}
        isAdmin={view === 'admin'}
        onBackToStore={handleBackToStore}
        onAuthOpen={() => setIsAuthOpen(true)}
      />

      <main>
        <AnimatePresence mode="wait">
          {view === 'store' && (
            <motion.div key="store" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <UserStore onProductClick={handleProductClick} />
            </motion.div>
          )}
          {view === 'product' && selectedProductSlug && (
            <motion.div key="product" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <ProductDetail slug={selectedProductSlug} onBack={handleBackToStore} />
            </motion.div>
          )}
          {view === 'admin' && user?.role === 'admin' && (
            <motion.div key="admin" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              <AdminDashboard />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AuthModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />

      <footer className="bg-gradient-to-b from-zinc-50 to-zinc-100/50 border-t border-zinc-100 py-16 mt-24">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-2 text-zinc-400">
              <div className="w-6 h-6 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-md"></div>
              <span className="font-bold text-zinc-600">PC MASTER</span>
            </div>
            <div className="flex items-center gap-6 text-sm">
              <a href="#" className="text-zinc-400 hover:text-indigo-600 transition-colors">Sản phẩm</a>
              <a href="#" className="text-zinc-400 hover:text-indigo-600 transition-colors">Khuyến mãi</a>
              <a href="#" className="text-zinc-400 hover:text-indigo-600 transition-colors">Liên hệ</a>
            </div>
            <p className="text-zinc-400 text-sm">© 2026 PC MASTER. All rights reserved.</p>
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
        <AppContent />
      </CartProvider>
    </AuthProvider>
  );
};

export default App;
