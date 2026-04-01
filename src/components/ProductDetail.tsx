import React, { useState, useEffect } from 'react';
import { ShoppingCart, ChevronRight, Shield, RotateCcw, Truck, ArrowLeft, Zap, Star, Package, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useCart } from '../CartContext';
import { useAuth } from '../AuthContext';
import { Product } from '../types';

export const ProductDetail = ({ slug, onBack, onAuthOpen }: { slug: string, onBack: () => void, onAuthOpen: () => void }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/${slug}`)
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(data => {
        setProduct(data);
        setLoading(false);
      })
      .catch(() => {
        setProduct(null);
        setLoading(false);
      });
  }, [slug]);

  const handleAdd = () => {
    if (!product) return;
    if (!isAuthenticated) {
      onAuthOpen();
      return;
    }
    addToCart(product);
    setAdded(true);
    setTimeout(() => setAdded(false), 1200);
  };

  if (loading) return (
    <div className="max-w-7xl mx-auto px-4 py-32 flex flex-col items-center gap-4">
      <div className="w-16 h-16 rounded-2xl animate-shimmer" />
      <div className="w-48 h-4 rounded-full animate-shimmer" />
    </div>
  );

  if (!product) return (
    <div className="max-w-7xl mx-auto px-4 py-24 text-center">
      <div className="w-20 h-20 bg-slate-50 rounded-3xl flex items-center justify-center mx-auto mb-4 border border-slate-100">
        <Package className="w-10 h-10 text-slate-300" />
      </div>
      <p className="text-slate-500 font-medium">Không tìm thấy sản phẩm</p>
      <button onClick={onBack} className="mt-4 text-indigo-600 font-semibold hover:underline">Quay lại cửa hàng</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      {/* Breadcrumb */}
      <motion.button 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: -4 }}
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-slate-400 hover:text-indigo-600 transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> 
        Quay lại cửa hàng
      </motion.button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
        {/* Image */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl overflow-hidden border border-slate-200/50 shadow-sm relative"
        >
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full aspect-square object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
          {/* Floating badges */}
          <div className="absolute top-4 left-4 flex flex-col gap-2">
            <span className="bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-xl text-[11px] font-bold uppercase tracking-wider text-slate-600 shadow-sm border border-white/50">
              {product.category_name || 'Linh kiện'}
            </span>
          </div>
        </motion.div>

        {/* Info */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col"
        >
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider border border-indigo-100">
                {product.category_name || 'Linh kiện'}
              </span>
              <div className="flex items-center gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-current" />)}
                <span className="text-xs text-slate-400 ml-1 font-medium">(4.9)</span>
              </div>
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black text-slate-900 mb-6 leading-tight">{product.name}</h1>
            
            <div className="flex items-baseline gap-3 mb-6">
              <span className="text-4xl font-black text-slate-900">
                {product.price.toLocaleString('vi-VN')}
              </span>
              <span className="text-lg font-bold text-slate-400">₫</span>
            </div>

            <div className="h-px bg-gradient-to-r from-slate-200 via-slate-100 to-transparent w-full mb-6" />
            
            <p className="text-slate-500 leading-relaxed text-[15px]">
              {product.description}
            </p>
          </div>

          <div className="mt-auto space-y-6">
            {/* Stock & shipping info */}
            <div className="flex items-center gap-5 text-sm">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-red-400 shadow-sm shadow-red-400/50'}`} />
                <span className="font-medium text-slate-600">{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}</span>
              </div>
              <div className="w-1 h-1 bg-slate-300 rounded-full" />
              <div className="flex items-center gap-1.5 text-slate-500">
                <Truck className="w-3.5 h-3.5" />
                Giao hàng 2-3 ngày
              </div>
            </div>

            {/* Add to cart */}
            <motion.button 
              whileHover={{ scale: 1.01, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAdd}
              disabled={product.stock <= 0}
              className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 text-base ${
                added 
                  ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-500/25' 
                  : 'bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white hover:shadow-2xl hover:shadow-indigo-500/25 disabled:from-slate-300 disabled:to-slate-300 disabled:cursor-not-allowed disabled:shadow-none'
              }`}
            >
              {added ? (
                <>
                  <Check className="w-5 h-5" />
                  Đã thêm vào giỏ hàng!
                </>
              ) : (
                <>
                  <ShoppingCart className="w-5 h-5" />
                  Thêm vào giỏ hàng
                </>
              )}
            </motion.button>
            
            {/* Feature grid */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: Shield, title: 'Bảo hành', value: '36 tháng', bg: 'from-indigo-50', border: 'border-indigo-100/50', iconColor: 'text-indigo-500' },
                { icon: RotateCcw, title: 'Đổi trả', value: '7 ngày', bg: 'from-emerald-50', border: 'border-emerald-100/50', iconColor: 'text-emerald-500' },
                { icon: Truck, title: 'Vận chuyển', value: 'Miễn phí', bg: 'from-violet-50', border: 'border-violet-100/50', iconColor: 'text-violet-500' },
              ].map(f => (
                <div key={f.title} className={`p-4 bg-gradient-to-br ${f.bg} to-white rounded-2xl border ${f.border} text-center`}>
                  <f.icon className={`w-5 h-5 ${f.iconColor} mx-auto mb-2`} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-0.5">{f.title}</p>
                  <p className="text-xs font-semibold text-slate-800">{f.value}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
