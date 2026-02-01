// 导入必要的模块
const logger = require('../config/logger'); // 导入日志记录器
const pool = require('../config/database'); // 导入数据库连接池

/**
 * 操作日志中间件
 * 记录用户的操作日志到数据库
 */
const logOperation = async (req, res, next) => {
  // 保存原始的res.json方法
  const originalSend = res.json;

  // 重写res.json方法
  res.json = function(data) {
    // 只有当用户已登录且请求方法不是GET时，才记录操作日志
    if (req.user && req.method !== 'GET') {
      // 准备日志数据
      const logData = {
        user_id: req.user.id, // 用户ID
        username: req.user.username, // 用户名
        module: req.baseUrl.split('/')[1] || 'unknown', // 操作模块
        action: req.method, // 操作类型（GET、POST、PUT、DELETE等）
        description: `${req.method} ${req.path}`, // 操作描述
        ip_address: req.ip || req.connection.remoteAddress // 用户IP地址
      };

      // 插入日志数据到数据库
      pool.query('INSERT INTO operation_logs SET ?', logData)
        .catch(err => logger.error('记录操作日志失败:', err)); // 记录插入失败的错误
    }
    // 调用原始的res.json方法
    originalSend.call(this, data);
  };

  // 继续处理请求
  next();
};

// 导出中间件函数
module.exports = logOperation;
