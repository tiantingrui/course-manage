import React, { ReactNode, useState } from 'react';
import { Layout as AntLayout, Menu, Avatar, Dropdown, Button } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  BookOutlined,
  PackageOutlined,
  CalendarOutlined,
  DollarOutlined,
  BarChartOutlined,
  LogoutOutlined,
  DashboardOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Sider, Content } = AntLayout;

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: '仪表盘',
    },
    {
      key: '/users',
      icon: <TeamOutlined />,
      label: '用户管理',
      roles: ['ADMIN'],
    },
    {
      key: '/courses',
      icon: <BookOutlined />,
      label: '课程管理',
      roles: ['ADMIN', 'TEACHER'],
    },
    {
      key: '/packages',
      icon: <PackageOutlined />,
      label: '课包管理',
    },
    {
      key: '/attendance',
      icon: <CalendarOutlined />,
      label: '出勤管理',
      roles: ['ADMIN', 'TEACHER'],
    },
    {
      key: '/payments',
      icon: <DollarOutlined />,
      label: '支付管理',
      roles: ['ADMIN'],
    },
    {
      key: '/statistics',
      icon: <BarChartOutlined />,
      label: '统计分析',
      roles: ['ADMIN', 'TEACHER'],
    },
  ];

  // 根据用户角色过滤菜单项
  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(user?.role || 'STUDENT');
  });

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人资料',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Sider trigger={null} collapsible collapsed={collapsed}>
        <div className="logo" />
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <AntLayout>
        <Header style={{ padding: 0, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{
              fontSize: '16px',
              width: 64,
              height: 64,
            }}
          />
          <div style={{ marginRight: 24 }}>
            <Dropdown
              menu={{ items: userMenuItems }}
              placement="bottomRight"
              arrow
            >
              <div style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Avatar icon={<UserOutlined />} />
                <span>{user?.name}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            minHeight: 280,
            background: '#f0f2f5',
          }}
        >
          {children}
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout; 