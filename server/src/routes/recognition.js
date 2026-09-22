const express = require('express');
const multer = require('multer');
const config = require('../config');
const { pool } = require('../db');
const { requireLogin, requireRole } = require('../middleware/auth');
const {
  RecognitionError,
  isConfigured,
  extractVoiceFields,
  recognizeVoice,
  recognizePlant
} = require('../services/recognition');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 4 * 1024 * 1024 }
});

function receiveFile(req, res, next) {
  upload.single('file')(req, res, (error) => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 4MB' : '文件上传失败';
    return res.status(400).json({ code: 400, message, data: null });
  });
}

function sendError(error, res, next) {
  if (error instanceof RecognitionError) {
    return res.status(error.status).json({ code: error.status, message: error.message, data: null });
  }
  return next(error);
}

router.get('/status', requireLogin, requireRole('farmer'), (req, res) => {
  res.json({
    code: 0,
    message: 'ok',
    data: {
      configured: isConfigured(),
      provider: '百度智能云',
      capabilities: ['短语音识别', '植物识别'],
      isMock: false
    }
  });
});

router.post('/voice', requireLogin, requireRole('farmer'), receiveFile, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传录音文件', data: null });
    const format = String(req.body.format || 'm4a').toLowerCase();
    if (!['m4a', 'wav', 'pcm', 'amr'].includes(format)) {
      return res.status(400).json({ code: 400, message: '录音格式仅支持 m4a、wav、pcm 或 amr', data: null });
    }
    const voice = await recognizeVoice(req.file.buffer, { format, cuid: `wx-user-${req.user.id}` });
    const [crops] = await pool.execute('SELECT name FROM crops WHERE enabled = TRUE ORDER BY CHAR_LENGTH(name) DESC');
    const fields = extractVoiceFields(voice.transcript, crops.map((item) => item.name));
    res.json({
      code: 0,
      message: '请确认真实语音识别结果',
      data: {
        isMock: false,
        provider: '百度智能云短语音识别',
        recognized: true,
        requiresConfirmation: true,
        transcript: voice.transcript,
        fields,
        requestId: voice.requestId
      }
    });
  } catch (error) {
    return sendError(error, res, next);
  }
});

router.post('/image', requireLogin, requireRole('farmer'), receiveFile, async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ code: 400, message: '请上传植物图片', data: null });
    if (req.file.size > 3 * 1024 * 1024) {
      return res.status(400).json({ code: 400, message: '图片不能超过 3MB', data: null });
    }
    if (!/^image\/(jpeg|jpg|png|bmp|x-ms-bmp)$/i.test(req.file.mimetype) && req.file.mimetype !== 'application/octet-stream') {
      return res.status(400).json({ code: 400, message: '图片仅支持 JPG、PNG 或 BMP', data: null });
    }
    const image = await recognizePlant(req.file.buffer);
    const configuredMinimum = Number.isFinite(config.baiduAi.minimumConfidence) ? config.baiduAi.minimumConfidence : 0.5;
    const minimum = Math.min(1, Math.max(0, configuredMinimum)) * 100;
    const recognized = image.top.score >= minimum;
    res.json({
      code: 0,
      message: recognized ? '请确认真实图片识别结果' : '图片识别置信度较低',
      data: {
        isMock: false,
        provider: '百度智能云植物识别',
        recognized,
        requiresConfirmation: recognized,
        description: recognized
          ? `识别为${image.top.name}，置信度 ${image.top.score}%`
          : `最可能是${image.top.name}，但置信度仅 ${image.top.score}%`,
        fields: recognized ? { cropName: image.top.name } : {},
        alternatives: image.alternatives,
        reference: image.description,
        requestId: image.requestId,
        message: recognized ? '' : '请重新拍摄主体清晰、光线充足的植物图片，或改为手动填写。'
      }
    });
  } catch (error) {
    return sendError(error, res, next);
  }
});

module.exports = router;
