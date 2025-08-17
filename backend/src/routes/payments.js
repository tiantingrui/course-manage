const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取支付记录列表
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('status').optional().isIn(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).withMessage('无效的支付状态'),
  query('method').optional().isIn(['CASH', 'WECHAT', 'ALIPAY', 'BANK_TRANSFER']).withMessage('无效的支付方式'),
  query('studentId').optional().isString().withMessage('学生ID必须是字符串'),
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, status, method, studentId, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    // 构建查询条件
    const where = {};
    if (status) where.status = status;
    if (method) where.method = method;
    if (studentId) where.studentId = studentId;
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = new Date(startDate);
      if (endDate) where.paidAt.lte = new Date(endDate);
    }

    // 学生只能看到自己的支付记录
    if (currentUser.role === 'STUDENT') {
      where.studentId = currentUser.id;
    }

    // 查询支付记录
    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true
            }
          },
          package: {
            select: {
              id: true,
              name: true,
              totalHours: true,
              price: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { paidAt: 'desc' }
      }),
      prisma.payment.count({ where })
    ]);

    res.json({
      payments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取支付记录错误:', error);
    res.status(500).json({ message: '获取支付记录失败' });
  }
});

// 获取单个支付记录详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            totalHours: true,
            price: true,
            validDays: true,
            expiresAt: true
          }
        }
      }
    });

    if (!payment) {
      return res.status(404).json({ message: '支付记录不存在' });
    }

    // 检查权限：学生只能查看自己的支付记录
    if (currentUser.role === 'STUDENT' && payment.studentId !== currentUser.id) {
      return res.status(403).json({ message: '权限不足' });
    }

    res.json({ payment });
  } catch (error) {
    console.error('获取支付记录详情错误:', error);
    res.status(500).json({ message: '获取支付记录详情失败' });
  }
});

// 创建支付记录（管理员）
router.post('/', auth, requireRole(['ADMIN']), [
  body('amount').isFloat({ min: 0 }).withMessage('金额必须为非负数'),
  body('method').isIn(['CASH', 'WECHAT', 'ALIPAY', 'BANK_TRANSFER']).withMessage('无效的支付方式'),
  body('status').isIn(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).withMessage('无效的支付状态'),
  body('studentId').isString().withMessage('学生ID必须是字符串'),
  body('packageId').optional().isString().withMessage('课包ID必须是字符串'),
  body('notes').optional().isString().withMessage('备注必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, method, status, studentId, packageId, notes } = req.body;

    // 检查学生是否存在
    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ message: '指定的学生不存在或不是学生角色' });
    }

    // 如果指定了课包ID，检查课包是否存在
    if (packageId) {
      const coursePackage = await prisma.coursePackage.findUnique({
        where: { id: packageId }
      });

      if (!coursePackage) {
        return res.status(404).json({ message: '课包不存在' });
      }

      if (coursePackage.studentId !== studentId) {
        return res.status(400).json({ message: '课包不属于该学生' });
      }
    }

    const payment = await prisma.payment.create({
      data: {
        amount,
        method,
        status,
        studentId,
        packageId,
        notes
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            totalHours: true,
            price: true
          }
        }
      }
    });

    res.status(201).json({
      message: '支付记录创建成功',
      payment
    });
  } catch (error) {
    console.error('创建支付记录错误:', error);
    res.status(500).json({ message: '创建支付记录失败' });
  }
});

// 更新支付记录状态
router.put('/:id/status', auth, requireRole(['ADMIN']), [
  body('status').isIn(['PENDING', 'PAID', 'FAILED', 'REFUNDED']).withMessage('无效的支付状态'),
  body('notes').optional().isString().withMessage('备注必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;

    // 检查支付记录是否存在
    const existingPayment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!existingPayment) {
      return res.status(404).json({ message: '支付记录不存在' });
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: { status, notes },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            totalHours: true,
            price: true
          }
        }
      }
    });

    res.json({
      message: '支付状态更新成功',
      payment
    });
  } catch (error) {
    console.error('更新支付状态错误:', error);
    res.status(500).json({ message: '更新支付状态失败' });
  }
});

// 删除支付记录
router.delete('/:id', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // 检查支付记录是否存在
    const payment = await prisma.payment.findUnique({
      where: { id }
    });

    if (!payment) {
      return res.status(404).json({ message: '支付记录不存在' });
    }

    // 检查是否可以删除
    if (payment.status === 'PAID') {
      return res.status(400).json({ message: '已支付的记录不能删除' });
    }

    await prisma.payment.delete({
      where: { id }
    });

    res.json({ message: '支付记录删除成功' });
  } catch (error) {
    console.error('删除支付记录错误:', error);
    res.status(500).json({ message: '删除支付记录失败' });
  }
});

// 获取支付统计信息
router.get('/statistics/overview', auth, requireRole(['ADMIN']), [
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;

    // 构建查询条件
    const where = {};
    if (startDate || endDate) {
      where.paidAt = {};
      if (startDate) where.paidAt.gte = new Date(startDate);
      if (endDate) where.paidAt.lte = new Date(endDate);
    }

    const [
      totalPayments,
      paidPayments,
      pendingPayments,
      failedPayments,
      refundedPayments,
      totalAmount,
      paidAmount,
      methodStats
    ] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.count({ where: { ...where, status: 'PAID' } }),
      prisma.payment.count({ where: { ...where, status: 'PENDING' } }),
      prisma.payment.count({ where: { ...where, status: 'FAILED' } }),
      prisma.payment.count({ where: { ...where, status: 'REFUNDED' } }),
      prisma.payment.aggregate({
        where,
        _sum: { amount: true }
      }),
      prisma.payment.aggregate({
        where: { ...where, status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: { ...where, status: 'PAID' },
        _sum: { amount: true },
        _count: true
      })
    ]);

    res.json({
      statistics: {
        totalPayments,
        paidPayments,
        pendingPayments,
        failedPayments,
        refundedPayments,
        totalAmount: totalAmount._sum.amount || 0,
        paidAmount: paidAmount._sum.amount || 0,
        methodStats: methodStats.map(stat => ({
          method: stat.method,
          count: stat._count,
          amount: stat._sum.amount || 0
        }))
      }
    });
  } catch (error) {
    console.error('获取支付统计错误:', error);
    res.status(500).json({ message: '获取支付统计失败' });
  }
});

// 获取月度支付统计
router.get('/statistics/monthly', auth, requireRole(['ADMIN']), [
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('年份必须在2020-2030之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { year } = req.query;

    // 获取指定年份的月度支付数据
    const monthlyStats = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "paidAt") as month,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM payments 
      WHERE 
        status = 'PAID' 
        AND EXTRACT(YEAR FROM "paidAt") = ${parseInt(year)}
      GROUP BY EXTRACT(MONTH FROM "paidAt")
      ORDER BY month
    `;

    // 填充缺失的月份
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyStats.find(stat => stat.month === month);
      monthlyData.push({
        month,
        count: monthData ? parseInt(monthData.count) : 0,
        amount: monthData ? parseFloat(monthData.total_amount) : 0
      });
    }

    res.json({
      year: parseInt(year),
      monthlyData
    });
  } catch (error) {
    console.error('获取月度支付统计错误:', error);
    res.status(500).json({ message: '获取月度支付统计失败' });
  }
});

module.exports = router; 