const config = require('../config');

const TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token';
const ASR_URL = 'https://vop.baidu.com/server_api';
const PLANT_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v1/plant';
let tokenCache = null;

class RecognitionError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.status = status;
  }
}

function isConfigured() {
  return Boolean(config.baiduAi.apiKey && config.baiduAi.secretKey);
}

function ensureConfigured() {
  if (!isConfigured()) {
    throw new RecognitionError('真实识别服务尚未配置，请在后端填写百度智能云 API Key 和 Secret Key', 503);
  }
}

async function parseResponse(response, serviceName) {
  let data;
  try {
    data = await response.json();
  } catch (error) {
    throw new RecognitionError(`${serviceName}返回了无法解析的数据`);
  }
  if (!response.ok) throw new RecognitionError(`${serviceName}请求失败（HTTP ${response.status}）`);
  return data;
}

async function getAccessToken(fetchImpl = global.fetch, now = Date.now()) {
  ensureConfigured();
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.value;
  const query = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: config.baiduAi.apiKey,
    client_secret: config.baiduAi.secretKey
  });
  let response;
  try {
    response = await fetchImpl(`${TOKEN_URL}?${query}`, { method: 'POST', signal: AbortSignal.timeout(10_000) });
  } catch (error) {
    throw new RecognitionError('无法连接百度智能云鉴权服务');
  }
  const data = await parseResponse(response, '百度智能云鉴权服务');
  if (!data.access_token) throw new RecognitionError(`百度智能云鉴权失败：${data.error_description || data.error || '请检查密钥'}`, 503);
  tokenCache = {
    value: data.access_token,
    expiresAt: now + Math.max(300, Number(data.expires_in) || 2_592_000) * 1000
  };
  return tokenCache.value;
}

function chineseNumber(text) {
  if (/^\d+(?:\.\d+)?$/.test(text)) return Number(text);
  if (text === '半') return 0.5;
  const normalized = text.replace(/两/g, '二');
  if (normalized.includes('点')) {
    const [integer, decimal = ''] = normalized.split('点');
    const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const decimalText = [...decimal].map((item) => digits[item]).join('');
    const integerValue = chineseNumber(integer || '零');
    return decimalText && Number.isFinite(integerValue) ? Number(`${integerValue}.${decimalText}`) : null;
  }
  const digits = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if ([...normalized].every((item) => Object.hasOwn(digits, item))) {
    return Number([...normalized].map((item) => digits[item]).join(''));
  }
  let total = 0;
  let current = 0;
  for (const character of normalized) {
    if (Object.hasOwn(digits, character)) current = digits[character];
    else if (character === '十') { total += (current || 1) * 10; current = 0; }
    else if (character === '百') { total += (current || 1) * 100; current = 0; }
    else return null;
  }
  return total + current;
}

function extractVoiceFields(transcript, cropNames = []) {
  const fields = {};
  const crop = [...cropNames].sort((a, b) => b.length - a.length).find((name) => transcript.includes(name));
  if (crop) fields.cropName = crop;
  const area = transcript.match(/(\d+(?:\.\d+)?|[零一二两三四五六七八九十百点半]+)\s*亩/);
  if (area) {
    const value = chineseNumber(area[1]);
    if (Number.isFinite(value) && value > 0) fields.areaMu = value;
  }
  const problemTerms = ['缺水', '干旱', '积水', '虫害', '病害', '叶片发黄', '黄叶', '倒伏', '长势不好', '土壤板结', '低温', '冻害'];
  const problems = problemTerms.filter((term) => transcript.includes(term));
  if (problems.length) fields.problemDescription = [...new Set(problems)].join('、');
  return fields;
}

async function recognizeVoice(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new RecognitionError('录音文件为空', 400);
  const fetchImpl = options.fetchImpl || global.fetch;
  const token = await getAccessToken(fetchImpl, options.now || Date.now());
  const payload = {
    format: options.format || 'm4a',
    rate: 16000,
    channel: 1,
    cuid: String(options.cuid || 'agriculture-miniprogram').slice(0, 60),
    token,
    dev_pid: config.baiduAi.asrDevPid,
    speech: buffer.toString('base64'),
    len: buffer.length
  };
  let response;
  try {
    response = await fetchImpl(ASR_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new RecognitionError('无法连接百度短语音识别服务');
  }
  const data = await parseResponse(response, '百度短语音识别服务');
  if (data.err_no !== 0 || !Array.isArray(data.result) || !data.result[0]) {
    throw new RecognitionError(`语音识别失败：${data.err_msg || '未识别到有效语音'}`, data.err_no === 3301 ? 422 : 502);
  }
  return { transcript: data.result[0], requestId: data.sn || null };
}

async function recognizePlant(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new RecognitionError('图片文件为空', 400);
  const fetchImpl = options.fetchImpl || global.fetch;
  const token = await getAccessToken(fetchImpl, options.now || Date.now());
  const body = new URLSearchParams({ image: buffer.toString('base64'), baike_num: '1' });
  let response;
  try {
    response = await fetchImpl(`${PLANT_URL}?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(30_000)
    });
  } catch (error) {
    throw new RecognitionError('无法连接百度植物识别服务');
  }
  const data = await parseResponse(response, '百度植物识别服务');
  if (data.error_code) throw new RecognitionError(`植物识别失败：${data.error_msg || data.error_code}`);
  if (!Array.isArray(data.result) || !data.result.length) throw new RecognitionError('图片中未识别到植物', 422);
  const alternatives = data.result.slice(0, 3).map((item) => ({
    name: String(item.name || '').trim(),
    score: Math.round(Number(item.score || 0) * 10_000) / 100
  })).filter((item) => item.name);
  if (!alternatives.length) throw new RecognitionError('图片中未识别到有效植物名称', 422);
  return {
    top: alternatives[0],
    alternatives,
    description: data.result[0].baike_info && data.result[0].baike_info.description
      ? String(data.result[0].baike_info.description).slice(0, 180)
      : '',
    requestId: data.log_id ? String(data.log_id) : null
  };
}

function resetTokenCache() {
  tokenCache = null;
}

module.exports = {
  RecognitionError,
  isConfigured,
  getAccessToken,
  extractVoiceFields,
  recognizeVoice,
  recognizePlant,
  resetTokenCache
};
