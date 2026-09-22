const express = require('express');
const cors = require('cors');
const config = require('./config');
const authRoutes = require('./routes/auth');
const healthRoutes = require('./routes/health');
const plotRoutes = require('./routes/plots');
const recordRoutes = require('./routes/records');
const recommendationRoutes = require('./routes/recommendations');
const disasterRoutes = require('./routes/disasters');

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  next();
});

app.get('/', (req, res) => {
  res.json({ code: 0, message: '农业作物智能决策后端已启动', data: null });
});

app.use('/api/auth', authRoutes);
app.use('/api/health', healthRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/plant-records', recordRoutes);
app.use('/api/recommendations', recommendationRoutes);
app.use('/api/disaster-alerts', disasterRoutes);

app.use((req, res) => {
  res.status(404).json({ code: 404, message: '接口不存在', data: null });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ code: 500, message: '服务器内部错误', data: null });
});

if (require.main === module) {
  app.listen(config.port, () => {
    console.log(`server running at http://localhost:${config.port}`);
  });
}

module.exports = app;
