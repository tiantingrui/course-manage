const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 用户注册
router.post('/register', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('name').notEmpty().withMessage('姓名不能为空'),
  body('phone').optional().isMobilePhone('zh-CN').withMessage('请输入有效的手机号'),
  body('role').isIn(['STUDENT', 'TEACHER']).withMessage('无效的用户角色')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, name, phone, role } = req.body;

    // 检查邮箱是否已存在
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ message: '邮箱已被注册' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 12);

    // 创建用户
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        phone,
        role
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true
      }
    });

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    res.status(201).json({
      message: '注册成功',
      user,
      token
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ message: '注册失败' });
  }
});

// 用户登录
router.post('/login', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址'),
  body('password').notEmpty().withMessage('密码不能为空')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: '邮箱或密码错误' });
    }

    // 检查用户状态
    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ message: '账户已被禁用' });
    }

    // 生成JWT令牌
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    // 返回用户信息（不包含密码）
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      message: '登录成功',
      user: userWithoutPassword,
      token
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ message: '登录失败' });
  }
});

// 获取当前用户信息
router.get('/me', auth, async (req, res) => {
  try {
    const { password: _, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({ message: '获取用户信息失败' });
  }
});

// 修改密码
router.put('/change-password', [
  auth,
  body('currentPassword').notEmpty().withMessage('当前密码不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // 获取用户完整信息（包含密码）
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    // 验证当前密码
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ message: '当前密码错误' });
    }

    // 加密新密码
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // 更新密码
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword }
    });

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({ message: '修改密码失败' });
  }
});

// 忘记密码（发送重置邮件）
router.post('/forgot-password', [
  body('email').isEmail().withMessage('请输入有效的邮箱地址')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 生成重置令牌
    const resetToken = jwt.sign(
      { userId: user.id, type: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    // TODO: 发送重置邮件
    // 这里可以集成邮件服务，如Nodemailer

    res.json({ message: '重置密码邮件已发送' });
  } catch (error) {
    console.error('忘记密码错误:', error);
    res.status(500).json({ message: '发送重置邮件失败' });
  }
});

module.exports = router; 