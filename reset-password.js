const bcrypt = require('bcryptjs');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function resetPassword() {
  try {
    // 创建数据库连接
    const pool = mysql.createPool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME
    });

    // 生成密码哈希
    const password = 'password';
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log('生成的密码哈希:', hashedPassword);

    // 更新 admin 用户的密码
    const [result] = await pool.query(
      'UPDATE users SET password = ? WHERE username = ?',
      [hashedPassword, 'admin']
    );

    console.log('更新结果:', result);
    console.log('密码重置成功！');

    // 验证更新结果
    const [users] = await pool.query(
      'SELECT username, LENGTH(password) AS password_length FROM users WHERE username = ?',
      ['admin']
    );
    console.log('验证结果:', users[0]);

    await pool.end();
  } catch (error) {
    console.error('密码重置失败:', error);
  }
}

resetPassword();