// 导入必要的模块
const jwt = require('jsonwebtoken'); // 导入jsonwebtoken模块，用于JWT令牌验证
const logger = require('../config/logger'); // 导入日志记录器
const config = require('../config/config'); // 导入配置文件

/**
 * JWT认证中间件
 * 验证请求头中的JWT令牌是否有效
 */
const authMiddleware = (req, res, next) => {
  try {
    // 从请求头中获取令牌
    const token = req.headers.authorization?.split(' ')[1];

    // 如果没有提供令牌，返回401错误
    if (!token) {
      return res.status(401).json({
        code: 401,
        msg: '未提供认证令牌',
        data: null
      });
    }

    // 验证令牌是否有效
    const decoded = jwt.verify(token, config.jwt.secret);
    // 将解码后的用户信息存储到请求对象中
    req.user = decoded;
    // 继续处理请求
    next();
  } catch (error) {
    // 记录错误日志
    logger.error('JWT验证失败:', error);
    // 返回401错误
    return res.status(401).json({
      code: 401,
      msg: '认证令牌无效或已过期',
      data: null
    });
  }
};

/**
 * 管理员权限验证中间件
 * 验证用户是否具有管理员权限
 */
const adminAuthMiddleware = (req, res, next) => {
  try {
    // 检查用户角色是否为管理员
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        code: 403,
        msg: '需要管理员权限',
        data: null
      });
    }
    // 继续处理请求
    next();
  } catch (error) {
    // 记录错误日志
    logger.error('权限验证失败:', error);
    // 返回403错误
    return res.status(403).json({
      code: 403,
      msg: '权限验证失败',
      data: null
    });
  }
};

// 导出中间件函数
module.exports = {
  authMiddleware,
  adminAuthMiddleware
};
