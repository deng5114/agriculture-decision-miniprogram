const { request } = require('../../utils/request');

Page({
  data: {
    role: 'farmer',
    roles: [
      { value: 'farmer', label: '种植农户' },
      { value: 'agronomist', label: '农技工作人员' },
      { value: 'admin', label: '区域管理者' }
    ]
  },
  chooseRole(event) {
    this.setData({ role: event.currentTarget.dataset.role });
  },
  async login() {
    try {
      const result = await request({
        url: '/api/auth/login',
        method: 'POST',
        data: { nickname: '演示农户', role: this.data.role, region: '示范区' }
      });
      const app = getApp();
      app.globalData.demoHeaders = result.demoHeaders;
      wx.setStorageSync('demoHeaders', result.demoHeaders);
      wx.setStorageSync('currentUser', result.user);
      wx.redirectTo({ url: '/pages/farmer/index' });
    } catch (error) {
      console.error(error);
    }
  }
});
