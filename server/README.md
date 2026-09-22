# 后端服务

## 环境要求

- Node.js 18 或更高版本
- MySQL 8 或更高版本

## 安装依赖

```bash
npm install
```

## 配置数据库

1. 创建 MySQL 数据库用户。
2. 执行 `../database/schema.sql`。
3. 复制 `.env.example` 为 `.env`。
4. 修改 `.env` 中的数据库密码和数据库配置。

## 启动服务

```bash
npm run dev
```

启动后可访问：

```text
GET  http://localhost:3000/api/health
POST http://localhost:3000/api/auth/login
```

当前登录接口是课程演示用登录，返回的 `demoHeaders` 可用于后续接口联调。正式接入微信时，再替换为微信登录校验流程。
