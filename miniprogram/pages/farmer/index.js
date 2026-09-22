const { request } = require('../../utils/request');

Page({
  data: { plots: [], user: {} },
  onShow() {
    this.setData({ user: wx.getStorageSync('currentUser') || {} });
    this.loadPlots();
  },
  async loadPlots() {
    try {
      const plots = await request({ url: '/api/plots' });
      this.setData({ plots });
    } catch (error) {
      console.error(error);
    }
  },
  addPlot() {
    wx.navigateTo({ url: '/pages/plot/index' });
  },
  recommend(event) {
    wx.navigateTo({ url: `/pages/recommendation/index?plotId=${event.currentTarget.dataset.id}` });
  },
  disaster(event) {
    wx.navigateTo({ url: `/pages/disaster/index?plotId=${event.currentTarget.dataset.id}` });
  }
});
