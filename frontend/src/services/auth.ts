import api from './api';
import { LoginRequest, RegisterRequest, LoginResponse, User } from '../types';

export const authService = {
  // 用户登录
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  // 用户注册
  register: async (data: RegisterRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // 获取当前用户信息
  getCurrentUser: async (): Promise<{ user: User }> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // 修改密码
  changePassword: async (data: { currentPassword: string; newPassword: string }): Promise<{ message: string }> => {
    const response = await api.put('/auth/change-password', data);
    return response.data;
  },

  // 忘记密码
  forgotPassword: async (email: string): Promise<{ message: string }> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  // 登出
  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  },

  // 检查是否已登录
  isAuthenticated: (): boolean => {
    return !!localStorage.getItem('token');
  },

  // 获取存储的用户信息
  getStoredUser: (): User | null => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  },

  // 存储用户信息
  storeUser: (user: User, token: string) => {
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('token', token);
  }
}; 