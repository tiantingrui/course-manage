# 书法课堂管理系统

一个现代化的书法课堂管理系统，提供完整的课程管理、用户管理、课包管理和统计分析功能。

## 功能特性

### 核心模块
- **用户管理** - 学生、教师、管理员账户管理
- **课堂管理** - 课程排期、课程安排、教室管理
- **课包管理** - 课程套餐、购买记录、有效期管理
- **耗课管理** - 课时消耗、课程记录、出勤管理
- **统计分析** - 每日消课统计、月度报表、收入分析

### 技术栈
- **后端**: Node.js + Express + PostgreSQL + Prisma
- **前端**: React + TypeScript + Ant Design
- **认证**: JWT
- **部署**: Docker

## 快速开始

### 环境要求
- Node.js 18+
- PostgreSQL 14+
- Docker (可选)

### 安装步骤
1. 克隆项目
```bash
git clone <repository-url>
cd course-manage
```

2. 安装依赖
```bash
# 安装后端依赖
cd backend
npm install

# 安装前端依赖
cd ../frontend
npm install
```

3. 配置数据库
```bash
# 复制环境变量文件
cp .env.example .env
# 编辑数据库配置
```

4. 启动服务
```bash
# 启动后端
cd backend
npm run dev

# 启动前端
cd frontend
npm start
```

## 项目结构
```
course-manage/
├── backend/          # 后端服务
├── frontend/         # 前端应用
├── docs/            # 文档
└── docker/          # Docker配置
```

## 许可证
MIT License