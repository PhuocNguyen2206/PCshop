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

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, authHeaders } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);

  // Load giỏ hàng từ DB khi user thay đổi
  const loadCart = useCallback(async () => {
    if (!user) { setItems([]); return; }
    try {
      const res = await fetch('/api/cart', { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (e) {
      console.error('Failed to load cart:', e);
    }
  }, [user, authHeaders]);

  useEffect(() => { loadCart(); }, [loadCart]);

  const addToCart = (product: Product) => {
    setItems(prev => {
      const existing = prev.find(item => item.id === product.id);
      let newQty: number;
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        newQty = existing.quantity + 1;
      } else {
        if (product.stock <= 0) return prev;
        newQty = 1;
      }
      // Sync to DB
      fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ product_id: product.id, quantity: newQty }),
      }).catch(console.error);

      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: newQty } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: number) => {
    setItems(prev => prev.filter(item => item.id !== productId));
    fetch(`/api/cart/${productId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(console.error);
  };

  const updateQuantity = (productId: number, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setItems(prev => prev.map(item =>
      item.id === productId ? { ...item, quantity: Math.min(quantity, item.stock) } : item
    ));
    const item = items.find(i => i.id === productId);
    const finalQty = item ? Math.min(quantity, item.stock) : quantity;
    fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ product_id: productId, quantity: finalQty }),
    }).catch(console.error);
  };

  const clearCart = () => {
    setItems([]);
    fetch('/api/cart', {
      method: 'DELETE',
      headers: authHeaders(),
    }).catch(console.error);
  };

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
