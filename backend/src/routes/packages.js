const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取课包列表
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('status').optional().isIn(['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED']).withMessage('无效的课包状态'),
  query('studentId').optional().isString().withMessage('学生ID必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, status, studentId } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    // 构建查询条件
    const where = {};
    if (status) where.status = status;
    
    // 学生只能看到自己的课包
    if (currentUser.role === 'STUDENT') {
      where.studentId = currentUser.id;
    } else if (studentId) {
      where.studentId = studentId;
    }

    // 查询课包
    const [packages, total] = await Promise.all([
      prisma.coursePackage.findMany({
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
          payments: {
            select: {
              id: true,
              amount: true,
              method: true,
              status: true,
              paidAt: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { purchasedAt: 'desc' }
      }),
      prisma.coursePackage.count({ where })
    ]);

    res.json({
      packages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取课包列表错误:', error);
    res.status(500).json({ message: '获取课包列表失败' });
  }
});

// 获取单个课包详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const coursePackage = await prisma.coursePackage.findUnique({
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
        payments: {
          select: {
            id: true,
            amount: true,
            method: true,
            status: true,
            paidAt: true
          }
        }
      }
    });

    if (!coursePackage) {
      return res.status(404).json({ message: '课包不存在' });
    }

    // 检查权限：学生只能查看自己的课包
    if (currentUser.role === 'STUDENT' && coursePackage.studentId !== currentUser.id) {
      return res.status(403).json({ message: '权限不足' });
    }

    res.json({ coursePackage });
  } catch (error) {
    console.error('获取课包详情错误:', error);
    res.status(500).json({ message: '获取课包详情失败' });
  }
});

// 创建课包（管理员）
router.post('/', auth, requireRole(['ADMIN']), [
  body('name').notEmpty().withMessage('课包名称不能为空'),
  body('description').optional().isString().withMessage('课包描述必须是字符串'),
  body('totalHours').isInt({ min: 1 }).withMessage('总课时必须为正整数'),
  body('price').isFloat({ min: 0 }).withMessage('价格必须为非负数'),
  body('validDays').isInt({ min: 1 }).withMessage('有效期天数必须为正整数'),
  body('studentId').isString().withMessage('学生ID必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, totalHours, price, validDays, studentId } = req.body;

    // 检查学生是否存在
    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ message: '指定的学生不存在或不是学生角色' });
    }

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validDays);

    const coursePackage = await prisma.coursePackage.create({
      data: {
        name,
        description,
        totalHours,
        price,
        validDays,
        studentId,
        expiresAt
      },
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: '课包创建成功',
      coursePackage
    });
  } catch (error) {
    console.error('创建课包错误:', error);
    res.status(500).json({ message: '创建课包失败' });
  }
});

// 更新课包信息
router.put('/:id', auth, requireRole(['ADMIN']), [
  body('name').optional().notEmpty().withMessage('课包名称不能为空'),
  body('description').optional().isString().withMessage('课包描述必须是字符串'),
  body('status').optional().isIn(['ACTIVE', 'EXPIRED', 'COMPLETED', 'CANCELLED']).withMessage('无效的课包状态')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const updateData = req.body;

    // 检查课包是否存在
    const existingPackage = await prisma.coursePackage.findUnique({
      where: { id }
    });

    if (!existingPackage) {
      return res.status(404).json({ message: '课包不存在' });
    }

    const coursePackage = await prisma.coursePackage.update({
      where: { id },
      data: updateData,
      include: {
        student: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: '课包更新成功',
      coursePackage
    });
  } catch (error) {
    console.error('更新课包错误:', error);
    res.status(500).json({ message: '更新课包失败' });
  }
});

// 删除课包
router.delete('/:id', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const { id } = req.params;

    // 检查课包是否存在
    const coursePackage = await prisma.coursePackage.findUnique({
      where: { id }
    });

    if (!coursePackage) {
      return res.status(404).json({ message: '课包不存在' });
    }

    // 检查是否可以删除
    if (coursePackage.usedHours > 0) {
      return res.status(400).json({ message: '课包已使用，无法删除' });
    }

    // 删除相关的支付记录
    await prisma.payment.deleteMany({
      where: { packageId: id }
    });

    // 删除课包
    await prisma.coursePackage.delete({
      where: { id }
    });

    res.json({ message: '课包删除成功' });
  } catch (error) {
    console.error('删除课包错误:', error);
    res.status(500).json({ message: '删除课包失败' });
  }
});

// 购买课包
router.post('/purchase', auth, requireRole(['STUDENT']), [
  body('name').notEmpty().withMessage('课包名称不能为空'),
  body('description').optional().isString().withMessage('课包描述必须是字符串'),
  body('totalHours').isInt({ min: 1 }).withMessage('总课时必须为正整数'),
  body('price').isFloat({ min: 0 }).withMessage('价格必须为非负数'),
  body('validDays').isInt({ min: 1 }).withMessage('有效期天数必须为正整数'),
  body('paymentMethod').isIn(['CASH', 'WECHAT', 'ALIPAY', 'BANK_TRANSFER']).withMessage('无效的支付方式')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, description, totalHours, price, validDays, paymentMethod } = req.body;
    const studentId = req.user.id;

    // 计算过期时间
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validDays);

    // 创建课包和支付记录
    const result = await prisma.$transaction(async (tx) => {
      // 创建课包
      const coursePackage = await tx.coursePackage.create({
        data: {
          name,
          description,
          totalHours,
          price,
          validDays,
          studentId,
          expiresAt
        }
      });

      // 创建支付记录
      const payment = await tx.payment.create({
        data: {
          amount: price,
          method: paymentMethod,
          status: 'PAID',
          packageId: coursePackage.id,
          studentId
        }
      });

      return { coursePackage, payment };
    });

    res.status(201).json({
      message: '课包购买成功',
      coursePackage: result.coursePackage,
      payment: result.payment
    });
  } catch (error) {
    console.error('购买课包错误:', error);
    res.status(500).json({ message: '购买课包失败' });
  }
});

// 消耗课时
router.post('/:id/consume', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('hours').isInt({ min: 1 }).withMessage('消耗课时必须为正整数'),
  body('courseId').isString().withMessage('课程ID必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { hours, courseId } = req.body;

    // 检查课包是否存在
    const coursePackage = await prisma.coursePackage.findUnique({
      where: { id }
    });

    if (!coursePackage) {
      return res.status(404).json({ message: '课包不存在' });
    }

    // 检查课包状态
    if (coursePackage.status !== 'ACTIVE') {
      return res.status(400).json({ message: '课包已不可用' });
    }

    // 检查是否过期
    if (coursePackage.expiresAt < new Date()) {
      return res.status(400).json({ message: '课包已过期' });
    }

    // 检查剩余课时
    const remainingHours = coursePackage.totalHours - coursePackage.usedHours;
    if (remainingHours < hours) {
      return res.status(400).json({ message: '课时不足' });
    }

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 更新课包使用课时
    const newUsedHours = coursePackage.usedHours + hours;
    const newStatus = newUsedHours >= coursePackage.totalHours ? 'COMPLETED' : 'ACTIVE';

    await prisma.coursePackage.update({
      where: { id },
      data: {
        usedHours: newUsedHours,
        status: newStatus
      }
    });

    res.json({
      message: '课时消耗成功',
      remainingHours: coursePackage.totalHours - newUsedHours,
      status: newStatus
    });
  } catch (error) {
    console.error('消耗课时错误:', error);
    res.status(500).json({ message: '消耗课时失败' });
  }
});

// 获取课包统计信息
router.get('/statistics/overview', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [
      totalPackages,
      activePackages,
      expiredPackages,
      completedPackages,
      totalRevenue,
      totalHours
    ] = await Promise.all([
      prisma.coursePackage.count(),
      prisma.coursePackage.count({ where: { status: 'ACTIVE' } }),
      prisma.coursePackage.count({ where: { status: 'EXPIRED' } }),
      prisma.coursePackage.count({ where: { status: 'COMPLETED' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.coursePackage.aggregate({
        _sum: { totalHours: true }
      })
    ]);

    res.json({
      statistics: {
        totalPackages,
        activePackages,
        expiredPackages,
        completedPackages,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalHours: totalHours._sum.totalHours || 0
      }
    });
  } catch (error) {
    console.error('获取课包统计错误:', error);
    res.status(500).json({ message: '获取统计信息失败' });
  }
});

module.exports = router; 