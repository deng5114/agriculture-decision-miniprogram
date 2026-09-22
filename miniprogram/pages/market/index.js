const { request } = require('../../utils/request');
const { METRICS, numberText, presentRows, presentAnalysis } = require('../../utils/market');

Page({
  data: {
    cropName: '番茄',
    region: '示范区',
    startYear: '2022',
    endYear: '2024',
    rows: [],
    source: '',
    note: '',
    analysis: null,
    metric: 'price',
    chartTitle: METRICS.price.title,
    chartUnit: METRICS.price.unit,
    loading: false,
    queried: false
  },
  input(event) {
    this.setData({ [event.currentTarget.dataset.field]: event.detail.value });
  },
  async onLoad() {
    this.loadData();
  },
  async loadData() {
    const cropName = this.data.cropName.trim();
    const region = this.data.region.trim();
    const startYear = Number(this.data.startYear);
    const endYear = Number(this.data.endYear);
    if (!cropName || !region || !/^\d{4}$/.test(this.data.startYear) || !/^\d{4}$/.test(this.data.endYear) || startYear > endYear) {
      wx.showToast({ title: '请完整填写作物、区域和有效年份', icon: 'none' });
      return;
    }
    const query = `cropName=${encodeURIComponent(cropName)}&region=${encodeURIComponent(region)}&startYear=${startYear}&endYear=${endYear}`;
    this.setData({ loading: true, rows: [], analysis: null, source: '', note: '' });
    try {
      const result = await request({ url: `/api/market-data?${query}` });
      this.setData({
        rows: presentRows(result.rows),
        analysis: presentAnalysis(result.analysis),
        source: result.dataSource,
        note: result.statisticNote,
        queried: true,
        loading: false
      }, () => this.drawChart());
    } catch (error) {
      console.error(error);
      this.setData({ loading: false, queried: true });
    }
  },
  selectMetric(event) {
    const metric = event.currentTarget.dataset.metric;
    const config = METRICS[metric];
    if (!config || metric === this.data.metric) return;
    this.setData({ metric, chartTitle: config.title, chartUnit: config.unit }, () => this.drawChart());
  },
  drawChart() {
    if (!this.data.rows.length) return;
    wx.nextTick(() => {
      wx.createSelectorQuery().in(this).select('#marketTrend').boundingClientRect((rect) => {
        if (!rect || !rect.width) return;
        const config = METRICS[this.data.metric];
        const points = this.data.rows.map((row) => ({ year: row.data_year, value: Number(row[config.field]) }));
        const context = wx.createCanvasContext('marketTrend', this);
        const width = rect.width;
        const height = rect.height;
        const padding = { left: 48, right: 16, top: 24, bottom: 38 };
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        const values = points.map((point) => point.value);
        let minimum = Math.min(...values);
        let maximum = Math.max(...values);
        const span = maximum - minimum || Math.max(Math.abs(maximum) * 0.2, 1);
        minimum = Math.max(0, minimum - span * 0.15);
        maximum += span * 0.15;

        context.clearRect(0, 0, width, height);
        context.setFontSize(11);
        context.setTextAlign('right');
        context.setTextBaseline('middle');
        for (let index = 0; index <= 4; index += 1) {
          const y = padding.top + (chartHeight * index) / 4;
          const value = maximum - ((maximum - minimum) * index) / 4;
          context.setStrokeStyle('#e2e8f0');
          context.setLineWidth(1);
          context.beginPath();
          context.moveTo(padding.left, y);
          context.lineTo(width - padding.right, y);
          context.stroke();
          context.setFillStyle('#718096');
          context.fillText(numberText(value, 1), padding.left - 7, y);
        }

        const plotted = points.map((point, index) => ({
          ...point,
          x: points.length === 1 ? padding.left + chartWidth / 2 : padding.left + (chartWidth * index) / (points.length - 1),
          y: padding.top + ((maximum - point.value) / (maximum - minimum)) * chartHeight
        }));
        context.setStrokeStyle(config.color);
        context.setLineWidth(3);
        context.setLineJoin('round');
        context.beginPath();
        plotted.forEach((point, index) => {
          if (index === 0) context.moveTo(point.x, point.y);
          else context.lineTo(point.x, point.y);
        });
        context.stroke();

        const labelStep = Math.max(1, Math.ceil(points.length / 5));
        plotted.forEach((point, index) => {
          context.setFillStyle('#ffffff');
          context.setStrokeStyle(config.color);
          context.setLineWidth(2);
          context.beginPath();
          context.arc(point.x, point.y, 4, 0, Math.PI * 2);
          context.fill();
          context.stroke();
          if (points.length <= 6 || index === 0 || index === points.length - 1 || index % labelStep === 0) {
            context.setFillStyle('#4a5568');
            context.setTextAlign('center');
            context.setTextBaseline('top');
            context.fillText(String(point.year), point.x, height - padding.bottom + 12);
          }
        });
        context.draw();
      }).exec();
    });
  }
});
