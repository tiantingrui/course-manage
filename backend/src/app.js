const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const courseRoutes = require('./routes/courses');
const packageRoutes = require('./routes/packages');
const attendanceRoutes = require('./routes/attendance');
const paymentRoutes = require('./routes/payments');
const statisticsRoutes = require('./routes/statistics');

const errorHandler = require('./middleware/errorHandler');
const { PrismaClient } = require('@prisma/client');

const app = express();
const prisma = new PrismaClient();

// 中间件
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/packages', packageRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/statistics', statisticsRoutes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 错误处理中间件
app.use(errorHandler);

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

const PORT = process.env.PORT || 3001;

// 启动服务器
async function startServer() {
  try {
    await prisma.$connect();
    console.log('数据库连接成功');
    
    app.listen(PORT, () => {
      console.log(`服务器运行在端口 ${PORT}`);
    });
  } catch (error) {
    console.error('启动服务器失败:', error);
    process.exit(1);
  }
}

// 优雅关闭
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

module.exports = app; 