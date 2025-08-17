FROM node:18-alpine

WORKDIR /app

# 复制package.json和package-lock.json
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production

# 复制源代码
COPY . .

# 生成Prisma客户端
RUN npx prisma generate

# 创建uploads目录
RUN mkdir -p uploads

# 暴露端口
EXPOSE 3001

# 启动命令
CMD ["npm", "start"] 