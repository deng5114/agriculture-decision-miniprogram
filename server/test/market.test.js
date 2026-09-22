const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { analyzeMarketRows, changePercent } = require('../src/services/market-analysis');
const { presentRows, presentAnalysis } = require('../../miniprogram/utils/market');

function row(year, price, output = 100, area = 50) {
  return {
    id: year,
    crop_name: '测试作物',
    region: '测试区',
    data_year: year,
    average_price: String(price),
    output_ton: String(output),
    planting_area_mu: String(area),
    source: '测试数据',
    is_mock: 1
  };
}

test('计算相邻年度同比、首末年趋势和价格波动', () => {
  const result = analyzeMarketRows([row(2024, 6, 120, 55), row(2022, 4), row(2023, 5, 110, 52)]);
  assert.deepEqual(result.rows.map((item) => item.data_year), [2022, 2023, 2024]);
  assert.equal(result.rows[0].yearOnYear.pricePct, null);
  assert.equal(result.rows[1].yearOnYear.pricePct, 25);
  assert.equal(result.rows[2].yearOnYear.outputPct, 9.09);
  assert.equal(result.analysis.summary.price.overallChangePct, 50);
  assert.equal(result.analysis.summary.price.trend, 'up');
  assert.equal(result.analysis.summary.price.average, 5);
  assert.equal(result.analysis.summary.price.maximumYear, 2024);
});

test('缺失年份不伪造同比，零基数不计算百分比，单年数据不判断趋势', () => {
  const gap = analyzeMarketRows([row(2022, 0), row(2024, 5)]);
  assert.equal(gap.rows[1].yearOnYear.comparable, false);
  assert.equal(gap.rows[1].yearOnYear.pricePct, null);
  assert.equal(changePercent(5, 0), null);
  const single = analyzeMarketRows([row(2024, 5)]);
  assert.equal(single.analysis.summary.price.overallChangePct, null);
  assert.equal(single.analysis.summary.price.trend, 'insufficient');
});

test('前端展示层正确格式化同比和分析结果', () => {
  const result = analyzeMarketRows([row(2022, 4), row(2023, 3.5)]);
  const rows = presentRows(result.rows);
  const analysis = presentAnalysis(result.analysis);
  assert.equal(rows[1].priceChangeText, '-12.5%');
  assert.equal(rows[1].priceChangeClass, 'change-down');
  assert.equal(analysis.overallChangeText, '-12.5%');
});

test('HTTP 与数据库：同年记录聚合，并拒绝无效年份', async () => {
  const app = require('../src/app');
  const { pool } = require('../src/db');
  const originalExecute = pool.execute;
  let connection;
  let server;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();
    pool.execute = connection.execute.bind(connection);
    const crop = `行情测试-${Date.now()}`;
    const values = [
      [crop, '测试区', 2023, 4, 100, 50, '来源甲', 1],
      [crop, '测试区', 2023, 6, 120, 54, '来源乙', 1],
      [crop, '测试区', 2024, 6, 132, 55, '来源甲', 1]
    ];
    for (const data of values) {
      await connection.execute(
        `INSERT INTO market_data
         (crop_name, region, data_year, average_price, output_ton, planting_area_mu, source, is_mock)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        data
      );
    }
    server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${server.address().port}/api/market-data`;
    const headers = { 'x-demo-user-id': '1', 'x-demo-role': 'farmer' };
    const response = await fetch(`${base}?cropName=${encodeURIComponent(crop)}&region=${encodeURIComponent('测试区')}&startYear=2023&endYear=2024`, { headers });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.data.rows.length, 2);
    assert.equal(body.data.rows[0].average_price, 5);
    assert.equal(body.data.rows[0].output_ton, 110);
    assert.equal(body.data.rows[1].yearOnYear.pricePct, 20);
    assert.match(body.data.rows[0].source, /来源甲/);
    assert.match(body.data.rows[0].source, /来源乙/);

    const invalid = await fetch(`${base}?cropName=x&region=y&startYear=2025&endYear=2024`, { headers });
    assert.equal(invalid.status, 400);
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
