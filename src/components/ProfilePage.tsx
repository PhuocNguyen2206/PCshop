import React, { useState } from 'react';
import { Mail, Shield, Calendar, Phone, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useAuth } from '../AuthContext';
import { ImageUpload } from './ImageUpload';

export const ProfilePage = () => {
  const { user, updateAvatar, updatePhone, authHeaders } = useAuth();
  const [phone, setPhone] = useState(user?.phone || '');
  const [editingPhone, setEditingPhone] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const handleSavePhone = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ phone }),
      });
      if (res.ok) {
        updatePhone(phone);
        setEditingPhone(false);
      }
    } catch {} finally { setSaving(false); }
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden"
      >
        {/* Header gradient */}
        <div className="h-32 bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-600 relative">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyem0wLTMwVjBoLTEydjRoMTJ6TTI0IDI0aDEydi0xMkgyNHYxMnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        </div>

        {/* Avatar section - overlapping the header */}
        <div className="px-8 -mt-16 relative z-10">
          <div className="flex flex-col items-center sm:flex-row sm:items-end gap-5">
            <ImageUpload
                endpoint="/api/upload/avatar"
                fieldName="avatar"
                currentImage={user.avatar}
                onUploadSuccess={(url) => updateAvatar(url)}
                maxSizeMB={10}
                shape="circle"
                label=""
              />
            <div className="text-center sm:text-left pb-2">
              <h1 className="text-2xl font-black text-slate-900">{user.name}</h1>
              <span className={`inline-flex items-center gap-1.5 mt-1 px-3 py-1 rounded-full text-xs font-semibold ${
                user.role === 'admin' 
                  ? 'bg-indigo-100 text-indigo-700' 
                  : 'bg-slate-100 text-slate-600'
              }`}>
                <Shield className="w-3 h-3" />
                {user.role === 'admin' ? 'Quản trị viên' : 'Khách hàng'}
              </span>
            </div>
          </div>
        </div>

        {/* User Info */}
        <div className="px-8 py-8 mt-4 space-y-4">
          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center shrink-0">
              <Mail className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email</p>
              <p className="text-sm font-semibold text-slate-700">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
            <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-emerald-500" />
            </div>
            <div className="flex-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</p>
              {editingPhone ? (
                <div className="flex items-center gap-2 mt-1">
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="Nhập số điện thoại"
                    className="flex-1 text-sm font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSavePhone}
                    disabled={saving}
                    className="p-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <p
                  onClick={() => setEditingPhone(true)}
                  className="text-sm font-semibold text-slate-700 cursor-pointer hover:text-indigo-600 transition-colors"
                >
                  {user.phone || <span className="text-slate-400 italic">Chưa cập nhật — nhấn để thêm</span>}
                </p>
              )}
            </div>
          </div>

          {user.created_at && (
            <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl">
              <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center shrink-0">
                <Calendar className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày tham gia</p>
                <p className="text-sm font-semibold text-slate-700">
                  {new Date(user.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
