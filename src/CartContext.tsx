import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CartItem, Product } from './types';
import { useAuth } from './AuthContext';

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (productId: number) => void;
  updateQuantity: (productId: number, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const CART_KEY_PREFIX = 'pcmaster_cart_';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const isLoadedRef = React.useRef(false);

  // Load giỏ hàng từ localStorage khi user thay đổi
  useEffect(() => {
    if (user) {
      const saved = localStorage.getItem(CART_KEY_PREFIX + user.id);
      setItems(saved ? JSON.parse(saved) : []);
    } else {
      setItems([]);
    }
    // Đánh dấu đã load xong, cho phép save
    isLoadedRef.current = true;
    return () => { isLoadedRef.current = false; };
  }, [user]);

  // Lưu giỏ hàng vào localStorage mỗi khi items thay đổi (chỉ sau khi đã load)
  useEffect(() => {
    if (user && isLoadedRef.current) {
      localStorage.setItem(CART_KEY_PREFIX + user.id, JSON.stringify(items));
    }
  }, [items, user]);

  const addToCart = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setItems(prev => prev.filter(item => item.id !== productId));
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev => prev.map(item => 
      item.id === productId ? { ...item, quantity } : item
    ));
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addToCart, removeFromCart, updateQuantity, clearCart, total }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
