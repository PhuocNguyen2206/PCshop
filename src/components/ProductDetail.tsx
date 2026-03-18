import React, { useState, useEffect } from 'react';
import { ShoppingCart, ChevronRight, Shield, RotateCcw, Truck, ArrowLeft } from 'lucide-react';
import { motion } from 'motion/react';
import { useCart } from '../CartContext';
import { Product } from '../types';

export const ProductDetail = ({ slug, onBack }: { slug: string, onBack: () => void }) => {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const { addToCart } = useCart();

  useEffect(() => {
    setLoading(true);
    fetch(`/api/products/${slug}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data);
        setLoading(false);
      });
  }, [slug]);

  const handleAdd = () => {
    if (!product) return;
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
      <p className="text-zinc-500">Không tìm thấy sản phẩm</p>
      <button onClick={onBack} className="mt-4 text-indigo-600 font-medium">Quay lại cửa hàng</button>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <motion.button 
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        whileHover={{ x: -4 }}
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-indigo-600 transition-colors mb-8 group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> 
        Quay lại cửa hàng
      </motion.button>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-16">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="group bg-gradient-to-br from-zinc-50 to-zinc-100 rounded-3xl overflow-hidden border border-zinc-100 shadow-sm relative"
        >
          <img 
            src={product.image_url} 
            alt={product.name} 
            className="w-full aspect-square object-cover group-hover:scale-[1.03] transition-transform duration-700 ease-out"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col"
        >
          <div className="mb-6">
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-violet-50 text-indigo-600 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-5 border border-indigo-100">
              {product.category_name || 'Linh kiện'}
            </span>
            <h1 className="text-3xl md:text-4xl font-black text-zinc-900 mb-5 leading-tight">{product.name}</h1>
            <p className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent mb-6">
              {product.price.toLocaleString('vi-VN')}đ
            </p>
            <div className="h-px bg-gradient-to-r from-zinc-200 via-zinc-100 to-transparent w-full mb-6" />
            <p className="text-zinc-500 leading-relaxed text-[15px]">
              {product.description}
            </p>
          </div>

          <div className="mt-auto space-y-5">
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${product.stock > 0 ? 'bg-emerald-400 shadow-sm shadow-emerald-200' : 'bg-red-400'}`} />
                <span className="font-medium">{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : 'Hết hàng'}</span>
              </div>
              <div className="w-1 h-1 bg-zinc-300 rounded-full" />
              <div className="flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5" />
                Giao hàng 2-3 ngày
              </div>
            </div>

            <motion.button 
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleAdd}
              disabled={product.stock <= 0}
              className={`w-full py-4 rounded-2xl font-bold transition-all duration-300 flex items-center justify-center gap-3 ${
                added 
                  ? 'bg-emerald-500 text-white shadow-xl shadow-emerald-200' 
                  : 'bg-gradient-to-r from-indigo-500 to-violet-600 text-white hover:shadow-xl hover:shadow-indigo-200 disabled:from-zinc-300 disabled:to-zinc-300 disabled:cursor-not-allowed disabled:shadow-none'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              {added ? 'Đã thêm vào giỏ hàng!' : 'Thêm vào giỏ hàng'}
            </motion.button>
            
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 bg-gradient-to-br from-indigo-50/50 to-white rounded-2xl border border-indigo-100/50 text-center">
                <Shield className="w-5 h-5 text-indigo-500 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Bảo hành</p>
                <p className="text-xs font-semibold text-zinc-800">36 tháng</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-emerald-50/50 to-white rounded-2xl border border-emerald-100/50 text-center">
                <RotateCcw className="w-5 h-5 text-emerald-500 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Đổi trả</p>
                <p className="text-xs font-semibold text-zinc-800">7 ngày</p>
              </div>
              <div className="p-4 bg-gradient-to-br from-violet-50/50 to-white rounded-2xl border border-violet-100/50 text-center">
                <Truck className="w-5 h-5 text-violet-500 mx-auto mb-2" />
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-0.5">Vận chuyển</p>
                <p className="text-xs font-semibold text-zinc-800">Miễn phí</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
