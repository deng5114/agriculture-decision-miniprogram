const METRICS = [
  { key: 'average_price', resultKey: 'price', label: '价格', unit: '元/公斤' },
  { key: 'output_ton', resultKey: 'output', label: '产量', unit: '吨' },
  { key: 'planting_area_mu', resultKey: 'area', label: '种植面积', unit: '亩' }
];

function round(value, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function changePercent(current, previous) {
  const currentValue = Number(current);
  const previousValue = Number(previous);
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue) || previousValue === 0) return null;
  return round(((currentValue - previousValue) / Math.abs(previousValue)) * 100);
}

function direction(change) {
  if (change === null) return { code: 'insufficient', text: '数据不足' };
  if (change > 3) return { code: 'up', text: '上升' };
  if (change < -3) return { code: 'down', text: '下降' };
  return { code: 'stable', text: '基本平稳' };
}

function metricSummary(rows, metric) {
  if (!rows.length) return null;
  const values = rows.map((row) => row[metric.key]);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  const volatilityPct = average === 0 ? null : round((Math.sqrt(variance) / Math.abs(average)) * 100);
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const overallChangePct = rows.length > 1 ? changePercent(values.at(-1), values[0]) : null;
  const trend = direction(overallChangePct);
  const risk = volatilityPct === null
    ? { code: 'unknown', text: '无法判断' }
    : volatilityPct >= 20
      ? { code: 'high', text: '波动较高' }
      : volatilityPct >= 10
        ? { code: 'medium', text: '波动中等' }
        : { code: 'low', text: '波动较低' };

  return {
    label: metric.label,
    unit: metric.unit,
    startValue: round(values[0]),
    endValue: round(values.at(-1)),
    average: round(average),
    minimum: round(minimum),
    minimumYear: rows[values.indexOf(minimum)].data_year,
    maximum: round(maximum),
    maximumYear: rows[values.indexOf(maximum)].data_year,
    overallChangePct,
    trend: trend.code,
    trendText: trend.text,
    volatilityPct,
    risk: risk.code,
    riskText: risk.text
  };
}

function analyzeMarketRows(databaseRows) {
  const rows = databaseRows
    .map((row) => ({
      ...row,
      data_year: Number(row.data_year),
      average_price: round(row.average_price),
      output_ton: round(row.output_ton),
      planting_area_mu: round(row.planting_area_mu),
      is_mock: Boolean(row.is_mock)
    }))
    .sort((a, b) => a.data_year - b.data_year);

  const enrichedRows = rows.map((row, index) => {
    const previous = rows[index - 1];
    const consecutive = previous && row.data_year === previous.data_year + 1;
    return {
      ...row,
      yearOnYear: {
        pricePct: consecutive ? changePercent(row.average_price, previous.average_price) : null,
        outputPct: consecutive ? changePercent(row.output_ton, previous.output_ton) : null,
        areaPct: consecutive ? changePercent(row.planting_area_mu, previous.planting_area_mu) : null,
        comparable: Boolean(consecutive)
      }
    };
  });

  const summary = Object.fromEntries(
    METRICS.map((metric) => [metric.resultKey, metricSummary(enrichedRows, metric)])
  );

  return {
    rows: enrichedRows,
    analysis: {
      period: enrichedRows.length ? `${enrichedRows[0].data_year}—${enrichedRows.at(-1).data_year}` : '',
      yearCount: enrichedRows.length,
      summary,
      methodology: '同比仅比较相邻自然年；趋势按首末年变化率判断（超过±3%为上升或下降）；波动按变异系数描述（低于10%为低、10%至20%为中、20%及以上为高）。结果为历史描述，不代表价格预测。'
    }
  };
}

module.exports = { analyzeMarketRows, changePercent };
