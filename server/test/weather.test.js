const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { normalize, coordinates, getWeather } = require('../src/services/weather');
const { evaluate } = require('../src/services/disaster');
function fixture(now = new Date('2026-09-22T08:00:00Z')) {
  const start = Date.parse(new Date(+now + 8 * 3600000).toISOString().slice(0, 10) + 'T00:00:00Z');
  return { latitude: 30.6, longitude: 114.3, timezone: 'Asia/Shanghai', daily: {
    time: Array.from({ length: 10 }, (_, i) => new Date(start + (i - 7) * 86400000).toISOString().slice(0, 10)),
    precipitation_sum: Array(10).fill(0), rain_sum: Array(10).fill(0), showers_sum: Array(10).fill(0),
    temperature_2m_min: Array(10).fill(20), temperature_2m_max: Array(10).fill(32)
  } };
}
test('坐标拒绝空值和非法值，零坐标合法', () => {
  for (const value of [null, '', ' ', 'abc', Infinity, true, [], 91]) assert.throws(() => coordinates(value, 110));
  assert.deepEqual(coordinates(0, 0), { latitude: 0, longitude: 0 });
});
test('缺失天气不变成零；北京时间日期；历史仅统计完整日', () => {
  const now = new Date('2026-09-21T17:00:00Z');
  const raw = fixture(now);
  const weather = normalize(raw, {}, now);
  assert.equal(weather.forecast[0].date, '2026-09-22');
  assert.equal(weather.history.at(-1).date, '2026-09-21');
  assert.equal(weather.dryDays, 7);
  raw.daily.precipitation_sum[5] = 2;
  assert.equal(normalize(raw, {}, now).dryDays, 1);
  raw.daily.temperature_2m_min[9] = null;
  assert.throws(() => normalize(raw, {}, now), /缺失/);
  assert.throws(() => normalize(null, {}, now), /不完整/);
});
test('降雨、干旱、低温与霜冻规则分别触发', () => {
  const now = new Date('2026-09-22T08:00:00Z');
  const raw = fixture(now);
  raw.daily.rain_sum[8] = 60;
  raw.daily.precipitation_sum[8] = 60;
  raw.daily.temperature_2m_min[7] = 10;
  raw.daily.temperature_2m_min[9] = -3;
  const alerts = evaluate(normalize(raw, {}, now), { name: '番茄', min_temperature: 15 });
  assert.deepEqual(new Set(alerts.map(a => a.type)), new Set(['cold', 'rainstorm', 'frost', 'drought']));
  assert.equal(alerts.find(a => a.type === 'frost').date, '2026-09-24');
  raw.daily.temperature_2m_max[7] = 25;
  assert.ok(!evaluate(normalize(raw, {}, now), { name: '番茄' }).some(a => a.type === 'drought'));
});
test('网络错误、限流以及缓存有效期', async () => {
  const now = new Date('2026-09-22T08:00:00Z');
  let calls = 0;
  const fetchImpl = async () => { calls++; return { ok: true, json: async () => fixture(now) }; };
  assert.equal((await getWeather(31, 113, { now, fetchImpl })).cached, false);
  assert.equal((await getWeather(31, 113, { now, fetchImpl })).cached, true);
  assert.equal(calls, 1);
  await assert.rejects(getWeather(31, 113, { now: new Date(+now + 600001), fetchImpl: async () => { throw new Error('offline'); } }), /连接失败/);
  await assert.rejects(getWeather(32, 113, { now, fetchImpl: async () => ({ ok: false, status: 429 }) }), /请求较多/);
});
test('HTTP 与数据库：位置归属、无坐标错误、天气接入（LIVE_WEATHER=1 使用真实服务）', async () => {
  const app = require('../src/app');
  const { pool } = require('../src/db');
  const originalExecute = pool.execute;
  const originalFetch = global.fetch;
  let connection, server;
  const live = process.env.LIVE_WEATHER === '1';
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    pool.execute = connection.execute.bind(connection);
    const [u] = await connection.execute("INSERT INTO users (openid,nickname,role,region) VALUES (?, '天气测试','farmer','测试区')", ['weather-' + Date.now()]);
    const [p] = await connection.execute("INSERT INTO plots(user_id,name,area_mu,soil_type,region) VALUES (?, '天气测试',2,'壤土','测试区')", [u.insertId]);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function call(url, method = 'GET', body, user = u.insertId) {
      const response = await originalFetch(base + url, { method, headers: { 'content-type': 'application/json', 'x-demo-user-id': String(user), 'x-demo-role': 'farmer' }, body: body ? JSON.stringify(body) : undefined });
      return { status: response.status, ...(await response.json()) };
    }
    if (!live) global.fetch = async () => ({ ok: true, json: async () => fixture(new Date()) });
    const query = `/disaster-alerts?plotId=${p.insertId}&cropName=${encodeURIComponent('番茄')}`;
    assert.equal((await call(query)).status, 400);
    assert.equal((await call(`/plots/${p.insertId}/location`, 'PUT', { latitude: 30.59, longitude: 114.30 }, 0)).status, 404);
    assert.equal((await call(`/plots/${p.insertId}/location`, 'PUT', { latitude: '', longitude: 114 })).status, 400);
    assert.equal((await call(`/plots/${p.insertId}/location`, 'PUT', { latitude: 30.59, longitude: 114.30 })).status, 200);
    const result = await call(query + '&rainfall=999');
    assert.equal(result.status, 200);
    assert.equal(result.data.weather.isMock, false);
    assert.equal(result.data.weather.forecast.length, 3);
    assert.ok(result.data.weather.forecast.every(d => d.rainfall !== 999));
    assert.equal(result.data.weather.source, 'Open-Meteo');
    if (live) {
      console.log('LIVE WEATHER', JSON.stringify({ source: result.data.weather.source, fetchedAt: result.data.weather.fetchedAt, forecast: result.data.weather.forecast }));
      const search = await call('/disaster-alerts/locations?name=Wuhan');
      assert.equal(search.status, 200);
      assert.ok(search.data.length > 0);
      console.log('LIVE LOCATION', search.data[0].label);
    } else {
      await call(`/plots/${p.insertId}/location`, 'PUT', { latitude: 31.9, longitude: 114.30 });
      global.fetch = async () => { throw new Error('offline'); };
      const unavailable = await call(query);
      assert.equal(unavailable.status, 503);
      assert.equal(unavailable.data, null);
    }
  } finally {
    global.fetch = originalFetch;
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    pool.execute = originalExecute;
    if (connection) { await connection.rollback(); connection.release(); }
    await pool.end();
  }
});
