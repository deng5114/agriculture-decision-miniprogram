const cache = new Map();
const TTL = 10 * 60 * 1000;
function fault(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }
function coordinates(latitude, longitude) {
  const valid = (v, limit) => ['number', 'string'].includes(typeof v) && String(v).trim() !== '' && Number.isFinite(Number(v)) && Math.abs(Number(v)) <= limit;
  if (!valid(latitude, 90) || !valid(longitude, 180)) throw fault(400, '请先为地块设置有效的 WGS84 经纬度');
  return { latitude: Number(latitude), longitude: Number(longitude) };
}
function chinaDate(now) { return new Date(now.getTime() + 8 * 3600000).toISOString().slice(0, 10); }
function dateOffset(date, days) { return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10); }
async function fetchOnceOrRetry(url, fetchImpl = fetch) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try { return await fetchImpl(url, { signal: AbortSignal.timeout(12000) }); }
    catch (error) { if (attempt === 1) throw error; }
  }
}
function normalize(raw, location, now = new Date()) {
  const today = chinaDate(now);
  const daily = raw?.daily;
  const keys = ['precipitation_sum', 'rain_sum', 'showers_sum', 'temperature_2m_min', 'temperature_2m_max'];
  if (!raw || raw.error || raw.timezone !== 'Asia/Shanghai' || !Array.isArray(daily?.time) || keys.some(k => !Array.isArray(daily[k]) || daily[k].length !== daily.time.length)) throw fault(502, '天气服务返回不完整数据，请稍后重试');
  const days = [];
  for (let offset = -7; offset <= 2; offset++) {
    const date = dateOffset(today, offset);
    const i = daily.time.indexOf(date);
    if (i < 0 || keys.some(k => typeof daily[k][i] !== 'number' || !Number.isFinite(daily[k][i]))) throw fault(502, '天气数据存在缺失，暂不能判断风险');
    const [precipitation, rain, showers, minTemperature, maxTemperature] = keys.map(k => daily[k][i]);
    if (Math.min(precipitation, rain, showers) < 0 || minTemperature > maxTemperature) throw fault(502, '天气数据异常，请稍后重试');
    days.push({ date, precipitation, rainfall: Math.round((rain + showers) * 10) / 10, minTemperature, maxTemperature });
  }
  const history = days.slice(0, 7);
  let dryDays = 0;
  for (const day of [...history].reverse()) { if (day.precipitation >= 1) break; dryDays++; }
  return {
    source: 'Open-Meteo', sourceUrl: 'https://open-meteo.com/', isMock: false,
    fetchedAt: now.toISOString(), timezone: 'Asia/Shanghai', location,
    gridLocation: { latitude: raw.latitude, longitude: raw.longitude },
    forecast: days.slice(7), history, dryDays, dryDaysCapped: dryDays === 7,
    historyNote: '过去7个完整日的模型天气数据，并非地面实测；日降水不足1毫米计入连续少雨天数，最多统计7天。',
    ruleNote: '系统规则生成的农业风险提示，不是气象部门发布的预警。'
  };
}
async function getWeather(latitude, longitude, { fetchImpl = fetch, now = new Date() } = {}) {
  const location = coordinates(latitude, longitude);
  const key = `${location.latitude},${location.longitude},${chinaDate(now)}`;
  const hit = cache.get(key);
  if (hit && now.getTime() - hit.time < TTL) return { ...hit.data, cached: true };
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({ ...location, daily: 'precipitation_sum,rain_sum,showers_sum,temperature_2m_min,temperature_2m_max', past_days: '7', forecast_days: '3', timezone: 'Asia/Shanghai', temperature_unit: 'celsius', precipitation_unit: 'mm' }).toString();
  let raw;
  try {
    const response = await fetchOnceOrRetry(url, fetchImpl);
    if (!response.ok) throw fault(502, response.status === 429 ? '天气服务请求较多，请稍后重试' : '天气服务暂不可用，请稍后重试');
    raw = await response.json();
  } catch (error) {
    if (error.statusCode) throw error;
    throw fault(503, '天气服务连接失败或超时，请检查网络后重试');
  }
  const data = normalize(raw, location, now);
  if (cache.size >= 200) cache.delete(cache.keys().next().value);
  cache.set(key, { time: now.getTime(), data });
  return { ...data, cached: false };
}
async function searchLocations(name) {
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 80) throw fault(400, '请输入至少两个字的城市或乡镇名称');
  const url = new URL('https://geocoding-api.open-meteo.com/v1/search');
  url.search = new URLSearchParams({ name: name.trim(), count: '8', language: 'zh', format: 'json' }).toString();
  try {
    const response = await fetchOnceOrRetry(url);
    if (!response.ok) throw new Error('upstream');
    const raw = await response.json();
    if (raw.error || (raw.results !== undefined && !Array.isArray(raw.results))) throw new Error('invalid');
    return (raw.results || []).map(row => ({ id: row.id, ...coordinates(row.latitude, row.longitude), label: [row.name, row.admin2, row.admin1, row.country].filter(Boolean).join(' · ') }));
  } catch (error) { throw fault(503, '地点搜索暂不可用，可重试或手动填写 WGS84 经纬度'); }
}
module.exports = { getWeather, normalize, coordinates, fault, searchLocations };
