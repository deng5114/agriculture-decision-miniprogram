const { request } = require('../../utils/request');

Page({
  data: {
    cropName: '番茄',
    region: '示范区',
    startYear: '2022',
    endYear: '2024',
    rows: [],
    source: '',
    note: ''
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async onLoad() {
    this.loadData();
  },
  async loadData() {
    const query = `cropName=${encodeURIComponent(this.data.cropName)}&region=${encodeURIComponent(this.data.region)}&startYear=${this.data.startYear}&endYear=${this.data.endYear}`;
    try {
      const result = await request({ url: `/api/market-data?${query}` });
      this.setData({ rows: result.rows || [], source: result.dataSource, note: result.statisticNote });
    } catch (error) {
      console.error(error);
    }
  }
});
