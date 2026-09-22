const express = require('express');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');
const { buildRegionStatistics } = require('../services/statistics');

const router = express.Router();

router.get('/region', requireLogin, requireRole('admin'), async (req, res, next) => {
  try {
    const region = String(req.query.region || '').trim();
    const cropName = String(req.query.cropName || '').trim();
    const conditions = [`r.status = 'approved'`];
    const values = [];

    if (region) {
      conditions.push('p.region = ?');
      values.push(region);
    }
    if (cropName) {
      conditions.push('r.crop_name = ?');
      values.push(cropName);
    }

    const where = conditions.join(' AND ');
    const [rows] = await pool.execute(
      `SELECT r.id AS record_id, r.crop_name, r.budget,
              p.id AS plot_id, p.area_mu, p.region
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       WHERE ${where}
       ORDER BY r.id`,
      values
    );

    res.json({
      code: 0,
      message: 'ok',
      data: buildRegionStatistics(rows)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
