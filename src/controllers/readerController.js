/**
 * 读者控制器
 * 处理读者相关的所有业务逻辑
 */

/**
 * 导入必要的模块
 */
const bcrypt = require('bcrypt'); // 用于密码加密和验证
const jwt = require('jsonwebtoken'); // 用于生成和验证JWT令牌
const dayjs = require('dayjs'); // 用于日期处理
const pool = require('../config/database'); // 数据库连接池
const config = require('../config/config'); // 系统配置

/**
 * 生成预约号
 * 格式：AP + 年月日 + 4位随机数
 * @returns {string} 生成的预约号
 */
const generateAppointmentNo = () => {
  const date = new Date();
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `AP${year}${month}${day}${random}`;
};

/**
 * 生成JWT token
 * 用于读者登录后的身份验证
 * @param {Object} user - 用户信息对象
 * @returns {string} 生成的JWT令牌
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id, // 用户ID
      reader_id: user.reader_id, // 读者ID
      role: user.role, // 角色
      reader_no: user.reader_no // 读者编号
    },
    process.env.JWT_SECRET || 'library_system_secret_key_2024', // JWT密钥
    { expiresIn: '7d' } // 令牌过期时间：7天
  );
};

// 登录
const login = async (req, res) => {
  try {
    const { username, reader_no, password, remember } = req.body;
    
    // 获取登录标识（用户名或读者号）
    const loginIdentifier = username || reader_no;
    
    // 验证参数
    if (!loginIdentifier || !password) {
      return res.status(400).json({
        code: 400,
        msg: '请输入用户名/读者号和密码',
        data: null
      });
    }
    
    // 查询用户
    const [users] = await pool.execute(
      'SELECT su.id, su.username, su.password, su.role, ri.id as reader_id, ri.reader_no, ri.name, ri.email, ri.gender, ri.id_card, ri.credit_status, ri.arrears_amount FROM sys_user su JOIN reader_info ri ON su.id = ri.user_id WHERE (su.username = ? OR ri.reader_no = ?) AND su.role = ?',
      [loginIdentifier, loginIdentifier, 'reader']
    );
    
    if (users.length === 0) {
      return res.status(401).json({
        code: 401,
        msg: '用户名或密码错误',
        data: null
      });
    }
    
    const user = users[0];
    
    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        code: 401,
        msg: '用户名或密码错误',
        data: null
      });
    }
    
    // 生成token
    const token = generateToken(user);
    
    return res.json({
      code: 200,
      msg: '登录成功',
      data: {
        token,
        user: {
          id: user.id,
          reader_id: user.reader_id,
          reader_no: user.reader_no,
          name: user.name,
          phone: user.phone,
          email: user.email,
          gender: user.gender,
          id_card: user.id_card,
          credit_status: user.credit_status,
          arrears_amount: user.arrears_amount,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('登录失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '登录失败',
      data: null
    });
  }
};

// 注册
const register = async (req, res) => {
  try {
    console.log('接收到的注册请求参数:', req.body);
    
    const username = req.body.username;
    const password = req.body.password;
    const realName = req.body.realName || req.body.real_name;
    const idCard = req.body.idCard || req.body.id_card;
    const email = req.body.email;
    
    if (!username || !password || !realName || !idCard || !email || 
        username.trim() === '' || password.trim() === '' || 
        realName.trim() === '' || idCard.trim() === '' || email.trim() === '') {
      console.log('参数验证失败:', { username, password, realName, idCard, email });
      return res.status(400).json({
        code: 400,
        msg: '请填写完整的注册信息',
        data: null
      });
    }
    
    console.log('开始验证用户名是否已注册:', username);
    const [existingUsersByUsername] = await pool.execute(
      'SELECT * FROM sys_user WHERE username = ?',
      [username]
    );
    
    console.log('验证用户名是否已注册结果:', existingUsersByUsername.length);
    if (existingUsersByUsername.length > 0) {
      console.log('用户名已注册:', username);
      return res.status(400).json({
        code: 400,
        msg: '该用户名已注册',
        data: null
      });
    }
    
    console.log('开始验证身份证号是否已注册:', idCard);
    const [existingUsersByIdCard] = await pool.execute(
      'SELECT * FROM reader_info WHERE id_card = ?',
      [idCard]
    );
    
    console.log('验证身份证号是否已注册结果:', existingUsersByIdCard.length);
    if (existingUsersByIdCard.length > 0) {
      console.log('身份证号已注册:', idCard);
      return res.status(400).json({
        code: 400,
        msg: '该身份证号已注册',
        data: null
      });
    }
    
    const reader_no = 'R' + Date.now().toString().slice(-8);
    console.log('生成的读者编号:', reader_no);
    
    console.log('开始加密密码');
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('密码加密完成');
    
    console.log('开始事务');
    await pool.query('START TRANSACTION');
    console.log('事务开始成功');
    
    try {
      console.log('开始创建系统用户:', username);
      const [userResult] = await pool.execute(
        'INSERT INTO sys_user (username, password, role, status, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
        [username, hashedPassword, 'reader', 'active', new Date(), new Date()]
      );
      console.log('创建系统用户成功:', userResult.insertId);
      
      const userId = userResult.insertId;
      
      console.log('开始创建读者信息:', userId, reader_no, realName, idCard, email);
      await pool.execute(
        'INSERT INTO reader_info (user_id, reader_no, name, gender, id_card, email, credit_status, arrears_amount, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [userId, reader_no, realName, 'male', idCard, email, 'good', 0, new Date(), new Date()]
      );
      console.log('创建读者信息成功');
      
      console.log('开始提交事务');
      await pool.query('COMMIT');
      console.log('事务提交成功');
      
      return res.json({
        code: 200,
        msg: '注册成功',
        data: null
      });
    } catch (error) {
      console.log('开始回滚事务');
      await pool.query('ROLLBACK');
      console.log('事务回滚成功');
      throw error;
    }
  } catch (error) {
    console.error('注册失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '注册失败',
      data: null
    });
  }
};

// 发送短信验证码
const sendSmsCode = async (req, res) => {
  try {
    const { phone } = req.body;
    
    // 验证参数
    if (!phone) {
      return res.status(400).json({
        code: 400,
        msg: '请输入手机号',
        data: null
      });
    }
    
    // 生成验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    
    // TODO: 集成短信SDK发送验证码
    console.log('发送验证码:', code, '到手机号:', phone);
    
    return res.json({
      code: 200,
      msg: '验证码发送成功',
      data: { code }
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '发送验证码失败',
      data: null
    });
  }
};

// 重置密码
const resetPassword = async (req, res) => {
  try {
    const { phone, code, newPassword, confirmPassword } = req.body;
    
    // 验证参数
    if (!phone || !code || !newPassword || !confirmPassword) {
      return res.status(400).json({
        code: 400,
        msg: '请填写完整的信息',
        data: null
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        code: 400,
        msg: '两次输入的密码不一致',
        data: null
      });
    }
    
    // 验证手机号是否存在
    const [users] = await pool.execute(
      'SELECT su.id FROM sys_user su JOIN reader_info ri ON su.id = ri.user_id WHERE ri.phone = ?',
      [phone]
    );
    
    if (users.length === 0) {
      return res.status(400).json({
        code: 400,
        msg: '该手机号未注册',
        data: null
      });
    }
    
    // 加密密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // 更新密码
    await pool.execute(
      'UPDATE sys_user SET password = ?, update_time = ? WHERE id = ?',
      [hashedPassword, new Date(), users[0].id]
    );
    
    return res.json({
      code: 200,
      msg: '密码重置成功',
      data: null
    });
  } catch (error) {
    console.error('重置密码失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '重置密码失败',
      data: null
    });
  }
};

// 获取用户信息
const getUserInfo = async (req, res) => {
  try {
    const { reader_id } = req.user;
    
    const [readers] = await pool.execute(
      'SELECT reader_no, name, gender, email, id_card, credit_status, arrears_amount, create_time, avatar FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readers.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '用户信息不存在',
        data: null
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: readers[0]
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取用户信息失败',
      data: null
    });
  }
};

// 更新用户信息
const updateUserProfile = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { name, gender, email } = req.body;
    
    if (!name || !gender) {
      return res.status(400).json({
        code: 400,
        msg: '请填写完整的信息',
        data: null
      });
    }
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    // 更新读者信息
    await pool.execute(
      'UPDATE reader_info SET name = ?, gender = ?, email = ?, update_time = ? WHERE id = ?',
      [name, gender, email || null, new Date(), reader_id]
    );
    
    return res.json({
      code: 200,
      msg: '更新成功',
      data: null
    });
  } catch (error) {
    console.error('更新用户信息失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '更新用户信息失败',
      data: null
    });
  }
};

// 修改密码
const changePassword = async (req, res) => {
  try {
    const { id } = req.user;
    const { oldPassword, newPassword } = req.body;
    
    // 验证参数
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        code: 400,
        msg: '请填写完整的信息',
        data: null
      });
    }
    
    // 获取当前密码
    const [users] = await pool.execute('SELECT password FROM sys_user WHERE id = ?', [id]);
    
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
    await pool.execute(
      'UPDATE sys_user SET password = ?, update_time = ? WHERE id = ?',
      [hashedPassword, new Date(), id]
    );
    
    return res.json({
      code: 200,
      msg: '密码修改成功',
      data: null
    });
  } catch (error) {
    console.error('修改密码失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '修改密码失败',
      data: null
    });
  }
};

// 获取用户统计信息
const getUserStatistics = async (req, res) => {
  try {
    const { reader_id } = req.user;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    // 累计借阅
    const [totalBorrowResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ?',
      [readerNo]
    );
    
    // 当前借阅
    const [currentBorrowResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND status = ?',
      [readerNo, 'borrowed']
    );
    
    // 累计预约
    const [totalReservationResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM appointments WHERE reader_id = ?',
      [readerNo]
    );
    
    // 历史逾期
    const [totalOverdueResult] = await pool.execute(
      'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND overdue_days > 0',
      [readerNo]
    );
    
    // 近12个月借阅趋势
    const trend = [];
    for (let i = 11; i >= 0; i--) {
      const month = dayjs().subtract(i, 'month');
      const monthStart = month.startOf('month').format('YYYY-MM-DD');
      const monthEnd = month.endOf('month').format('YYYY-MM-DD');
      
      const [monthResult] = await pool.execute(
        'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND borrow_date >= ? AND borrow_date <= ?',
        [readerNo, monthStart, monthEnd]
      );
      
      trend.push({
        month: month.format('YYYY-MM'),
        count: monthResult[0].count
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: {
        totalBorrow: totalBorrowResult[0].count,
        currentBorrow: currentBorrowResult[0].count,
        totalReservation: totalReservationResult[0].count,
        totalOverdue: totalOverdueResult[0].count,
        borrowTrend: trend
      }
    });
  } catch (error) {
    console.error('获取用户统计信息失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取用户统计信息失败',
      data: null
    });
  }
};

// 图书搜索
const searchBooks = async (req, res) => {
  try {
    const { keyword, categoryId, status, sort, page = 1, pageSize = 12 } = req.query;
    
    // 确保分页参数是数字
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 12;
    
    // 构建SQL语句
    let query = 'SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.publish_date, b.price, b.location, b.total_count, b.available_count, b.status, b.borrow_count, b.cover, c.category_name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE 1=1';
    
    // 关键词搜索
    if (keyword) {
      const keywordLike = `%${keyword}%`;
      query += ` AND (b.title LIKE '${keywordLike}' OR b.author LIKE '${keywordLike}' OR b.isbn LIKE '${keywordLike}')`;
    }
    
    // 分类筛选
    if (categoryId) {
      query += ` AND b.category_id = ${categoryId}`;
    }
    
    // 状态筛选
    if (status) {
      if (status === 'available') {
        query += " AND b.status = 'available'";
      } else if (status === 'borrowed') {
        query += " AND b.status = 'borrowed'";
      } else if (status === 'reserved') {
        query += " AND b.status = 'reserved'";
      }
    }
    
    // 排序
    if (sort) {
      if (sort === 'hot') {
        query += ' ORDER BY b.borrow_count DESC';
      } else if (sort === 'publish_date') {
        query += ' ORDER BY b.publish_date DESC';
      } else if (sort === 'title') {
        query += ' ORDER BY b.title ASC';
      }
    } else {
      query += ' ORDER BY b.id DESC';
    }
    
    // 分页
    query += ` LIMIT ${sizeNum} OFFSET ${(pageNum - 1) * sizeNum}`;
    
    // 执行查询
    const [books] = await pool.query(query);
    
    // 获取总数
    let countQuery = 'SELECT COUNT(*) as count FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE 1=1';
    
    // 关键词搜索
    if (keyword) {
      const keywordLike = `%${keyword}%`;
      countQuery += ` AND (b.title LIKE '${keywordLike}' OR b.author LIKE '${keywordLike}' OR b.isbn LIKE '${keywordLike}')`;
    }
    
    // 分类筛选
    if (categoryId) {
      countQuery += ` AND b.category_id = ${categoryId}`;
    }
    
    // 状态筛选
    if (status) {
      if (status === 'available') {
        countQuery += " AND b.status = 'available'";
      } else if (status === 'borrowed') {
        countQuery += " AND b.status = 'borrowed'";
      } else if (status === 'reserved') {
        countQuery += " AND b.status = 'reserved'";
      }
    }
    const [countResult] = await pool.query(countQuery);
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: {
        list: books,
        total: countResult[0].count
      }
    });
  } catch (error) {
    console.error('搜索图书失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '搜索图书失败',
      data: null
    });
  }
};

// 获取图书详情
const getBookDetail = async (req, res) => {
  try {
    const { id } = req.params;
    
    const [books] = await pool.execute(
      'SELECT b.*, c.category_name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id WHERE b.id = ?',
      [id]
    );
    
    if (books.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '图书不存在',
        data: null
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: books[0]
    });
  } catch (error) {
    console.error('获取图书详情失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取图书详情失败',
      data: null
    });
  }
};

// 获取热门图书
const getHotBooks = async (req, res) => {
  try {
    const [books] = await pool.execute(
      'SELECT b.id, b.isbn, b.title, b.author, b.publisher, b.publish_date, b.price, b.location, b.total_count, b.available_count, b.status, b.borrow_count, b.cover, c.category_name as category_name FROM books b LEFT JOIN categories c ON b.category_id = c.id ORDER BY b.borrow_count DESC LIMIT 10',
      []
    );
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: books
    });
  } catch (error) {
    console.error('获取热门图书失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取热门图书失败',
      data: null
    });
  }
};

// 获取图书分类
const getBookCategories = async (req, res) => {
  try {
    const [categories] = await pool.execute('SELECT id, category_name as name FROM categories ORDER BY id ASC', []);
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: categories
    });
  } catch (error) {
    console.error('获取图书分类失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取图书分类失败',
      data: null
    });
  }
};

// 创建预约
const createReservation = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { book_id } = req.body;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    // 验证参数
    if (!book_id) {
      return res.status(400).json({
        code: 400,
        msg: '请选择图书',
        data: null
      });
    }
    
    // 验证图书是否存在
    const [books] = await pool.execute(
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
    
    // 验证图书是否可预约
    if (book.status === 1) {
      return res.status(400).json({
        code: 400,
        msg: '该图书可直接借阅，无需预约',
        data: null
      });
    }
    
    // 验证读者是否已预约该图书
    const [existingReservations] = await pool.query(`SELECT * FROM appointments WHERE reader_id = ${reader_id} AND book_id = ${book_id} AND status = 'pending'`);
    
    if (existingReservations.length > 0) {
      return res.status(400).json({
        code: 400,
        msg: '您已预约该图书',
        data: null
      });
    }
    
    // 验证读者预约数量是否超过限制
    const [reservationCount] = await pool.query(`SELECT COUNT(*) as count FROM appointments WHERE reader_id = ${reader_id} AND status = 'pending'`);
    
    if (reservationCount[0].count >= 3) {
      return res.status(400).json({
        code: 400,
        msg: '您的预约数量已达上限',
        data: null
      });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 创建预约记录
      const [reservationResult] = await pool.query(`INSERT INTO appointments (appointment_no, reader_id, book_id, appointment_date, status, created_at, updated_at) VALUES ('${generateAppointmentNo()}', ${reader_id}, ${book_id}, '${dayjs().format('YYYY-MM-DD HH:mm:ss')}', 'pending', '${dayjs().format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().format('YYYY-MM-DD HH:mm:ss')}')`);
      
      // 更新图书状态
      await pool.query(`UPDATE books SET status = 3, updated_at = '${dayjs().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = ${book_id}`);
      
      // 提交事务
      await pool.query('COMMIT');
      
      return res.json({
        code: 200,
        msg: '预约成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('预约图书失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '预约图书失败',
      data: null
    });
  }
};

// 取消预约
const cancelReservation = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { id } = req.params;
    
    // 验证预约是否存在且属于该读者
    const [reservations] = await pool.execute(
      'SELECT * FROM appointments WHERE id = ? AND reader_id = ?',
      [id, reader_id]
    );
    
    if (reservations.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约记录不存在',
        data: null
      });
    }
    
    const reservation = reservations[0];
    
    // 验证预约状态
    if (reservation.status !== 'pending') {
      return res.status(400).json({
        code: 400,
        msg: '只能取消预约中的记录',
        data: null
      });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 更新预约状态
      await pool.execute(
        'UPDATE appointments SET status = ?, updated_at = ? WHERE id = ?',
        ['cancelled', new Date(), id]
      );
      
      // 检查是否还有其他预约
      const [otherReservations] = await pool.execute(
        'SELECT * FROM appointments WHERE book_id = ? AND status = ?',
        [reservation.book_id, 'pending']
      );
      
      // 如果没有其他预约，更新图书状态
      if (otherReservations.length === 0) {
        await pool.execute(
          'UPDATE books SET status = ?, updated_at = ? WHERE id = ?',
          [1, new Date(), reservation.book_id]
        );
      }
      
      // 提交事务
      await pool.query('COMMIT');
      
      return res.json({
        code: 200,
        msg: '取消预约成功',
        data: null
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('取消预约失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '取消预约失败',
      data: null
    });
  }
};

// 获取预约列表
const getReservationList = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { status, page = 1, pageSize = 10 } = req.query;
    
    // 确保分页参数是数字
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 10;
    
    // 构建SQL语句
    let query = `SELECT br.*, b.title, b.isbn FROM appointments br JOIN books b ON br.book_id = b.id WHERE br.reader_id = ${reader_id}`;
    
    // 状态筛选
    if (status) {
      query += ` AND br.status = '${status}'`;
    }
    
    // 排序
    query += ' ORDER BY br.appointment_date DESC';
    
    // 分页
    query += ` LIMIT ${sizeNum} OFFSET ${(pageNum - 1) * sizeNum}`;
    
    // 执行查询
    const [reservations] = await pool.query(query);
    
    // 获取总数
    let countQuery = `SELECT COUNT(*) as count FROM appointments br JOIN books b ON br.book_id = b.id WHERE br.reader_id = ${reader_id}`;
    
    // 如果有状态筛选，在countQuery中也添加
    if (status) {
      countQuery += ` AND br.status = '${status}'`;
    }
    const [countResult] = await pool.query(countQuery);
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: {
        list: reservations,
        total: countResult[0].count
      }
    });
  } catch (error) {
    console.error('获取预约列表失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取预约列表失败',
      data: null
    });
  }
};

// 获取预约详情
const getReservationDetail = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { id } = req.params;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    const [reservations] = await pool.execute(
      'SELECT br.*, b.title, b.isbn, b.author, b.publisher FROM appointments br JOIN books b ON br.book_id = b.id WHERE br.id = ? AND br.reader_id = ?',
      [id, readerNo]
    );
    
    if (reservations.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '预约记录不存在',
        data: null
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: reservations[0]
    });
  } catch (error) {
    console.error('获取预约详情失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取预约详情失败',
      data: null
    });
  }
};

// 获取借阅列表
const getBorrowList = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { status, page = 1, pageSize = 10 } = req.query;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    // 确保分页参数是数字
    const pageNum = parseInt(page) || 1;
    const sizeNum = parseInt(pageSize) || 10;
    
    // 构建SQL语句
    let query = `SELECT br.*, b.title, b.isbn, b.author FROM borrow_records br JOIN books b ON br.book_id = b.id WHERE br.reader_id = '${readerNo}'`;
    
    // 状态筛选
    if (status) {
      query += ` AND br.status = '${status}'`;
    }
    
    // 排序
    query += ' ORDER BY br.borrow_date DESC';
    
    // 分页
    query += ` LIMIT ${sizeNum} OFFSET ${(pageNum - 1) * sizeNum}`;
    
    // 执行查询
    const [borrowRecords] = await pool.query(query);
    
    // 获取总数
    let countQuery = `SELECT COUNT(*) as count FROM borrow_records br JOIN books b ON br.book_id = b.id WHERE br.reader_id = '${readerNo}'`;
    
    // 如果有状态筛选，在countQuery中也添加
    if (status) {
      countQuery += ` AND br.status = '${status}'`;
    }
    const [countResult] = await pool.query(countQuery);
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: {
        list: borrowRecords,
        total: countResult[0].count
      }
    });
  } catch (error) {
    console.error('获取借阅列表失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取借阅列表失败',
      data: null
    });
  }
};

// 获取借阅详情
const getBorrowDetail = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { id } = req.params;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    const [borrowRecords] = await pool.execute(
      'SELECT br.*, b.title, b.isbn, b.author, b.publisher FROM borrow_records br JOIN books b ON br.book_id = b.id WHERE br.id = ? AND br.reader_id = ?',
      [id, readerNo]
    );
    
    if (borrowRecords.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '借阅记录不存在',
        data: null
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: borrowRecords[0]
    });
  } catch (error) {
    console.error('获取借阅详情失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取借阅详情失败',
      data: null
    });
  }
};

// 续借图书
const renewBook = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { id } = req.params;
    
    // 获取读者编号
    const [readerInfo] = await pool.execute(
      'SELECT reader_no FROM reader_info WHERE id = ?',
      [reader_id]
    );
    
    if (readerInfo.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const readerNo = readerInfo[0].reader_no;
    
    // 验证借阅记录是否存在且属于该读者
    const [borrowRecords] = await pool.query(`SELECT * FROM borrow_records WHERE id = ${id} AND reader_id = '${readerNo}'`);
    
    if (borrowRecords.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '借阅记录不存在',
        data: null
      });
    }
    
    const record = borrowRecords[0];
    
    // 验证借阅状态
    if (record.status !== 'borrowed') {
      return res.status(400).json({
        code: 400,
        msg: '只能续借借阅中的图书',
        data: null
      });
    }
    
    // 验证续借次数
    if (record.renew_count >= 1) {
      return res.status(400).json({
        code: 400,
        msg: '该图书已达到最大续借次数',
        data: null
      });
    }
    
    // 计算新的到期时间
    const newDueDate = dayjs(record.due_date).add(30, 'day').format('YYYY-MM-DD HH:mm:ss');
    
    // 更新借阅记录
    await pool.query(`UPDATE borrow_records SET due_date = '${newDueDate}', renew_count = renew_count + 1, updated_at = '${dayjs().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = ${id}`);
    
    return res.json({
      code: 200,
      msg: '续借成功',
      data: null
    });
  } catch (error) {
    console.error('续借图书失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '续借图书失败',
      data: null
    });
  }
};

// 直接借阅图书
const borrowBook = async (req, res) => {
  try {
    const { reader_id } = req.user;
    const { book_id } = req.body;
    
    // 验证参数
    if (!book_id) {
      return res.status(400).json({
        code: 400,
        msg: '请选择图书',
        data: null
      });
    }
    
    // 验证图书是否存在
    const [books] = await pool.execute(
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
    
    // 验证图书是否可借
    if (book.status !== 1) {
      return res.status(400).json({
        code: 400,
        msg: '该图书不可直接借阅',
        data: null
      });
    }
    
    // 验证图书库存
    if (book.available_count <= 0) {
      return res.status(400).json({
        code: 400,
        msg: '图书库存不足',
        data: null
      });
    }
    
    // 验证读者信息
    const [readers] = await pool.execute(
      'SELECT ri.reader_no, ri.credit_status, ri.arrears_amount, sc.value as max_borrow_count_value, sc2.value as max_borrow_days_value FROM reader_info ri LEFT JOIN sys_config sc ON sc.key = "max_borrow_count" LEFT JOIN sys_config sc2 ON sc2.key = "max_borrow_days" WHERE ri.id = ?',
      [reader_id]
    );
    if (readers.length === 0) {
      return res.status(404).json({
        code: 404,
        msg: '读者信息不存在',
        data: null
      });
    }
    
    const reader = readers[0];
    const actual_reader_id = reader.reader_no;
    const max_borrow_count = parseInt(reader.max_borrow_count_value) || 5;
    const max_borrow_days = parseInt(reader.max_borrow_days_value) || 30;
    
    // 验证读者信用状态
    if (reader.credit_status !== 'good' && reader.credit_status !== 'normal') {
      return res.status(400).json({
        code: 400,
        msg: '您的信用状态不佳，无法借阅图书',
        data: null
      });
    }
    
    // 验证读者是否有未还清的欠款
    if (reader.arrears_amount > 0) {
      return res.status(400).json({
        code: 400,
        msg: '您有未还清的欠款，无法借阅图书',
        data: null
      });
    }
    
    // 查询读者当前借阅数量
    const [borrowCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM borrow_records WHERE reader_id = ? AND status = ?',
      [actual_reader_id, 'borrowed']
    );
    const current_borrow_count = borrowCount[0].count;
    
    // 验证读者是否达到最大借阅数量
    if (current_borrow_count >= max_borrow_count) {
      return res.status(400).json({
        code: 400,
        msg: '您已达到最大借阅数量，无法借阅更多图书',
        data: null
      });
    }
    
    // 开始事务
    await pool.query('START TRANSACTION');
    
    try {
      // 生成借阅编号
      const borrow_no = 'B' + Date.now() + Math.floor(Math.random() * 1000);
      
      // 创建借阅记录
      const [borrowResult] = await pool.query(`INSERT INTO borrow_records (borrow_no, reader_id, book_id, borrow_date, due_date, status, created_at, updated_at) VALUES ('${borrow_no}', '${actual_reader_id}', ${book_id}, '${dayjs().format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().add(max_borrow_days, 'day').format('YYYY-MM-DD HH:mm:ss')}', 'borrowed', '${dayjs().format('YYYY-MM-DD HH:mm:ss')}', '${dayjs().format('YYYY-MM-DD HH:mm:ss')}')`);
      
      // 更新图书库存和状态
      await pool.query(`UPDATE books SET available_count = available_count - 1, borrow_count = borrow_count + 1, status = 2, updated_at = '${dayjs().format('YYYY-MM-DD HH:mm:ss')}' WHERE id = ${book_id}`);
      
      // 提交事务
      await pool.query('COMMIT');
      
      return res.json({
        code: 200,
        msg: '借阅成功',
        data: {
          borrow_no,
          due_date: dayjs().add(max_borrow_days, 'day').format('YYYY-MM-DD HH:mm:ss')
        }
      });
    } catch (error) {
      // 回滚事务
      await pool.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('借阅图书失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '借阅图书失败',
      data: null
    });
  }
};

// 获取公告列表
const getAnnouncements = async (req, res) => {
  try {
    const { page = 1, pageSize = 10 } = req.query;
    
    // 确保参数是有效的数字，使用更严格的验证
    const pageNum = Number.isNaN(Number(page)) ? 1 : Number(page);
    const size = Number.isNaN(Number(pageSize)) ? 10 : Number(pageSize);
    const offset = Math.max(0, (pageNum - 1) * size);
    
    // 确保参数是整数
    const finalSize = Math.max(1, Math.min(100, Math.floor(size)));
    const finalOffset = Math.floor(offset);
    
    console.log('执行公告查询:', {
      page: pageNum,
      pageSize: size,
      finalSize,
      finalOffset
    });
    
    // 执行查询 - 使用直接插入值的方式，而不是参数化查询
    const [announcements] = await pool.execute(
      `SELECT id, title, content, author, view_count, created_at FROM announcement ORDER BY created_at DESC LIMIT ${finalSize} OFFSET ${finalOffset}`
    );
    
    // 获取总数
    const [countResult] = await pool.execute('SELECT COUNT(*) as count FROM announcement');
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: {
        list: announcements,
        total: countResult[0].count
      }
    });
  } catch (error) {
    console.error('获取公告列表失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取公告列表失败',
      data: null
    });
  }
};

// 获取最新公告
const getLatestAnnouncement = async (req, res) => {
  try {
    const [announcements] = await pool.execute(
      'SELECT id, title, content, author, view_count, created_at FROM announcement ORDER BY created_at DESC LIMIT 1'
    );
    
    if (announcements.length === 0) {
      return res.json({
        code: 200,
        msg: '获取成功',
        data: null
      });
    }
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: announcements[0]
    });
  } catch (error) {
    console.error('获取最新公告失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取最新公告失败',
      data: null
    });
  }
};

// 获取系统配置
const getSystemConfig = async (req, res) => {
  try {
    const [configs] = await pool.execute('SELECT * FROM sys_config');
    
    const config = {};
    configs.forEach(item => {
      config[item.key] = item.value;
    });
    
    return res.json({
      code: 200,
      msg: '获取成功',
      data: config
    });
  } catch (error) {
    console.error('获取系统配置失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '获取系统配置失败',
      data: null
    });
  }
};

// 登出
const logout = async (req, res) => {
  try {
    // 前端已经处理了 token 的清除
    // 这里可以添加一些额外的逻辑，比如记录登出日志
    return res.json({
      code: 200,
      msg: '登出成功',
      data: null
    });
  } catch (error) {
    console.error('登出失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '登出失败',
      data: null
    });
  }
};

// 上传头像
const uploadAvatar = async (req, res) => {
  try {
    const { reader_id } = req.user;
    
    if (!req.file) {
      return res.status(400).json({
        code: 400,
        msg: '请选择要上传的头像',
        data: null
      });
    }
    
    const avatarUrl = `/uploads/${req.file.filename}`;
    
    await pool.execute(
      'UPDATE reader_info SET avatar = ?, update_time = ? WHERE id = ?',
      [avatarUrl, new Date(), reader_id]
    );
    
    return res.json({
      code: 200,
      msg: '头像上传成功',
      data: {
        avatar: avatarUrl
      }
    });
  } catch (error) {
    console.error('上传头像失败:', error);
    return res.status(500).json({
      code: 500,
      msg: '上传头像失败',
      data: null
    });
  }
};

module.exports = {
  login,
  register,
  sendSmsCode,
  resetPassword,
  logout,
  getUserInfo,
  updateUserProfile,
  changePassword,
  getUserStatistics,
  searchBooks,
  getBookDetail,
  getHotBooks,
  getBookCategories,
  createReservation,
  cancelReservation,
  getReservationList,
  getReservationDetail,
  getBorrowList,
  getBorrowDetail,
  renewBook,
  borrowBook,
  getAnnouncements,
  getLatestAnnouncement,
  getSystemConfig,
  uploadAvatar
};