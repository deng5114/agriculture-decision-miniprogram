const express = require('express');
const { requireLogin, requireRole } = require('../middleware/auth');
const { getDisasterAlerts } = require('../services/disaster');

const router = express.Router();

router.get('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const {
      plotId,
      cropName,
      rainfall = 0,
      dryDays = 0,
      minTemperature = null
    } = req.query;

    if (!plotId || !cropName) {
      return res.status(400).json({ code: 400, message: 'plotId 和 cropName 不能为空', data: null });
    }
    if ([rainfall, dryDays].some((value) => Number.isNaN(Number(value)) || Number(value) < 0)) {
      return res.status(400).json({ code: 400, message: '降水量和连续无有效降水天数不能为负数', data: null });
    }

    const data = await getDisasterAlerts({
      plotId: Number(plotId),
      userId: req.user.id,
      cropName,
      rainfall,
      dryDays,
      minTemperature
    });

    res.json({
      code: 0,
      message: data.alerts.length ? '检测到灾害风险' : '当前未检测到灾害风险',
      data
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
