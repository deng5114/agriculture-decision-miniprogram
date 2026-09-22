const express = require('express');
const { requireLogin, requireRole } = require('../middleware/auth');
const router = express.Router();

// Deterministic fixtures only: no recording, upload or external AI service.
const samples = {
  voice: {
    tomato: { transcript: '种两亩番茄，地块缺水', fields: { cropName: '番茄', areaMu: 2, problemDescription: '缺水' } },
    corn: { transcript: '种三亩玉米', fields: { cropName: '玉米', areaMu: 3, problemDescription: '' } }
  },
  image: {
    tomato: { description: '演示样例：番茄植株', fields: { cropName: '番茄' } },
    corn: { description: '演示样例：玉米植株', fields: { cropName: '玉米' } }
  }
};
router.post('/:kind', requireLogin, requireRole('farmer'), (req, res) => {
  const { kind } = req.params;
  const { sample } = req.body || {};
  if (!['voice', 'image'].includes(kind) || typeof sample !== 'string') {
    return res.status(400).json({ code: 400, message: '请选择有效的演示样例', data: null });
  }
  if (['noise', 'blurred', 'unrelated'].includes(sample)) {
    return res.json({ code: 0, message: '模拟识别失败', data: {
      isMock: true, recognized: false, fields: {},
      message: '未获得可靠结果，请重试或改用手动填写。'
    } });
  }
  if (!Object.hasOwn(samples[kind], sample)) {
    return res.status(400).json({ code: 400, message: '未知演示样例', data: null });
  }
  res.json({ code: 0, message: '请确认候选结果', data: {
    isMock: true, recognized: true, requiresConfirmation: true,
    ...samples[kind][sample]
  } });
});
module.exports = router;
