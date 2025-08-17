# 书法课堂管理系统 API 文档

## 基础信息

- 基础URL: `http://localhost:3001/api`
- 认证方式: Bearer Token
- 数据格式: JSON

## 认证

### 登录
```
POST /auth/login
```

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**响应:**
```json
{
  "message": "登录成功",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "name": "用户名",
    "role": "STUDENT",
    "status": "ACTIVE"
  },
  "token": "jwt_token"
}
```

### 注册
```
POST /auth/register
```

**请求体:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "用户名",
  "phone": "13800138000",
  "role": "STUDENT"
}
```

### 获取当前用户信息
```
GET /auth/me
```

**请求头:**
```
Authorization: Bearer <token>
```

## 用户管理

### 获取用户列表
```
GET /users?page=1&limit=10&role=STUDENT&status=ACTIVE&search=关键词
```

**权限:** ADMIN, TEACHER

### 获取用户详情
```
GET /users/:id
```

### 创建用户
```
POST /users
```

**权限:** ADMIN

**请求体:**
```json
{
  "email": "user@example.com",
  "name": "用户名",
  "phone": "13800138000",
  "role": "STUDENT",
  "status": "ACTIVE"
}
```

### 更新用户信息
```
PUT /users/:id
```

**请求体:**
```json
{
  "name": "新用户名",
  "phone": "13800138001",
  "status": "ACTIVE"
}
```

### 删除用户
```
DELETE /users/:id
```

**权限:** ADMIN

## 课程管理

### 获取课程列表
```
GET /courses?page=1&limit=10&status=SCHEDULED&teacherId=teacher_id&startDate=2024-01-01&endDate=2024-12-31
```

### 获取课程详情
```
GET /courses/:id
```

### 创建课程
```
POST /courses
```

**权限:** ADMIN, TEACHER

**请求体:**
```json
{
  "title": "书法基础课程",
  "description": "学习书法基础知识",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "maxStudents": 20,
  "classroom": "教室A",
  "teacherId": "teacher_id"
}
```

### 更新课程
```
PUT /courses/:id
```

**请求体:**
```json
{
  "title": "更新的课程标题",
  "description": "更新的课程描述",
  "startTime": "2024-01-15T10:00:00Z",
  "endTime": "2024-01-15T12:00:00Z",
  "maxStudents": 25,
  "classroom": "教室B",
  "status": "IN_PROGRESS"
}
```

### 删除课程
```
DELETE /courses/:id
```

**权限:** ADMIN, TEACHER

### 学生报名课程
```
POST /courses/:id/enroll
```

**权限:** STUDENT

### 学生取消报名
```
DELETE /courses/:id/enroll
```

**权限:** STUDENT

## 课包管理

### 获取课包列表
```
GET /packages?page=1&limit=10&status=ACTIVE&studentId=student_id
```

### 获取课包详情
```
GET /packages/:id
```

### 创建课包
```
POST /packages
```

**权限:** ADMIN

**请求体:**
```json
{
  "name": "基础课包",
  "description": "包含20课时的基础课程",
  "totalHours": 20,
  "price": 1000.00,
  "validDays": 365,
  "studentId": "student_id"
}
```

### 更新课包
```
PUT /packages/:id
```

**请求体:**
```json
{
  "name": "更新的课包名称",
  "description": "更新的描述",
  "status": "ACTIVE"
}
```

### 删除课包
```
DELETE /packages/:id
```

**权限:** ADMIN

### 购买课包
```
POST /packages/purchase
```

**权限:** STUDENT

**请求体:**
```json
{
  "name": "基础课包",
  "description": "包含20课时的基础课程",
  "totalHours": 20,
  "price": 1000.00,
  "validDays": 365,
  "paymentMethod": "WECHAT"
}
```

### 消耗课时
```
POST /packages/:id/consume
```

**权限:** ADMIN, TEACHER

**请求体:**
```json
{
  "hours": 2,
  "courseId": "course_id"
}
```

## 出勤管理

### 获取出勤记录列表
```
GET /attendance?page=1&limit=10&courseId=course_id&studentId=student_id&status=PRESENT&startDate=2024-01-01&endDate=2024-12-31
```

### 获取出勤记录详情
```
GET /attendance/:id
```

### 创建出勤记录
```
POST /attendance
```

**权限:** ADMIN, TEACHER

**请求体:**
```json
{
  "studentId": "student_id",
  "courseId": "course_id",
  "status": "PRESENT",
  "notes": "学生表现良好"
}
```

### 批量创建出勤记录
```
POST /attendance/batch
```

**权限:** ADMIN, TEACHER

**请求体:**
```json
{
  "courseId": "course_id",
  "records": [
    {
      "studentId": "student_id_1",
      "status": "PRESENT",
      "notes": "表现良好"
    },
    {
      "studentId": "student_id_2",
      "status": "ABSENT",
      "notes": "请假"
    }
  ]
}
```

### 更新出勤记录
```
PUT /attendance/:id
```

**请求体:**
```json
{
  "status": "LATE",
  "notes": "迟到10分钟"
}
```

### 删除出勤记录
```
DELETE /attendance/:id
```

**权限:** ADMIN, TEACHER

### 获取课程出勤统计
```
GET /attendance/course/:courseId/statistics
```

## 支付管理

### 获取支付记录列表
```
GET /payments?page=1&limit=10&status=PAID&method=WECHAT&studentId=student_id&startDate=2024-01-01&endDate=2024-12-31
```

### 获取支付记录详情
```
GET /payments/:id
```

### 创建支付记录
```
POST /payments
```

**权限:** ADMIN

**请求体:**
```json
{
  "amount": 1000.00,
  "method": "WECHAT",
  "status": "PAID",
  "studentId": "student_id",
  "packageId": "package_id",
  "notes": "微信支付"
}
```

### 更新支付状态
```
PUT /payments/:id/status
```

**权限:** ADMIN

**请求体:**
```json
{
  "status": "PAID",
  "notes": "支付成功"
}
```

### 删除支付记录
```
DELETE /payments/:id
```

**权限:** ADMIN

## 统计分析

### 获取总体统计概览
```
GET /statistics/overview
```

**权限:** ADMIN

**响应:**
```json
{
  "overview": {
    "totalUsers": 100,
    "totalStudents": 80,
    "totalTeachers": 10,
    "totalCourses": 50,
    "totalPackages": 200,
    "totalPayments": 150,
    "totalRevenue": 50000.00,
    "totalHours": 1000
  }
}
```

### 获取每日消课统计
```
GET /statistics/daily-consumption?startDate=2024-01-01&endDate=2024-12-31
```

**权限:** ADMIN, TEACHER

### 获取月度耗课时统计
```
GET /statistics/monthly-hours?year=2024
```

**权限:** ADMIN

### 获取月度收入统计
```
GET /statistics/monthly-revenue?year=2024
```

**权限:** ADMIN

### 获取教师统计
```
GET /statistics/teachers
```

**权限:** ADMIN

### 获取学生统计
```
GET /statistics/students
```

**权限:** ADMIN, TEACHER

### 获取课程统计
```
GET /statistics/courses?startDate=2024-01-01&endDate=2024-12-31
```

**权限:** ADMIN, TEACHER

### 获取课包统计
```
GET /statistics/packages
```

**权限:** ADMIN

## 错误响应

### 400 Bad Request
```json
{
  "message": "请求参数错误",
  "errors": [
    {
      "field": "email",
      "msg": "请输入有效的邮箱地址"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "message": "请提供认证令牌"
}
```

### 403 Forbidden
```json
{
  "message": "权限不足"
}
```

### 404 Not Found
```json
{
  "message": "资源不存在"
}
```

### 500 Internal Server Error
```json
{
  "message": "服务器内部错误"
}
```

## 分页响应格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

## 状态码说明

- `SCHEDULED`: 已安排
- `IN_PROGRESS`: 进行中
- `COMPLETED`: 已完成
- `CANCELLED`: 已取消
- `ACTIVE`: 活跃
- `INACTIVE`: 非活跃
- `SUSPENDED`: 暂停
- `PRESENT`: 出席
- `ABSENT`: 缺席
- `LATE`: 迟到
- `LEAVE`: 请假
- `PENDING`: 待支付
- `PAID`: 已支付
- `FAILED`: 支付失败
- `REFUNDED`: 已退款 