const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const logger = require('../config/logger');
const { authMiddleware } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (req.query.reader_no) {
      whereClause += ' AND ri.reader_no LIKE ?';
      params.push(`%${req.query.reader_no}%`);
    }

    if (req.query.name) {
      whereClause += ' AND ri.name LIKE ?';
      params.push(`%${req.query.name}%`);
    }

    // Phone field is not available in reader_info table
    // if (req.query.phone) {
    //   whereClause += ' AND ri.phone LIKE ?';
    //   params.push(`%${req.query.phone}%`);
    // }

    if (req.query.credit_status) {
      whereClause += ' AND ri.credit_status = ?';
      params.push(req.query.credit_status);
    }

    // 构建 SQL 查询字符串
    const sqlQuery = `SELECT ri.id, ri.reader_no, ri.name, ri.email, ri.id_card, '' as phone, ri.credit_status, ri.arrears_amount as debt_amount, 5 as max_borrow_count, 1 as status, ri.create_time, ri.update_time FROM reader_info ri${whereClause} ORDER BY ri.create_time DESC LIMIT ? OFFSET ?`;
    
    // 执行查询
    const [readers] = await pool.query(sqlQuery, [...params, pageSize, offset]);

    const [countResult] = await pool.query(
      'SELECT COUNT(*) as total FROM reader_info ri' + whereClause,
      params
    );

    res.json({
      code: 200,
      msg: '获取读者列表成功',
      data: {
        list: readers,
        total: countResult[0].total,
        page,
        pageSize
      }
    });
  } catch (error) {
    logger.error('获取读者列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取读者列表失败',
      data: null
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // 构建 SQL 查询字符串
    const sqlQuery = `SELECT ri.id, ri.reader_no, ri.name, ri.email, ri.id_card, '' as phone, ri.credit_status, ri.arrears_amount as debt_amount, 5 as max_borrow_count, 1 as status, ri.create_time, ri.update_time FROM reader_info ri WHERE ri.id = ?`;
    
    // 执行查询
    const [readers] = await pool.query(sqlQuery, [id]);

    if (readers.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者不存在',
        data: null
      });
    }

    res.json({
      code: 200,
      msg: '获取读者信息成功',
      data: readers[0]
    });
  } catch (error) {
    logger.error('获取读者信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取读者信息失败',
      data: null
    });
  }
});

router.post('/', [
  body('reader_no').notEmpty().withMessage('读者编号不能为空'),
  body('name').notEmpty().withMessage('读者姓名不能为空'),
  body('id_card').matches(/^\d{17}[\dXx]$/).withMessage('身份证号格式不正确')
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

    const { reader_no, name, phone, email, id_card, max_borrow_count, max_borrow_days } = req.body;

    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 创建系统用户
      const [userResult] = await pool.execute(
        'INSERT INTO sys_user (username, password, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
        [reader_no, '$2b$10$eJq7t18p0J6z6j9q8p7o8e9r8t7y6u5i4o3p2n1m0l9k8j7i6h5g4f3e2d1c', 'reader', 'active', new Date(), new Date()]
      );
      
      const userId = userResult.insertId;
      
      // 创建读者信息（用于读者系统）
    await pool.execute(
      'INSERT INTO reader_info (user_id, reader_no, name, gender, id_card, email, credit_status, arrears_amount, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, reader_no, name, 'male', id_card, email || null, 'good', 0, new Date(), new Date()]
    );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({
        code: 200,
        msg: '创建读者成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('创建读者失败:', error);
    res.status(500).json({
      code: 500,
      msg: '创建读者失败',
      data: null
    });
  }
});

router.put('/:id', [
  body('reader_no').notEmpty().withMessage('读者编号不能为空'),
  body('name').notEmpty().withMessage('读者姓名不能为空'),
  body('id_card').matches(/^\d{17}[\dXx]$/).withMessage('身份证号格式不正确')
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
    const { reader_no, name, phone, email, id_card, max_borrow_count, max_borrow_days, status } = req.body;

    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 更新读者信息（用于读者系统）
    await pool.execute(
      'UPDATE reader_info SET reader_no = ?, name = ?, email = ?, id_card = ?, update_time = ? WHERE id = ?',
      [reader_no, name, email || null, id_card, new Date(), id]
    );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({
        code: 200,
        msg: '更新读者成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('更新读者失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新读者失败',
      data: null
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`开始删除读者，ID: ${id}`);

    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 获取读者编号和用户ID
      const [readerResult] = await pool.execute(
        'SELECT reader_no, user_id FROM reader_info WHERE id = ?',
        [id]
      );
      
      if (readerResult.length === 0) {
        return res.status(404).json({
          code: 404,
          msg: '读者不存在',
          data: null
        });
      }
      
      const { reader_no, user_id } = readerResult[0];

      // 检查是否有未归还的图书
      logger.info('检查是否有未归还的图书');
      const [borrowRecords] = await pool.query(
        'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND status = "borrowed"',
        [reader_no]
      );
      logger.info(`未归还图书数量: ${borrowRecords[0].count}`);

      if (borrowRecords[0].count > 0) {
        return res.status(400).json({
          code: 400,
          msg: '该读者还有未归还的图书，无法删除',
          data: null
        });
      }

      // 检查是否有预约记录
      logger.info('检查是否有预约记录');
      const [appointmentRecords] = await pool.query(
        'SELECT COUNT(*) as count FROM appointments WHERE reader_id = ?',
        [reader_no]
      );
      logger.info(`预约记录数量: ${appointmentRecords[0].count}`);

      if (appointmentRecords[0].count > 0) {
        return res.status(400).json({
          code: 400,
          msg: '该读者还有相关的预约记录，无法删除',
          data: null
        });
      }

      // 检查是否有任何借阅记录（包括已归还的）
      logger.info('检查是否有任何借阅记录');
      const [allBorrowRecords] = await pool.query(
        'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ?',
        [reader_no]
      );
      logger.info(`借阅记录数量: ${allBorrowRecords[0].count}`);

      if (allBorrowRecords[0].count > 0) {
        return res.status(400).json({
          code: 400,
          msg: '该读者还有借阅记录，无法删除',
          data: null
        });
      }

      // 尝试获取appointments表中具体的记录
      logger.info('尝试获取appointments表中具体的记录');
      const [appointments] = await pool.query(
        'SELECT * FROM appointments WHERE reader_id = ?',
        [reader_no]
      );
      logger.info(`appointments表中具体记录: ${JSON.stringify(appointments)}`);

      // 删除系统用户
      logger.info('删除系统用户');
      await pool.execute(
        'DELETE FROM sys_user WHERE id = ?',
        [user_id]
      );
      
      // 删除读者信息（用于读者系统）
      logger.info('删除读者信息');
      await pool.execute(
        'DELETE FROM reader_info WHERE id = ?',
        [id]
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({
        code: 200,
        msg: '删除读者成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('删除读者失败:', error);
    res.status(500).json({
      code: 500,
      msg: '删除读者失败',
      data: null
    });
  }
});

router.put('/:id/credit', [
  body('credit_status').isIn(['normal', 'overdue', 'debt']).withMessage('信用状态不正确')
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
    const { credit_status } = req.body;

    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 获取读者编号
      const [readerResult] = await pool.execute(
        'SELECT reader_no FROM reader_info WHERE id = ?',
        [id]
      );
      
      if (readerResult.length === 0) {
        return res.status(404).json({
          code: 404,
          msg: '读者不存在',
          data: null
        });
      }
      
      const { reader_no } = readerResult[0];

      // 更新读者信息（用于读者系统）
      await pool.execute(
        'UPDATE reader_info SET credit_status = ?, update_time = ? WHERE id = ?',
        [credit_status, new Date(), id]
      );
      
      // 提交事务
      await pool.query('COMMIT');
      
      res.json({
        code: 200,
        msg: '更新信用状态成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    logger.error('更新信用状态失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新信用状态失败',
      data: null
    });
  }
});

module.exports = router;
