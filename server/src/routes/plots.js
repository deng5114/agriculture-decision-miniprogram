const express = require('express');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

router.post('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const { name, areaMu, soilType, region, latitude = null, longitude = null } = req.body || {};

    if (!name || !soilType || !region || areaMu === undefined || Number(areaMu) <= 0) {
      return res.status(400).json({ code: 400, message: '地块名称、面积、土壤类型和区域不能为空，面积必须大于0', data: null });
    }

    const [result] = await pool.execute(
      `INSERT INTO plots (user_id, name, area_mu, soil_type, region, latitude, longitude)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, name, Number(areaMu), soilType, region, latitude, longitude]
    );

    const [rows] = await pool.execute('SELECT * FROM plots WHERE id = ?', [result.insertId]);
    res.status(201).json({ code: 0, message: '创建地块成功', data: rows[0] });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT * FROM plots WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json({ code: 0, message: 'ok', data: rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT p.*, u.nickname AS owner_name
       FROM plots p JOIN users u ON u.id = p.user_id
       WHERE p.id = ? AND (p.user_id = ? OR ? IN ('agronomist', 'admin'))`,
      [req.params.id, req.user.id, req.user.role || '']
    );

    if (!rows.length) {
      return res.status(404).json({ code: 404, message: '地块不存在或无权访问', data: null });
    }
    res.json({ code: 0, message: 'ok', data: rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
