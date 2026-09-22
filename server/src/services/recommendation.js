const { pool } = require('../db');

const EXPERIENCE_SCORE = {
  初级: 70,
  中等: 85,
  熟练: 100
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function soilScore(crop, soilType) {
  const soils = crop.suitable_soil.split(',').map((item) => item.trim());
  return soils.includes(soilType) ? 95 : 45;
}

function climateScore(crop, temperature) {
  if (temperature === null || temperature === undefined || temperature === '') return 60;
  const value = Number(temperature);
  const min = Number(crop.min_temperature);
  const max = Number(crop.max_temperature);
  if (value < min || value > max) return 0;
  const distance = Math.min(value - min, max - value);
  const range = Math.max((max - min) / 2, 1);
  return clamp(70 + (distance / range) * 30);
}

function costScore(crop, budget) {
  if (budget === null || budget === undefined || budget === '') return 60;
  const expectedCost = Number(crop.cost_level) * 500;
  return clamp((Number(budget) / expectedCost) * 100);
}

function marketScore(rows) {
  if (rows.length < 2) return { score: 60, risk: '市场数据不足，建议结合当地行情进一步确认' };
  const prices = rows.map((row) => Number(row.average_price));
  const average = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  const variation = average ? (Math.max(...prices) - Math.min(...prices)) / average : 1;
  if (variation > 0.5) return { score: 40, risk: '近年价格波动较大' };
  if (variation > 0.25) return { score: 65, risk: '近年价格存在一定波动' };
  return { score: 90, risk: null };
}

function experienceScore(crop, experienceLevel) {
  const userScore = EXPERIENCE_SCORE[experienceLevel] || 60;
  if (!crop.experience_level || crop.experience_level === experienceLevel) return userScore;
  if (crop.experience_level === '初级' && userScore >= 70) return userScore;
  return clamp(userScore - 15);
}

async function recommend({ plotId, userId, temperature = null, budget = null, experienceLevel = null }) {
  const [plots] = await pool.execute(
    'SELECT id, soil_type, region FROM plots WHERE id = ? AND user_id = ?',
    [plotId, userId]
  );
  if (!plots.length) {
    const error = new Error('地块不存在或无权访问');
    error.statusCode = 404;
    throw error;
  }

  const plot = plots[0];
  const [crops] = await pool.execute('SELECT * FROM crops WHERE enabled = TRUE');
  const results = [];

  for (const crop of crops) {
    const soil = soilScore(crop, plot.soil_type);
    const climate = climateScore(crop, temperature);
    if (soil < 50 || climate === 0) continue;

    const [marketRows] = await pool.execute(
      `SELECT data_year, average_price FROM market_data
       WHERE crop_name = ? AND region = ?
       ORDER BY data_year DESC LIMIT 5`,
      [crop.name, plot.region]
    );
    const market = marketScore(marketRows);
    const experience = experienceScore(crop, experienceLevel);
    const cost = costScore(crop, budget);
    const score = clamp(
      0.30 * soil +
      0.25 * climate +
      0.20 * market.score +
      0.15 * experience +
      0.10 * cost
    );
    const risks = [];
    if (market.risk) risks.push(market.risk);
    if (cost < 60) risks.push('预计成本可能超过当前预算');
    if (experience < 70) risks.push('该作物对种植经验要求较高');

    results.push({
      cropName: crop.name,
      score,
      dimensions: { soil, climate, market: market.score, experience, cost },
      reasons: [
        `土壤适配度 ${soil} 分`,
        `气候适配度 ${climate} 分`,
        `市场稳定度 ${market.score} 分`
      ],
      risks
    });
  }

  return results.sort((a, b) => b.score - a.score).slice(0, 3);
}

module.exports = { recommend };
