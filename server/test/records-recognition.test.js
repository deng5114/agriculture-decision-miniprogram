const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('表单：真实识别候选确认前不修改；失败和取消保留原值；重复点击只保存一次', async () => {
  let page;
  let response;
  let requests = 0;
  let pendingResolve;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../miniprogram/pages/record-edit/index.js'), 'utf8'), {
    Page: value => { page = value; },
    require: () => ({ request: async () => { requests++; return response; }, uploadFile: async () => response }),
    wx: { showToast() {} }, console, setInterval, clearInterval
  });
  page.setData = (update) => {
    for (const [key, value] of Object.entries(update)) {
      if (key.startsWith('candidate.')) page.data.candidate[key.split('.')[1]] = value;
      else page.data[key] = value;
    }
  };
  page.data.cropName = '小麦';
  response = {
    recognized: true,
    isMock: false,
    provider: '真实服务',
    transcript: '种两亩番茄',
    fields: { cropName: '番茄', areaMu: 2 }
  };
  page.applyRecognitionResult(response);
  assert.equal(page.data.cropName, '小麦');
  assert.equal(page.data.candidate.cropName, '番茄');
  page.cancelCandidate();
  assert.equal(page.data.cropName, '小麦');
  page.applyRecognitionResult(response);
  page.confirmCandidate();
  assert.equal(page.data.cropName, '番茄');
  page.applyRecognitionResult({ recognized: false, message: '请重试', fields: {} });
  assert.equal(page.data.cropName, '番茄');
  assert.equal(page.data.candidate, null);
  page.data.plots = [{ id: 1 }];
  response = new Promise(resolve => { pendingResolve = resolve; });
  const before = requests;
  const saving = page.save({ currentTarget: { dataset: { action: 'save' } } });
  await page.save({ currentTarget: { dataset: { action: 'save' } } });
  assert.equal(requests, before + 1);
  pendingResolve({ id: 99 });
  await saving;
  assert.equal(page.data.id, 99);
});

test('HTTP 与 MySQL：真实文件上传识别及种植记录全流程（云端响应模拟、事务回滚）', async () => {
  const config = require('../src/config');
  const recognition = require('../src/services/recognition');
  const app = require('../src/app');
  const { pool } = require('../src/db');
  const originalExecute = pool.execute;
  const originalFetch = global.fetch;
  const originalApiKey = config.baiduAi.apiKey;
  const originalSecretKey = config.baiduAi.secretKey;
  let connection;
  let server;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    pool.execute = connection.execute.bind(connection);
    const [user] = await connection.execute("INSERT INTO users (openid, nickname, role, region) VALUES (?, '自动测试', 'farmer', '测试区')", ['test-' + Date.now()]);
    const [plot] = await connection.execute("INSERT INTO plots (user_id, name, area_mu, soil_type, region) VALUES (?, '测试地块', 2, '壤土', '测试区')", [user.insertId]);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api`;
    async function call(url, method = 'GET', body, userId = user.insertId) {
      const headers = { 'content-type': 'application/json' };
      if (userId != null) Object.assign(headers, { 'x-demo-user-id': String(userId), 'x-demo-role': 'farmer' });
      const result = await originalFetch(base + url, { method, headers, body: body ? JSON.stringify(body) : undefined });
      return { status: result.status, ...(await result.json()) };
    }
    async function upload(url, bytes, type, formData = {}, userId = user.insertId) {
      const body = new FormData();
      body.append('file', new Blob([bytes], { type }), type.startsWith('image/') ? 'plant.jpg' : 'voice.m4a');
      Object.entries(formData).forEach(([key, value]) => body.append(key, value));
      const headers = userId == null ? {} : { 'x-demo-user-id': String(userId), 'x-demo-role': 'farmer' };
      const result = await originalFetch(base + url, { method: 'POST', headers, body });
      return { status: result.status, ...(await result.json()) };
    }

    config.baiduAi.apiKey = '';
    config.baiduAi.secretKey = '';
    recognition.resetTokenCache();
    assert.equal((await call('/recognition/status')).data.configured, false);
    assert.equal((await upload('/recognition/voice', Buffer.from('voice'), 'audio/mp4', { format: 'm4a' }, null)).status, 401);
    assert.equal((await upload('/recognition/voice', Buffer.from('voice'), 'audio/mp4', { format: 'm4a' })).status, 503);

    config.baiduAi.apiKey = 'test-api-key';
    config.baiduAi.secretKey = 'test-secret-key';
    recognition.resetTokenCache();
    let tokenCalls = 0;
    global.fetch = async (url) => {
      const address = String(url);
      if (address.includes('/oauth/2.0/token')) {
        tokenCalls += 1;
        return { ok: true, status: 200, json: async () => ({ access_token: 'test-token', expires_in: 3600 }) };
      }
      if (address.includes('vop.baidu.com/server_api')) {
        return { ok: true, status: 200, json: async () => ({ err_no: 0, err_msg: 'success.', sn: 'voice-request', result: ['种两亩番茄，地块缺水'] }) };
      }
      if (address.includes('/image-classify/v1/plant')) {
        return { ok: true, status: 200, json: async () => ({ log_id: 123, result: [
          { name: '玉米', score: 0.93, baike_info: { description: '玉米是一年生草本植物。' } },
          { name: '高粱', score: 0.05 }
        ] }) };
      }
      throw new Error(`unexpected cloud URL: ${address}`);
    };
    assert.equal((await call('/recognition/status')).data.configured, true);
    const voice = await upload('/recognition/voice', Buffer.from('real-voice-bytes'), 'audio/mp4', { format: 'm4a' });
    assert.equal(voice.status, 200);
    assert.equal(voice.data.isMock, false);
    assert.equal(voice.data.transcript, '种两亩番茄，地块缺水');
    assert.equal(voice.data.fields.cropName, '番茄');
    assert.equal(voice.data.fields.areaMu, 2);
    assert.equal(voice.data.fields.problemDescription, '缺水');
    const image = await upload('/recognition/image', Buffer.from('real-image-bytes'), 'image/jpeg');
    assert.equal(image.status, 200);
    assert.equal(image.data.isMock, false);
    assert.equal(image.data.fields.cropName, '玉米');
    assert.equal(image.data.alternatives[0].score, 93);
    assert.equal(tokenCalls, 1);

    const body = { plotId: plot.insertId, cropName: '番茄', budget: 1200, plantingDate: '2026-09-22', experienceLevel: '初级' };
    for (const budget of ['abc', -1, '', null]) assert.equal((await call('/plant-records', 'POST', { ...body, budget })).status, 400);
    assert.equal((await call('/plant-records', 'POST', { ...body, plantingDate: '2026-02-30' })).status, 400);
    const created = await call('/plant-records', 'POST', body);
    assert.equal(created.status, 201);
    const url = '/plant-records/' + created.data.id;
    assert.equal(created.data.planting_date, '2026-09-22');
    assert.equal((await call(url, 'GET', undefined, 0)).status, 404);
    assert.equal((await call(url, 'PUT', { ...body, cropName: '玉米' })).data.crop_name, '玉米');
    assert.equal((await call(url + '/submit', 'POST')).data.status, 'pending');
    assert.equal((await call(url + '/submit', 'POST')).status, 400);
    assert.equal((await call(url, 'PUT', body)).status, 400);
    await connection.execute("UPDATE plant_records SET status='rejected', review_comment='请补充预算' WHERE id=?", [created.data.id]);
    const edited = await call(url, 'PUT', body);
    assert.equal(edited.data.status, 'draft');
    assert.equal(edited.data.review_comment, '请补充预算');
    assert.equal((await call(url + '/submit', 'POST')).data.status, 'pending');
    assert.equal((await call('/plant-records')).data.length, 1);
  } finally {
    global.fetch = originalFetch;
    config.baiduAi.apiKey = originalApiKey;
    config.baiduAi.secretKey = originalSecretKey;
    recognition.resetTokenCache();
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    pool.execute = originalExecute;
    if (connection) { await connection.rollback(); connection.release(); }
    await pool.end();
  }
});
