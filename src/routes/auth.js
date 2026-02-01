const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const logger = require('../config/logger');

router.post('/login', [
  body('username').notEmpty().withMessage('用户名不能为空'),
  body('password').notEmpty().withMessage('密码不能为空')
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

    const { username, password } = req.body;

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        msg: '用户名或密码错误',
        data: null
      });
    }

    const user = users[0];

    if (user.status === 0) {
      return res.status(403).json({
        code: 403,
        msg: '账号已被禁用',
        data: null
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        msg: '用户名或密码错误',
        data: null
      });
    }

    // 创建登录会话记录
    const [sessionResult] = await pool.query(
      'INSERT INTO login_sessions (user_id, username, ip_address, user_agent) VALUES (?, ?, ?, ?)',
      [user.id, user.username, req.ip, req.headers['user-agent']]
    );

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        realName: user.real_name,
        sessionId: sessionResult.insertId
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    await pool.query(
      'INSERT INTO operation_logs (user_id, username, module, action, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [user.id, user.username, 'auth', 'login', '用户登录', req.ip]
    );

    res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          realName: user.real_name,
          phone: user.phone
        }
      }
    });
  } catch (error) {
    logger.error('登录失败:', error);
    res.status(500).json({
      code: 500,
      msg: '登录失败',
      data: null
    });
  }
});

router.get('/info', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        code: 401,
        msg: '未提供认证令牌',
        data: null
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [users] = await pool.query(
      'SELECT id, username, role, real_name, phone, status, created_at FROM users WHERE id = ?',
      [decoded.id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '用户不存在',
        data: null
      });
    }

    res.json({
      code: 200,
      msg: '获取用户信息成功',
      data: users[0]
    });
  } catch (error) {
    logger.error('获取用户信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取用户信息失败',
      data: null
    });
  }
});

// 检查用户数据
router.get('/check-users', async (req, res) => {
  try {
    const [users] = await pool.query(
      'SELECT id, username, real_name, role, status FROM users'
    );

    res.json({
      code: 200,
      msg: '获取用户数据成功',
      data: users
    });
  } catch (error) {
    logger.error('获取用户数据失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取用户数据失败',
      data: null
    });
  }
});

// 注册接口
router.post('/register', [
  body('username').notEmpty().withMessage('用户名不能为空').isLength({ min: 3, max: 50 }).withMessage('用户名长度3-50位'),
  body('password').notEmpty().withMessage('密码不能为空').isLength({ min: 6 }).withMessage('密码长度至少6位'),
  body('realName').notEmpty().withMessage('真实姓名不能为空'),
  body('role').optional().isIn(['admin', 'librarian']).withMessage('角色只能是admin或librarian')
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

    const { username, password, realName, phone, role } = req.body;

    // 检查用户名是否已存在
    const [existingUsers] = await pool.query(
      'SELECT * FROM users WHERE username = ?',
      [username]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        code: 400,
        msg: '用户名已存在',
        data: null
      });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 插入用户数据
    const [result] = await pool.query(
      'INSERT INTO users (username, password, role, real_name, phone) VALUES (?, ?, ?, ?, ?)',
      [username, hashedPassword, role || 'librarian', realName, phone || null]
    );

    await pool.query(
      'INSERT INTO operation_logs (user_id, username, module, action, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [result.insertId, username, 'auth', 'register', '用户注册', req.ip]
    );

    res.json({
      code: 200,
      msg: '注册成功',
      data: {
        userId: result.insertId,
        username,
        role: role || 'librarian',
        realName
      }
    });
  } catch (error) {
    logger.error('注册失败:', error);
    res.status(500).json({
      code: 500,
      msg: '注册失败',
      data: null
    });
  }
});

// 登出路由
router.post('/logout', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const sessionId = decoded.sessionId;

        if (sessionId) {
          // 更新登录会话记录
          await pool.query(
            `UPDATE login_sessions 
             SET logout_time = CURRENT_TIMESTAMP, 
                 duration = TIMESTAMPDIFF(SECOND, login_time, CURRENT_TIMESTAMP), 
                 status = 'ended' 
             WHERE id = ? AND status = 'active'`,
            [sessionId]
          );

          // 记录登出操作
          await pool.query(
            'INSERT INTO operation_logs (user_id, username, module, action, description, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
            [decoded.id, decoded.username, 'auth', 'logout', '用户登出', req.ip]
          );
        }
      } catch (tokenError) {
        logger.error('Token验证失败:', tokenError);
      }
    }

    res.json({
      code: 200,
      msg: '登出成功',
      data: null
    });
  } catch (error) {
    logger.error('登出失败:', error);
    res.status(500).json({
      code: 500,
      msg: '登出失败',
      data: null
    });
  }
});

// 重置用户密码
router.get('/reset-password', async (req, res) => {
  try {
    const bcrypt = require('bcryptjs');
    const newPassword = await bcrypt.hash('123456', 10);
    console.log('新密码哈希:', newPassword);

    await pool.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [newPassword, 'admin']
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



// 获取登录历史记录
router.get('/login-history', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({
        code: 401,
        msg: '未提供认证令牌',
        data: null
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id;

    // 获取登录历史记录
    const [history] = await pool.query(
      `SELECT id, login_time, logout_time, duration, ip_address, status 
       FROM login_sessions 
       WHERE user_id = ? 
       ORDER BY login_time DESC 
       LIMIT 20`,
      [userId]
    );

    // 格式化登录时长
    const formattedHistory = history.map(session => {
      let durationText = '未知';
      if (session.duration) {
        const hours = Math.floor(session.duration / 3600);
        const minutes = Math.floor((session.duration % 3600) / 60);
        const seconds = session.duration % 60;
        if (hours > 0) {
          durationText = `${hours}小时${minutes}分钟`;
        } else if (minutes > 0) {
          durationText = `${minutes}分钟${seconds}秒`;
        } else {
          durationText = `${seconds}秒`;
        }
      }

      return {
        ...session,
        duration_text: durationText
      };
    });

    // 获取登录时长统计
    const [stats] = await pool.query(
      `SELECT 
        COUNT(*) as total_sessions, 
        SUM(duration) as total_duration, 
        AVG(duration) as avg_duration 
       FROM login_sessions 
       WHERE user_id = ? AND status = 'ended'`,
      [userId]
    );

    const statistics = {
      total_sessions: stats[0].total_sessions || 0,
      total_duration: stats[0].total_duration || 0,
      avg_duration: stats[0].avg_duration || 0
    };

    // 格式化统计数据
    if (statistics.total_duration) {
      const totalHours = Math.floor(statistics.total_duration / 3600);
      const totalMinutes = Math.floor((statistics.total_duration % 3600) / 60);
      statistics.total_duration_text = `${totalHours}小时${totalMinutes}分钟`;
    } else {
      statistics.total_duration_text = '0分钟';
    }

    if (statistics.avg_duration) {
      const avgMinutes = Math.floor(statistics.avg_duration / 60);
      const avgSeconds = Math.floor(statistics.avg_duration % 60);
      statistics.avg_duration_text = `${avgMinutes}分钟${avgSeconds}秒`;
    } else {
      statistics.avg_duration_text = '0分钟';
    }

    res.json({
      code: 200,
      msg: '获取登录历史成功',
      data: {
        history: formattedHistory,
        statistics
      }
    });
  } catch (error) {
    logger.error('获取登录历史失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取登录历史失败',
      data: null
    });
  }
});

module.exports = router;
