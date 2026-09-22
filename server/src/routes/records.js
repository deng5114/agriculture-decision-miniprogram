const express = require('express');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

async function findRecord(id, userId, role) {
  const [rows] = await pool.execute(
    `SELECT r.*, p.name AS plot_name, p.area_mu, p.soil_type, p.region
     FROM plant_records r JOIN plots p ON p.id = r.plot_id
     WHERE r.id = ? AND (r.user_id = ? OR ? IN ('agronomist', 'admin'))`,
    [id, userId, role || '']
  );
  return rows[0];
}

router.post('/', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const {
      plotId,
      cropName,
      plantingDate = null,
      budget = 0,
      experienceLevel = null,
      problemDescription = null
    } = req.body || {};

    if (!plotId || !cropName || Number(budget) < 0) {
      return res.status(400).json({ code: 400, message: '地块、作物不能为空，预算不能为负数', data: null });
    }

    const [plots] = await pool.execute('SELECT id FROM plots WHERE id = ? AND user_id = ?', [plotId, req.user.id]);
    if (!plots.length) {
      return res.status(403).json({ code: 403, message: '只能为自己的地块创建种植记录', data: null });
    }

    const [result] = await pool.execute(
      `INSERT INTO plant_records
       (plot_id, user_id, crop_name, planting_date, budget, experience_level, problem_description)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [plotId, req.user.id, cropName, plantingDate, Number(budget), experienceLevel, problemDescription]
    );

    const record = await findRecord(result.insertId, req.user.id, 'farmer');
    res.status(201).json({ code: 0, message: '种植记录已保存为草稿', data: record });
  } catch (error) {
    next(error);
  }
});

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const isStaff = ['agronomist', 'admin'].includes(req.user.role || '');
    const [rows] = await pool.execute(
      `SELECT r.*, p.name AS plot_name, p.region
       FROM plant_records r JOIN plots p ON p.id = r.plot_id
       WHERE ${isStaff ? '1 = 1' : 'r.user_id = ?'}
       ORDER BY r.updated_at DESC`,
      isStaff ? [] : [req.user.id]
    );
    res.json({ code: 0, message: 'ok', data: rows });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const existing = await findRecord(req.params.id, req.user.id, 'farmer');
    if (!existing || !['draft', 'rejected'].includes(existing.status)) {
      return res.status(400).json({ code: 400, message: '只有草稿或已驳回记录可以修改', data: null });
    }

    const { cropName, plantingDate = null, budget = 0, experienceLevel = null, problemDescription = null } = req.body || {};
    if (!cropName || Number(budget) < 0) {
      return res.status(400).json({ code: 400, message: '作物不能为空，预算不能为负数', data: null });
    }

    await pool.execute(
      `UPDATE plant_records
       SET crop_name = ?, planting_date = ?, budget = ?, experience_level = ?, problem_description = ?, status = 'draft', review_comment = NULL
       WHERE id = ? AND user_id = ?`,
      [cropName, plantingDate, Number(budget), experienceLevel, problemDescription, req.params.id, req.user.id]
    );
    res.json({ code: 0, message: '种植记录已更新', data: await findRecord(req.params.id, req.user.id, 'farmer') });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', requireLogin, requireRole('farmer'), async (req, res, next) => {
  try {
    const existing = await findRecord(req.params.id, req.user.id, 'farmer');
    if (!existing || !['draft', 'rejected'].includes(existing.status)) {
      return res.status(400).json({ code: 400, message: '只有草稿或已驳回记录可以提交审核', data: null });
    }

    await pool.execute(
      `UPDATE plant_records SET status = 'pending', review_comment = NULL WHERE id = ? AND user_id = ?`,
      [req.params.id, req.user.id]
    );
    res.json({ code: 0, message: '已提交审核', data: await findRecord(req.params.id, req.user.id, 'farmer') });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
