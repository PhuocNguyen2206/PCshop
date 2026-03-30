import React, { createContext, useContext, useState } from 'react';
import { User } from './types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  authHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('pcmaster_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('pcmaster_token');
  });

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
    localStorage.setItem('pcmaster_user', JSON.stringify(userData));
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
    localStorage.setItem('pcmaster_user', JSON.stringify(userData));
    localStorage.setItem('pcmaster_token', jwt);
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('pcmaster_user');
    localStorage.removeItem('pcmaster_token');
  };

  const authHeaders = () => {
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isAuthenticated, authHeaders }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
