const express = require('express');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');

const router = express.Router();

router.get('/pending', requireLogin, requireRole('agronomist'), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      `SELECT r.*, p.name AS plot_name, p.region, u.nickname AS farmer_name
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       JOIN users u ON u.id = r.user_id
       WHERE r.status = 'pending'
       ORDER BY r.created_at ASC`
    );
    res.json({ code: 0, message: 'ok', data: rows });
  } catch (error) {
    next(error);
  }
});

async function reviewRecord(req, res, next, result) {
  try {
    const comment = String(req.body?.comment || '').trim();
    if (result === 'rejected' && !comment) {
      return res.status(400).json({ code: 400, message: '驳回时必须填写审核意见', data: null });
    }

    const [records] = await pool.execute(
      `SELECT id, user_id, status FROM plant_records WHERE id = ?`,
      [req.params.id]
    );
    if (!records.length) {
      return res.status(404).json({ code: 404, message: '种植记录不存在', data: null });
    }
    if (records[0].status !== 'pending') {
      return res.status(400).json({ code: 400, message: '只有待审核记录可以审核', data: null });
    }

    const nextStatus = result === 'approved' ? 'approved' : 'rejected';
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute(
        `UPDATE plant_records SET status = ?, review_comment = ? WHERE id = ?`,
        [nextStatus, comment || '审核通过', req.params.id]
      );
      await connection.execute(
        `INSERT INTO audit_records (target_type, target_id, reviewer_id, result, comment)
         VALUES ('plant_record', ?, ?, ?, ?)`,
        [req.params.id, req.user.id, result, comment || '审核通过']
      );
      await connection.execute(
        `INSERT INTO operation_logs (operator_id, action, target_type, target_id, detail)
         VALUES (?, ?, 'plant_record', ?, ?)`,
        [req.user.id, result === 'approved' ? 'approve_record' : 'reject_record', req.params.id, comment || '审核通过']
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    const [updated] = await pool.execute(
      `SELECT r.*, p.name AS plot_name, p.region, u.nickname AS farmer_name
       FROM plant_records r
       JOIN plots p ON p.id = r.plot_id
       JOIN users u ON u.id = r.user_id
       WHERE r.id = ?`,
      [req.params.id]
    );
    res.json({ code: 0, message: result === 'approved' ? '审核通过' : '已驳回', data: updated[0] });
  } catch (error) {
    next(error);
  }
}

router.post('/:id/approve', requireLogin, requireRole('agronomist'), (req, res, next) => {
  reviewRecord(req, res, next, 'approved');
});

router.post('/:id/reject', requireLogin, requireRole('agronomist'), (req, res, next) => {
  reviewRecord(req, res, next, 'rejected');
});

module.exports = router;
