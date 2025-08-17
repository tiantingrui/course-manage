const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: '请提供认证令牌' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ message: '用户不存在' });
    }

    if (user.status !== 'ACTIVE') {
      return res.status(401).json({ message: '账户已被禁用' });
    }

    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({ message: '认证失败' });
  }
};

const requireRole = (roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: '请先登录' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: '权限不足' });
    }

    next();
  };
};

module.exports = { auth, requireRole }; 