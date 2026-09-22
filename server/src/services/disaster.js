const { pool } = require('../db');

function levelByValue(value, warning, danger) {
  if (value >= danger) return 'high';
  if (value >= warning) return 'medium';
  return null;
}

async function getDisasterAlerts({ plotId, userId, cropName, rainfall = 0, dryDays = 0, minTemperature = null }) {
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
  const [crops] = await pool.execute('SELECT * FROM crops WHERE name = ? AND enabled = TRUE', [cropName]);
  if (!crops.length) {
    const error = new Error('作物不存在，请先选择有效作物');
    error.statusCode = 400;
    throw error;
  }

  const crop = crops[0];
  const [rules] = await pool.execute(
    `SELECT disaster_type, trigger_condition, impact, measures, source
     FROM disaster_rules WHERE enabled = TRUE`
  );
  const ruleMap = Object.fromEntries(rules.map((rule) => [rule.disaster_type, rule]));
  const alerts = [];

  const rainLevel = levelByValue(Number(rainfall), 50, 80);
  if (rainLevel) {
    const rule = ruleMap.rainstorm;
    alerts.push({
      type: 'rainstorm',
      level: rainLevel,
      title: rainLevel === 'high' ? '暴雨高风险' : '暴雨风险',
      trigger: `预计降水量 ${Number(rainfall)} 毫米，达到预警阈值`,
      impact: rule ? rule.impact : '可能造成积水和作物倒伏',
      measures: rule ? rule.measures : '及时排水、加固设施、避免积水',
      source: rule ? rule.source : '课程演示规则'
    });
  }

  const droughtLevel = Number(dryDays) >= 7 && Number(rainfall) < 10 ? 'high'
    : Number(dryDays) >= 3 && Number(rainfall) < 20 ? 'medium' : null;
  if (droughtLevel) {
    const rule = ruleMap.drought;
    alerts.push({
      type: 'drought',
      level: droughtLevel,
      title: droughtLevel === 'high' ? '干旱高风险' : '干旱风险',
      trigger: `连续 ${Number(dryDays)} 天有效降水不足，当前温度条件可能加剧缺水`,
      impact: rule ? rule.impact : '作物缺水，生长速度下降',
      measures: rule ? rule.measures : '分时灌溉、覆盖保墒、节水提示',
      source: rule ? rule.source : '课程演示规则'
    });
  }

  const cropMinTemperature = Number(crop.min_temperature);
  if (minTemperature !== null && minTemperature !== '' && Number(minTemperature) < cropMinTemperature) {
    const difference = cropMinTemperature - Number(minTemperature);
    const frostLevel = difference >= 8 ? 'high' : 'medium';
    const rule = ruleMap.frost;
    alerts.push({
      type: 'frost',
      level: frostLevel,
      title: frostLevel === 'high' ? '霜冻高风险' : '霜冻风险',
      trigger: `最低温度 ${Number(minTemperature)}℃，低于${crop.name}最低耐受温度 ${cropMinTemperature}℃`,
      impact: rule ? rule.impact : '幼苗冻伤，生长受阻',
      measures: rule ? rule.measures : '覆盖保温、检查幼苗、联系农技人员',
      source: rule ? rule.source : '课程演示规则'
    });
  }

  return {
    plotId: plot.id,
    region: plot.region,
    cropName: crop.name,
    weather: {
      rainfall: Number(rainfall),
      dryDays: Number(dryDays),
      minTemperature: minTemperature === null || minTemperature === '' ? null : Number(minTemperature)
    },
    alerts,
    status: alerts.length ? 'warning' : 'normal'
  };
}

module.exports = { getDisasterAlerts };
