/**
 * 路由索引文件
 * 集中管理所有API路由
 */

/**
 * 导入必要的模块
 */
const express = require('express'); // 导入Express框架
const router = express.Router(); // 创建路由实例

/**
 * 导入路由模块
 */
const appointmentRoutes = require('./appointment'); // 预约相关路由
const authRoutes = require('./auth'); // 认证相关路由
const booksRoutes = require('./books'); // 图书相关路由
const borrowRoutes = require('./borrow'); // 借阅相关路由
const logsRoutes = require('./logs'); // 日志相关路由
const readerRoutes = require('./reader'); // 读者端API路由
const readersRoutes = require('./readers'); // 读者管理相关路由
const statisticsRoutes = require('./statistics'); // 统计相关路由
const usersRoutes = require('./users'); // 用户相关路由

/**
 * 注册路由
 */

// 预约相关路由
router.use('/appointment', appointmentRoutes);

// 认证相关路由
router.use('/auth', authRoutes);

// 图书相关路由
router.use('/books', booksRoutes);

// 借阅相关路由
router.use('/borrow', borrowRoutes);

// 日志相关路由
router.use('/logs', logsRoutes);

// 读者端API路由
router.use('/reader', readerRoutes);

// 读者管理相关路由
router.use('/readers', readersRoutes);

// 统计相关路由
router.use('/statistics', statisticsRoutes);

// 用户相关路由
router.use('/users', usersRoutes);

/**
 * 导出路由实例
 * 供app.js使用
 */
module.exports = router;