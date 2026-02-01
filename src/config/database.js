/**
 * 数据库配置文件
 * 用于管理数据库连接和连接池配置
 */

/**
 * 导入必要的模块
 */
const mysql = require('mysql2/promise'); // 导入mysql2/promise模块，支持异步操作
require('dotenv').config(); // 加载环境变量，从.env文件中读取数据库配置

/**
 * 创建数据库连接池
 * 连接池用于管理数据库连接，提高性能
 */
const pool = mysql.createPool({
  host: process.env.DB_HOST, // 数据库主机地址
  port: process.env.DB_PORT, // 数据库端口
  user: process.env.DB_USER, // 数据库用户名
  password: process.env.DB_PASSWORD, // 数据库密码
  database: process.env.DB_NAME, // 数据库名称
  waitForConnections: true, // 当没有可用连接时，等待连接释放
  connectionLimit: 10, // 连接池最大连接数
  queueLimit: 0, // 连接队列大小，0表示无限制
  enableKeepAlive: true, // 启用连接保活
  keepAliveInitialDelay: 0 // 连接保活初始延迟时间
});

/**
 * 测试数据库连接
 * 确保应用启动时能够正常连接到数据库
 */
pool.getConnection()
  .then(connection => {
    console.log('数据库连接成功');
    connection.release(); // 释放连接回连接池
  })
  .catch(err => {
    console.error('数据库连接失败:', err.message);
  });

/**
 * 导出数据库连接池
 * 供其他模块使用
 */
module.exports = pool;
