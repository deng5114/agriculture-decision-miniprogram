const { request } = require('../../utils/request');

Page({
  data: { name: '', areaMu: '', soilType: '壤土', region: '示范区' },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async submit() {
    const { name, areaMu, soilType, region } = this.data;
    if (!name || !areaMu || Number(areaMu) <= 0) {
      wx.showToast({ title: '请填写地块名称和有效面积', icon: 'none' });
      return;
    }
    try {
      await request({
        url: '/api/plots',
        method: 'POST',
        data: { name, areaMu: Number(areaMu), soilType, region }
      });
      wx.showToast({ title: '保存成功' });
      setTimeout(() => wx.navigateBack(), 500);
    } catch (error) {
      console.error(error);
    }
  }
});
