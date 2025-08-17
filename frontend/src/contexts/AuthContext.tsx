import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, phone?: string, role?: 'STUDENT' | 'TEACHER') => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // 检查本地存储的用户信息
        const storedUser = authService.getStoredUser();
        if (storedUser && authService.isAuthenticated()) {
          // 验证token有效性
          const { user: currentUser } = await authService.getCurrentUser();
          setUser(currentUser);
        }
      } catch (error) {
        // token无效，清除本地存储
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const response = await authService.login({ email, password });
      authService.storeUser(response.user, response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const register = async (email: string, password: string, name: string, phone?: string, role: 'STUDENT' | 'TEACHER' = 'STUDENT') => {
    try {
      const response = await authService.register({ email, password, name, phone, role });
      authService.storeUser(response.user, response.token);
      setUser(response.user);
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
    // 更新本地存储
    const token = localStorage.getItem('token');
    if (token) {
      authService.storeUser(updatedUser, token);
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    register,
    logout,
    updateUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 