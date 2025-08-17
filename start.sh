#!/bin/bash

echo "🚀 启动书法课堂管理系统..."

# 检查Docker是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker未安装，请先安装Docker"
    exit 1
fi

# 检查Docker Compose是否安装
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose未安装，请先安装Docker Compose"
    exit 1
fi

# 进入docker目录
cd docker

# 停止现有容器
echo "🛑 停止现有容器..."
docker-compose down

# 构建并启动服务
echo "🔨 构建并启动服务..."
docker-compose up -d --build

# 等待服务启动
echo "⏳ 等待服务启动..."
sleep 10

# 检查服务状态
echo "📊 检查服务状态..."
docker-compose ps

# 运行数据库迁移
echo "🗄️ 运行数据库迁移..."
docker-compose exec backend npm run db:generate
docker-compose exec backend npm run db:push

echo ""
echo "✅ 系统启动完成！"
echo ""
echo "🌐 访问地址："
echo "   前端: http://localhost:3000"
echo "   后端API: http://localhost:3001"
echo "   数据库: localhost:5432"
echo ""
echo "📝 默认管理员账户："
echo "   邮箱: admin@example.com"
echo "   密码: admin123"
echo ""
echo "🔧 管理命令："
echo "   查看日志: docker-compose logs -f"
echo "   停止服务: docker-compose down"
echo "   重启服务: docker-compose restart"
echo "" 