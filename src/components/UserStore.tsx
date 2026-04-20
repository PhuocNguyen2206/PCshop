import { useState, useEffect } from 'react';
import { Plus, Sparkles, ShoppingCart, Zap, Shield, Truck, Star, ChevronDown, TrendingUp, Flame } from 'lucide-react';
import { motion } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { Product } from '../types';

export const UserStore = ({ onProductClick, onAuthOpen, onViewProducts }: { onProductClick: (slug: string) => void; onAuthOpen: () => void; onViewProducts: () => void }) => {
  const [bestSellers, setBestSellers] = useState<(Product & { total_sold?: number })[]>([]);
  const [addedId, setAddedId] = useState<number | null>(null);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    fetch('/api/products/best-sellers?limit=8')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setBestSellers)
      .catch(() => setBestSellers([]));
  }, []);

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
                  onClick={onViewProducts}
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

      {/* ── Best Sellers Section ────────────────────────────── */}
      {bestSellers.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="flex items-center justify-between mb-10"
          >
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-orange-50 border border-orange-100 rounded-full text-xs font-semibold text-orange-600 mb-3">
                <Flame className="w-3.5 h-3.5" />
                Hot picks
              </div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900">
                Sản phẩm <span className="bg-gradient-to-r from-orange-500 to-rose-500 bg-clip-text text-transparent">bán chạy</span>
              </h2>
            </div>
            <button
              onClick={onViewProducts}
              className="hidden md:inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
            >
              Xem tất cả
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </motion.div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {bestSellers.map((product, idx) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
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

                  {/* Rank badge */}
                  {idx < 3 && (
                    <div className="absolute top-3 left-3">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold shadow-sm backdrop-blur-sm ${
                        idx === 0 ? 'bg-amber-400/90 text-amber-900' :
                        idx === 1 ? 'bg-slate-300/90 text-slate-700' :
                        'bg-orange-300/90 text-orange-800'
                      }`}>
                        <TrendingUp className="w-3 h-3" />
                        #{idx + 1}
                      </span>
                    </div>
                  )}

                  {/* Sold count */}
                  {product.total_sold && product.total_sold > 0 && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-white/90 backdrop-blur-sm text-slate-600 px-2 py-1 rounded-lg text-[10px] font-semibold shadow-sm">
                        Đã bán {product.total_sold}
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
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">{product.category_name}</p>
                  <h3 className="font-semibold text-slate-900 mb-3 line-clamp-1 group-hover:text-indigo-600 transition-colors duration-300">{product.name}</h3>
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
                          : 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/25 hover:shadow-xl hover:shadow-orange-500/30'
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
          </div>
        </div>
      )}

      {/* ── Features Banner ──────────────────────────────── */}
      <div className="bg-gradient-to-r from-slate-50 to-slate-100/50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: 'Bảo hành chính hãng', desc: 'Bảo hành lên đến 36 tháng cho mọi sản phẩm', bgColor: 'bg-indigo-50', textColor: 'text-indigo-600' },
              { icon: Truck, title: 'Giao hàng nhanh chóng', desc: 'Ship COD toàn quốc, miễn phí với đơn trên 500K', bgColor: 'bg-violet-50', textColor: 'text-violet-600' },
              { icon: Zap, title: 'Tư vấn build PC', desc: 'Đội ngũ kỹ thuật tư vấn cấu hình phù hợp nhất', bgColor: 'bg-purple-50', textColor: 'text-purple-600' },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex items-start gap-4 p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-300"
              >
                <div className={`w-12 h-12 ${feature.bgColor} rounded-2xl flex items-center justify-center shrink-0`}>
                  <feature.icon className={`w-6 h-6 ${feature.textColor}`} />
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
