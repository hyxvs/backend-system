const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../config/logger');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

// 获取操作日志列表
router.get('/', async (req, res) => {
  try {
    const { 
      operator, 
      action, 
      startDate, 
      endDate, 
      ipAddress, 
      page = 1, 
      pageSize = 10 
    } = req.query;

    let query = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];

    // 添加搜索条件
    if (operator) {
      query += ' AND username LIKE ?';
      params.push(`%${operator}%`);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    if (ipAddress) {
      query += ' AND ip_address LIKE ?';
      params.push(`%${ipAddress}%`);
    }

    // 添加排序
    query += ' ORDER BY created_at DESC';

    // 获取总数
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as count');
    const [countResult] = await pool.query(countQuery, params);
    const total = countResult[0].count;

    // 添加分页
    const offset = (page - 1) * pageSize;
    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(pageSize), parseInt(offset));

    // 执行查询
    const [logs] = await pool.query(query, params);

    // 格式化日志数据
    const formattedLogs = logs.map(log => ({
      id: log.id,
      operator: log.username,
      operationType: log.action,
      content: log.description,
      operationTime: log.created_at,
      ipAddress: log.ip_address
    }));

    res.json({
      code: 200,
      msg: '获取日志成功',
      data: {
        list: formattedLogs,
        pagination: {
          current: parseInt(page),
          pageSize: parseInt(pageSize),
          total
        }
      }
    });
  } catch (error) {
    logger.error('获取日志失败:', error);
    res.status(500).json({
      code: 500,
      msg: '获取日志失败',
      data: null
    });
  }
});

// 导出操作日志为 Excel
router.get('/export', async (req, res) => {
  try {
    const { 
      operator, 
      action, 
      startDate, 
      endDate, 
      ipAddress
    } = req.query;

    let query = 'SELECT * FROM operation_logs WHERE 1=1';
    const params = [];

    // 添加搜索条件
    if (operator) {
      query += ' AND username LIKE ?';
      params.push(`%${operator}%`);
    }

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    if (ipAddress) {
      query += ' AND ip_address LIKE ?';
      params.push(`%${ipAddress}%`);
    }

    // 添加排序
    query += ' ORDER BY created_at DESC';

    // 执行查询
    const [logs] = await pool.query(query, params);

    // 格式化日志数据
    const formattedLogs = logs.map(log => ({
      '日志ID': log.id,
      '操作人': log.username,
      '操作类型': log.action,
      '操作内容': log.description,
      '操作时间': log.created_at,
      'IP地址': log.ip_address
    }));

    // 创建工作簿和工作表
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(formattedLogs);

    // 将工作表添加到工作簿
    XLSX.utils.book_append_sheet(workbook, worksheet, '操作日志');

    // 生成文件名
    const fileName = `操作日志_${new Date().toISOString().slice(0, 19).replace(/[-:]/g, '')}.xlsx`;
    const filePath = path.join(__dirname, '..', '..', 'temp', fileName);

    // 确保 temp 目录存在
    if (!fs.existsSync(path.join(__dirname, '..', '..', 'temp'))) {
      fs.mkdirSync(path.join(__dirname, '..', '..', 'temp'), { recursive: true });
    }

    // 写入文件
    XLSX.writeFile(workbook, filePath);

    // 发送文件
    res.download(filePath, fileName, (err) => {
      if (err) {
        logger.error('下载文件失败:', err);
        res.status(500).json({
          code: 500,
          msg: '导出失败',
          data: null
        });
      }

      // 删除临时文件
      fs.unlinkSync(filePath);
    });
  } catch (error) {
    logger.error('导出日志失败:', error);
    res.status(500).json({
      code: 500,
      msg: '导出失败',
      data: null
    });
  }
});

module.exports = router;