import { useState, useEffect, useRef } from 'react';
import { Plus, Package, ShoppingCart, Search, SlidersHorizontal, X, ChevronDown, Check } from 'lucide-react';
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

const PRICE_MIN = 0;
const PRICE_MAX = 100000000;
const PRICE_STEP = 500000;

const formatPrice = (v: number) => {
  if (v >= 1000000) return `${(v / 1000000).toFixed(v % 1000000 === 0 ? 0 : 1)}tr`;
  if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
  return String(v);
};

const SORT_OPTIONS = [
  { label: 'Mới nhất', value: 'created_at', order: 'desc' },
  { label: 'Giá tăng dần', value: 'price', order: 'asc' },
  { label: 'Giá giảm dần', value: 'price', order: 'desc' },
  { label: 'Tên A-Z', value: 'name', order: 'asc' },
];

export const ProductsPage = ({ onProductClick, onAuthOpen }: { onProductClick: (slug: string) => void; onAuthOpen: () => void }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([PRICE_MIN, PRICE_MAX]);
  const [selectedSort, setSelectedSort] = useState(0);
  const [sortOpen, setSortOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (!sortOpen) return;
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [sortOpen]);

  const debouncedSearch = useDebounce(searchTerm, 500);
  const debouncedMinPrice = useDebounce(priceRange[0], 400);
  const debouncedMaxPrice = useDebounce(priceRange[1], 400);

  useEffect(() => {
    fetch('/api/categories')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setCategories)
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, selectedCategory, debouncedMinPrice, debouncedMaxPrice, selectedSort]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedCategory) params.set('category', selectedCategory);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());

    if (debouncedMinPrice > PRICE_MIN) params.set('minPrice', String(debouncedMinPrice));
    if (debouncedMaxPrice < PRICE_MAX) params.set('maxPrice', String(debouncedMaxPrice));

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
  }, [selectedCategory, debouncedSearch, debouncedMinPrice, debouncedMaxPrice, selectedSort, currentPage]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory(null);
    setPriceRange([PRICE_MIN, PRICE_MAX]);
    setSelectedSort(0);
    setCurrentPage(1);
  };

  const hasActiveFilters = searchTerm || selectedCategory || priceRange[0] > PRICE_MIN || priceRange[1] < PRICE_MAX || selectedSort > 0;

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Section header */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-3">
          Tất cả <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">sản phẩm</span>
        </h2>
        <p className="text-slate-500 max-w-lg mx-auto">Lựa chọn từ các thương hiệu uy tín hàng đầu thế giới</p>
      </motion.div>

      {/* Search Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
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
          {searchTerm !== debouncedSearch && searchTerm.trim() && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Filter Toggle & Sort */}
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
          {hasActiveFilters && <span className="w-2 h-2 bg-indigo-500 rounded-full" />}
        </button>

        <div ref={sortRef} className="relative">
          <button
            onClick={() => setSortOpen(!sortOpen)}
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

      {/* Filters Panel */}
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
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Khoảng giá</h4>
                  <span className="text-sm font-semibold text-indigo-600">
                    {priceRange[0] === PRICE_MIN && priceRange[1] === PRICE_MAX
                      ? 'Tất cả'
                      : `${formatPrice(priceRange[0])} — ${priceRange[1] >= PRICE_MAX ? 'Không giới hạn' : formatPrice(priceRange[1])}`}
                  </span>
                </div>
                {/* Dual range slider */}
                <div className="relative h-10 flex items-center max-w-md">
                  <div className="absolute inset-x-0 h-2 bg-slate-200 rounded-full" />
                  <div
                    className="absolute h-2 bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full"
                    style={{
                      left: `${(priceRange[0] / PRICE_MAX) * 100}%`,
                      right: `${100 - (priceRange[1] / PRICE_MAX) * 100}%`,
                    }}
                  />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={priceRange[0]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPriceRange(([, max]) => [Math.min(v, max - PRICE_STEP), max]);
                    }}
                    className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-indigo-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-indigo-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                  <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    value={priceRange[1]}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPriceRange(([min]) => [min, Math.max(v, min + PRICE_STEP)]);
                    }}
                    className="absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-violet-500 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:transition-transform [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:appearance-none [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-violet-500 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-pointer"
                  />
                </div>
                {/* Quick preset buttons */}
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {[
                    { label: 'Tất cả', min: PRICE_MIN, max: PRICE_MAX },
                    { label: '< 5tr', min: PRICE_MIN, max: 5000000 },
                    { label: '5-15tr', min: 5000000, max: 15000000 },
                    { label: '15-30tr', min: 15000000, max: 30000000 },
                    { label: '> 30tr', min: 30000000, max: PRICE_MAX },
                  ].map((p) => {
                    const active = priceRange[0] === p.min && priceRange[1] === p.max;
                    return (
                      <button
                        key={p.label}
                        onClick={() => setPriceRange([p.min, p.max])}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                          active
                            ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                            : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-300'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>
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
        animate={{ opacity: 1, y: 0 }}
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
                    <div className="aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 relative">
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                      <div className="absolute top-3 left-3">
                        <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider text-slate-600 shadow-sm border border-white/50">
                          {product.category_name}
                        </span>
                      </div>

                      {product.stock <= 3 && product.stock > 0 && (
                        <div className="absolute top-3 right-3">
                          <span className="bg-amber-500/90 backdrop-blur-sm text-white px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm">
                            Còn {product.stock}
                          </span>
                        </div>
                      )}

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

                    <div className="p-5">
                      <h3 className="font-semibold text-slate-900 mb-1.5 line-clamp-1 group-hover:text-indigo-600 transition-colors duration-300">{product.name}</h3>
                      <p className="text-sm text-slate-400 mb-4 line-clamp-2 min-h-[40px] leading-relaxed whitespace-pre-line break-words">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-extrabold text-slate-900">
                          {product.price.toLocaleString('vi-VN')}
                          <span className="text-sm font-bold text-slate-400 ml-0.5">₫</span>
                        </span>
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
      </div>

      {/* Pagination */}
      {pagination && !loading && (
        <Pagination
          pagination={pagination}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
};
