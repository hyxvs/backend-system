/**
 * 系统配置文件
 * 用于管理应用程序的各种配置项
 */

// 加载环境变量，从.env文件中读取配置
require('dotenv').config();

/**
 * 导出配置模块
 * 包含系统运行所需的各种配置参数
 */
module.exports = {
  /**
   * JWT (JSON Web Token) 配置
   * 用于用户认证和授权
   */
  jwt: {
    /**
     * JWT 密钥
     * 用于签名和验证令牌的安全性
     * 优先从环境变量中获取，若不存在则使用默认值
     */
    secret: process.env.JWT_SECRET || 'library_system_secret_key_2024',
    
    /**
     * JWT 令牌过期时间
     * 控制令牌的有效期
     * 优先从环境变量中获取，若不存在则使用默认值 24 小时
     */
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  }
};
