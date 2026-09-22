const { request } = require('../../utils/request');
const statusLabels = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已驳回' };
Page({
  data: {
    id: '', plots: [], plotIndex: 0, loading: true, error: '', busy: false,
    readonly: false, statusLabel: '新记录', reviewComment: '',
    cropName: '', plantingDate: '', budget: '0', experienceLevel: '初级', problemDescription: '',
    experiences: ['初级', '中等', '熟练'], errors: {}, candidate: null, recognitionMessage: ''
  },
  onLoad(options) { this.options = options; this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const plots = await request({ url: '/api/plots' });
      const id = this.options.id || '';
      const record = id ? await request({ url: `/api/plant-records/${id}` }) : null;
      const plotId = record ? record.plot_id : this.options.plotId;
      const plotIndex = Math.max(0, plots.findIndex(p => String(p.id) === String(plotId)));
      const update = { plots, plotIndex, id };
      if (record) Object.assign(update, {
        cropName: record.crop_name, plantingDate: record.planting_date || '', budget: String(record.budget),
        experienceLevel: record.experience_level || '初级', problemDescription: record.problem_description || '',
        readonly: !['draft', 'rejected'].includes(record.status), statusLabel: statusLabels[record.status],
        reviewComment: record.review_comment || ''
      });
      this.setData(update);
    } catch (error) { this.setData({ error: '无法加载表单，请检查后端后重试。' }); }
    finally { this.setData({ loading: false }); }
  },
  input(e) { this.setData({ [e.currentTarget.dataset.field]: e.detail.value }); },
  choosePlot(e) { this.setData({ plotIndex: Number(e.detail.value) }); },
  chooseExperience(e) { this.setData({ experienceLevel: this.data.experiences[Number(e.detail.value)] }); },
  addPlot() { wx.navigateTo({ url: '/pages/plot/index' }); },
  onShow() { if (this.options && !this.data.loading && !this.data.plots.length) this.load(); },
  chooseSample(e) {
    if (this.data.busy || this.data.readonly) return;
    const kind = e.currentTarget.dataset.kind;
    const names = kind === 'voice' ? ['种两亩番茄，地块缺水', '种三亩玉米', '噪声 / 无声（模拟失败）'] : ['番茄图片样例', '玉米图片样例', '模糊图片（模拟失败）', '无关图片（模拟失败）'];
    const samples = kind === 'voice' ? ['tomato', 'corn', 'noise'] : ['tomato', 'corn', 'blurred', 'unrelated'];
    wx.showActionSheet({ itemList: names, success: result => this.recognize(kind, samples[result.tapIndex]) });
  },
  async recognize(kind, sample) {
    if (this.data.busy || this.data.readonly) return;
    this.setData({ busy: true, candidate: null, recognitionMessage: '' });
    try {
      const result = await request({ url: `/api/recognition/${kind}`, method: 'POST', data: { sample } });
      if (!result.recognized) { this.setData({ recognitionMessage: result.message }); return; }
      this.setData({ candidate: {
        description: result.transcript || result.description,
        cropName: result.fields.cropName || '', areaMu: result.fields.areaMu || '',
        problemDescription: result.fields.problemDescription || '', hasProblem: Object.prototype.hasOwnProperty.call(result.fields, 'problemDescription')
      } });
    } catch (error) { this.setData({ recognitionMessage: '模拟服务不可用，请重试或手动填写，原表单未改变。' }); }
    finally { this.setData({ busy: false }); }
  },
  candidateInput(e) { this.setData({ ['candidate.' + e.currentTarget.dataset.field]: e.detail.value }); },
  confirmCandidate() {
    const candidate = this.data.candidate;
    if (!candidate || this.data.readonly) return;
    if (!candidate.cropName.trim()) { wx.showToast({ title: '请填写候选作物', icon: 'none' }); return; }
    const update = { cropName: candidate.cropName.trim(), candidate: null, recognitionMessage: '候选结果已填入表单，请核对后保存。' };
    if (candidate.hasProblem) update.problemDescription = candidate.problemDescription;
    this.setData(update);
  },
  cancelCandidate() { this.setData({ candidate: null, recognitionMessage: '已取消，可继续手动填写。' }); },
  async save(e) {
    if (this.data.busy || this.data.readonly) return;
    if (this.data.candidate) { wx.showToast({ title: '请先确认或取消候选结果', icon: 'none' }); return; }
    const d = this.data;
    const errors = {};
    if (!d.plots[d.plotIndex]) errors.plot = '请先新增并选择地块';
    if (!d.cropName.trim()) errors.crop = '请输入作物名称';
    if (!String(d.budget).trim() || !Number.isFinite(Number(d.budget)) || Number(d.budget) < 0) errors.budget = '预算必须为非负数';
    this.setData({ errors });
    if (Object.keys(errors).length) return;
    this.setData({ busy: true });
    try {
      const record = await request({ url: d.id ? `/api/plant-records/${d.id}` : '/api/plant-records', method: d.id ? 'PUT' : 'POST', data: {
        plotId: d.plots[d.plotIndex].id, cropName: d.cropName.trim(), plantingDate: d.plantingDate || null,
        budget: Number(d.budget), experienceLevel: d.experienceLevel, problemDescription: d.problemDescription
      } });
      this.setData({ id: record.id, statusLabel: '草稿' });
      if (e.currentTarget.dataset.action === 'submit') {
        await request({ url: `/api/plant-records/${record.id}/submit`, method: 'POST' });
        this.setData({ readonly: true, statusLabel: '待审核' });
        wx.showToast({ title: '已提交审核' });
      } else wx.showToast({ title: '草稿已保存' });
    } catch (error) { /* Keep form and saved id so a retry cannot create another record. */ }
    finally { this.setData({ busy: false }); }
  },
  viewRecords() { wx.redirectTo({ url: '/pages/records/index' }); }
});
