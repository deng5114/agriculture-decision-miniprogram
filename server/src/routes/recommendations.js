const express = require('express');
const { requireLogin, requireRole } = require('../middleware/auth');
const { recommend } = require('../services/recommendation');

const router = express.Router();

router.post('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const { plotId, temperature = null, budget = null, experienceLevel = null } = req.body || {};
    if (!plotId) {
      return res.status(400).json({ code: 400, message: 'plotId 不能为空', data: null });
    }
    if (budget !== null && Number(budget) < 0) {
      return res.status(400).json({ code: 400, message: '预算不能为负数', data: null });
    }

    const data = await recommend({
      plotId: Number(plotId),
      userId: req.user.id,
      temperature,
      budget,
      experienceLevel
    });

    res.json({
      code: 0,
      message: data.length ? '推荐完成' : '暂无符合硬约束的作物',
      data: { top3: data, ruleVersion: 'rule-v1' }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
