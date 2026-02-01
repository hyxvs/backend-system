// 导入必要的模块
const express = require('express'); // 导入Express框架
const router = express.Router(); // 创建路由实例
const { body, validationResult } = require('express-validator'); // 导入express-validator，用于请求参数验证
const pool = require('../config/database'); // 导入数据库连接池
const logger = require('../config/logger'); // 导入日志记录器
const { authMiddleware } = require('../middleware/auth'); // 导入认证中间件

/**
 * 获取预约列表
 * GET /api/appointment
 * @param {number} page - 页码，默认为1
 * @param {number} pageSize - 每页数量，默认为10
 * @param {string} reader_name - 读者姓名，模糊查询
 * @param {string} book_title - 图书标题，模糊查询
 * @param {number} book_id - 图书ID
 * @param {string} status - 预约状态
 * @param {string} start_date - 开始日期
 * @param {string} end_date - 结束日期
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    // 解析分页参数
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    // 构建查询条件
    let whereClause = ' WHERE 1=1';
    const params = [];

    // 读者姓名模糊查询
    if (req.query.reader_name) {
      whereClause += ' AND ri.name LIKE ?';
      params.push(`%${req.query.reader_name}%`);
    }

    // 图书标题模糊查询
    if (req.query.book_title) {
      whereClause += ' AND b.title LIKE ?';
      params.push(`%${req.query.book_title}%`);
    }

    // 图书ID精确查询
    if (req.query.book_id) {
      whereClause += ' AND a.book_id = ?';
      params.push(req.query.book_id);
    }

    // 只有当明确指定了状态时，才添加状态过滤条件
    if (req.query.status) {
      whereClause += ' AND a.status = ?';
      params.push(req.query.status);
    }

    // 开始日期过滤
    if (req.query.start_date) {
      whereClause += ' AND a.appointment_date >= ?';
      params.push(req.query.start_date);
    }

    // 结束日期过滤
    if (req.query.end_date) {
      whereClause += ' AND a.appointment_date <= ?';
      params.push(req.query.end_date);
    }

    // 查询预约列表
    const [appointments] = await pool.query(
      `SELECT a.*, ri.name as reader_name, ri.reader_no, b.title as book_title, b.isbn, u.real_name as operator_name 
       FROM appointments a
       LEFT JOIN reader_info ri ON a.reader_id = ri.id
       LEFT JOIN books b ON a.book_id = b.id
       LEFT JOIN users u ON a.operator_id = u.id
       ${whereClause}
       ORDER BY a.appointment_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    // 查询总记录数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM appointments a
       LEFT JOIN reader_info ri ON a.reader_id = ri.id
       LEFT JOIN books b ON a.book_id = b.id
       ${whereClause}`,
      params
    );

    // 记录日志
    logger.info('获取预约列表成功，共', appointments.length, '条记录');

    // 返回响应
    res.json({
      code: 200,
      msg: '获取预约列表成功',
      data: {
        list: appointments,
        total: countResult[0].total,
        page,
        pageSize
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('获取预约列表失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '获取预约列表失败',
      data: null
    });
  }
});

/**
 * 创建预约
 * POST /api/appointment
 * @param {number} reader_id - 读者ID
 * @param {number} book_id - 图书ID
 * @param {string} appointment_date - 预约日期
 */
router.post('/', authMiddleware, [
  body('reader_id').notEmpty().withMessage('读者ID不能为空'),
  body('book_id').notEmpty().withMessage('图书ID不能为空'),
  body('appointment_date').notEmpty().withMessage('预约日期不能为空')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    // 解析请求参数
    const { reader_id, book_id, appointment_date } = req.body;
    const operator_id = req.user.id;

    // 检查读者是否存在
    const [readers] = await pool.query(
      'SELECT * FROM reader_info WHERE id = ?',
      [reader_id]
    );

    if (readers.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者不存在',
        data: null
      });
    }

    const reader = readers[0];

    // 检查读者信用状态
    if (reader.credit_status !== 'good' && reader.credit_status !== 'normal') {
      return res.status(400).json({
        code: 400,
        msg: '读者信用状态异常，无法预约',
        data: null
      });
    }

    // 检查图书是否存在
    const [books] = await pool.query(
      'SELECT * FROM books WHERE id = ?',
      [book_id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }

    const book = books[0];

    // 检查图书库存
    if (book.available_count <= 0) {
      return res.status(400).json({
        code: 400,
        msg: '图书库存不足，无法预约',
        data: null
      });
    }

    // 检查图书状态
    if (book.status === 0) {
      return res.status(400).json({
        code: 400,
        msg: '图书已下架',
        data: null
      });
    }

    // 检查是否已存在相同的预约
    const [existingAppointments] = await pool.query(
      'SELECT COUNT(*) as count FROM appointments WHERE reader_id = ? AND book_id = ? AND status = "pending"',
      [reader_id, book_id]
    );

    if (existingAppointments[0].count > 0) {
      return res.status(400).json({
        code: 400,
        msg: '该读者已预约过此图书',
        data: null
      });
    }

    // 生成预约编号
    const appointment_no = 'A' + Date.now() + Math.floor(Math.random() * 1000);

    // 创建预约
    await pool.query(
      'INSERT INTO appointments (appointment_no, reader_id, book_id, appointment_date, operator_id) VALUES (?, ?, ?, ?, ?)',
      [appointment_no, reader_id, book_id, appointment_date, operator_id]
    );

    // 返回响应
    res.json({
      code: 200,
      msg: '创建预约成功',
      data: {
        appointment_no
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('创建预约失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '创建预约失败',
      data: null
    });
  }
});

/**
 * 更新预约状态
 * PUT /api/appointment/:id
 * @param {number} id - 预约ID
 * @param {string} status - 预约状态，可选值：pending, completed, cancelled
 */
router.put('/:id', authMiddleware, [
  body('status').isIn(['pending', 'completed', 'cancelled']).withMessage('状态不正确')
], async (req, res) => {
  try {
    // 验证请求参数
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    // 解析请求参数
    const { id } = req.params;
    const { status } = req.body;

    // 检查预约是否存在
    const [appointments] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约不存在',
        data: null
      });
    }

    const appointment = appointments[0];

    // 检查预约状态
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        msg: '该预约已完成或已取消',
        data: null
      });
    }

    // 如果状态为completed，需要更新图书库存
    if (status === 'completed') {
      const connection = await pool.getConnection();
      try {
        // 开始事务
        await connection.beginTransaction();

        // 更新预约状态
        await connection.query(
          'UPDATE appointments SET status = ?, completed_date = NOW() WHERE id = ?',
          [status, id]
        );

        // 减少图书库存
        await connection.query(
          'UPDATE books SET available_count = available_count - 1 WHERE id = ?',
          [appointment.book_id]
        );

        // 提交事务
        await connection.commit();
      } catch (error) {
        // 回滚事务
        await connection.rollback();
        throw error;
      } finally {
        // 释放连接
        connection.release();
      }
    } else {
      // 更新预约状态为cancelled
      await pool.query(
        'UPDATE appointments SET status = ?, cancelled_date = NOW() WHERE id = ?',
        [status, id]
      );
    }

    // 返回响应
    res.json({
      code: 200,
      msg: '更新预约成功',
      data: null
    });
  } catch (error) {
    // 记录错误日志
    logger.error('更新预约失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '更新预约失败',
      data: null
    });
  }
});

/**
 * 删除预约
 * DELETE /api/appointment/:id
 * @param {number} id - 预约ID
 */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    // 解析请求参数
    const { id } = req.params;

    // 检查预约是否存在
    const [appointments] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约不存在',
        data: null
      });
    }

    const appointment = appointments[0];

    // 检查预约状态
    if (appointment.status === 'completed') {
      return res.status(400).json({
        code: 400,
        msg: '该预约已完成，无法删除',
        data: null
      });
    }

    // 删除预约
    await pool.query('DELETE FROM appointments WHERE id = ?', [id]);

    // 返回响应
    res.json({
      code: 200,
      msg: '删除预约成功',
      data: null
    });
  } catch (error) {
    // 记录错误日志
    logger.error('删除预约失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '删除预约失败',
      data: null
    });
  }
});

/**
 * 发送预约提醒
 * POST /api/appointment/reminder/:id
 * @param {number} id - 预约ID
 */
router.post('/reminder/:id', authMiddleware, async (req, res) => {
  try {
    // 解析请求参数
    const { id } = req.params;

    // 检查预约是否存在
    const [appointments] = await pool.query(
      `SELECT a.*, r.name as reader_name, '' as phone, b.title as book_title 
       FROM appointments a
       LEFT JOIN reader_info r ON a.reader_id = r.id
       LEFT JOIN books b ON a.book_id = b.id
       WHERE a.id = ?`,
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约不存在',
        data: null
      });
    }

    const appointment = appointments[0];

    // 检查预约状态
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        msg: '该预约已完成或已取消',
        data: null
      });
    }

    // 更新提醒状态
    await pool.query(
      'UPDATE appointments SET reminder_sent = 1 WHERE id = ?',
      [id]
    );

    // 返回响应
    res.json({
      code: 200,
      msg: '发送提醒成功',
      data: {
        reader_name: appointment.reader_name,
        phone: appointment.phone,
        book_title: appointment.book_title
      }
    });
  } catch (error) {
    // 记录错误日志
    logger.error('发送提醒失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '发送提醒失败',
      data: null
    });
  }
});

/**
 * 取消预约
 * POST /api/appointment/:id/cancel
 * @param {number} id - 预约ID
 */
router.post('/:id/cancel', authMiddleware, async (req, res) => {
  try {
    // 解析请求参数
    const { id } = req.params;

    // 检查预约是否存在
    const [appointments] = await pool.query(
      'SELECT * FROM appointments WHERE id = ?',
      [id]
    );

    if (appointments.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约不存在',
        data: null
      });
    }

    const appointment = appointments[0];

    // 检查预约状态
    if (appointment.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        msg: '该预约已完成或已取消',
        data: null
      });
    }

    // 取消预约
    await pool.query(
      'UPDATE appointments SET status = ?, cancelled_date = NOW() WHERE id = ?',
      ['cancelled', id]
    );

    // 返回响应
    res.json({
      code: 200,
      msg: '预约已取消',
      data: null
    });
  } catch (error) {
    // 记录错误日志
    logger.error('取消预约失败:', error);
    // 返回错误响应
    res.status(500).json({
      code: 500,
      msg: '取消预约失败',
      data: null
    });
  }
});

// 导出路由实例
module.exports = router;