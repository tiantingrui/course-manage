const express = require('express');
const { query, validationResult } = require('express-validator');
const { PrismaClient } = require('@prisma/client');
const { auth, requireRole } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// 获取总体统计概览
router.get('/overview', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const [
      totalUsers,
      totalStudents,
      totalTeachers,
      totalCourses,
      totalPackages,
      totalPayments,
      totalRevenue,
      totalHours
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: 'STUDENT' } }),
      prisma.user.count({ where: { role: 'TEACHER' } }),
      prisma.course.count(),
      prisma.coursePackage.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.payment.aggregate({
        where: { status: 'PAID' },
        _sum: { amount: true }
      }),
      prisma.coursePackage.aggregate({
        _sum: { totalHours: true }
      })
    ]);

    res.json({
      overview: {
        totalUsers,
        totalStudents,
        totalTeachers,
        totalCourses,
        totalPackages,
        totalPayments,
        totalRevenue: totalRevenue._sum.amount || 0,
        totalHours: totalHours._sum.totalHours || 0
      }
    });
  } catch (error) {
    console.error('获取总体统计错误:', error);
    res.status(500).json({ message: '获取总体统计失败' });
  }
});

// 获取每日消课统计
router.get('/daily-consumption', auth, requireRole(['ADMIN', 'TEACHER']), [
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    const currentUser = req.user;

    // 构建查询条件
    const where = {};
    if (startDate || endDate) {
      where.recordedAt = {};
      if (startDate) where.recordedAt.gte = new Date(startDate);
      if (endDate) where.recordedAt.lte = new Date(endDate);
    }

    // 教师只能看到自己的课程统计
    if (currentUser.role === 'TEACHER') {
      where.course = {
        teacherId: currentUser.id
      };
    }

    // 获取每日出勤统计
    const dailyStats = await prisma.$queryRaw`
      SELECT 
        DATE("recordedAt") as date,
        COUNT(*) as total_records,
        COUNT(CASE WHEN status = 'PRESENT' THEN 1 END) as present_count,
        COUNT(CASE WHEN status = 'ABSENT' THEN 1 END) as absent_count,
        COUNT(CASE WHEN status = 'LATE' THEN 1 END) as late_count,
        COUNT(CASE WHEN status = 'LEAVE' THEN 1 END) as leave_count
      FROM attendance_records ar
      LEFT JOIN courses c ON ar."courseId" = c.id
      WHERE 1=1
        ${startDate ? `AND DATE(ar."recordedAt") >= ${new Date(startDate).toISOString().split('T')[0]}` : ''}
        ${endDate ? `AND DATE(ar."recordedAt") <= ${new Date(endDate).toISOString().split('T')[0]}` : ''}
        ${currentUser.role === 'TEACHER' ? `AND c."teacherId" = ${currentUser.id}` : ''}
      GROUP BY DATE(ar."recordedAt")
      ORDER BY date DESC
    `;

    res.json({
      dailyStats: dailyStats.map(stat => ({
        date: stat.date,
        totalRecords: parseInt(stat.total_records),
        presentCount: parseInt(stat.present_count),
        absentCount: parseInt(stat.absent_count),
        lateCount: parseInt(stat.late_count),
        leaveCount: parseInt(stat.leave_count),
        attendanceRate: stat.total_records > 0 ? 
          ((parseInt(stat.present_count) / parseInt(stat.total_records)) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('获取每日消课统计错误:', error);
    res.status(500).json({ message: '获取每日消课统计失败' });
  }
});

// 获取月度耗课时统计
router.get('/monthly-hours', auth, requireRole(['ADMIN']), [
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('年份必须在2020-2030之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { year } = req.query;

    // 获取月度课时消耗统计
    const monthlyHours = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM ar."recordedAt") as month,
        COUNT(*) as total_records,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) as consumed_hours
      FROM attendance_records ar
      WHERE 
        ar.status = 'PRESENT'
        AND EXTRACT(YEAR FROM ar."recordedAt") = ${parseInt(year)}
      GROUP BY EXTRACT(MONTH FROM ar."recordedAt")
      ORDER BY month
    `;

    // 填充缺失的月份
    const monthlyData = [];
    for (let month = 1; month <= 12; month++) {
      const monthData = monthlyHours.find(stat => stat.month === month);
      monthlyData.push({
        month,
        totalRecords: monthData ? parseInt(monthData.total_records) : 0,
        consumedHours: monthData ? parseInt(monthData.consumed_hours) : 0
      });
    }

    res.json({
      year: parseInt(year),
      monthlyData
    });
  } catch (error) {
    console.error('获取月度耗课时统计错误:', error);
    res.status(500).json({ message: '获取月度耗课时统计失败' });
  }
});

// 获取月度收入统计
router.get('/monthly-revenue', auth, requireRole(['ADMIN']), [
  query('year').isInt({ min: 2020, max: 2030 }).withMessage('年份必须在2020-2030之间')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { year } = req.query;

    // 获取月度收入统计
    const monthlyRevenue = await prisma.$queryRaw`
      SELECT 
        EXTRACT(MONTH FROM "paidAt") as month,
        COUNT(*) as payment_count,
        SUM(amount) as total_revenue
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
      const monthData = monthlyRevenue.find(stat => stat.month === month);
      monthlyData.push({
        month,
        paymentCount: monthData ? parseInt(monthData.payment_count) : 0,
        totalRevenue: monthData ? parseFloat(monthData.total_revenue) : 0
      });
    }

    res.json({
      year: parseInt(year),
      monthlyData
    });
  } catch (error) {
    console.error('获取月度收入统计错误:', error);
    res.status(500).json({ message: '获取月度收入统计失败' });
  }
});

// 获取教师统计
router.get('/teachers', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const teacherStats = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT c.id) as total_courses,
        COUNT(DISTINCT ar."courseId") as courses_with_attendance,
        COUNT(ar.id) as total_attendance_records,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) as present_records,
        COUNT(CASE WHEN ar.status = 'ABSENT' THEN 1 END) as absent_records
      FROM users u
      LEFT JOIN courses c ON u.id = c."teacherId"
      LEFT JOIN attendance_records ar ON c.id = ar."courseId"
      WHERE u.role = 'TEACHER'
      GROUP BY u.id, u.name, u.email
      ORDER BY total_courses DESC
    `;

    res.json({
      teacherStats: teacherStats.map(stat => ({
        id: stat.id,
        name: stat.name,
        email: stat.email,
        totalCourses: parseInt(stat.total_courses),
        coursesWithAttendance: parseInt(stat.courses_with_attendance),
        totalAttendanceRecords: parseInt(stat.total_attendance_records),
        presentRecords: parseInt(stat.present_records),
        absentRecords: parseInt(stat.absent_records),
        attendanceRate: stat.total_attendance_records > 0 ? 
          ((parseInt(stat.present_records) / parseInt(stat.total_attendance_records)) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('获取教师统计错误:', error);
    res.status(500).json({ message: '获取教师统计失败' });
  }
});

// 获取学生统计
router.get('/students', auth, requireRole(['ADMIN', 'TEACHER']), async (req, res) => {
  try {
    const currentUser = req.user;

    // 构建查询条件
    let whereClause = '';
    if (currentUser.role === 'TEACHER') {
      whereClause = `AND c."teacherId" = '${currentUser.id}'`;
    }

    const studentStats = await prisma.$queryRaw`
      SELECT 
        u.id,
        u.name,
        u.email,
        COUNT(DISTINCT sc."courseId") as enrolled_courses,
        COUNT(DISTINCT ar."courseId") as attended_courses,
        COUNT(ar.id) as total_attendance_records,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) as present_records,
        COUNT(CASE WHEN ar.status = 'ABSENT' THEN 1 END) as absent_records,
        COUNT(CASE WHEN ar.status = 'LATE' THEN 1 END) as late_records,
        COUNT(CASE WHEN ar.status = 'LEAVE' THEN 1 END) as leave_records
      FROM users u
      LEFT JOIN student_courses sc ON u.id = sc."studentId"
      LEFT JOIN attendance_records ar ON u.id = ar."studentId"
      LEFT JOIN courses c ON sc."courseId" = c.id
      WHERE u.role = 'STUDENT'
        ${whereClause}
      GROUP BY u.id, u.name, u.email
      ORDER BY enrolled_courses DESC
    `;

    res.json({
      studentStats: studentStats.map(stat => ({
        id: stat.id,
        name: stat.name,
        email: stat.email,
        enrolledCourses: parseInt(stat.enrolled_courses),
        attendedCourses: parseInt(stat.attended_courses),
        totalAttendanceRecords: parseInt(stat.total_attendance_records),
        presentRecords: parseInt(stat.present_records),
        absentRecords: parseInt(stat.absent_records),
        lateRecords: parseInt(stat.late_records),
        leaveRecords: parseInt(stat.leave_records),
        attendanceRate: stat.total_attendance_records > 0 ? 
          ((parseInt(stat.present_records) / parseInt(stat.total_attendance_records)) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('获取学生统计错误:', error);
    res.status(500).json({ message: '获取学生统计失败' });
  }
});

// 获取课程统计
router.get('/courses', auth, requireRole(['ADMIN', 'TEACHER']), [
  query('startDate').optional().isISO8601().withMessage('开始日期格式无效'),
  query('endDate').optional().isISO8601().withMessage('结束日期格式无效')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate } = req.query;
    const currentUser = req.user;

    // 构建查询条件
    let whereClause = '';
    if (currentUser.role === 'TEACHER') {
      whereClause = `AND c."teacherId" = '${currentUser.id}'`;
    }
    if (startDate) {
      whereClause += `AND c."startTime" >= '${new Date(startDate).toISOString()}'`;
    }
    if (endDate) {
      whereClause += `AND c."startTime" <= '${new Date(endDate).toISOString()}'`;
    }

    const courseStats = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.title,
        c."startTime",
        c."endTime",
        c."maxStudents",
        c."currentStudents",
        c.status,
        u.name as teacher_name,
        COUNT(ar.id) as attendance_records,
        COUNT(CASE WHEN ar.status = 'PRESENT' THEN 1 END) as present_count,
        COUNT(CASE WHEN ar.status = 'ABSENT' THEN 1 END) as absent_count,
        COUNT(CASE WHEN ar.status = 'LATE' THEN 1 END) as late_count,
        COUNT(CASE WHEN ar.status = 'LEAVE' THEN 1 END) as leave_count
      FROM courses c
      LEFT JOIN users u ON c."teacherId" = u.id
      LEFT JOIN attendance_records ar ON c.id = ar."courseId"
      WHERE 1=1
        ${whereClause}
      GROUP BY c.id, c.title, c."startTime", c."endTime", c."maxStudents", c."currentStudents", c.status, u.name
      ORDER BY c."startTime" DESC
    `;

    res.json({
      courseStats: courseStats.map(stat => ({
        id: stat.id,
        title: stat.title,
        startTime: stat.startTime,
        endTime: stat.endTime,
        maxStudents: parseInt(stat.maxStudents),
        currentStudents: parseInt(stat.currentStudents),
        status: stat.status,
        teacherName: stat.teacher_name,
        attendanceRecords: parseInt(stat.attendance_records),
        presentCount: parseInt(stat.present_count),
        absentCount: parseInt(stat.absent_count),
        lateCount: parseInt(stat.late_count),
        leaveCount: parseInt(stat.leave_count),
        attendanceRate: stat.attendance_records > 0 ? 
          ((parseInt(stat.present_count) / parseInt(stat.attendance_records)) * 100).toFixed(2) : 0,
        enrollmentRate: parseInt(stat.maxStudents) > 0 ? 
          ((parseInt(stat.currentStudents) / parseInt(stat.maxStudents)) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('获取课程统计错误:', error);
    res.status(500).json({ message: '获取课程统计失败' });
  }
});

// 获取课包统计
router.get('/packages', auth, requireRole(['ADMIN']), async (req, res) => {
  try {
    const packageStats = await prisma.$queryRaw`
      SELECT 
        cp.id,
        cp.name,
        cp."totalHours",
        cp."usedHours",
        cp.price,
        cp.status,
        cp."purchasedAt",
        cp."expiresAt",
        u.name as student_name,
        u.email as student_email
      FROM course_packages cp
      LEFT JOIN users u ON cp."studentId" = u.id
      ORDER BY cp."purchasedAt" DESC
    `;

    res.json({
      packageStats: packageStats.map(stat => ({
        id: stat.id,
        name: stat.name,
        totalHours: parseInt(stat.totalHours),
        usedHours: parseInt(stat.usedHours),
        remainingHours: parseInt(stat.totalHours) - parseInt(stat.usedHours),
        price: parseFloat(stat.price),
        status: stat.status,
        purchasedAt: stat.purchasedAt,
        expiresAt: stat.expiresAt,
        studentName: stat.student_name,
        studentEmail: stat.student_email,
        usageRate: parseInt(stat.totalHours) > 0 ? 
          ((parseInt(stat.usedHours) / parseInt(stat.totalHours)) * 100).toFixed(2) : 0
      }))
    });
  } catch (error) {
    console.error('获取课包统计错误:', error);
    res.status(500).json({ message: '获取课包统计失败' });
  }
});

module.exports = router; 