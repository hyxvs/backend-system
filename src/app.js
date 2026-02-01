const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const logger = require('./config/logger');
const { errorHandler, notFoundHandler } = require('./middleware/error');
const logOperation = require('./middleware/log');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use(logOperation);

app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/readers', require('./routes/readers'));
app.use('/api/reader', require('./routes/reader'));
app.use('/api/books', require('./routes/books'));
app.use('/api/borrow', require('./routes/borrow'));
app.use('/api/appointment', require('./routes/appointment'));
app.use('/api/statistics', require('./routes/statistics'));
app.use('/api/logs', require('./routes/logs'));

app.get('/api/health', (req, res) => {
  res.json({
    code: 200,
    msg: '服务正常运行',
    data: {
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  logger.info(`服务器运行在端口 ${PORT}`);
  logger.info(`环境: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
