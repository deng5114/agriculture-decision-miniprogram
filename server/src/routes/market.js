const express = require('express');
const { pool } = require('../db');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const { cropName = '', region = '', startYear = '', endYear = '' } = req.query;
    const conditions = [];
    const values = [];

    if (cropName) {
      conditions.push('crop_name = ?');
      values.push(cropName);
    }
    if (region) {
      conditions.push('region = ?');
      values.push(region);
    }
    if (startYear) {
      conditions.push('data_year >= ?');
      values.push(Number(startYear));
    }
    if (endYear) {
      conditions.push('data_year <= ?');
      values.push(Number(endYear));
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [rows] = await pool.execute(
      `SELECT id, crop_name, region, data_year, average_price, output_ton,
              planting_area_mu, source, is_mock
       FROM market_data ${where}
       ORDER BY crop_name, data_year`,
      values
    );

    res.json({
      code: 0,
      message: rows.length ? 'ok' : '暂无行情数据',
      data: {
        rows,
        dataSource: rows.some((row) => row.is_mock) ? '包含课程模拟数据' : '业务数据',
        statisticNote: '价格为年度均价；产量单位为吨；种植面积单位为亩'
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
