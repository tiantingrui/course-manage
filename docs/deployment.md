# 书法课堂管理系统部署指南

## 环境要求

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+ (本地开发)
- PostgreSQL 14+ (本地开发)

## 快速部署

### 1. 使用Docker Compose部署（推荐）

```bash
# 克隆项目
git clone <repository-url>
cd course-manage

# 进入docker目录
cd docker

# 启动所有服务
docker-compose up -d

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
```

服务启动后：
- 前端访问地址：http://localhost:3000
- 后端API地址：http://localhost:3001
- 数据库端口：5432

### 2. 手动部署

#### 后端部署

```bash
cd backend

# 安装依赖
npm install

# 配置环境变量
cp env.example .env
# 编辑.env文件，配置数据库连接等信息

# 生成Prisma客户端
npm run db:generate

# 运行数据库迁移
npm run db:migrate

# 启动服务
npm start
```

#### 前端部署

```bash
cd frontend

# 安装依赖
npm install

# 配置环境变量
# 创建.env文件，设置REACT_APP_API_URL

# 构建生产版本
npm run build

# 使用nginx或其他web服务器部署build目录
```

## 环境变量配置

### 后端环境变量 (.env)

```env
# 数据库配置
DATABASE_URL="postgresql://username:password@localhost:5432/course_manage"

# JWT配置
JWT_SECRET="your-super-secret-jwt-key"
JWT_EXPIRES_IN="7d"

# 服务器配置
PORT=3001
NODE_ENV=production

# 文件上传配置
UPLOAD_PATH="./uploads"
MAX_FILE_SIZE=5242880
```

### 前端环境变量 (.env)

```env
REACT_APP_API_URL=http://localhost:3001/api
```

## 数据库初始化

### 1. 创建数据库

```sql
CREATE DATABASE course_manage;
```

### 2. 运行迁移

```bash
cd backend
npm run db:migrate
```

### 3. 初始化数据（可选）

```bash
cd backend
npm run db:seed
```

## 生产环境部署

### 1. 安全配置

- 修改默认的JWT密钥
- 配置HTTPS
- 设置防火墙规则
- 配置数据库访问权限

### 2. 性能优化

- 启用数据库连接池
- 配置Redis缓存
- 启用Gzip压缩
- 配置CDN

### 3. 监控和日志

- 配置日志收集
- 设置健康检查
- 配置错误监控
- 设置备份策略

## 常见问题

### 1. 数据库连接失败

检查DATABASE_URL配置是否正确，确保数据库服务正在运行。

### 2. 前端无法访问API

检查REACT_APP_API_URL配置，确保后端服务正在运行。

### 3. 权限问题

确保Docker容器有足够的权限访问文件系统。

### 4. 端口冲突

如果端口被占用，可以在docker-compose.yml中修改端口映射。

## 维护命令

```bash
# 停止服务
docker-compose down

# 重启服务
docker-compose restart

# 更新代码后重新构建
docker-compose up -d --build

# 查看服务日志
docker-compose logs -f [service-name]

# 进入容器
docker-compose exec [service-name] sh

# 备份数据库
docker-compose exec postgres pg_dump -U postgres course_manage > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U postgres course_manage < backup.sql
```

## 故障排除

### 1. 服务无法启动

检查日志文件：
```bash
docker-compose logs [service-name]
```

### 2. 数据库迁移失败

手动运行迁移：
```bash
docker-compose exec backend npm run db:migrate
```

### 3. 前端构建失败

检查Node.js版本和依赖：
```bash
docker-compose exec frontend npm install
docker-compose exec frontend npm run build
```

## 更新部署

```bash
# 拉取最新代码
git pull

# 重新构建并启动服务
docker-compose up -d --build

# 运行数据库迁移
docker-compose exec backend npm run db:migrate
``` 