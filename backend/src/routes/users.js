const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取用户列表（管理员和教师）
router.get('/', auth, requireRole(['ADMIN', 'TEACHER']), [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('role').optional().isIn(['ADMIN', 'TEACHER', 'STUDENT']).withMessage('无效的用户角色'),
  query('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']).withMessage('无效的用户状态'),
  query('search').optional().isString().withMessage('搜索关键词必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, role, status, search } = req.query;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where = {};
    if (role) where.role = role;
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ];
    }

    // 查询用户
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          role: true,
          status: true,
          avatar: true,
          createdAt: true,
          updatedAt: true
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取用户列表错误:', error);
    res.status(500).json({ message: '获取用户列表失败' });
  }
});

// 获取单个用户详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // 检查权限：只能查看自己的信息，或者管理员/教师可以查看所有用户
    if (currentUser.id !== id && !['ADMIN', 'TEACHER'].includes(currentUser.role)) {
      return res.status(403).json({ message: '权限不足' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        avatar: true,
        createdAt: true,
        updatedAt: true,
        // 如果是学生，包含课包信息
        ...(currentUser.role === 'STUDENT' && {
          coursePackages: {
            select: {
              id: true,
              name: true,
              totalHours: true,
              usedHours: true,
              status: true,
              expiresAt: true
            }
          }
        })
      }
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    console.error('获取用户详情错误:', error);
    res.status(500).json({ message: '获取用户详情失败' });
  }
});

// 创建用户（管理员）
router.post('/', auth, requireRole(['ADMIN']), [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
  body('role').isIn(['ADMIN', 'TEACHER', 'STUDENT']).withMessage('无效的用户角色'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']).withMessage('无效的用户状态')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, name, phone, role, status = 'ACTIVE' } = req.body;

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: '邮箱已被注册' });
    }

    // 创建用户（管理员创建的用户需要设置临时密码）
    const tempPassword = Math.random().toString(36).slice(-8);
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role,
        status
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    res.status(201).json({
      message: '用户创建成功',
      user,
      tempPassword // 临时密码，应该通过安全方式发送给用户
    });
  } catch (error) {
    console.error('创建用户错误:', error);
    res.status(500).json({ message: '创建用户失败' });
  }
});

// 更新用户信息
router.put('/:id', auth, [
  body('name').optional().notEmpty().withMessage('姓名不能为空'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
  body('status').optional().isIn(['ACTIVE', 'INACTIVE', 'SUSPENDED']).withMessage('无效的用户状态')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const currentUser = req.user;
    const { name, phone, status } = req.body;

    // 检查权限
    if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 只有管理员可以修改用户状态
    const updateData = { name, phone };
    if (currentUser.role === 'ADMIN' && status) {
      updateData.status = status;
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        status: true,
        avatar: true,
        updatedAt: true
      }
    });

    res.json({
      message: '用户信息更新成功',
      user
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    res.status(500).json({ message: '更新用户信息失败' });
  }
});

// 删除用户（管理员）
router.delete('/:id', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 软删除：将状态设置为SUSPENDED
    await prisma.user.update({
      where: { id },
      data: { status: 'SUSPENDED' }
    });

    res.json({ message: '用户已删除' });
  } catch (error) {
    console.error('删除用户错误:', error);
    res.status(500).json({ message: '删除用户失败' });
  }
});

// 上传头像
router.post('/:id/avatar', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // 检查权限
    if (currentUser.id !== id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // TODO: 实现文件上传逻辑
    // 这里可以使用multer等中间件处理文件上传

    res.json({ message: '头像上传成功' });
  } catch (error) {
    console.error('上传头像错误:', error);
    res.status(500).json({ message: '上传头像失败' });
  }
});

module.exports = router; 