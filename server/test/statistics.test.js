const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { buildRegionStatistics } = require('../src/services/statistics');
const { presentStatistics } = require('../../miniprogram/utils/statistics');

test('面积按唯一地块统计，同一地块的重复记录不重复累加', () => {
  const rows = [
    { record_id: 1, crop_name: '番茄', budget: '100', plot_id: 10, area_mu: '8', region: '东区' },
    { record_id: 2, crop_name: '番茄', budget: '200', plot_id: 10, area_mu: '8', region: '东区' },
    { record_id: 3, crop_name: '玉米', budget: '300', plot_id: 10, area_mu: '8', region: '东区' },
    { record_id: 4, crop_name: '番茄', budget: '50', plot_id: 11, area_mu: '5', region: '西区' }
  ];
  const stats = buildRegionStatistics(rows);
  assert.deepEqual(stats.summary, {
    record_count: 4,
    unique_plot_count: 2,
    total_area_mu: 13,
    total_budget: 650
  });
  assert.deepEqual(stats.byCrop[0], {
    crop_name: '番茄', record_count: 3, unique_plot_count: 2, total_area_mu: 13
  });
  assert.deepEqual(stats.byCrop[1], {
    crop_name: '玉米', record_count: 1, unique_plot_count: 1, total_area_mu: 8
  });
  assert.equal(stats.byRegion.find((item) => item.region === '东区').total_area_mu, 8);
});

test('空数据返回零值，前端图表百分比和格式正确', () => {
  const empty = buildRegionStatistics([]);
  assert.equal(empty.summary.total_area_mu, 0);
  assert.deepEqual(empty.byCrop, []);
  const view = presentStatistics(buildRegionStatistics([
    { crop_name: '番茄', budget: 100, plot_id: 1, area_mu: 10, region: '甲区' },
    { crop_name: '玉米', budget: 100, plot_id: 2, area_mu: 5, region: '乙区' }
  ]), 'area');
  assert.equal(view.cropChart[0].chartPercent, 100);
  assert.equal(view.cropChart[1].chartPercent, 50);
  assert.equal(view.summary.areaText, '15');
});

test('HTTP 与数据库：管理员统计排除未审核记录并正确去重面积', async () => {
  const app = require('../src/app');
  const { pool } = require('../src/db');
  const originalExecute = pool.execute;
  let connection;
  let server;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    pool.execute = connection.execute.bind(connection);
    const suffix = Date.now();
    const region = `统计测试区-${suffix}`;
    const [user] = await connection.execute(
      "INSERT INTO users (openid,nickname,role,region) VALUES (?, '统计测试','farmer',?)",
      [`statistics-${suffix}`, region]
    );
    const [plot] = await connection.execute(
      "INSERT INTO plots (user_id,name,area_mu,soil_type,region) VALUES (?, '去重地块',6.5,'壤土',?)",
      [user.insertId, region]
    );
    const records = [
      ['番茄', 100, 'approved'],
      ['番茄', 200, 'approved'],
      ['玉米', 300, 'approved'],
      ['辣椒', 999, 'pending']
    ];
    for (const [crop, budget, status] of records) {
      await connection.execute(
        `INSERT INTO plant_records (plot_id,user_id,crop_name,budget,status)
         VALUES (?, ?, ?, ?, ?)`,
        [plot.insertId, user.insertId, crop, budget, status]
      );
    }
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/api/statistics/region?region=${encodeURIComponent(region)}`;
    const response = await fetch(url, { headers: { 'x-demo-user-id': '3', 'x-demo-role': 'admin' } });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.summary.record_count, 3);
    assert.equal(body.data.summary.unique_plot_count, 1);
    assert.equal(body.data.summary.total_area_mu, 6.5);
    assert.equal(body.data.summary.total_budget, 600);
    assert.equal(body.data.byCrop.find((item) => item.crop_name === '番茄').total_area_mu, 6.5);
    assert.ok(!body.data.byCrop.some((item) => item.crop_name === '辣椒'));

    const forbidden = await fetch(url, {
      headers: { 'x-demo-user-id': String(user.insertId), 'x-demo-role': 'farmer' }
    });
    assert.equal(forbidden.status, 403);
  } finally {
    if (server) {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
    pool.execute = originalExecute;
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    await pool.end();
  }
});
