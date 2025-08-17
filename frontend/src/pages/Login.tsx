import React, { useState } from 'react';
import { Form, Input, Button, Card, Tabs, message } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';

const { TabPane } = Tabs;

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleLogin = async (values: any) => {
    setLoading(true);
    try {
      await login(values.email, values.password);
      message.success('登录成功');
    } catch (error) {
      // 错误处理已在API拦截器中完成
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (values: any) => {
    setLoading(true);
    try {
      await register(values.email, values.password, values.name, values.phone, values.role);
      message.success('注册成功');
    } catch (error) {
      // 错误处理已在API拦截器中完成
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-form">
        <h1 className="login-title">书法课堂管理系统</h1>
        
        <Tabs defaultActiveKey="login" centered>
          <TabPane tab="登录" key="login">
            <Form
              name="login"
              onFinish={handleLogin}
              autoComplete="off"
              layout="vertical"
            >
              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  prefix={<MailOutlined />} 
                  placeholder="请输入邮箱" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6位' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="请输入密码" 
                  size="large"
                />
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  size="large"
                  block
                >
                  登录
                </Button>
              </Form.Item>
            </Form>
          </TabPane>

          <TabPane tab="注册" key="register">
            <Form
              name="register"
              onFinish={handleRegister}
              autoComplete="off"
              layout="vertical"
            >
              <Form.Item
                name="name"
                label="姓名"
                rules={[
                  { required: true, message: '请输入姓名' }
                ]}
              >
                <Input 
                  prefix={<UserOutlined />} 
                  placeholder="请输入姓名" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="email"
                label="邮箱"
                rules={[
                  { required: true, message: '请输入邮箱' },
                  { type: 'email', message: '请输入有效的邮箱地址' }
                ]}
              >
                <Input 
                  prefix={<MailOutlined />} 
                  placeholder="请输入邮箱" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="phone"
                label="手机号"
                rules={[
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入有效的手机号' }
                ]}
              >
                <Input 
                  prefix={<PhoneOutlined />} 
                  placeholder="请输入手机号（可选）" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="password"
                label="密码"
                rules={[
                  { required: true, message: '请输入密码' },
                  { min: 6, message: '密码至少6位' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="请输入密码" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="确认密码"
                dependencies={['password']}
                rules={[
                  { required: true, message: '请确认密码' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('两次输入的密码不一致'));
                    },
                  }),
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="请确认密码" 
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="role"
                label="角色"
                initialValue="STUDENT"
                rules={[
                  { required: true, message: '请选择角色' }
                ]}
              >
                <Input.Group compact>
                  <Button 
                    type="default" 
                    style={{ width: '50%' }}
                    onClick={() => {
                      const form = document.querySelector('form[name="register"]') as any;
                      if (form) {
                        form.setFieldsValue({ role: 'STUDENT' });
                      }
                    }}
                  >
                    学生
                  </Button>
                  <Button 
                    type="default" 
                    style={{ width: '50%' }}
                    onClick={() => {
                      const form = document.querySelector('form[name="register"]') as any;
                      if (form) {
                        form.setFieldsValue({ role: 'TEACHER' });
                      }
                    }}
                  >
                    教师
                  </Button>
                </Input.Group>
              </Form.Item>

              <Form.Item>
                <Button 
                  type="primary" 
                  htmlType="submit" 
                  loading={loading}
                  size="large"
                  block
                >
                  注册
                </Button>
              </Form.Item>
            </Form>
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default Login; 