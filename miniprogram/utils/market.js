const METRICS = {
  price: { field: 'average_price', title: '年度均价趋势', unit: '元/公斤', color: '#2f855a' },
  output: { field: 'output_ton', title: '年度产量趋势', unit: '吨', color: '#3182ce' },
  area: { field: 'planting_area_mu', title: '种植面积趋势', unit: '亩', color: '#dd6b20' }
};

function numberText(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toFixed(digits).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function changeText(value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return '--';
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${numberText(number)}%`;
}

function changeClass(value) {
  if (value === null || value === undefined || Number(value) === 0) return 'change-flat';
  return Number(value) > 0 ? 'change-up' : 'change-down';
}

function presentRows(rows) {
  return (rows || []).map((row) => ({
    ...row,
    priceText: numberText(row.average_price),
    outputText: numberText(row.output_ton),
    areaText: numberText(row.planting_area_mu),
    priceChangeText: changeText(row.yearOnYear && row.yearOnYear.pricePct),
    outputChangeText: changeText(row.yearOnYear && row.yearOnYear.outputPct),
    areaChangeText: changeText(row.yearOnYear && row.yearOnYear.areaPct),
    priceChangeClass: changeClass(row.yearOnYear && row.yearOnYear.pricePct),
    outputChangeClass: changeClass(row.yearOnYear && row.yearOnYear.outputPct),
    areaChangeClass: changeClass(row.yearOnYear && row.yearOnYear.areaPct)
  }));
}

function presentAnalysis(analysis) {
  const price = analysis && analysis.summary && analysis.summary.price;
  const output = analysis && analysis.summary && analysis.summary.output;
  const area = analysis && analysis.summary && analysis.summary.area;
  if (!price) return null;
  return {
    period: analysis.period,
    yearCount: analysis.yearCount,
    trendText: price.trendText,
    trendClass: price.trend === 'up' ? 'change-up' : price.trend === 'down' ? 'change-down' : 'change-flat',
    overallChangeText: changeText(price.overallChangePct),
    outputChangeText: output ? changeText(output.overallChangePct) : '--',
    areaChangeText: area ? changeText(area.overallChangePct) : '--',
    averageText: numberText(price.average),
    rangeText: `${numberText(price.minimum)}（${price.minimumYear}）— ${numberText(price.maximum)}（${price.maximumYear}）`,
    volatilityText: price.volatilityPct === null ? '--' : `${numberText(price.volatilityPct)}% · ${price.riskText}`,
    methodology: analysis.methodology
  };
}

module.exports = { METRICS, numberText, changeText, presentRows, presentAnalysis };
