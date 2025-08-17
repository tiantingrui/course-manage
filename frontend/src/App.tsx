import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Users from './pages/Users';
import Courses from './pages/Courses';
import Packages from './pages/Packages';
import Attendance from './pages/Attendance';
import Payments from './pages/Payments';
import Statistics from './pages/Statistics';
import Profile from './pages/Profile';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<Login />} />
          
          {/* 受保护的路由 */}
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/users" element={<PrivateRoute><Users /></PrivateRoute>} />
          <Route path="/courses" element={<PrivateRoute><Courses /></PrivateRoute>} />
          <Route path="/packages" element={<PrivateRoute><Packages /></PrivateRoute>} />
          <Route path="/attendance" element={<PrivateRoute><Attendance /></PrivateRoute>} />
          <Route path="/payments" element={<PrivateRoute><Payments /></PrivateRoute>} />
          <Route path="/statistics" element={<PrivateRoute><Statistics /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          
          {/* 默认重定向 */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
};

export default App; 