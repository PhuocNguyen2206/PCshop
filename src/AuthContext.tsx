import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateAvatar: (avatar: string) => void;
  updatePhone: (phone: string) => void;
  updateName: (name: string) => void;
  isAuthenticated: boolean;
  authHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isTokenExpired = (jwt: string): boolean => {
    try {
      const payload = JSON.parse(atob(jwt.split('.')[1]));
      return payload.exp ? payload.exp * 1000 < Date.now() : false;
    } catch { return true; }
  };

  const [token, setToken] = useState<string | null>(() => {
    const savedToken = localStorage.getItem('pcmaster_token');
    if (savedToken && isTokenExpired(savedToken)) {
      localStorage.removeItem('pcmaster_token');
      return null;
    }
    return savedToken;
  });
  const [user, setUser] = useState<User | null>(null);

  // Fetch user từ DB khi có token
  const fetchUser = useCallback(async (jwt: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${jwt}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
      } else {
        // Token không hợp lệ hoặc user không tồn tại
        setToken(null);
        setUser(null);
        localStorage.removeItem('pcmaster_token');
      }
    } catch {
      // Network error — giữ token, thử lại sau
    }
  }, []);

  // Load user từ DB khi app khởi động
  useEffect(() => {
    if (token) fetchUser(token);
  }, [token, fetchUser]);

  const login = async (email: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Đăng nhập thất bại');
    }
    const { token: jwt, ...userData } = await res.json();
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('pcmaster_token', jwt);
  };

  const register = async (name: string, email: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Đăng ký thất bại');
    }
    const { token: jwt, ...userData } = await res.json();
    setUser(userData);
    setToken(jwt);
    localStorage.setItem('pcmaster_token', jwt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pcmaster_token');
  };

  const updateAvatar = (avatar: string) => {
    if (user) setUser({ ...user, avatar });
  };

  const updatePhone = (phone: string) => {
    if (user) setUser({ ...user, phone });
  };

  const updateName = (name: string) => {
    if (user) setUser({ ...user, name });
  };

  const authHeaders = useCallback((): Record<string, string> => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }, [token]);

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, updateAvatar, updatePhone, updateName, isAuthenticated, authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
