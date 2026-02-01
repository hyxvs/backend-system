/**
 * 读者端API路由
 * 处理读者端的所有API请求
 * 路由前缀: /api/reader
 */

/**
 * 导入必要的模块
 */
const express = require('express'); // 导入Express框架
const router = express.Router(); // 创建路由实例
const readerAuth = require('../middleware/readerAuth'); // 读者认证中间件
const readerController = require('../controllers/readerController'); // 读者控制器
const upload = require('../config/multer');

/**
 * 无需认证的路由
 * 登录/注册/找回密码相关
 */

// 读者登录
router.post('/login', readerController.login);

// 读者注册
router.post('/register', readerController.register);

// 发送短信验证码
router.post('/send-sms-code', readerController.sendSmsCode);

// 重置密码
router.post('/reset-password', readerController.resetPassword);

/**
 * 需要认证的路由
 * 以下路由需要读者登录后才能访问
 */
router.use(readerAuth);

// 登出
router.post('/logout', readerController.logout);

/**
 * 用户相关路由
 */

// 获取用户信息
router.get('/user/info', readerController.getUserInfo);

// 更新用户信息
router.put('/user/profile', readerController.updateUserProfile);

// 修改密码
router.post('/user/change-password', readerController.changePassword);

// 上传头像
router.post('/user/avatar', upload.single('file'), readerController.uploadAvatar);

// 获取用户统计信息
router.get('/user/statistics', readerController.getUserStatistics);

/**
 * 图书相关路由
 */

// 搜索图书
router.get('/books/search', readerController.searchBooks);

// 获取图书详情
router.get('/books/detail/:id', readerController.getBookDetail);

// 获取热门图书
router.get('/books/hot', readerController.getHotBooks);

// 获取图书分类
router.get('/books/categories', readerController.getBookCategories);

/**
 * 预约相关路由
 */

// 创建预约
router.post('/reservation/create', readerController.createReservation);

// 取消预约
router.post('/reservation/cancel/:id', readerController.cancelReservation);

// 获取预约列表
router.get('/reservation/list', readerController.getReservationList);

// 获取预约详情
router.get('/reservation/detail/:id', readerController.getReservationDetail);

/**
 * 借阅相关路由
 */

// 获取借阅列表
router.get('/borrow/list', readerController.getBorrowList);

// 获取借阅详情
router.get('/borrow/detail/:id', readerController.getBorrowDetail);

// 续借图书
router.post('/borrow/renew/:id', readerController.renewBook);

// 直接借阅图书
router.post('/borrow/create', readerController.borrowBook);

/**
 * 系统相关路由
 */

// 获取公告列表
router.get('/announcements', readerController.getAnnouncements);

// 获取最新公告
router.get('/announcements/latest', readerController.getLatestAnnouncement);

// 获取系统配置
router.get('/system/config', readerController.getSystemConfig);

/**
 * 导出路由实例
 */
module.exports = router;