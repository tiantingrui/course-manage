const errorHandler = (err, req, res, next) => {
  console.error('错误:', err);

  // Prisma错误处理
  if (err.code === 'P2002') {
    return res.status(400).json({
      message: '数据已存在，请检查输入信息',
      field: err.meta?.target?.[0]
    });
  }

  if (err.code === 'P2025') {
    return res.status(404).json({
      message: '记录不存在'
    });
  }

  // JWT错误处理
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      message: '无效的令牌'
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: '令牌已过期'
    });
  }

  // 验证错误处理
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: '数据验证失败',
      errors: err.errors
    });
  }

  // 默认错误响应
  const statusCode = err.statusCode || 500;
  const message = err.message || '服务器内部错误';

  res.status(statusCode).json({
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler; 