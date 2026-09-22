const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('表单：候选确认前不修改；失败和取消保留原值；重复点击只保存一次', async () => {
  let page;
  let response;
  let requests = 0;
  let pendingResolve;
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../../miniprogram/pages/record-edit/index.js'), 'utf8'), {
    Page: value => { page = value; },
    require: () => ({ request: async () => { requests++; return response; } }),
    wx: { showToast() {} }, console
  });
  page.setData = update => Object.assign(page.data, update);
  page.data.cropName = '小麦';
  response = { recognized: true, transcript: '种两亩番茄', fields: { cropName: '番茄', areaMu: 2 } };
  await page.recognize('voice', 'tomato');
  assert.equal(page.data.cropName, '小麦');
  page.cancelCandidate();
  assert.equal(page.data.cropName, '小麦');
  await page.recognize('voice', 'tomato');
  page.confirmCandidate();
  assert.equal(page.data.cropName, '番茄');
  response = { recognized: false, message: '请重试', fields: {} };
  await page.recognize('image', 'blurred');
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

test('HTTP 与 MySQL：模拟识别及种植记录全流程（事务回滚）', async () => {
  const app = require('../src/app');
  const { pool } = require('../src/db');
  let connection;
  let server;
  const original = pool.execute;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    // All route queries use an isolated, rollback-only fixture transaction.
    pool.execute = connection.execute.bind(connection);
    const [user] = await connection.execute("INSERT INTO users (openid, nickname, role, region) VALUES (?, '自动测试', 'farmer', '测试区')", ['test-' + Date.now()]);
    const [plot] = await connection.execute("INSERT INTO plots (user_id, name, area_mu, soil_type, region) VALUES (?, '测试地块', 2, '壤土', '测试区')", [user.insertId]);
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    async function call(url, method = 'GET', body, userId = user.insertId) {
      const headers = { 'content-type': 'application/json' };
      if (userId != null) Object.assign(headers, { 'x-demo-user-id': String(userId), 'x-demo-role': 'farmer' });
      const r = await fetch(`http://127.0.0.1:${server.address().port}/api${url}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, ...(await r.json()) };
    }
    assert.equal((await call('/recognition/voice', 'POST', { sample: 'tomato' }, null)).status, 401);
    const candidate = await call('/recognition/voice', 'POST', { sample: 'tomato' });
    assert.equal(candidate.data.fields.areaMu, 2);
    assert.equal(candidate.data.isMock, true);
    assert.equal(candidate.data.requiresConfirmation, true);
    assert.equal((await call('/recognition/image', 'POST', { sample: 'corn' })).data.fields.cropName, '玉米');
    assert.equal((await call('/recognition/image', 'POST', { sample: 'blurred' })).data.recognized, false);
    assert.equal((await call('/recognition/voice', 'POST', { sample: 'noise' })).data.recognized, false);
    assert.equal((await call('/recognition/image', 'POST', { sample: 'unknown' })).status, 400);
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
    // Seed a rejected state to verify the edit/resubmit contract independently of review routes.
    await connection.execute("UPDATE plant_records SET status='rejected', review_comment='请补充预算' WHERE id=?", [created.data.id]);
    const edited = await call(url, 'PUT', body);
    assert.equal(edited.data.status, 'draft');
    assert.equal(edited.data.review_comment, '请补充预算');
    assert.equal((await call(url + '/submit', 'POST')).data.status, 'pending');
    assert.equal((await call('/plant-records')).data.length, 1);
  } finally {
    if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    pool.execute = original;
    if (connection) { await connection.rollback(); connection.release(); }
    await pool.end();
  }
});
