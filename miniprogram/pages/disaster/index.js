const { request } = require('../../utils/request');

Page({
  data: { plotId: '', cropName: '番茄', rainfall: '0', dryDays: '0', minTemperature: '18', alerts: [], status: '' },
  onLoad(options) {
    this.setData({ plotId: options.plotId || '' });
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async submit() {
    const query = [
      `plotId=${this.data.plotId}`,
      `cropName=${encodeURIComponent(this.data.cropName)}`,
      `rainfall=${this.data.rainfall}`,
      `dryDays=${this.data.dryDays}`,
      `minTemperature=${this.data.minTemperature}`
    ].join('&');
    try {
      const result = await request({ url: `/api/disaster-alerts?${query}` });
      this.setData({ alerts: result.alerts || [], status: result.status });
    } catch (error) {
      console.error(error);
    }
  }
});
