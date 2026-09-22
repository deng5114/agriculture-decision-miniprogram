const express = require('express');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/region', requireLogin, requireRole('admin'), async (req, res, next) => {
  try {
    const { region = '', cropName = '' } = req.query;
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
    const [summaryRows] = await pool.execute(
      `SELECT COUNT(*) AS record_count,
              COALESCE(SUM(p.area_mu), 0) AS total_area_mu,
              COALESCE(SUM(r.budget), 0) AS total_budget
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       WHERE ${where}`,
      values
    );
    const [byCrop] = await pool.execute(
      `SELECT r.crop_name AS crop_name,
              COUNT(*) AS record_count,
              COALESCE(SUM(p.area_mu), 0) AS total_area_mu
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       WHERE ${where}
       GROUP BY r.crop_name
       ORDER BY record_count DESC`,
      values
    );
    const [byRegion] = await pool.execute(
      `SELECT p.region,
              COUNT(*) AS record_count,
              COALESCE(SUM(p.area_mu), 0) AS total_area_mu
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       WHERE ${where}
       GROUP BY p.region
       ORDER BY record_count DESC`,
      values
    );

    res.json({
      code: 0,
      message: 'ok',
      data: {
        onlyApproved: true,
        summary: summaryRows[0],
        byCrop,
        byRegion
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
