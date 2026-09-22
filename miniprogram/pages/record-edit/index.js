const { request, uploadFile } = require('../../utils/request');
const statusLabels = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已驳回' };
Page({
  data: {
    id: '', plots: [], plotIndex: 0, loading: true, error: '', busy: false,
    readonly: false, statusLabel: '新记录', reviewComment: '',
    cropName: '', plantingDate: '', budget: '0', experienceLevel: '初级', problemDescription: '',
    experiences: ['初级', '中等', '熟练'], errors: {}, candidate: null, recognitionMessage: '',
    recognitionConfigured: null, recognitionProvider: '', recognitionStatusText: '检测中', recognitionStatusClass: 'checking',
    recording: false, recordingSeconds: 0,
    imagePreview: '', recognitionAlternatives: []
  },
  onLoad(options) { this.options = options; this.setupRecorder(); this.load(); },
  async load() {
    this.setData({ loading: true, error: '' });
    try {
      const plots = await request({ url: '/api/plots' });
      try {
        const status = await request({ url: '/api/recognition/status' });
        this.setData({
          recognitionConfigured: status.configured,
          recognitionProvider: status.provider,
          recognitionStatusText: status.configured ? '已配置' : '待配置',
          recognitionStatusClass: status.configured ? 'ready' : 'not-ready'
        });
      } catch (error) {
        this.setData({
          recognitionConfigured: false,
          recognitionProvider: '',
          recognitionStatusText: '不可用',
          recognitionStatusClass: 'not-ready'
        });
      }
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
  onUnload() {
    this.unloading = true;
    clearInterval(this.recordingTimer);
    if (this.data.recording && this.recorder) this.recorder.stop();
  },
  setupRecorder() {
    if (!wx.getRecorderManager) return;
    this.recorder = wx.getRecorderManager();
    this.recorder.onStart(() => {
      this.setData({ recording: true, recordingSeconds: 0, recognitionMessage: '正在录音，请清楚说出作物、面积和问题…' });
      this.recordingTimer = setInterval(() => this.setData({ recordingSeconds: this.data.recordingSeconds + 1 }), 1000);
    });
    this.recorder.onStop((result) => {
      clearInterval(this.recordingTimer);
      this.setData({ recording: false });
      if (this.unloading) return;
      if (result.duration < 800) {
        this.setData({ recognitionMessage: '录音时间太短，请至少说 1 秒。' });
        return;
      }
      this.uploadRecognition('voice', result.tempFilePath, { format: 'm4a' });
    });
    this.recorder.onError((error) => {
      clearInterval(this.recordingTimer);
      console.error(error);
      this.setData({ recording: false, recognitionMessage: '录音失败，请检查麦克风权限后重试。' });
    });
  },
  ensureRecognitionReady() {
    if (this.data.recognitionConfigured !== true) {
      wx.showToast({ title: this.data.recognitionConfigured === false ? '后端尚未配置真实识别密钥' : '正在检查识别服务', icon: 'none' });
      return false;
    }
    return true;
  },
  async startVoiceRecognition() {
    if (this.data.busy || this.data.readonly) return;
    if (!this.ensureRecognitionReady()) return;
    if (!this.recorder) {
      this.setData({ recognitionMessage: '当前微信基础库不支持录音，请升级微信后重试。' });
      return;
    }
    try {
      await new Promise((resolve, reject) => wx.authorize({ scope: 'scope.record', success: resolve, fail: reject }));
      this.recorder.start({ duration: 20_000, sampleRate: 16_000, numberOfChannels: 1, encodeBitRate: 48_000, format: 'aac' });
    } catch (error) {
      this.setData({ recognitionMessage: '需要麦克风权限。请在右上角设置中允许录音后重试。' });
    }
  },
  stopVoiceRecognition() {
    if (this.data.recording && this.recorder) this.recorder.stop();
  },
  chooseImage() {
    if (this.data.busy || this.data.readonly || !this.ensureRecognitionReady()) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera', 'album'],
      sizeType: ['compressed'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (file.size > 3 * 1024 * 1024) {
          wx.showToast({ title: '图片不能超过 3MB', icon: 'none' });
          return;
        }
        this.setData({ imagePreview: file.tempFilePath });
        this.uploadRecognition('image', file.tempFilePath);
      }
    });
  },
  async uploadRecognition(kind, filePath, formData = {}) {
    if (this.data.busy || this.data.readonly) return;
    this.setData({ busy: true, candidate: null, recognitionAlternatives: [], recognitionMessage: '正在调用真实识别服务…' });
    try {
      const result = await uploadFile({ url: `/api/recognition/${kind}`, filePath, formData });
      this.applyRecognitionResult(result);
    } catch (error) {
      this.setData({ recognitionMessage: (error && error.message) || '真实识别失败，请重试或手动填写，原表单未改变。' });
    } finally {
      this.setData({ busy: false });
    }
  },
  applyRecognitionResult(result) {
    if (!result.recognized) {
      this.setData({ recognitionMessage: result.message || '未获得可靠识别结果，请重试或手动填写。' });
      return;
    }
    const fields = result.fields || {};
    this.setData({
      recognitionMessage: `${result.provider || '识别服务'}已返回结果，请人工核对。`,
      recognitionAlternatives: result.alternatives || [],
      candidate: {
        description: result.transcript || result.description,
        cropName: fields.cropName || '',
        areaMu: fields.areaMu || '',
        problemDescription: fields.problemDescription || '',
        hasProblem: Object.prototype.hasOwnProperty.call(fields, 'problemDescription')
      }
    });
  },
  selectAlternative(e) {
    if (!this.data.candidate) return;
    this.setData({ 'candidate.cropName': e.currentTarget.dataset.name });
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
    if (this.data.busy || this.data.recording || this.data.readonly) return;
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
