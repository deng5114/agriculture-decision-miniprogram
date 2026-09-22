const { request } = require('../../utils/request');

Page({
  data: { plotId: '', temperature: '25', budget: '1500', experienceLevel: '中等', results: [] },
  onLoad(options) {
    this.setData({ plotId: options.plotId || '' });
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async submit() {
    try {
      const result = await request({
        url: '/api/recommendations',
        method: 'POST',
        data: {
          plotId: Number(this.data.plotId),
          temperature: Number(this.data.temperature),
          budget: Number(this.data.budget),
          experienceLevel: this.data.experienceLevel
        }
      });
      this.setData({ results: result.top3 || [] });
    } catch (error) {
      console.error(error);
    }
  }
});
