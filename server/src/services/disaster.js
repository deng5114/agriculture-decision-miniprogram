const { pool } = require('../db');
const { getWeather, fault } = require('./weather');
function evaluate(weather, crop) {
  const alerts = [];
  function add(day, type, level, title, trigger, impact, measures) {
    alerts.push({ id: `${day.date}-${type}`, date: day.date, type, level, title, trigger, impact, measures, source: 'Open-Meteo 天气数据 + 项目规则 weather-v2' });
  }
  for (const day of weather.forecast) {
    if (day.rainfall >= 50) add(day, 'rainstorm', day.rainfall >= 80 ? 'high' : 'medium', '强降雨风险', `当日预计降雨 ${day.rainfall} 毫米（北京时间日累计）`, '可能出现积水和倒伏', '检查排水沟、加固设施，关注当地气象预警');
    if (day.minTemperature <= 0) {
      add(day, 'frost', day.minTemperature <= -3 ? 'high' : 'medium', '霜冻风险提示', `预计日最低气温 ${day.minTemperature}℃，达到项目低温阈值`, `${crop.name}可能受到低温影响，实际风险还与品种和生育期有关`, '检查保温覆盖和幼苗，咨询农技人员');
    } else if (crop.min_temperature != null && day.minTemperature < Number(crop.min_temperature)) {
      add(day, 'cold', 'medium', '作物低温适配提醒', `预计最低 ${day.minTemperature}℃，低于作物库生长温度下限 ${crop.min_temperature}℃`, '该阈值是生长适配参考，不是霜冻耐受温度', '关注作物生育期与夜间温度，必要时咨询农技人员');
    }
  }
  const today = weather.forecast[0];
  if (weather.dryDays >= 3 && today.maxTemperature >= 30 && today.precipitation < 10) add(today, 'drought', weather.dryDays >= 7 ? 'high' : 'medium', '少雨高温缺水风险', `截至昨日连续${weather.dryDaysCapped ? '至少' : ''}${weather.dryDays}天日降水不足1毫米，今日最高 ${today.maxTemperature}℃`, '可能增加缺水风险；未结合土壤湿度，不作为干旱实况判定', '检查墒情，结合实际缺水程度安排节水灌溉');
  return alerts;
}
async function getDisasterAlerts({ plotId, userId, cropName }) {
  const [plots] = await pool.execute('SELECT id, region, latitude, longitude FROM plots WHERE id = ? AND user_id = ?', [plotId, userId]);
  if (!plots.length) throw fault(404, '地块不存在或无权访问');
  const [crops] = await pool.execute('SELECT name, min_temperature FROM crops WHERE name = ? AND enabled = TRUE', [cropName]);
  if (!crops.length) throw fault(400, '请选择作物库中有效的作物');
  const plot = plots[0];
  const weather = await getWeather(plot.latitude, plot.longitude);
  const alerts = evaluate(weather, crops[0]);
  return { plotId: plot.id, region: plot.region, cropName, weather, alerts, status: alerts.length ? 'warning' : 'normal', ruleVersion: 'weather-v2' };
}
module.exports = { getDisasterAlerts, evaluate };
