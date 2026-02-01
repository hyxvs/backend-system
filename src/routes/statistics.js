const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');
const { authMiddleware } = require('../middleware/auth');
const ExcelJS = require('exceljs');

router.get('/dashboard', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    
    const [totalReaders] = await pool.query('SELECT COUNT(*) as count FROM reader_info');
    const [totalBooks] = await pool.query('SELECT COUNT(*) as count FROM books WHERE status = 1');
    const [totalBorrowed] = await pool.query('SELECT COUNT(*) as count FROM borrow_records WHERE status = "borrowed"');
    const [totalOverdue] = await pool.query('SELECT COUNT(*) as count FROM borrow_records WHERE status = "borrowed" AND due_date < NOW()');

    const [categoryStats] = await pool.query(
      `SELECT c.category_name, COUNT(br.id) as borrow_count 
       FROM categories c 
       LEFT JOIN books b ON c.id = b.category_id
       LEFT JOIN borrow_records br ON b.id = br.book_id AND br.borrow_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY c.id, c.category_name
       ORDER BY borrow_count DESC`,
      [days]
    );

    const [borrowTrend] = await pool.query(
      `SELECT DATE(borrow_date) as date, 
              COUNT(*) as total_count,
              COUNT(CASE WHEN status = 'borrowed' THEN 1 END) as borrowed_count,
              COUNT(CASE WHEN status = 'returned' THEN 1 END) as returned_count,
              COUNT(CASE WHEN status = 'overdue' THEN 1 END) as overdue_count
       FROM borrow_records 
       WHERE borrow_date >= DATE_SUB(NOW(), INTERVAL ? DAY)
       GROUP BY DATE(borrow_date)
       ORDER BY date ASC`,
      [days]
    );

    const [hotBooks] = await pool.query(
      `SELECT b.id, b.isbn, b.title, b.author, c.category_name, b.borrow_count, b.available_count, b.total_count
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.status = 1
       ORDER BY b.borrow_count DESC
       LIMIT 10`
    );

    const [bookStatus] = await pool.query(
      `SELECT 
        CASE 
          WHEN status = 1 THEN '正常'
          WHEN status = 0 THEN '下架'
          ELSE '其他'
        END as status_name,
        COUNT(*) as count
       FROM books
       GROUP BY status`
    );

    const [monthlyStats] = await pool.query(
      `SELECT 
        DATE_FORMAT(borrow_date, '%Y-%m') as month,
        COUNT(*) as borrow_count
       FROM borrow_records
       WHERE borrow_date >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
       GROUP BY DATE_FORMAT(borrow_date, '%Y-%m')
       ORDER BY month ASC`
    );

    res.json({
      code: 200,
      msg: '获取统计数据成功',
      data: {
        totalReaders: totalReaders[0].count,
        totalBooks: totalBooks[0].count,
        totalBorrowed: totalBorrowed[0].count,
        totalOverdue: totalOverdue[0].count,
        categoryStats,
        borrowTrend,
        hotBooks,
        bookStatus,
        monthlyStats
      }
    });
  } catch (error) {
    logger.error('获取统计数据失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取统计数据失败',
      data: null
    });
  }
});

router.get('/hot-books', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [hotBooks] = await pool.query(
      `SELECT b.id, b.isbn, b.title, b.author, c.category_name, b.borrow_count, b.available_count, b.total_count
       FROM books b
       LEFT JOIN categories c ON b.category_id = c.id
       WHERE b.status = 1
       ORDER BY b.borrow_count DESC
       LIMIT ?`,
      [limit]
    );

    res.json({
      code: 200,
      msg: '获取热门图书成功',
      data: hotBooks
    });
  } catch (error) {
    logger.error('获取热门图书失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取热门图书失败',
      data: null
    });
  }
});

router.get('/category-borrow', authMiddleware, async (req, res) => {
  try {
    const [categoryBorrow] = await pool.query(
      `SELECT c.category_name, COUNT(br.id) as borrow_count
       FROM categories c
       LEFT JOIN books b ON c.id = b.category_id
       LEFT JOIN borrow_records br ON b.id = br.book_id
       GROUP BY c.id, c.category_name
       ORDER BY borrow_count DESC`
    );

    res.json({
      code: 200,
      msg: '获取分类借阅统计成功',
      data: categoryBorrow
    });
  } catch (error) {
    logger.error('获取分类借阅统计失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取分类借阅统计失败',
      data: null
    });
  }
});

router.get('/reader-borrow', authMiddleware, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const [readerBorrow] = await pool.query(
      `SELECT ri.id, ri.reader_no, ri.name, '' as phone, COUNT(br.id) as borrow_count
       FROM reader_info ri
       LEFT JOIN borrow_records br ON ri.reader_no = br.reader_id
       GROUP BY ri.id, ri.reader_no, ri.name
       ORDER BY borrow_count DESC
       LIMIT ?`,
      [limit]
    );

    res.json({
      code: 200,
      msg: '获取读者借阅排行成功',
      data: readerBorrow
    });
  } catch (error) {
    logger.error('获取读者借阅排行失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取读者借阅排行失败',
      data: null
    });
  }
});

router.get('/export/borrow-records', authMiddleware, async (req, res) => {
  try {
    const { start_date, end_date, status } = req.query;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (start_date) {
      whereClause += ' AND br.borrow_date >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND br.borrow_date <= ?';
      params.push(end_date);
    }

    if (status) {
      whereClause += ' AND br.status = ?';
      params.push(status);
    }

    const [records] = await pool.query(
      `SELECT br.borrow_no, ri.reader_no, ri.name as reader_name, '' as phone, 
              b.isbn, b.title as book_title, b.author, 
              br.borrow_date, br.due_date, br.return_date, 
              br.status, br.overdue_days, br.fine_amount
       FROM borrow_records br
       LEFT JOIN reader_info ri ON br.reader_id = ri.reader_no
       LEFT JOIN books b ON br.book_id = b.id
       ${whereClause}
       ORDER BY br.borrow_date DESC`,
      params
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('借阅记录');

    worksheet.columns = [
      { header: '借阅编号', key: 'borrow_no', width: 20 },
      { header: '读者编号', key: 'reader_no', width: 15 },
      { header: '读者姓名', key: 'reader_name', width: 15 },
      { header: '联系电话', key: 'phone', width: 15 },
      { header: 'ISBN', key: 'isbn', width: 15 },
      { header: '图书名称', key: 'book_title', width: 30 },
      { header: '作者', key: 'author', width: 15 },
      { header: '借阅时间', key: 'borrow_date', width: 20 },
      { header: '应还时间', key: 'due_date', width: 20 },
      { header: '归还时间', key: 'return_date', width: 20 },
      { header: '状态', key: 'status', width: 10 },
      { header: '逾期天数', key: 'overdue_days', width: 10 },
      { header: '罚款金额', key: 'fine_amount', width: 10 }
    ];

    const statusMap = {
      'borrowed': '借阅中',
      'returned': '已归还',
      'overdue': '已逾期'
    };

    records.forEach(record => {
      worksheet.addRow({
        borrow_no: record.borrow_no,
        reader_no: record.reader_no,
        reader_name: record.reader_name,
        phone: record.phone,
        isbn: record.isbn,
        book_title: record.book_title,
        author: record.author,
        borrow_date: record.borrow_date ? new Date(record.borrow_date).toLocaleString('zh-CN') : '',
        due_date: record.due_date ? new Date(record.due_date).toLocaleString('zh-CN') : '',
        return_date: record.return_date ? new Date(record.return_date).toLocaleString('zh-CN') : '',
        status: statusMap[record.status] || record.status,
        overdue_days: record.overdue_days || 0,
        fine_amount: record.fine_amount || 0
      });
    });

    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };

    const fileName = `借阅记录_${new Date().getTime()}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${encodeURIComponent(fileName)}`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('导出借阅记录失败:', error);
    res.status(500).json({
      code: 500,
      msg: '导出借阅记录失败',
      data: null
    });
  }
});

module.exports = router;
