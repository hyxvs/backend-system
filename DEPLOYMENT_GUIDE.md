# 后端部署指南 - Render方案

## 前置准备

1. 将后端代码推送到GitHub
2. 注册以下账号：
   - [Render](https://render.com/)
   - [PlanetScale](https://planetscale.com/) (数据库)

## 步骤1：准备数据库

### 1.1 创建PlanetScale数据库
1. 访问 https://planetscale.com/
2. 注册并登录
3. 点击"Create database"
4. 数据库名称：`library_system`
5. 区域选择：选择离你最近的区域
6. 点击"Create database"

### 1.2 获取数据库连接信息
1. 在PlanetScale控制台，点击你的数据库
2. 点击"Connect" → "General" → "Connect with"
3. 选择"Node.js"
4. 复制以下信息：
   - Host
   - Username
   - Password
   - Database name

### 1.3 导入数据库结构
1. 在PlanetScale控制台，点击"Console"
2. 执行你的数据库创建脚本（如果有）
3. 或者使用PlanetScale的导入功能导入SQL文件

## 步骤2：准备后端代码

### 2.1 创建环境变量文件
在backend目录创建`.env`文件（不要提交到Git）：

```env
PORT=3000
DB_HOST=your-planetscale-host.com
DB_PORT=3306
DB_USER=your-planetscale-username
DB_PASSWORD=your-planetscale-password
DB_NAME=library_system
JWT_SECRET=your-very-secure-secret-key-change-this
JWT_EXPIRES_IN=24h
LOG_LEVEL=info
```

### 2.2 确保package.json正确
确保package.json包含以下内容：

```json
{
  "name": "library-backend",
  "version": "1.0.0",
  "main": "src/app.js",
  "scripts": {
    "start": "node src/app.js",
    "dev": "nodemon src/app.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.5",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "bcrypt": "^6.0.0",
    "multer": "^2.0.2"
  }
}
```

### 2.3 推送代码到GitHub
```bash
git add .
git commit -m "准备后端部署"
git push
```

## 步骤3：部署到Render

### 3.1 创建Render账号
1. 访问 https://render.com/
2. 使用GitHub账号登录
3. 验证邮箱

### 3.2 创建Web Service
1. 登录后，点击右上角的"+"
2. 选择"New Web Service"
3. 在"Connect"页面，找到你的GitHub仓库
4. 点击"Connect"按钮

### 3.3 配置构建和运行
1. **Name**: 输入服务名称，如`library-backend`
2. **Region**: 选择离你最近的区域
3. **Branch**: 选择`main`或`master`
4. **Runtime**: 选择`Node`
5. **Build Command**: 输入`npm install`
6. **Start Command**: 输入`node src/app.js`

### 3.4 配置环境变量
1. 滚动到"Advanced"部分
2. 点击"Add Environment Variable"
3. 添加以下变量（从步骤2.1的.env文件复制）：
   - `PORT`: `3000`
   - `DB_HOST`: 你的PlanetScale主机地址
   - `DB_PORT`: `3306`
   - `DB_USER`: 你的PlanetScale用户名
   - `DB_PASSWORD`: 你的PlanetScale密码
   - `DB_NAME`: `library_system`
   - `JWT_SECRET`: 你的安全密钥
   - `JWT_EXPIRES_IN`: `24h`
   - `LOG_LEVEL`: `info`

### 3.5 部署
1. 点击底部的"Create Web Service"按钮
2. 等待构建和部署完成（通常需要2-5分钟）
3. 部署成功后，你会看到一个URL，如：`https://library-backend.onrender.com`

## 步骤4：测试后端API

### 4.1 测试健康检查
在浏览器访问：`https://library-backend.onrender.com/api/health`

应该返回：
```json
{
  "code": 200,
  "msg": "服务正常运行",
  "data": {
    "timestamp": "...",
    "uptime": ...
  }
}
```

### 4.2 测试其他API
使用Postman或curl测试其他API端点。

## 步骤5：更新前端配置

### 5.1 修改前端环境变量
编辑`reader-mobile/.env.production`：

```env
VITE_API_BASE_URL=https://library-backend.onrender.com/api
```

### 5.2 重新构建前端
```bash
cd reader-mobile
npm run build
```

### 5.3 提交并推送前端代码
```bash
git add .
git commit -m "更新生产环境API地址"
git push
```

### 5.4 在Vercel配置环境变量
1. 访问Vercel控制台
2. 进入你的前端项目
3. 进入Settings → Environment Variables
4. 添加环境变量：
   - Name: `VITE_API_BASE_URL`
   - Value: `https://library-backend.onrender.com/api`
   - Environment: Production, Preview, Development
5. 点击"Save"
6. 重新部署前端项目

## 常见问题

### Q1: 部署失败怎么办？
A: 查看Render的部署日志，检查：
- 环境变量是否正确配置
- 数据库连接是否正常
- 依赖是否正确安装

### Q2: 数据库连接失败？
A: 检查：
- PlanetScale的IP白名单设置
- 数据库凭证是否正确
- 数据库是否已创建

### Q3: API请求超时？
A: Render免费版有启动时间限制（15分钟无活动后会休眠）：
- 首次请求可能需要30-60秒启动
- 考虑升级到付费版或使用其他服务

### Q4: 如何查看日志？
A: 在Render控制台：
1. 进入你的Web Service
2. 点击"Logs"标签
3. 可以查看实时日志

## 成本估算

### Render免费版
- 512MB RAM
- 0.1 CPU
- 750小时/月
- 适合开发和测试

### PlanetScale免费版
- 5GB存储
- 10亿行读取/月
- 完全免费

### 升级建议
- 生产环境建议升级到Render Starter ($7/月)
- 数据库可继续使用PlanetScale免费版

## 下一步

部署完成后：
1. 测试所有API端点
2. 监控应用性能
3. 设置错误告警
4. 定期备份数据库

## 技术支持

- Render文档: https://render.com/docs
- PlanetScale文档: https://planetscale.com/docs
- Node.js部署: https://nodejs.org/en/docs/