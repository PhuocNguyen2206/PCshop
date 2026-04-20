import { useState, useEffect } from 'react';
import { X, LogIn, UserPlus, Mail, Lock, User, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../AuthContext';

export const AuthModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const [isLogin, setIsLogin] = useState(true);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (isLogin) {
        await login(formData.email, formData.password);
      } else {
        await register(formData.name, formData.email, formData.password);
      }
      setFormData({ name: '', email: '', password: '' });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[80]"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-[90] overflow-hidden"
          >
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
              {/* Top decorative bar */}
              <div className="h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />
              
              {/* Header with branding */}
              <div className="px-8 pt-8 pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <Cpu className="w-5 h-5 text-white" />
                      </div>
                      <span className="text-sm font-bold text-slate-400">PC MASTER</span>
                    </div>
                    <h2 className="text-2xl font-black text-slate-900">{isLogin ? 'Chào mừng trở lại' : 'Tạo tài khoản'}</h2>
                    <p className="text-sm text-slate-500 mt-1">{isLogin ? 'Đăng nhập để tiếp tục mua sắm' : 'Tham gia cùng PC MASTER ngay hôm nay'}</p>
                  </div>
                  <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors -mt-1 -mr-1">
                    <X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>
              </div>

              <div className="px-8 pb-8 pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 font-medium"
                    >
                      {error}
                    </motion.div>
                  )}
                  {!isLogin && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Họ tên</label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                        <input 
                          type="text" 
                          required
                          disabled={loading}
                          placeholder="Nhập họ và tên"
                          className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                          value={formData.name}
                          onChange={e => setFormData({...formData, name: e.target.value})}
                        />
                      </div>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="email" 
                        required
                        disabled={loading}
                        placeholder="you@example.com"
                        className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mật khẩu</label>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                      <input 
                        type="password" 
                        required
                        disabled={loading}
                        placeholder="••••••••"
                        className="w-full pl-11 pr-4 py-3.5 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all disabled:bg-slate-50 disabled:cursor-not-allowed"
                        value={formData.password}
                        onChange={e => setFormData({...formData, password: e.target.value})}
                      />
                    </div>
                  </div>

                  <motion.button 
                    type="submit"
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.01, y: loading ? 0 : -1 }}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-4 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-xl hover:shadow-indigo-500/25 disabled:from-slate-400 disabled:to-slate-400 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 mt-6"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white"></div>
                    ) : (
                      <>
                        {isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />}
                        {isLogin ? 'Đăng nhập' : 'Đăng ký'}
                      </>
                    )}
                  </motion.button>
                </form>

                <div className="mt-8 text-center">
                  <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-slate-100"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-white px-4 text-slate-400">hoặc</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsLogin(!isLogin); setError(''); }}
                    className="text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium"
                  >
                    {isLogin ? 'Chưa có tài khoản? Đăng ký ngay' : 'Đã có tài khoản? Đăng nhập'}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
