// 导入必要的模块
const jwt = require('jsonwebtoken'); // 导入jsonwebtoken模块，用于JWT令牌验证
const config = require('../config/config'); // 导入配置文件

/**
 * 读者认证中间件
 * 验证请求头中的JWT令牌是否有效，并且用户角色是否为reader
 */
const readerAuth = (req, res, next) => {
  try {
    // 从请求头中获取令牌
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    // 如果没有提供令牌，返回401错误
    if (!token) {
      return res.status(401).json({
        code: 401,
        msg: '未提供认证token',
        data: null
      });
    }
    
    // 验证令牌是否有效
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'library_system_secret_key_2024');
    
    // 检查角色是否为reader
    if (decoded.role !== 'reader') {
      return res.status(403).json({
        code: 403,
        msg: '无权限访问',
        data: null
      });
    }
    
    // 将用户信息存储到请求对象中
    req.user = {
      id: decoded.id, // 用户ID
      reader_id: decoded.reader_id, // 读者ID
      role: decoded.role, // 角色
      reader_no: decoded.reader_no // 读者编号
    };
    
    // 继续处理请求
    next();
  } catch (error) {
    // 处理JWT错误
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        code: 401,
        msg: '无效的token',
        data: null
      });
    } else if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        code: 401,
        msg: 'token已过期',
        data: null
      });
    }
    
    // 处理其他认证错误
    return res.status(500).json({
      code: 500,
      msg: '认证失败',
      data: null
    });
  }
};

// 导出中间件函数
module.exports = readerAuth;