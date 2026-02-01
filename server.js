// 导入必要的模块
const express = require('express'); // 导入Express框架
const cors = require('cors'); // 导入CORS中间件
const bodyParser = require('body-parser'); // 导入body-parser中间件
const config = require('./src/config/config'); // 导入配置文件
const routes = require('./src/routes'); // 导入路由模块

// 创建Express应用实例
const app = express();

// 配置CORS
app.use(cors({
  origin: '*', // 允许所有来源
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // 允许的HTTP方法
  allowedHeaders: ['Content-Type', 'Authorization'] // 允许的请求头
}));

// 配置body-parser
app.use(bodyParser.json()); // 解析JSON格式的请求体
app.use(bodyParser.urlencoded({ extended: true })); // 解析URL编码的请求体

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    code: 200,
    msg: 'Server is running',
    data: null
  });
});

// API路由
app.use('/api', routes); // 将所有API路由挂载到/api路径下

// 404处理
app.use((req, res) => {
  res.status(404).json({
    code: 404,
    msg: 'API not found',
    data: null
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    code: 500,
    msg: 'Internal server error',
    data: null
  });
});

// 启动服务器
const PORT = config.server.port || 3000; // 从配置文件获取端口号，默认为3000
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// 导出应用实例
module.exports = app;