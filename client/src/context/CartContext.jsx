import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';
import api from '../utils/api';

const CartContext = createContext();

export const CartProvider = ({ children }) => {
  const { isAuthenticated, updateCachedProfile, user } = useAuth();
  const { showToast } = useToast();
  
  const cartKey = user ? `cart_${user.id || user._id}` : 'cart_guest';

  const [cart, setCart] = useState(() => {
    try {
      const cached = localStorage.getItem(cartKey);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const cached = localStorage.getItem(cartKey);
      setCart(cached ? JSON.parse(cached) : []);
    } catch {
      setCart([]);
    }
  }, [cartKey]);

  useEffect(() => {
    localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  const toggleCart = () => setIsOpen(prev => !prev);
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  const addToCart = (book) => {
    if (!isAuthenticated) {
      showToast('Please sign in to add items to your cart', 'warning');
      return;
    }

    if (cart.some(item => item.id === book.id)) {
      showToast('Book is already in your cart', 'info');
      return;
    }

    setCart(prev => [...prev, book]);
    showToast('Added to cart!', 'success');
  };

  const removeFromCart = (id) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  const checkout = async () => {
    if (cart.length === 0) return;
    
    let successCount = 0;
    let errorMsg = '';
    const failedItemIds = [];

    for (const item of cart) {
      try {
        const res = await api.post('/transactions/buy', { bookId: item.id });
        if (res.success) {
          successCount++;
        } else {
          failedItemIds.push(item.id);
        }
      } catch (err) {
        failedItemIds.push(item.id);
        errorMsg = err.message || 'Funds hold failed';
      }
    }

    if (successCount > 0) {
      showToast(`Successfully purchased ${successCount} book(s)! Funds are held in escrow.`, 'success');
      // Only remove the items that were successfully purchased
      setCart(prev => prev.filter(item => failedItemIds.includes(item.id)));
      if (failedItemIds.length === 0) closeCart();
      
      // Update user balances in navbar
      updateCachedProfile();
      return true;
    } else {
      showToast(`Checkout failed: ${errorMsg}`, 'error');
      return false;
    }
  };

  const cartTotal = cart.reduce((total, item) => total + item.price, 0);

  return (
    <CartContext.Provider value={{
      cart,
      isOpen,
      toggleCart,
      openCart,
      closeCart,
      addToCart,
      removeFromCart,
      clearCart,
      checkout,
      cartTotal
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => useContext(CartContext);
