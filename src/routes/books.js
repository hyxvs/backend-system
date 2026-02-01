const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const pool = require('../config/database');
const logger = require('../config/logger');
const { authMiddleware } = require('../middleware/auth');
const upload = require('../config/multer');

// 测试路由
router.get('/test', async (req, res) => {
  try {
    // 添加一个简单的数据库查询
    const [result] = await pool.query("SELECT 1");
    
    res.json({
      code: 200,
      msg: '测试路由成功',
      data: result
    });
  } catch (error) {
    logger.error('测试路由失败:', error);
    res.status(500).json({
      code: 500,
      msg: '测试路由失败',
      data: null
    });
  }
});

// 更新图书名字为中文
router.get('/update-titles', async (req, res) => {
  try {
    await pool.query("UPDATE books SET title = 'JavaScript高级程序设计' WHERE isbn = '9787111111111'");
    await pool.query("UPDATE books SET title = '深入理解计算机系统' WHERE isbn = '9787111111112'");
    await pool.query("UPDATE books SET title = '算法导论' WHERE isbn = '9787111111113'");
    await pool.query("UPDATE books SET title = '红楼梦' WHERE isbn = '9787111111114'");
    await pool.query("UPDATE books SET title = '三国演义' WHERE isbn = '9787111111115'");
    await pool.query("UPDATE books SET title = '西游记' WHERE isbn = '9787111111116'");
    await pool.query("UPDATE books SET title = '水浒传' WHERE isbn = '9787111111117'");
    await pool.query("UPDATE books SET title = '史记' WHERE isbn = '9787111111118'");
    await pool.query("UPDATE books SET title = '资治通鉴' WHERE isbn = '9787111111119'");
    await pool.query("UPDATE books SET title = '论语' WHERE isbn = '9787111111120'");
    
    const [books] = await pool.query("SELECT id, isbn, title FROM books");
    
    res.json({
      code: 200,
      msg: '更新图书名字成功',
      data: books
    });
  } catch (error) {
    logger.error('更新图书名字失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新图书名字失败',
      data: null
    });
  }
});

// 为所有表添加数据
router.get('/add-all-data', async (req, res) => {
  try {
    // 开始事务
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // 1. 添加用户数据
      const bcrypt = require('bcryptjs');
      const users = [
        {
          username: 'admin',
          password: await bcrypt.hash('123456', 10),
          real_name: '管理员',
          role: 'admin',
          phone: '13800138000',
          status: 1
        },
        {
          username: 'librarian',
          password: await bcrypt.hash('123456', 10),
          real_name: '图书管理员',
          role: 'librarian',
          phone: '13900139000',
          status: 1
        }
      ];
      
      for (const user of users) {
        await connection.query(
          'INSERT IGNORE INTO users (username, password, real_name, role, phone, status) VALUES (?, ?, ?, ?, ?, ?)',
          [user.username, user.password, user.real_name, user.role, user.phone, user.status]
        );
      }

      // 2. 添加分类数据
      const categories = [
        { category_name: '计算机科学' },
        { category_name: '文学' },
        { category_name: '历史' },
        { category_name: '哲学' },
        { category_name: '艺术' },
        { category_name: '科学' },
        { category_name: '工程' },
        { category_name: '医学' },
        { category_name: '经济' },
        { category_name: '教育' },
        { category_name: '其他' }
      ];
      
      for (const category of categories) {
        await connection.query(
          'INSERT IGNORE INTO categories (category_name) VALUES (?)',
          [category.category_name]
        );
      }

      // 2. 添加图书数据
      const books = [
        {
          isbn: '9787111111111',
          title: 'JavaScript高级程序设计',
          author: '尼古拉斯·扎卡斯',
          publisher: '人民邮电出版社',
          publish_date: '2020-01-01',
          price: 99.00,
          category_id: 1,
          total_count: 5,
          location: 'A区1层',
          description: 'JavaScript领域的经典著作',
          status: 1
        },
        {
          isbn: '9787111111112',
          title: '深入理解计算机系统',
          author: 'Randal E. Bryant',
          publisher: '机械工业出版社',
          publish_date: '2019-01-01',
          price: 129.00,
          category_id: 1,
          total_count: 4,
          location: 'A区1层',
          description: '计算机系统领域的经典著作',
          status: 1
        },
        {
          isbn: '9787111111113',
          title: '算法导论',
          author: 'Thomas H. Cormen',
          publisher: '机械工业出版社',
          publish_date: '2018-01-01',
          price: 139.00,
          category_id: 1,
          total_count: 3,
          location: 'A区1层',
          description: '算法领域的经典著作',
          status: 1
        },
        {
          isbn: '9787111111114',
          title: '红楼梦',
          author: '曹雪芹',
          publisher: '人民文学出版社',
          publish_date: '2017-01-01',
          price: 49.00,
          category_id: 2,
          total_count: 6,
          location: 'B区1层',
          description: '中国古典文学四大名著之一',
          status: 1
        },
        {
          isbn: '9787111111115',
          title: '三国演义',
          author: '罗贯中',
          publisher: '人民文学出版社',
          publish_date: '2017-01-01',
          price: 45.00,
          category_id: 2,
          total_count: 5,
          location: 'B区1层',
          description: '中国古典文学四大名著之一',
          status: 1
        },
        {
          isbn: '9787111111116',
          title: '西游记',
          author: '吴承恩',
          publisher: '人民文学出版社',
          publish_date: '2017-01-01',
          price: 48.00,
          category_id: 2,
          total_count: 5,
          location: 'B区1层',
          description: '中国古典文学四大名著之一',
          status: 1
        },
        {
          isbn: '9787111111117',
          title: '水浒传',
          author: '施耐庵',
          publisher: '人民文学出版社',
          publish_date: '2017-01-01',
          price: 46.00,
          category_id: 2,
          total_count: 5,
          location: 'B区1层',
          description: '中国古典文学四大名著之一',
          status: 1
        },
        {
          isbn: '9787111111118',
          title: '史记',
          author: '司马迁',
          publisher: '中华书局',
          publish_date: '2016-01-01',
          price: 198.00,
          category_id: 3,
          total_count: 3,
          location: 'C区1层',
          description: '中国第一部纪传体通史',
          status: 1
        },
        {
          isbn: '9787111111119',
          title: '资治通鉴',
          author: '司马光',
          publisher: '中华书局',
          publish_date: '2016-01-01',
          price: 298.00,
          category_id: 3,
          total_count: 2,
          location: 'C区1层',
          description: '中国第一部编年体通史',
          status: 1
        },
        {
          isbn: '9787111111120',
          title: '论语',
          author: '孔子',
          publisher: '中华书局',
          publish_date: '2015-01-01',
          price: 38.00,
          category_id: 4,
          total_count: 5,
          location: 'D区1层',
          description: '儒家学派的经典著作',
          status: 1
        }
      ];
      
      for (const book of books) {
        await connection.query(
          'INSERT IGNORE INTO books (isbn, title, author, publisher, publish_date, price, category_id, total_count, available_count, location, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [book.isbn, book.title, book.author, book.publisher, book.publish_date, book.price, book.category_id, book.total_count, book.total_count, book.location, book.description, book.status]
        );
      }

      // 3. 添加读者数据
      const readers = [
        {
          reader_no: 'R001',
          name: '张三',
          phone: '13800138001',
          email: 'zhangsan@example.com',
          id_card: '110101199001011234',
          max_borrow_count: 5,
          max_borrow_days: 30
        },
        {
          reader_no: 'R002',
          name: '李四',
          phone: '13800138002',
          email: 'lisi@example.com',
          id_card: '110101199001011235',
          max_borrow_count: 5,
          max_borrow_days: 30
        },
        {
          reader_no: 'R003',
          name: '王五',
          phone: '13800138003',
          email: 'wangwu@example.com',
          id_card: '110101199001011236',
          max_borrow_count: 5,
          max_borrow_days: 30
        },
        {
          reader_no: 'R004',
          name: '赵六',
          phone: '13800138004',
          email: 'zhaoliu@example.com',
          id_card: '110101199001011237',
          max_borrow_count: 5,
          max_borrow_days: 30
        },
        {
          reader_no: 'R005',
          name: '钱七',
          phone: '13800138005',
          email: 'qianqi@example.com',
          id_card: '110101199001011238',
          max_borrow_count: 5,
          max_borrow_days: 30
        }
      ];
      
      for (const reader of readers) {
        // 创建系统用户
        const [userResult] = await connection.query(
          'INSERT IGNORE INTO sys_user (username, password, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
          [reader.reader_no, '$2b$10$eJq7t18p0J6z6j9q8p7o8e9r8t7y6u5i4o3p2n1m0l9k8j7i6h5g4f3e2d1c', 'reader', 'active', new Date(), new Date()]
        );
        
        const userId = userResult.insertId;
        
        // 创建读者信息（用于读者系统）
        await connection.query(
          'INSERT IGNORE INTO reader_info (user_id, reader_no, name, gender, id_card, email, credit_status, arrears_amount, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [userId, reader.reader_no, reader.name, 'male', reader.id_card, reader.email || null, 'good', 0, new Date(), new Date()]
        );
      }

      // 4. 添加预约记录数据
      const appointments = [
        {
          book_id: 1,
          reader_id: 1,
          appointment_date: '2026-01-20',
          status: 'pending'
        },
        {
          book_id: 2,
          reader_id: 2,
          appointment_date: '2026-01-21',
          status: 'approved'
        },
        {
          book_id: 3,
          reader_id: 3,
          appointment_date: '2026-01-22',
          status: 'rejected'
        }
      ];
      
      for (const appointment of appointments) {
        await connection.query(
          'INSERT IGNORE INTO appointments (book_id, reader_id, appointment_date, status) VALUES (?, ?, ?, ?)',
          [appointment.book_id, appointment.reader_id, appointment.appointment_date, appointment.status]
        );
      }

      // 5. 添加借阅记录数据
      const borrowRecords = [
        {
          reader_id: 1,
          book_id: 1,
          borrow_date: '2026-01-15',
          due_date: '2026-02-14',
          status: 'borrowed'
        },
        {
          reader_id: 2,
          book_id: 2,
          borrow_date: '2026-01-16',
          due_date: '2026-02-15',
          status: 'borrowed'
        },
        {
          reader_id: 3,
          book_id: 3,
          borrow_date: '2026-01-10',
          due_date: '2026-02-09',
          status: 'overdue'
        },
        {
          reader_id: 4,
          book_id: 4,
          borrow_date: '2026-01-01',
          due_date: '2026-01-31',
          return_date: '2026-01-25',
          status: 'returned'
        },
        {
          reader_id: 5,
          book_id: 5,
          borrow_date: '2026-01-05',
          due_date: '2026-02-04',
          return_date: '2026-02-01',
          status: 'returned'
        }
      ];
      
      for (const record of borrowRecords) {
        const borrow_no = 'B' + Date.now() + Math.floor(Math.random() * 1000);
        await connection.query(
          'INSERT IGNORE INTO borrow_records (borrow_no, reader_id, book_id, borrow_date, due_date, return_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [borrow_no, record.reader_id, record.book_id, record.borrow_date, record.due_date, record.return_date || null, record.status]
        );
        
        // 更新图书的可借数量
        await connection.query(
          'UPDATE books SET available_count = available_count - 1 WHERE id = ?',
          [record.book_id]
        );
      }

      // 提交事务
      await connection.commit();
      connection.release();

      res.json({
        code: 200,
        msg: '为所有表添加数据成功',
        data: {
          users: users.length,
          categories: categories.length,
          books: books.length,
          readers: readers.length,
          appointments: appointments.length,
          borrowRecords: borrowRecords.length
        }
      });
    } catch (error) {
      // 回滚事务
      await connection.rollback();
      connection.release();
      throw error;
    }
  } catch (error) {
    logger.error('为所有表添加数据失败:', error);
    res.status(500).json({
      code: 500,
      msg: '为所有表添加数据失败',
      data: null
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 10;
    const offset = (page - 1) * pageSize;

    let whereClause = ' WHERE 1=1';
    const params = [];

    if (req.query.isbn) {
      whereClause += ' AND isbn LIKE ?';
      params.push(`%${req.query.isbn}%`);
    }

    if (req.query.title) {
      whereClause += ' AND title LIKE ?';
      params.push(`%${req.query.title}%`);
    }

    if (req.query.author) {
      whereClause += ' AND author LIKE ?';
      params.push(`%${req.query.author}%`);
    }

    if (req.query.category_id && req.query.category_id !== '') {
      whereClause += ' AND category_id = ?';
      params.push(req.query.category_id);
    }

    if (req.query.status !== undefined && req.query.status !== '') {
      if (req.query.status === 'available') {
        whereClause += ' AND status = 1';
      } else if (req.query.status === 'empty') {
        whereClause += ' AND status = 0';
      } else {
        whereClause += ' AND status = ?';
        params.push(req.query.status);
      }
    }

    const [books] = await pool.query(
      `SELECT b.*, c.category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id${whereClause} ORDER BY b.created_at DESC LIMIT ? OFFSET ?`,
      [...params, pageSize, offset]
    );

    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM books b${whereClause}`,
      params
    );

    res.json({
      code: 200,
      msg: '获取图书列表成功',
      data: {
        list: books,
        total: countResult[0].total,
        page,
        pageSize
      }
    });
  } catch (error) {
    logger.error('获取图书列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取图书列表失败',
      data: null
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [books] = await pool.query(
      'SELECT b.*, c.category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?',
      [id]
    );

    if (books.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }

    res.json({
      code: 200,
      msg: '获取图书信息成功',
      data: books[0]
    });
  } catch (error) {
    logger.error('获取图书信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取图书信息失败',
      data: null
    });
  }
});

router.post('/', [
  body('isbn').notEmpty().withMessage('ISBN不能为空'),
  body('title').notEmpty().withMessage('书名不能为空'),
  body('author').notEmpty().withMessage('作者不能为空'),
  body('category_id').notEmpty().withMessage('分类不能为空')
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

    const { isbn, title, author, publisher, publish_date, price, category_id, total_count, location, description, cover } = req.body;

    await pool.query(
      'INSERT INTO books (isbn, title, author, publisher, publish_date, price, category_id, total_count, available_count, location, description, cover) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [isbn, title, author, publisher, publish_date, price, category_id, total_count || 1, total_count || 1, location, description, cover]
    );

    res.json({
      code: 200,
      msg: '创建图书成功',
      data: null
    });
  } catch (error) {
    logger.error('创建图书失败:', error);
    res.status(500).json({
      code: 500,
      msg: '创建图书失败',
      data: null
    });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { isbn, title, author, publisher, publish_date, price, category_id, total_count, location, description, status, cover } = req.body;

    const [books] = await pool.query('SELECT * FROM books WHERE id = ?', [id]);
    if (books.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }

    // 获取现有数据，用于默认值
    const existingBook = books[0];
    const oldTotalCount = existingBook.total_count;
    const oldAvailableCount = existingBook.available_count;
    const newTotalCount = total_count || oldTotalCount;
    const newAvailableCount = oldAvailableCount + (newTotalCount - oldTotalCount);

    // 构建更新数据，只更新提供的字段
    const updateData = {
      isbn: isbn || existingBook.isbn,
      title: title || existingBook.title,
      author: author || existingBook.author,
      publisher: publisher || existingBook.publisher,
      publish_date: publish_date || existingBook.publish_date,
      price: price || existingBook.price,
      category_id: category_id || existingBook.category_id,
      total_count: newTotalCount,
      available_count: newAvailableCount,
      location: location || existingBook.location,
      description: description || existingBook.description,
      status: status !== undefined ? status : existingBook.status,
      cover: cover !== undefined ? cover : existingBook.cover
    };

    await pool.query(
      'UPDATE books SET isbn = ?, title = ?, author = ?, publisher = ?, publish_date = ?, price = ?, category_id = ?, total_count = ?, available_count = ?, location = ?, description = ?, cover = ?, status = ? WHERE id = ?',
      [updateData.isbn, updateData.title, updateData.author, updateData.publisher, updateData.publish_date, updateData.price, updateData.category_id, updateData.total_count, updateData.available_count, updateData.location, updateData.description, updateData.cover, updateData.status, id]
    );

    res.json({
      code: 200,
      msg: '更新图书成功',
      data: null
    });
  } catch (error) {
    logger.error('更新图书失败:', error);
    res.status(500).json({
      code: 500,
      msg: '更新图书失败',
      data: null
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    logger.info(`开始删除图书，ID: ${id}`);

    // 检查是否有未归还的图书
    logger.info('检查是否有未归还的图书');
    const [borrowRecords] = await pool.query(
      'SELECT COUNT(*) as count FROM borrow_records WHERE book_id = ? AND status = "borrowed"',
      [id]
    );
    logger.info(`未归还图书数量: ${borrowRecords[0].count}`);

    if (borrowRecords[0].count > 0) {
      return res.status(400).json({
        code: 400,
        msg: '该图书还有未归还的记录，无法删除',
        data: null
      });
    }

    // 检查是否有预约记录
    logger.info('检查是否有预约记录');
    const [appointmentRecords] = await pool.query(
      'SELECT COUNT(*) as count FROM appointments WHERE book_id = ?',
      [id]
    );
    logger.info(`预约记录数量: ${appointmentRecords[0].count}`);

    if (appointmentRecords[0].count > 0) {
      return res.status(400).json({
        code: 400,
        msg: '该图书还有相关的预约记录，无法删除',
        data: null
      });
    }

    // 执行删除操作
    logger.info('执行删除操作');
    const [deleteResult] = await pool.query('DELETE FROM books WHERE id = ?', [id]);
    logger.info(`删除结果: ${JSON.stringify(deleteResult)}`);

    res.json({
      code: 200,
      msg: '删除图书成功',
      data: null
    });
  } catch (error) {
    logger.error('删除图书失败:', error);
    res.status(500).json({
      code: 500,
      msg: '删除图书失败',
      data: null
    });
  }
});

router.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        msg: '没有上传文件',
        data: null
      });
    }

    const fileUrl = `/uploads/${req.file.filename}`;

    res.json({
      code: 200,
      msg: '上传成功',
      data: {
        url: fileUrl,
        filename: req.file.filename,
        originalname: req.file.originalname,
        size: req.file.size
      }
    });
  } catch (error) {
    logger.error('上传图片失败:', error);
    res.status(500).json({
      code: 500,
      msg: '上传图片失败',
      data: null
    });
  }
});

router.get('/categories/list', async (req, res) => {
  try {
    const [categories] = await pool.query('SELECT * FROM categories ORDER BY id');

    res.json({
      code: 200,
      msg: '获取分类列表成功',
      data: categories
    });
  } catch (error) {
    logger.error('获取分类列表失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取分类列表失败',
      data: null
    });
  }
});

router.get('/isbn', async (req, res) => {
  try {
    const { isbn } = req.query;

    if (!isbn) {
      return res.status(400).json({
        code: 400,
        msg: 'ISBN参数不能为空',
        data: null
      });
    }

    const [books] = await pool.query(
      'SELECT b.*, c.category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.isbn = ?',
      [isbn]
    );

    if (books.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }

    res.json({
      code: 200,
      msg: '获取图书信息成功',
      data: books[0]
    });
  } catch (error) {
    logger.error('获取图书信息失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取图书信息失败',
      data: null
    });
  }
});

module.exports = router;
