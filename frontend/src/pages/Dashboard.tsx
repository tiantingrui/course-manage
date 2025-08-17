import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Table, Tag } from 'antd';
import { 
  UserOutlined, 
  BookOutlined, 
  PackageOutlined, 
  DollarOutlined,
  TeamOutlined,
  CalendarOutlined
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { OverviewStatistics, Course, CoursePackage } from '../types';

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [statistics, setStatistics] = useState<OverviewStatistics | null>(null);
  const [recentCourses, setRecentCourses] = useState<Course[]>([]);
  const [recentPackages, setRecentPackages] = useState<CoursePackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // 获取统计数据
        const statsResponse = await api.get('/statistics/overview');
        setStatistics(statsResponse.data.overview);

        // 获取最近课程
        const coursesResponse = await api.get('/courses?limit=5');
        setRecentCourses(coursesResponse.data.courses);

        // 获取最近课包
        const packagesResponse = await api.get('/packages?limit=5');
        setRecentPackages(packagesResponse.data.packages);
      } catch (error) {
        console.error('获取仪表盘数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const getRoleDisplayName = (role: string) => {
    switch (role) {
      case 'ADMIN': return '管理员';
      case 'TEACHER': return '教师';
      case 'STUDENT': return '学生';
      default: return role;
    }
  };

  const getStatusTag = (status: string) => {
    const statusMap: { [key: string]: { color: string; text: string } } = {
      'SCHEDULED': { color: 'blue', text: '已安排' },
      'IN_PROGRESS': { color: 'orange', text: '进行中' },
      'COMPLETED': { color: 'green', text: '已完成' },
      'CANCELLED': { color: 'red', text: '已取消' },
      'ACTIVE': { color: 'green', text: '有效' },
      'EXPIRED': { color: 'red', text: '已过期' },
    };

    const statusInfo = statusMap[status] || { color: 'default', text: status };
    return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
  };

  const courseColumns = [
    {
      title: '课程名称',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '教师',
      dataIndex: ['teacher', 'name'],
      key: 'teacher',
    },
    {
      title: '开始时间',
      dataIndex: 'startTime',
      key: 'startTime',
      render: (text: string) => new Date(text).toLocaleString(),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
    {
      title: '学生数',
      dataIndex: 'currentStudents',
      key: 'currentStudents',
      render: (current: number, record: Course) => `${current}/${record.maxStudents}`,
    },
  ];

  const packageColumns = [
    {
      title: '课包名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '学生',
      dataIndex: ['student', 'name'],
      key: 'student',
    },
    {
      title: '课时',
      dataIndex: 'totalHours',
      key: 'totalHours',
      render: (total: number, record: CoursePackage) => `${record.usedHours}/${total}`,
    },
    {
      title: '价格',
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `¥${price}`,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => getStatusTag(status),
    },
  ];

  if (loading) {
    return <div>加载中...</div>;
  }

  return (
    <div>
      <h1>欢迎回来，{user?.name}！</h1>
      <p>您当前的角色是：{getRoleDisplayName(user?.role || '')}</p>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={statistics?.totalUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总课程数"
              value={statistics?.totalCourses || 0}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总课包数"
              value={statistics?.totalPackages || 0}
              prefix={<PackageOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总收入"
              value={statistics?.totalRevenue || 0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#cf1322' }}
              suffix="元"
            />
          </Card>
        </Col>
      </Row>

      {/* 详细统计 */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="学生数"
              value={statistics?.totalStudents || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="教师数"
              value={statistics?.totalTeachers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={8}>
          <Card>
            <Statistic
              title="总课时"
              value={statistics?.totalHours || 0}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#722ed1' }}
              suffix="小时"
            />
          </Card>
        </Col>
      </Row>

      {/* 最近课程和课包 */}
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card title="最近课程" style={{ marginBottom: 16 }}>
            <Table
              columns={courseColumns}
              dataSource={recentCourses}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="最近课包" style={{ marginBottom: 16 }}>
            <Table
              columns={packageColumns}
              dataSource={recentPackages}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 