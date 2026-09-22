const express = require('express');

const router = express.Router();

// 第一阶段使用演示登录。接入微信登录时，将此处替换为 wx.login + 服务端校验。
router.post('/login', (req, res) => {
  const { nickname = '演示农户', role = 'farmer', region = '示范区' } = req.body || {};
  const allowedRoles = ['farmer', 'resource_provider', 'agronomist', 'admin'];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({
      code: 400,
      message: '角色参数不正确',
      data: null
    });
  }

  return res.json({
    code: 0,
    message: 'ok',
    data: {
      user: { id: 1, nickname, role, region },
      demoHeaders: {
        'x-demo-user-id': '1',
        'x-demo-role': role
      }
    }
  });
});

module.exports = router;
