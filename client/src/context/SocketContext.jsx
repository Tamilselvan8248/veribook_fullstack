import React, { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SocketContext = createContext();

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (isAuthenticated && user) {
      // Connect to the Socket.IO server
      const newSocket = io();
      setSocket(newSocket);

      // Join with user ID
      newSocket.emit('join_user', user._id);

      // Listen for push notifications
      newSocket.on('push_notification', (data) => {
        // We only care about messages in this context right now
        if (data.type === 'MESSAGE') {
          showToast(data.title + ' - ' + data.message, 'info');
        }
      });

      return () => {
        newSocket.disconnect();
        setSocket(null);
      };
    }
  }, [isAuthenticated, user, showToast]);

  return (
    <SocketContext.Provider value={{ socket }}>
      {children}
    </SocketContext.Provider>
  );
};
