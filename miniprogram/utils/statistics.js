function numberText(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '0';
  return number.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
}

function listItems(items, labelField) {
  return (items || []).map((item) => ({
    ...item,
    label: item[labelField],
    areaText: numberText(item.total_area_mu),
    recordText: numberText(item.record_count),
    plotText: numberText(item.unique_plot_count)
  }));
}

function chartItems(items, metric) {
  const field = metric === 'area' ? 'total_area_mu' : 'record_count';
  const unit = metric === 'area' ? '亩' : '条';
  const sorted = [...items].sort((a, b) => Number(b[field]) - Number(a[field])).slice(0, 8);
  const maximum = Math.max(0, ...sorted.map((item) => Number(item[field])));
  return sorted.map((item) => {
    const value = Number(item[field]);
    return {
      ...item,
      chartValueText: `${numberText(value)} ${unit}`,
      chartPercent: maximum > 0 ? Math.max(4, Math.round((value / maximum) * 100)) : 0
    };
  });
}

function presentStatistics(raw, metric = 'area') {
  if (!raw) return null;
  const byCrop = listItems(raw.byCrop, 'crop_name');
  const byRegion = listItems(raw.byRegion, 'region');
  return {
    ...raw,
    summary: {
      ...raw.summary,
      areaText: numberText(raw.summary.total_area_mu),
      budgetText: numberText(raw.summary.total_budget)
    },
    byCrop,
    byRegion,
    cropChart: chartItems(byCrop, metric),
    regionChart: chartItems(byRegion, metric)
  };
}

module.exports = { presentStatistics, chartItems, numberText };
