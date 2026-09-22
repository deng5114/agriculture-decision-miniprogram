const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

module.exports = {
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  database: {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'agriculture_decision'
  },
  baiduAi: {
    apiKey: process.env.BAIDU_AI_API_KEY || '',
    secretKey: process.env.BAIDU_AI_SECRET_KEY || '',
    asrDevPid: Number(process.env.BAIDU_ASR_DEV_PID || 1537),
    minimumConfidence: Number(process.env.RECOGNITION_MIN_CONFIDENCE || 0.5)
  }
};
