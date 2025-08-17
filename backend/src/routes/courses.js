const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取课程列表
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('status').optional().isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('无效的课程状态'),
  query('teacherId').optional().isString().withMessage('教师ID必须是字符串'),
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, status, teacherId, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    // 构建查询条件
    const where = {};
    if (status) where.status = status;
    if (teacherId) where.teacherId = teacherId;
    if (startDate || endDate) {
      where.startTime = {};
      if (startDate) where.startTime.gte = new Date(startDate);
      if (endDate) where.startTime.lte = new Date(endDate);
    }

    // 学生只能看到自己报名的课程
    if (currentUser.role === 'STUDENT') {
      where.students = {
        some: {
          studentId: currentUser.id
        }
      };
    }

    // 查询课程
    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        include: {
          teacher: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          students: {
            include: {
              student: {
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              }
            }
          },
          _count: {
            select: {
              students: true
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { startTime: 'asc' }
      }),
      prisma.course.count({ where })
    ]);

    res.json({
      courses,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取课程列表错误:', error);
    res.status(500).json({ message: '获取课程列表失败' });
  }
});

// 获取单个课程详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const course = await prisma.course.findUnique({
      where: { id },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
        students: {
          include: {
            student: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        },
        attendanceRecords: {
          include: {
            student: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限：学生只能查看自己报名的课程
    if (currentUser.role === 'STUDENT') {
      const isEnrolled = course.students.some(sc => sc.studentId === currentUser.id);
      if (!isEnrolled) {
        return res.status(403).json({ message: '权限不足' });
      }
    }

    res.json({ course });
  } catch (error) {
    console.error('获取课程详情错误:', error);
    res.status(500).json({ message: '获取课程详情失败' });
  }
});

// 创建课程（管理员和教师）
router.post('/', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('title').notEmpty().withMessage('课程标题不能为空'),
  body('description').optional().isString().withMessage('课程描述必须是字符串'),
  body('startTime').isISO8601().withMessage('开始时间格式无效'),
  body('endTime').isISO8601().withMessage('结束时间格式无效'),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage('最大学生数必须为正整数'),
  body('classroom').optional().isString().withMessage('教室必须是字符串'),
  body('teacherId').optional().isString().withMessage('教师ID必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { title, description, startTime, endTime, maxStudents = 20, classroom, teacherId } = req.body;
    const currentUser = req.user;

    // 验证时间
    const start = new Date(startTime);
    const end = new Date(endTime);
    
    if (start >= end) {
      return res.status(400).json({ message: '结束时间必须晚于开始时间' });
    }

    if (start <= new Date()) {
      return res.status(400).json({ message: '课程开始时间不能早于当前时间' });
    }

    // 确定教师ID
    const finalTeacherId = teacherId || currentUser.id;

    // 检查教师是否存在且是教师角色
    const teacher = await prisma.user.findUnique({
      where: { id: finalTeacherId }
    });

    if (!teacher || teacher.role !== 'TEACHER') {
      return res.status(400).json({ message: '指定的教师不存在或不是教师角色' });
    }

    // 检查时间冲突
    const conflictingCourse = await prisma.course.findFirst({
      where: {
        teacherId: finalTeacherId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        OR: [
          {
            startTime: { lte: start },
            endTime: { gt: start }
          },
          {
            startTime: { lt: end },
            endTime: { gte: end }
          },
          {
            startTime: { gte: start },
            endTime: { lte: end }
          }
        ]
      }
    });

    if (conflictingCourse) {
      return res.status(400).json({ message: '该时间段已有其他课程安排' });
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        startTime: start,
        endTime: end,
        maxStudents,
        classroom,
        teacherId: finalTeacherId
      },
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: '课程创建成功',
      course
    });
  } catch (error) {
    console.error('创建课程错误:', error);
    res.status(500).json({ message: '创建课程失败' });
  }
});

// 更新课程信息
router.put('/:id', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('title').optional().notEmpty().withMessage('课程标题不能为空'),
  body('description').optional().isString().withMessage('课程描述必须是字符串'),
  body('startTime').optional().isISO8601().withMessage('开始时间格式无效'),
  body('endTime').optional().isISO8601().withMessage('结束时间格式无效'),
  body('maxStudents').optional().isInt({ min: 1 }).withMessage('最大学生数必须为正整数'),
  body('classroom').optional().isString().withMessage('教室必须是字符串'),
  body('status').optional().isIn(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).withMessage('无效的课程状态')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const currentUser = req.user;
    const updateData = req.body;

    // 检查课程是否存在
    const existingCourse = await prisma.course.findUnique({
      where: { id }
    });

    if (!existingCourse) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限：只有课程教师或管理员可以修改
    if (existingCourse.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 如果修改时间，需要检查冲突
    if (updateData.startTime || updateData.endTime) {
      const start = updateData.startTime ? new Date(updateData.startTime) : existingCourse.startTime;
      const end = updateData.endTime ? new Date(updateData.endTime) : existingCourse.endTime;

      if (start >= end) {
        return res.status(400).json({ message: '结束时间必须晚于开始时间' });
      }

      const conflictingCourse = await prisma.course.findFirst({
        where: {
          id: { not: id },
          teacherId: existingCourse.teacherId,
          status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          OR: [
            {
              startTime: { lte: start },
              endTime: { gt: start }
            },
            {
              startTime: { lt: end },
              endTime: { gte: end }
            },
            {
              startTime: { gte: start },
              endTime: { lte: end }
            }
          ]
        }
      });

      if (conflictingCourse) {
        return res.status(400).json({ message: '该时间段已有其他课程安排' });
      }
    }

    const course = await prisma.course.update({
      where: { id },
      data: updateData,
      include: {
        teacher: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      message: '课程更新成功',
      course
    });
  } catch (error) {
    console.error('更新课程错误:', error);
    res.status(500).json({ message: '更新课程失败' });
  }
});

// 删除课程
router.delete('/:id', auth, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限
    if (course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 检查是否可以删除
    if (course.status === 'IN_PROGRESS' || course.status === 'COMPLETED') {
      return res.status(400).json({ message: '进行中或已完成的课程不能删除' });
    }

    // 删除相关的学生课程关联
    await prisma.studentCourse.deleteMany({
      where: { courseId: id }
    });

    // 删除课程
    await prisma.course.delete({
      where: { id }
    });

    res.json({ message: '课程删除成功' });
  } catch (error) {
    console.error('删除课程错误:', error);
    res.status(500).json({ message: '删除课程失败' });
  }
});

// 学生报名课程
router.post('/:id/enroll', auth, requireRole(['STUDENT']), async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查课程状态
    if (course.status !== 'SCHEDULED') {
      return res.status(400).json({ message: '课程已不可报名' });
    }

    // 检查是否已报名
    const existingEnrollment = await prisma.studentCourse.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId: id
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ message: '您已报名此课程' });
    }

    // 检查课程容量
    if (course.currentStudents >= course.maxStudents) {
      return res.status(400).json({ message: '课程已满员' });
    }

    // 创建报名记录
    await prisma.$transaction([
      prisma.studentCourse.create({
        data: {
          studentId,
          courseId: id
        }
      }),
      prisma.course.update({
        where: { id },
        data: {
          currentStudents: {
            increment: 1
          }
        }
      })
    ]);

    res.json({ message: '报名成功' });
  } catch (error) {
    console.error('报名课程错误:', error);
    res.status(500).json({ message: '报名失败' });
  }
});

// 学生取消报名
router.delete('/:id/enroll', auth, requireRole(['STUDENT']), async (req, res) => {
  try {
    const { id } = req.params;
    const studentId = req.user.id;

    // 检查报名记录
    const enrollment = await prisma.studentCourse.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId: id
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ message: '未找到报名记录' });
    }

    // 检查课程状态
    const course = await prisma.course.findUnique({
      where: { id }
    });

    if (course.status !== 'SCHEDULED') {
      return res.status(400).json({ message: '课程已开始，无法取消报名' });
    }

    // 取消报名
    await prisma.$transaction([
      prisma.studentCourse.delete({
        where: {
          studentId_courseId: {
            studentId,
            courseId: id
          }
        }
      }),
      prisma.course.update({
        where: { id },
        data: {
          currentStudents: {
            decrement: 1
          }
        }
      })
    ]);

    res.json({ message: '取消报名成功' });
  } catch (error) {
    console.error('取消报名错误:', error);
    res.status(500).json({ message: '取消报名失败' });
  }
});

module.exports = router; 