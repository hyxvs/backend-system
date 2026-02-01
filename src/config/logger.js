/**
 * 日志配置文件
 * 用于配置和创建系统日志记录器
 */

/**
 * 导入必要的模块
 */
const winston = require('winston'); // 导入winston日志库
const path = require('path'); // 导入path模块，用于处理文件路径
require('dotenv').config(); // 加载环境变量

/**
 * 定义日志格式
 * 配置日志的输出格式和内容
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), // 添加时间戳，格式为年-月-日 时:分:秒
  winston.format.errors({ stack: true }), // 包含错误堆栈信息，便于调试
  winston.format.printf(({ timestamp, level, message, stack }) => {
    if (stack) {
      // 如果有堆栈信息，输出堆栈信息
      return `${timestamp} [${level.toUpperCase()}]: ${message}\n${stack}`;
    }
    // 否则只输出基本日志信息
    return `${timestamp} [${level.toUpperCase()}]: ${message}`;
  }) // 自定义日志输出格式
);

/**
 * 创建日志记录器
 * 配置日志的级别、格式和输出目标
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info', // 日志级别，默认为info
  format: logFormat, // 使用定义的日志格式
  transports: [
    // 控制台输出配置
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // 添加颜色，使日志在控制台更易读
        logFormat
      )
    }),
    // 错误日志文件配置
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'), // 错误日志文件路径
      level: 'error', // 只记录错误级别及以上的日志
      maxsize: 5242880, // 日志文件最大大小（5MB）
      maxFiles: 5 // 最大日志文件数，超过后会自动轮转
    }),
    // 综合日志文件配置
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'), // 综合日志文件路径
      maxsize: 5242880, // 日志文件最大大小（5MB）
      maxFiles: 5 // 最大日志文件数，超过后会自动轮转
    })
  ]
});

/**
 * 导出日志记录器
 * 供其他模块使用
 */
module.exports = logger;
