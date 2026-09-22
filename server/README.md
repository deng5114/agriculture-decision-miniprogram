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
POST http://localhost:3000/api/plots
GET  http://localhost:3000/api/plant-records
POST http://localhost:3000/api/recommendations
GET  http://localhost:3000/api/disaster-alerts?plotId=1&cropName=番茄
GET  http://localhost:3000/api/disaster-alerts/locations?name=Wuhan
PUT  http://localhost:3000/api/plots/:id/location
GET  http://localhost:3000/api/reviews/pending
POST http://localhost:3000/api/reviews/:id/approve
POST http://localhost:3000/api/reviews/:id/reject
GET  http://localhost:3000/api/market-data?cropName=番茄&region=示范区&startYear=2022&endYear=2024
GET  http://localhost:3000/api/statistics/region
```

当前登录接口是课程演示用登录，返回的 `demoHeaders` 可用于后续接口联调。正式接入微信时，再替换为微信登录校验流程。

天气接口已接入 Open-Meteo，无需填写 API Key。地块必须先保存 WGS84 经纬度；位置接口请求体为 `{ "latitude": 30.59, "longitude": 114.30 }`（仅为示例，实际使用应填写地块位置）。客户端传入的 rainfall、dryDays、minTemperature 不再用于预警。服务器须能访问 api.open-meteo.com 与 geocoding-api.open-meteo.com。

使用说明、规则口径和验证结果见 `../docs/真实天气接入说明.md`。
