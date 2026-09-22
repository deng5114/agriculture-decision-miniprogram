function round(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function createGroup(label) {
  return { label, recordCount: 0, plotAreas: new Map() };
}

function addToGroup(groups, label, row) {
  if (!groups.has(label)) groups.set(label, createGroup(label));
  const group = groups.get(label);
  group.recordCount += 1;
  if (!group.plotAreas.has(row.plot_id)) group.plotAreas.set(row.plot_id, Number(row.area_mu));
}

function finishGroups(groups, field) {
  return [...groups.values()]
    .map((group) => ({
      [field]: group.label,
      record_count: group.recordCount,
      unique_plot_count: group.plotAreas.size,
      total_area_mu: round([...group.plotAreas.values()].reduce((sum, area) => sum + area, 0))
    }))
    .sort((a, b) => b.record_count - a.record_count || b.total_area_mu - a.total_area_mu);
}

function buildRegionStatistics(rows) {
  const uniquePlots = new Map();
  const cropGroups = new Map();
  const regionGroups = new Map();
  let totalBudget = 0;

  rows.forEach((row) => {
    totalBudget += Number(row.budget);
    if (!uniquePlots.has(row.plot_id)) uniquePlots.set(row.plot_id, Number(row.area_mu));
    addToGroup(cropGroups, row.crop_name, row);
    addToGroup(regionGroups, row.region, row);
  });

  return {
    onlyApproved: true,
    summary: {
      record_count: rows.length,
      unique_plot_count: uniquePlots.size,
      total_area_mu: round([...uniquePlots.values()].reduce((sum, area) => sum + area, 0)),
      total_budget: round(totalBudget)
    },
    byCrop: finishGroups(cropGroups, 'crop_name'),
    byRegion: finishGroups(regionGroups, 'region'),
    areaDefinition: '汇总面积按唯一地块统计，同一地块的多条记录只计一次；按作物分类时，同一“地块＋作物”组合只计一次。'
  };
}

module.exports = { buildRegionStatistics };
