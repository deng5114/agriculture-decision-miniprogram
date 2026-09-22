const express = require('express');
const { requireLogin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: { service: 'agriculture-decision-server', status: 'running' }
  });
});

router.get('/private', requireLogin, (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: { userId: req.user.id, message: '已通过登录校验' }
  });
});

module.exports = router;
