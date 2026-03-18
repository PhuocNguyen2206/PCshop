import React, { useState, useEffect } from 'react';
import { Plus, Package, Sparkles, ShoppingCart } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { Product, Category } from '../types';

export const UserStore = ({ onProductClick }: { onProductClick: (slug: string) => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);
  const { addToCart } = useCart();

  useEffect(() => {
    fetch('/api/categories').then(res => res.json()).then(setCategories);
  }, []);

  useEffect(() => {
    const url = selectedCategory ? `/api/products?category=${selectedCategory}` : '/api/products';
    fetch(url).then(res => res.json()).then(setProducts);
  }, [selectedCategory]);

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    addToCart(product);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 800);
  };

  return (
    <div>
      {/* Hero Section */}
      <div className="hero-gradient relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-20 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 border border-indigo-100 rounded-full text-xs font-semibold text-indigo-600 mb-6">
              <Sparkles className="w-3.5 h-3.5" />
              Linh kiện chính hãng - Bảo hành toàn quốc
            </div>
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-zinc-900 mb-4">
              NÂNG CẤP{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 bg-clip-text text-transparent">
                TRẢI NGHIỆM
              </span>
              {' '}PC
            </h2>
            <p className="text-zinc-500 max-w-2xl mx-auto text-base md:text-lg">
              Cung cấp linh kiện máy tính chính hãng, hiệu năng cao cho game thủ và chuyên gia đồ họa.
            </p>
          </motion.div>

          {/* Decorative blobs */}
          <div className="absolute top-10 left-10 w-32 h-32 bg-indigo-200/20 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-10 right-10 w-40 h-40 bg-violet-200/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Categories */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-2 mb-10"
        >
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${!selectedCategory ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:shadow-md'}`}
          >
            Tất cả
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${selectedCategory === cat.slug ? 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:shadow-md'}`}
            >
              {cat.name}
            </button>
          ))}
        </motion.div>

        {/* Product Grid */}
        <div className="min-h-[60vh]">
          <AnimatePresence mode="wait">
            {products.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 text-zinc-400"
              >
                <div className="w-24 h-24 bg-zinc-50 rounded-3xl flex items-center justify-center mb-4 border border-zinc-100">
                  <Package className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-sm font-medium">Không có sản phẩm trong danh mục này</p>
              </motion.div>
            ) : (
              <motion.div 
                key={selectedCategory || 'all'}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {products.map((product, idx) => (
                  <motion.div 
                    key={product.id}
                    initial={{ opacity: 0, y: 25 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    whileHover={{ y: -6, transition: { duration: 0.2 } }}
                    className="group bg-white border border-zinc-100 rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-indigo-100/50 hover:border-indigo-100 transition-all duration-300 cursor-pointer"
                    onClick={() => onProductClick(product.slug)}
                  >
                    <div className="aspect-square overflow-hidden bg-gradient-to-br from-zinc-50 to-zinc-100 relative">
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                      <div className="absolute top-3 left-3">
                        <span className="bg-white/95 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-zinc-600 shadow-sm">
                          {product.category_name}
                        </span>
                      </div>
                      {product.stock <= 3 && product.stock > 0 && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-amber-500 text-white px-2 py-0.5 rounded-md text-[10px] font-bold">
                            Còn {product.stock}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-5">
                      <h3 className="font-semibold text-zinc-900 mb-1.5 line-clamp-1 group-hover:text-indigo-700 transition-colors">{product.name}</h3>
                      <p className="text-sm text-zinc-400 mb-4 line-clamp-2 min-h-[40px] leading-relaxed">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                          {product.price.toLocaleString('vi-VN')}đ
                        </span>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => handleAddToCart(e, product)}
                          className={`p-2.5 rounded-xl transition-all duration-300 shadow-md ${
                            addedId === product.id 
                              ? 'bg-emerald-500 text-white shadow-emerald-200' 
                              : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:shadow-lg hover:shadow-indigo-200'
                          }`}
                        >
                          {addedId === product.id ? (
                            <ShoppingCart className="w-4 h-4" />
                          ) : (
                            <Plus className="w-4 h-4" />
                          )}
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
