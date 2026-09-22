const { request } = require('../../utils/request');
Page({
  data: { plotId: '', cropName: '番茄', latitude: '', longitude: '', locationName: '', locations: [], locationMessage: '', busy: false, ready: false, error: '', weather: null, alerts: [], status: '', fetchedText: '' },
  async onLoad(options) {
    this.setData({ plotId: options.plotId || '' });
    await this.loadPlot();
  },
  async loadPlot() {
    this.setData({ busy: true, error: '' });
    try {
      const plot = await request({ url: `/api/plots/${this.data.plotId}` });
      this.setData({ latitude: plot.latitude == null ? '' : String(plot.latitude), longitude: plot.longitude == null ? '' : String(plot.longitude), ready: true });
    } catch (e) { this.setData({ error: '地块读取失败，请返回首页重试。' }); }
    finally { this.setData({ busy: false }); }
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value, weather: null, alerts: [], status: '' }); },
  async searchLocation() {
    if (this.data.busy) return;
    this.setData({ busy: true, error: '', locations: [], locationMessage: '' });
    try {
      const locations = await request({ url: `/api/disaster-alerts/locations?name=${encodeURIComponent(this.data.locationName)}` });
      this.setData({ locations, locationMessage: locations.length ? '请选择实际地块附近地点，并核对经纬度。' : '未找到地点，请尝试拼音或手动填写经纬度。' });
    } catch (e) { this.setData({ error: e.message || '地点搜索失败，可手动填写经纬度' }); }
    finally { this.setData({ busy: false }); }
  },
  chooseLocation(e) {
    const location = this.data.locations[e.currentTarget.dataset.index];
    this.setData({ latitude: String(location.latitude), longitude: String(location.longitude), locations: [], locationMessage: location.label, weather: null, alerts: [], status: '' });
  },
  async submit() {
    if (this.data.busy || !this.data.ready) return;
    const { latitude, longitude, cropName, plotId } = this.data;
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180 || !cropName.trim()) {
      this.setData({ error: '请填写有效的经纬度和作物名称。', weather: null, alerts: [], status: '' }); return;
    }
    this.setData({ busy: true, weather: null, alerts: [], status: '', error: '' });
    try {
      await request({ url: `/api/plots/${plotId}/location`, method: 'PUT', data: { latitude: Number(latitude), longitude: Number(longitude) } });
      const result = await request({ url: `/api/disaster-alerts?plotId=${encodeURIComponent(plotId)}&cropName=${encodeURIComponent(cropName.trim())}` });
      const fetchedText = new Date(Date.parse(result.weather.fetchedAt) + 8 * 3600000).toISOString().replace('T', ' ').slice(0, 19);
      this.setData({ weather: result.weather, fetchedText, alerts: result.alerts.map(a => ({ ...a, levelText: a.level === 'high' ? '高' : '中' })), status: result.status });
    } catch (e) { this.setData({ error: e.message || '天气查询失败，请检查网络后重试。' }); }
    finally { this.setData({ busy: false }); }
  }
});
