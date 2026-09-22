const express = require('express');
const { requireLogin, requireRole } = require('../middleware/auth');
const { getDisasterAlerts } = require('../services/disaster');
const router = express.Router();
router.get('/locations', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const data = await require('../services/weather').searchLocations(req.query.name);
    res.json({ code: 0, message: data.length ? '请选择匹配地点' : '未找到地点，可尝试拼音或填写经纬度', data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
    next(error);
  }
});
router.get('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const { plotId, cropName } = req.query;
    if (typeof plotId !== 'string' || !/^\d+$/.test(plotId) || !Number.isSafeInteger(Number(plotId)) || Number(plotId) < 1 || typeof cropName !== 'string' || !cropName.trim() || cropName.length > 50) return res.status(400).json({ code: 400, message: '请提供有效地块和作物', data: null });
    const data = await getDisasterAlerts({ plotId: Number(plotId), userId: req.user.id, cropName: cropName.trim() });
    res.json({ code: 0, message: '天气查询完成', data });
  } catch (error) {
    if (error.statusCode) return res.status(error.statusCode).json({ code: error.statusCode, message: error.message, data: null });
    next(error);
  }
});
module.exports = router;
