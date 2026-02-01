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

    if (req.query.borrow_no) {
      whereClause += ' AND br.borrow_no LIKE ?';
      params.push(`%${req.query.borrow_no}%`);
    }

    if (req.query.reader_name) {
      whereClause += ' AND ri.name LIKE ?';
      params.push(`%${req.query.reader_name}%`);
    }

    if (req.query.reader_no) {
      whereClause += ' AND ri.reader_no LIKE ?';
      params.push(`%${req.query.reader_no}%`);
    }

    if (req.query.book_title) {
      whereClause += ' AND b.title LIKE ?';
      params.push(`%${req.query.book_title}%`);
    }

    if (req.query.book_id) {
      whereClause += ' AND br.book_id = ?';
      params.push(req.query.book_id);
    }

    if (req.query.status) {
      whereClause += ' AND br.status = ?';
      params.push(req.query.status);
    }

    if (req.query.start_date) {
      whereClause += ' AND br.borrow_date >= ?';
      params.push(req.query.start_date);
    }

    if (req.query.end_date) {
      whereClause += ' AND br.borrow_date <= ?';
      params.push(req.query.end_date);
    }

    const [records] = await pool.query(
      `SELECT br.*, ri.name as reader_name, ri.reader_no, b.title as book_title, b.isbn, u.real_name as operator_name 
       FROM borrow_records br
       LEFT JOIN reader_info ri ON br.reader_id = ri.reader_no
       LEFT JOIN books b ON br.book_id = b.id
       LEFT JOIN users u ON br.operator_id = u.id
       ${whereClause}
       ORDER BY br.borrow_date DESC
       LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM borrow_records br
       LEFT JOIN reader_info ri ON br.reader_id = ri.reader_no
       LEFT JOIN books b ON br.book_id = b.id
       ${whereClause}`,
      params
    );

    res.json({
      code: 200,
      msg: '获取借阅记录成功',
      data: {
        list: records,
        total: countResult[0].total,
        page,
        pageSize
      }
    });
  } catch (error) {
    logger.error('获取借阅记录失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取借阅记录失败',
      data: null
    });
  }
});

router.post('/borrow', authMiddleware, [
  body('reader_id').notEmpty().withMessage('读者ID不能为空'),
  body('book_id').notEmpty().withMessage('图书ID不能为空')
], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { reader_id, book_id } = req.body;
    const operator_id = req.user.id;

    const [readers] = await connection.query(
      'SELECT ri.*, sc.value as max_borrow_count_value, sc2.value as max_borrow_days_value FROM reader_info ri LEFT JOIN sys_config sc ON sc.key = "max_borrow_count" LEFT JOIN sys_config sc2 ON sc2.key = "max_borrow_days" WHERE ri.reader_no = ?',
      [reader_id]
    );

    if (readers.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        msg: '读者不存在',
        data: null
      });
    }

    const reader = readers[0];
    const max_borrow_count = parseInt(reader.max_borrow_count_value) || 5;
    const max_borrow_days = parseInt(reader.max_borrow_days_value) || 30;

    const [borrowCount] = await connection.query(
      'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND status = "borrowed"',
      [reader_id]
    );
    const current_borrow_count = borrowCount[0].count;

    if (reader.credit_status !== 'good' && reader.credit_status !== 'normal') {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '读者信用状态异常，无法借阅',
        data: null
      });
    }

    if (current_borrow_count >= max_borrow_count) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '已达到最大借阅册数限制',
        data: null
      });
    }

    const [books] = await connection.query(
      'SELECT * FROM books WHERE id = ?',
      [book_id]
    );

    if (books.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }

    const book = books[0];

    if (book.available_count <= 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '图书库存不足',
        data: null
      });
    }

    if (book.status === 0) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '图书已下架',
        data: null
      });
    }

    const borrow_no = 'B' + Date.now() + Math.floor(Math.random() * 1000);
    const borrow_date = new Date();
    const due_date = new Date(borrow_date);
    due_date.setDate(due_date.getDate() + reader.max_borrow_days);

    await connection.query(
      'INSERT INTO borrow_records (borrow_no, reader_id, book_id, borrow_date, due_date, operator_id) VALUES (?, ?, ?, ?, ?, ?)',
      [borrow_no, reader_id, book_id, borrow_date, due_date, operator_id]
    );

    await connection.query(
      'UPDATE books SET available_count = available_count - 1, borrow_count = borrow_count + 1 WHERE id = ?',
      [book_id]
    );

    await connection.commit();

    res.json({
      code: 200,
      msg: '借阅成功',
      data: {
        borrow_no,
        due_date
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('借阅失败:', error);
    res.status(500).json({
      code: 500,
      msg: '借阅失败',
      data: null
    });
  } finally {
    connection.release();
  }
});

router.post('/return', authMiddleware, [
  body('borrow_no').notEmpty().withMessage('借阅编号不能为空')
], async (req, res) => {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await connection.rollback();
      return res.status(400).json({
        code: 400,
        msg: '参数验证失败',
        data: errors.array()
      });
    }

    const { borrow_no } = req.body;
    const operator_id = req.user.id;

    const [records] = await connection.query(
      'SELECT * FROM borrow_records WHERE borrow_no = ? AND status = "borrowed"',
      [borrow_no]
    );

    if (records.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        code: 404,
        msg: '借阅记录不存在或已归还',
        data: null
      });
    }

    const record = records[0];
    const return_date = new Date();

    let overdue_days = 0;
    let fine_amount = 0;

    if (return_date > record.due_date) {
      const diffTime = Math.abs(return_date - record.due_date);
      overdue_days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      fine_amount = overdue_days * 0.5;
    }

    await connection.query(
      'UPDATE borrow_records SET return_date = ?, status = "returned", overdue_days = ?, fine_amount = ?, operator_id = ? WHERE borrow_no = ?',
      [return_date, overdue_days, fine_amount, operator_id, borrow_no]
    );

    await connection.query(
      'UPDATE reader_info SET arrears_amount = arrears_amount + ? WHERE reader_no = ?',
      [fine_amount, record.reader_id]
    );

    await connection.query(
      'UPDATE books SET available_count = available_count + 1 WHERE id = ?',
      [record.book_id]
    );

    if (fine_amount > 0) {
      await connection.query(
        'UPDATE reader_info SET credit_status = "debt" WHERE reader_no = ?',
        [record.reader_id]
      );
    }

    await connection.commit();

    res.json({
      code: 200,
      msg: '归还成功',
      data: {
        overdue_days,
        fine_amount
      }
    });
  } catch (error) {
    await connection.rollback();
    logger.error('归还失败:', error);
    res.status(500).json({
      code: 500,
      msg: '归还失败',
      data: null
    });
  } finally {
    connection.release();
  }
});

router.post('/renew', authMiddleware, [
  body('borrow_no').notEmpty().withMessage('借阅编号不能为空')
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

    const { borrow_no } = req.body;

    const [records] = await pool.query(
      'SELECT br.*, sc.value as max_borrow_days_value FROM borrow_records br LEFT JOIN sys_config sc ON sc.key = "max_borrow_days" WHERE borrow_no = ? AND status = "borrowed"',
      [borrow_no]
    );

    if (records.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '借阅记录不存在或已归还',
        data: null
      });
    }

    const record = records[0];
    const max_borrow_days = parseInt(record.max_borrow_days_value) || 30;

    if (record.renew_count >= record.max_renew_count) {
      return res.status(400).json({
        code: 400,
        msg: '已达到最大续借次数',
        data: null
      });
    }

    const new_due_date = new Date(record.due_date);
    new_due_date.setDate(new_due_date.getDate() + max_borrow_days);

    await pool.query(
      'UPDATE borrow_records SET due_date = ?, renew_count = renew_count + 1 WHERE borrow_no = ?',
      [new_due_date, borrow_no]
    );

    res.json({
      code: 200,
      msg: '续借成功',
      data: {
        new_due_date
      }
    });
  } catch (error) {
    logger.error('续借失败:', error);
    res.status(500).json({
      code: 500,
      msg: '续借失败',
      data: null
    });
  }
});

router.get('/overdue/list', authMiddleware, async (req, res) => {
  try {
    const [records] = await pool.query(
      `SELECT br.*, ri.name as reader_name, ri.reader_no, b.title as book_title, b.isbn 
       FROM borrow_records br
       LEFT JOIN reader_info ri ON br.reader_id = ri.reader_no
       LEFT JOIN books b ON br.book_id = b.id
       WHERE br.status = 'borrowed' AND br.due_date < NOW()
       ORDER BY br.due_date ASC`
    );

    res.json({
      code: 200,
      msg: '获取逾期记录成功',
      data: records
    });
  } catch (error) {
    logger.error('获取逾期记录失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取逾期记录失败',
      data: null
    });
  }
});

module.exports = router;
