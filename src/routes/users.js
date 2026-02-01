const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const pool = require('../config/database');
const logger = require('../config/logger');
const { authMiddleware, adminAuthMiddleware } = require('../middleware/auth');
const dayjs = require('dayjs');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    let whereClause = '';
    const params = [];

    if (req.query.username) {
      whereClause += ' WHERE username LIKE ?';
      params.push(`%${req.query.username}%`);
    }

    if (req.query.role) {
      whereClause += whereClause ? ' AND role = ?' : ' WHERE role = ?';
      params.push(req.query.role);
    }

    const [users] = await pool.query(
      `SELECT id, username, role, real_name, phone, status, created_at FROM users${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM users${whereClause}`,
      params
    );

    res.json({
      code: 200,
      msg: '获取用户列表成功',
      data: {
        list: users,
        total: countResult[0].total,
        page,
        pageSize
      }
    });
  } catch (error) {
    logger.error('获取用户列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取用户列表失败',
      data: null
    });
  }
});

router.post('/', [authMiddleware, adminAuthMiddleware], [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').isLength({ min: 6 }).withMessage('密码至少6位'),
  body('real_name').notEmpty().withMessage('真实姓名不能为空'),
  body('role').isIn(['admin', 'librarian']).withMessage('角色必须是admin或librarian')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { username, password, role, real_name, phone, status } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'INSERT INTO users (username, password, role, real_name, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
      [username, hashedPassword, role, real_name, phone, status || 1]
    );

    res.json({
      code: 200,
      msg: '创建用户成功',
      data: null
    });
  } catch (error) {
    logger.error('创建用户失败:', error);
    res.status(500).json({
      code: 500,
      msg: '创建用户失败',
      data: null
    });
  }
});

router.put('/:id', [authMiddleware, adminAuthMiddleware], [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('real_name').notEmpty().withMessage('真实姓名不能为空'),
  body('role').isIn(['admin', 'librarian']).withMessage('角色必须是admin或librarian')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { id } = req.params;
    const { username, role, real_name, phone, status } = req.body;

    await pool.query(
      'UPDATE users SET username = ?, role = ?, real_name = ?, phone = ?, status = ? WHERE id = ?',
      [username, role, real_name, phone, status, id]
    );

    res.json({
      code: 200,
      msg: '更新用户成功',
      data: null
    });
  } catch (error) {
    logger.error('更新用户失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新用户失败',
      data: null
    });
  }
});

router.delete('/:id', [authMiddleware, adminAuthMiddleware], async (req, res) => {
  try {
    const { id } = req.params;

    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        code: 400,
        msg: '不能删除自己的账号',
        data: null
      });
    }

    await pool.query('DELETE FROM users WHERE id = ?', [id]);

    res.json({
      code: 200,
      msg: '删除用户成功',
      data: null
    });
  } catch (error) {
    logger.error('删除用户失败:', error);
    res.status(500).json({
      code: 500,
      msg: '删除用户失败',
      data: null
    });
  }
});

router.put('/:id/password', [authMiddleware, adminAuthMiddleware], [
  body('password').isLength({ min: 6 }).withMessage('密码至少6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { id } = req.params;
    const { password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, id]
    );

    res.json({
      code: 200,
      msg: '重置密码成功',
      data: null
    });
  } catch (error) {
    logger.error('重置密码失败:', error);
    res.status(500).json({
      code: 500,
      msg: '重置密码失败',
      data: null
    });
  }
});

// 更新当前用户个人信息
router.put('/profile', authMiddleware, [
  body('real_name').notEmpty().withMessage('真实姓名不能为空')
], async (req, res) => {
  try {
    console.log('req.user:', req.user);
    console.log('req.body:', req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log('验证错误:', errors.array());
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { real_name, phone } = req.body;
    const userId = req.user.id;

    await pool.query(
      'UPDATE users SET real_name = ?, phone = ? WHERE id = ?',
      [real_name, phone, userId]
    );

    // 记录操作日志
    await pool.query(
      'INSERT INTO operation_logs (user_id, username, module, action, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, req.user.username, 'user', 'update_profile', '更新个人信息', req.ip]
    );

    res.json({
      code: 200,
      msg: '更新个人信息成功',
      data: null
    });
  } catch (error) {
    logger.error('更新个人信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新个人信息失败',
      data: null
    });
  }
});

// 修改当前用户密码
router.put('/change-password', [
  body('oldPassword').notEmpty().withMessage('旧密码不能为空'),
  body('newPassword').isLength({ min: 6 }).withMessage('新密码至少6位')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    // 获取用户信息
    const [users] = await pool.query(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '用户不存在',
        data: null
      });
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, users[0].password);
    if (!isPasswordValid) {
      return res.status(400).json({
        code: 400,
        msg: '旧密码错误',
        data: null
      });
    }

    // 加密新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 更新密码
    await pool.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, userId]
    );

    // 记录操作日志
    await pool.query(
      'INSERT INTO operation_logs (user_id, username, module, action, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, req.user.username, 'user', 'change_password', '修改密码', req.ip]
    );

    res.json({
      code: 200,
      msg: '修改密码成功',
      data: null
    });
  } catch (error) {
    logger.error('修改密码失败:', error);
    res.status(500).json({
      code: 500,
      msg: '修改密码失败',
      data: null
    });
  }
});

// 获取当前用户统计信息
router.get('/statistics', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const username = req.user.username;

    // 获取累计操作次数
    const [totalOperationsResult] = await pool.query(
      'SELECT COUNT(*) as count FROM operation_logs WHERE user_id = ?',
      [userId]
    );
    const totalOperations = totalOperationsResult[0].count;

    // 获取登录次数
    const [loginCountResult] = await pool.query(
      'SELECT COUNT(*) as count FROM operation_logs WHERE user_id = ? AND action = "login"',
      [userId]
    );
    const loginCount = loginCountResult[0].count;

    // 获取本月操作次数
    const [thisMonthOperationsResult] = await pool.query(
      'SELECT COUNT(*) as count FROM operation_logs WHERE user_id = ? AND DATE(created_at) >= DATE(NOW() - INTERVAL 1 MONTH)',
      [userId]
    );
    const thisMonthOperations = thisMonthOperationsResult[0].count;

    // 获取错误操作次数（这里假设错误操作会在description中包含"错误"或"失败"）
    const [errorOperationsResult] = await pool.query(
      'SELECT COUNT(*) as count FROM operation_logs WHERE user_id = ? AND (description LIKE ? OR description LIKE ?)',
      [userId, '%错误%', '%失败%']
    );
    const errorOperations = errorOperationsResult[0].count;

    // 获取近30天操作趋势
    const [operationTrendResult] = await pool.query(
      `SELECT DATE(created_at) as date, COUNT(*) as count 
       FROM operation_logs 
       WHERE user_id = ? AND DATE(created_at) >= DATE(NOW() - INTERVAL 30 DAY) 
       GROUP BY DATE(created_at) 
       ORDER BY date ASC`,
      [userId]
    );

    // 生成近30天的日期数组，确保每天都有数据点
    const operationTrend = [];
    for (let i = 29; i >= 0; i--) {
      const date = dayjs().subtract(i, 'day').format('YYYY-MM-DD');
      const existingData = operationTrendResult.find(item => item.date === date);
      operationTrend.push({
        date,
        count: existingData ? existingData.count : 0
      });
    }

    res.json({
      code: 200,
      msg: '获取用户统计信息成功',
      data: {
        totalOperations,
        loginCount,
        thisMonthOperations,
        errorOperations,
        operationTrend
      }
    });
  } catch (error) {
    logger.error('获取用户统计信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取用户统计信息失败',
      data: null
    });
  }
});

module.exports = router;
