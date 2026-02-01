// 导入必要的模块
const logger = require('../config/logger'); // 导入日志记录器

/**
 * 错误处理中间件
 * 处理应用程序中的各种错误
 */
const errorHandler = (err, req, res, next) => {
  // 记录错误日志
  logger.error('发生错误:', err);

  // 处理验证错误
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      code: 400,
      msg: '参数验证失败',
      data: err.errors
    });
  }

  // 处理未授权错误
  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      code: 401,
      msg: '未授权访问',
      data: null
    });
  }

  // 处理重复数据错误
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      code: 409,
      msg: '数据已存在',
      data: null
    });
  }

  // 处理关联数据不存在错误
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(400).json({
      code: 400,
      msg: '关联数据不存在',
      data: null
    });
  }

  // 处理其他所有错误
  res.status(500).json({
    code: 500,
    msg: err.message || '服务器内部错误',
    data: null
  });
};

/**
 * 404处理中间件
 * 处理请求的资源不存在的情况
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    code: 404,
    msg: '请求的资源不存在',
    data: null
  });
};

// 导出中间件函数
module.exports = {
  errorHandler,
  notFoundHandler
};
