const { request } = require('../../utils/request');

Page({
  data: { stats: null },
  onShow() {
    this.loadStats();
  },
  async loadStats() {
    try {
      const stats = await request({ url: '/api/statistics/region' });
      this.setData({ stats });
    } catch (error) {
      console.error(error);
    }
  }
});
