const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取出勤记录列表
router.get('/', auth, [
  query('page').optional().isInt({ min: 1 }).withMessage('页码必须为正整数'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('每页数量必须在1-100之间'),
  query('courseId').optional().isString().withMessage('课程ID必须是字符串'),
  query('studentId').optional().isString().withMessage('学生ID必须是字符串'),
  query('status').optional().isIn(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']).withMessage('无效的出勤状态'),
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { page = 1, limit = 10, courseId, studentId, status, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;
    const currentUser = req.user;

    // 构建查询条件
    const where = {};
    if (courseId) where.courseId = courseId;
    if (studentId) where.studentId = studentId;
    if (status) where.status = status;
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate);
      if (endDate) where.recordedAt.lte = new Date(endDate);
    }

    // 学生只能看到自己的出勤记录
    if (currentUser.role === 'STUDENT') {
      where.studentId = currentUser.id;
    }

    // 查询出勤记录
    const [records, total] = await Promise.all([
      prisma.attendanceRecord.findMany({
        where,
        include: {
          student: {
            select: {
              id: true,
              name: true,
              email: true
            }
          },
          course: {
            select: {
              id: true,
              title: true,
              startTime: true,
              endTime: true,
              teacher: {
                select: {
                  id: true,
                  name: true
                }
              }
            }
          }
        },
        skip: parseInt(skip),
        take: parseInt(limit),
        orderBy: { recordedAt: 'desc' }
      }),
      prisma.attendanceRecord.count({ where })
    ]);

    res.json({
      records,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取出勤记录错误:', error);
    res.status(500).json({ message: '获取出勤记录失败' });
  }
});

// 获取单个出勤记录详情
router.get('/:id', auth, async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    const record = await prisma.attendanceRecord.findUnique({
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
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            startTime: true,
            endTime: true,
            classroom: true,
            teacher: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    if (!record) {
      return res.status(404).json({ message: '出勤记录不存在' });
    }

    // 检查权限：学生只能查看自己的记录
    if (currentUser.role === 'STUDENT' && record.studentId !== currentUser.id) {
      return res.status(403).json({ message: '权限不足' });
    }

    res.json({ record });
  } catch (error) {
    console.error('获取出勤记录详情错误:', error);
    res.status(500).json({ message: '获取出勤记录详情失败' });
  }
});

// 创建出勤记录（教师和管理员）
router.post('/', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('studentId').isString().withMessage('学生ID必须是字符串'),
  body('courseId').isString().withMessage('课程ID必须是字符串'),
  body('status').isIn(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']).withMessage('无效的出勤状态'),
  body('notes').optional().isString().withMessage('备注必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { studentId, courseId, status, notes } = req.body;
    const currentUser = req.user;

    // 检查学生是否存在
    const student = await prisma.user.findUnique({
      where: { id: studentId }
    });

    if (!student || student.role !== 'STUDENT') {
      return res.status(400).json({ message: '指定的学生不存在或不是学生角色' });
    }

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限：只有课程教师或管理员可以记录出勤
    if (course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 检查学生是否报名了该课程
    const enrollment = await prisma.studentCourse.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId
        }
      }
    });

    if (!enrollment) {
      return res.status(400).json({ message: '该学生未报名此课程' });
    }

    // 检查是否已有出勤记录
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: {
        studentId_courseId: {
          studentId,
          courseId
        }
      }
    });

    if (existingRecord) {
      return res.status(400).json({ message: '该学生在此课程中已有出勤记录' });
    }

    const record = await prisma.attendanceRecord.create({
      data: {
        studentId,
        courseId,
        status,
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
        course: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true
          }
        }
      }
    });

    res.status(201).json({
      message: '出勤记录创建成功',
      record
    });
  } catch (error) {
    console.error('创建出勤记录错误:', error);
    res.status(500).json({ message: '创建出勤记录失败' });
  }
});

// 批量创建出勤记录
router.post('/batch', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('courseId').isString().withMessage('课程ID必须是字符串'),
  body('records').isArray().withMessage('出勤记录必须是数组'),
  body('records.*.studentId').isString().withMessage('学生ID必须是字符串'),
  body('records.*.status').isIn(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']).withMessage('无效的出勤状态'),
  body('records.*.notes').optional().isString().withMessage('备注必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { courseId, records } = req.body;
    const currentUser = req.user;

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限
    if (course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 验证所有学生ID
    const studentIds = records.map(r => r.studentId);
    const students = await prisma.user.findMany({
      where: {
        id: { in: studentIds },
        role: 'STUDENT'
      }
    });

    if (students.length !== studentIds.length) {
      return res.status(400).json({ message: '部分学生不存在或不是学生角色' });
    }

    // 检查学生是否都报名了该课程
    const enrollments = await prisma.studentCourse.findMany({
      where: {
        studentId: { in: studentIds },
        courseId
      }
    });

    if (enrollments.length !== studentIds.length) {
      return res.status(400).json({ message: '部分学生未报名此课程' });
    }

    // 检查是否已有出勤记录
    const existingRecords = await prisma.attendanceRecord.findMany({
      where: {
        courseId,
        studentId: { in: studentIds }
      }
    });

    if (existingRecords.length > 0) {
      return res.status(400).json({ message: '部分学生已有出勤记录' });
    }

    // 批量创建出勤记录
    const createdRecords = await prisma.attendanceRecord.createMany({
      data: records.map(record => ({
        studentId: record.studentId,
        courseId,
        status: record.status,
        notes: record.notes
      }))
    });

    res.status(201).json({
      message: '批量创建出勤记录成功',
      count: createdRecords.count
    });
  } catch (error) {
    console.error('批量创建出勤记录错误:', error);
    res.status(500).json({ message: '批量创建出勤记录失败' });
  }
});

// 更新出勤记录
router.put('/:id', auth, requireRole(['ADMIN', 'TEACHER']), [
  body('status').isIn(['PRESENT', 'ABSENT', 'LATE', 'LEAVE']).withMessage('无效的出勤状态'),
  body('notes').optional().isString().withMessage('备注必须是字符串')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { status, notes } = req.body;
    const currentUser = req.user;

    // 检查出勤记录是否存在
    const existingRecord = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!existingRecord) {
      return res.status(404).json({ message: '出勤记录不存在' });
    }

    // 检查权限
    if (existingRecord.course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    const record = await prisma.attendanceRecord.update({
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
        course: {
          select: {
            id: true,
            title: true,
            startTime: true,
            endTime: true
          }
        }
      }
    });

    res.json({
      message: '出勤记录更新成功',
      record
    });
  } catch (error) {
    console.error('更新出勤记录错误:', error);
    res.status(500).json({ message: '更新出勤记录失败' });
  }
});

// 删除出勤记录
router.delete('/:id', auth, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = req.user;

    // 检查出勤记录是否存在
    const record = await prisma.attendanceRecord.findUnique({
      where: { id },
      include: {
        course: true
      }
    });

    if (!record) {
      return res.status(404).json({ message: '出勤记录不存在' });
    }

    // 检查权限
    if (record.course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    await prisma.attendanceRecord.delete({
      where: { id }
    });

    res.json({ message: '出勤记录删除成功' });
  } catch (error) {
    console.error('删除出勤记录错误:', error);
    res.status(500).json({ message: '删除出勤记录失败' });
  }
});

// 获取课程出勤统计
router.get('/course/:courseId/statistics', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const currentUser = req.user;

    // 检查课程是否存在
    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });

    if (!course) {
      return res.status(404).json({ message: '课程不存在' });
    }

    // 检查权限
    if (course.teacherId !== currentUser.id && currentUser.role !== 'ADMIN') {
      return res.status(403).json({ message: '权限不足' });
    }

    // 获取出勤统计
    const [
      totalStudents,
      presentCount,
      absentCount,
      lateCount,
      leaveCount,
      attendanceRate
    ] = await Promise.all([
      prisma.studentCourse.count({ where: { courseId } }),
      prisma.attendanceRecord.count({ where: { courseId, status: 'PRESENT' } }),
      prisma.attendanceRecord.count({ where: { courseId, status: 'ABSENT' } }),
      prisma.attendanceRecord.count({ where: { courseId, status: 'LATE' } }),
      prisma.attendanceRecord.count({ where: { courseId, status: 'LEAVE' } }),
      prisma.attendanceRecord.count({ where: { courseId } })
    ]);

    const rate = totalStudents > 0 ? (attendanceRate / totalStudents * 100).toFixed(2) : 0;

    res.json({
      statistics: {
        totalStudents,
        presentCount,
        absentCount,
        lateCount,
        leaveCount,
        attendanceRate: parseFloat(rate)
      }
    });
  } catch (error) {
    console.error('获取出勤统计错误:', error);
    res.status(500).json({ message: '获取出勤统计失败' });
  }
});

module.exports = router; 