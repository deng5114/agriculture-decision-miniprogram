const { request } = require('../../utils/request');
const { presentStatistics } = require('../../utils/statistics');

Page({
  data: {
    rawStats: null,
    stats: null,
    chartMetric: 'area',
    loading: false,
    loaded: false
  },
  onShow() {
    this.loadStats();
  },
  async loadStats() {
    this.setData({ loading: true });
    try {
      const rawStats = await request({ url: '/api/statistics/region' });
      this.setData({
        rawStats,
        stats: presentStatistics(rawStats, this.data.chartMetric),
        loading: false,
        loaded: true
      });
    } catch (error) {
      console.error(error);
      this.setData({ loading: false, loaded: true });
    }
  },
  selectMetric(event) {
    const chartMetric = event.currentTarget.dataset.metric;
    if (!this.data.rawStats || chartMetric === this.data.chartMetric) return;
    this.setData({
      chartMetric,
      stats: presentStatistics(this.data.rawStats, chartMetric)
    });
  }
});
