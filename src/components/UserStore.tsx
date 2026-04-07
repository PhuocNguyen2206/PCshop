import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Package, Sparkles, ShoppingCart, Zap, Shield, Truck, Monitor, Cpu, HardDrive, Star, Search, SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { Product, Category } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { Pagination } from './Pagination';

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasPrev: boolean;
  hasNext: boolean;
}

const PRICE_RANGES = [
  { label: 'Tất cả', min: undefined, max: undefined },
  { label: 'Dưới 5 triệu', min: 0, max: 5000000 },
  { label: '5 - 15 triệu', min: 5000000, max: 15000000 },
  { label: '15 - 30 triệu', min: 15000000, max: 30000000 },
  { label: 'Trên 30 triệu', min: 30000000, max: undefined },
];

const SORT_OPTIONS = [
  { label: 'Mới nhất', value: 'created_at', order: 'desc' },
  { label: 'Giá tăng dần', value: 'price', order: 'asc' },
  { label: 'Giá giảm dần', value: 'price', order: 'desc' },
  { label: 'Tên A-Z', value: 'name', order: 'asc' },
];

export const UserStore = ({ onProductClick, onAuthOpen }: { onProductClick: (slug: string) => void, onAuthOpen: () => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPriceRange, setSelectedPriceRange] = useState(0);
  const [selectedSort, setSelectedSort] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  const debouncedSearch = useDebounce(searchTerm, 500);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  // Reset page khi filter thay đổi
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, selectedPriceRange, selectedSort]);

  // Fetch products với search, filter, pagination
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

    const priceRange = PRICE_RANGES[selectedPriceRange];
    if (priceRange.min !== undefined) params.set('minPrice', String(priceRange.min));
    if (priceRange.max !== undefined) params.set('maxPrice', String(priceRange.max));

    const sortOption = SORT_OPTIONS[selectedSort];
    params.set('sort', sortOption.value);
    params.set('order', sortOption.order);
    params.set('page', String(currentPage));
    params.set('limit', '12');

    setLoading(true);
    fetch(`/api/products?${params.toString()}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then((result) => {
        setProducts(result.data);
        setPagination(result.pagination);
      })
      .catch(() => { setProducts([]); setPagination(null); })
      .finally(() => setLoading(false));
  }, [selectedCategory, debouncedSearch, selectedPriceRange, selectedSort, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setSelectedPriceRange(0);
    setSelectedSort(0);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || selectedCategory || selectedPriceRange > 0 || selectedSort > 0;

  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      onAuthOpen();
      return;
    }
    addToCart(product);
    setAddedId(product.id);
    setTimeout(() => setAddedId(null), 800);
  };

  return (
    <div>
      {/* ── Hero Section ─────────────────────────────────── */}
      <div className="hero-dark noise">
        {/* Grid overlay */}
        <div className="absolute inset-0 grid-pattern" />
        
        {/* Animated orbs */}
        <div className="absolute top-20 left-[10%] w-72 h-72 bg-indigo-500/20 rounded-full blur-[100px] animate-orb-1" />
        <div className="absolute bottom-10 right-[15%] w-96 h-96 bg-violet-500/15 rounded-full blur-[120px] animate-orb-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[100px] animate-float-slow" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Badge */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full text-xs font-semibold text-indigo-300 mb-8 backdrop-blur-sm"
              >
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                Linh kiện chính hãng — Bảo hành toàn quốc
              </motion.div>

              {/* Heading */}
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-black tracking-tight text-white mb-6 leading-[1.1]">
                Nâng cấp{' '}
                <span className="animated-gradient-text">
                  trải nghiệm
                </span>
                <br />
                PC của bạn
              </h1>

              <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                Cung cấp linh kiện máy tính chính hãng, hiệu năng cao cho game thủ và chuyên gia đồ họa.
              </p>

              {/* CTA Buttons */}
              <div className="flex flex-wrap items-center justify-center gap-4 mb-16">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => document.getElementById('products')?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-8 py-3.5 text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 rounded-2xl shadow-xl shadow-indigo-500/25 hover:shadow-2xl hover:shadow-indigo-500/30 transition-all duration-300 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Khám phá ngay
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-8 py-3.5 text-sm font-bold text-slate-300 bg-white/5 border border-white/10 rounded-2xl hover:bg-white/10 transition-all duration-300 backdrop-blur-sm"
                >
                  Xem khuyến mãi
                </motion.button>
              </div>
            </motion.div>

            {/* Stats bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6"
            >
              {[
                { icon: Zap, label: 'Hiệu năng cao', value: 'Top-tier' },
                { icon: Shield, label: 'Bảo hành', value: '36 tháng' },
                { icon: Truck, label: 'Vận chuyển', value: 'Miễn phí' },
                { icon: Star, label: 'Đánh giá', value: '4.9/5.0' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="flex flex-col items-center gap-2 p-4 bg-white/[0.03] border border-white/[0.06] rounded-2xl backdrop-blur-sm"
                >
                  <stat.icon className="w-5 h-5 text-indigo-400" />
                  <span className="text-sm font-bold text-white">{stat.value}</span>
                  <span className="text-[11px] text-slate-500">{stat.label}</span>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>

        {/* Bottom gradient fade to white */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white to-transparent" />
      </div>

      {/* ── Products Section ─────────────────────────────── */}
      <div id="products" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
            Sản phẩm <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">nổi bật</span>
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto">Lựa chọn từ các thương hiệu uy tín hàng đầu thế giới</p>
        </motion.div>

        {/* ── Search Bar ──────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-6"
        >
          <div className="relative max-w-xl mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm kiếm sản phẩm..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 bg-white border border-slate-200 rounded-2xl text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 shadow-sm transition-all duration-200"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            {/* Debounce indicator */}
            {searchTerm !== debouncedSearch && searchTerm.trim() && (
              <div className="absolute right-12 top-1/2 -translate-y-1/2">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Filter Toggle & Sort ─────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
              showFilters || hasActiveFilters
                ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Bộ lọc
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-indigo-500 rounded-full" />
            )}
          </button>

          <div className="relative">
            <button
              onClick={() => setSortOpen(!sortOpen)}
              onBlur={() => setTimeout(() => setSortOpen(false), 150)}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-600 hover:border-slate-300 transition-all cursor-pointer"
            >
              <span className="text-slate-400">Sắp xếp:</span>
              <span className="font-medium text-slate-700">{SORT_OPTIONS[selectedSort].label}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${sortOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {sortOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -4, scale: 0.97 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-44 bg-white border border-slate-100 rounded-2xl shadow-xl shadow-slate-200/50 py-1.5 z-50 overflow-hidden"
                >
                  {SORT_OPTIONS.map((opt, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedSort(i); setSortOpen(false); }}
                      className={`w-full px-4 py-2.5 text-left text-sm flex items-center justify-between transition-colors ${
                        selectedSort === i
                          ? 'bg-indigo-50 text-indigo-600 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {opt.label}
                      {selectedSort === i && <Check className="w-4 h-4 text-indigo-500" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* ── Filters Panel ──────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 space-y-5">
                {/* Khoảng giá */}
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Khoảng giá</h4>
                  <div className="flex flex-wrap gap-2">
                    {PRICE_RANGES.map((range, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedPriceRange(i)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                          selectedPriceRange === i
                            ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25'
                            : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:shadow-sm'
                        }`}
                      >
                        {range.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Xóa bộ lọc */}
                {hasActiveFilters && (
                  <button
                    onClick={handleClearFilters}
                    className="flex items-center gap-1.5 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Xóa tất cả bộ lọc
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categories */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-12"
        >
          <button 
            onClick={() => setSelectedCategory(null)}
            className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${!selectedCategory ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-md'}`}
          >
            Tất cả
          </button>
          {categories.map(cat => (
            <button 
              key={cat.id}
              onClick={() => setSelectedCategory(cat.slug)}
              className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${selectedCategory === cat.slug ? 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:shadow-md'}`}
            >
              {cat.name}
            </button>
          ))}
        </motion.div>

        {/* Product Grid */}
        <div className="min-h-[60vh]">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <div className="w-10 h-10 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
              <p className="text-sm font-medium">Đang tải sản phẩm...</p>
            </div>
          ) : (
          <AnimatePresence mode="wait">
            {products.length === 0 ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-24 text-slate-400"
              >
                <div className="w-24 h-24 bg-slate-50 rounded-3xl flex items-center justify-center mb-4 border border-slate-100">
                  <Package className="w-10 h-10 opacity-30" />
                </div>
                <p className="text-sm font-medium">Không có sản phẩm trong danh mục này</p>
              </motion.div>
            ) : (
              <motion.div 
                key={`${selectedCategory || 'all'}-page${currentPage}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {products.map((product, idx) => (
                  <motion.div 
                    key={product.id}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.06, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="product-card group bg-white border border-slate-100 rounded-2xl overflow-hidden cursor-pointer"
                    onClick={() => onProductClick(product.slug)}
                  >
                    {/* Image */}
                    <div className="aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 relative">
                      <img 
                        src={product.image_url} 
                        alt={product.name} 
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      {/* Category badge */}
                      <div className="absolute top-3 left-3">
                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm border border-white/50">
                          {product.category_name}
                        </span>
                      </div>
                      
                      {/* Stock warning */}
                      {product.stock <= 3 && product.stock > 0 && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-amber-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                            Còn {product.stock}
                          </span>
                        </div>
                      )}

                      {/* Quick add on hover */}
                      <motion.button 
                        initial={{ opacity: 0, y: 10 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => handleAddToCart(e, product)}
                        className="absolute bottom-3 right-3 p-3 bg-white/90 backdrop-blur-sm rounded-xl shadow-lg opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all duration-300 text-indigo-600 hover:bg-indigo-600 hover:text-white border border-white/50"
                      >
                        {addedId === product.id ? (
                          <ShoppingCart className="w-4 h-4" />
                        ) : (
                          <Plus className="w-4 h-4" />
                        )}
                      </motion.button>
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-semibold text-slate-900 mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors duration-300">{product.name}</h3>
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2 min-h-[40px] leading-relaxed">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-lg font-extrabold text-slate-900">
                            {product.price.toLocaleString('vi-VN')}
                            <span className="text-sm font-bold text-slate-400 ml-0.5">₫</span>
                          </span>
                        </div>
                        <motion.button 
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.85 }}
                          onClick={(e) => handleAddToCart(e, product)}
                          className={`p-2.5 rounded-xl transition-all duration-300 ${
                            addedId === product.id 
                              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/25' 
                              : 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25 hover:shadow-xl hover:shadow-indigo-500/30'
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
          )}

          {/* Pagination */}
          {pagination && !loading && (
            <Pagination
              pagination={pagination}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      </div>

      {/* ── Features Banner ──────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Bảo hành chính hãng', desc: 'Bảo hành lên đến 36 tháng cho mọi sản phẩm', color: 'indigo' },
              { icon: Truck, title: 'Giao hàng nhanh chóng', desc: 'Ship COD toàn quốc, miễn phí với đơn trên 500K', color: 'violet' },
              { icon: Zap, title: 'Tư vấn build PC', desc: 'Đội ngũ kỹ thuật tư vấn cấu hình phù hợp nhất', color: 'purple' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className={`w-12 h-12 bg-${feature.color}-50 rounded-2xl flex items-center justify-center shrink-0`}>
                  <feature.icon className={`w-6 h-6 text-${feature.color}-600`} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 mb-1">{feature.title}</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">{feature.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
