const express = require('express');
const { pool } = require('../db');
const { requireLogin } = require('../middleware/auth');
const { analyzeMarketRows } = require('../services/market-analysis');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const { cropName = '', region = '', startYear = '', endYear = '' } = req.query;
    const crop = String(cropName).trim();
    const area = String(region).trim();
    const start = Number(startYear);
    const end = Number(endYear);

    if (!crop || !area) {
      return res.status(400).json({ code: 400, message: '请输入作物和区域', data: null });
    }
    if (!/^\d{4}$/.test(String(startYear)) || !/^\d{4}$/.test(String(endYear))
      || start < 1900 || end > 2100 || start > end) {
      return res.status(400).json({ code: 400, message: '请输入有效年份，且开始年份不能晚于结束年份', data: null });
    }
    if (end - start > 20) {
      return res.status(400).json({ code: 400, message: '一次最多查询连续 21 年数据', data: null });
    }

    const [databaseRows] = await pool.execute(
      `SELECT MIN(id) AS id, crop_name, region, data_year,
              ROUND(AVG(average_price), 2) AS average_price,
              ROUND(AVG(output_ton), 2) AS output_ton,
              ROUND(AVG(planting_area_mu), 2) AS planting_area_mu,
              GROUP_CONCAT(DISTINCT source ORDER BY source SEPARATOR '；') AS source,
              MAX(is_mock) AS is_mock
       FROM market_data
       WHERE crop_name = ? AND region = ? AND data_year BETWEEN ? AND ?
       GROUP BY crop_name, region, data_year
       ORDER BY data_year`,
      [crop, area, start, end]
    );
    const { rows, analysis } = analyzeMarketRows(databaseRows);

    res.json({
      code: 0,
      message: rows.length ? 'ok' : '暂无行情数据',
      data: {
        rows,
        analysis,
        dataSource: rows.length
          ? (rows.some((row) => row.is_mock) ? '包含课程模拟数据' : '业务数据')
          : '未查询到数据',
        statisticNote: '同一作物、区域和年份的多条记录按平均值聚合；价格单位为元/公斤，产量单位为吨，种植面积单位为亩'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
