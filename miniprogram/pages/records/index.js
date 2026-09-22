const { request } = require('../../utils/request');
const labels = { draft: '草稿', pending: '待审核', approved: '已通过', rejected: '已驳回' };
Page({
  data: { records: [], visible: [], filter: 0, filters: ['全部', '草稿', '待审核', '已通过', '已驳回'], loading: false, error: '', submitting: '' },
  onShow() { this.loadRecords(); },
  async loadRecords() {
    this.setData({ loading: true, error: '' });
    try {
      const rows = await request({ url: '/api/plant-records' });
      this.setData({ records: rows.map(r => ({ ...r, statusLabel: labels[r.status] || r.status, editable: ['draft', 'rejected'].includes(r.status) })) });
      this.filterRecords();
    } catch (e) { this.setData({ error: '读取失败，请检查后端服务后重试。' }); }
    finally { this.setData({ loading: false }); }
  },
  chooseFilter(e) { this.setData({ filter: Number(e.detail.value) }); this.filterRecords(); },
  filterRecords() {
    this.setData({ visible: this.data.records.filter(r => !this.data.filter || r.statusLabel === this.data.filters[this.data.filter]) });
  },
  add() { wx.navigateTo({ url: '/pages/record-edit/index' }); },
  open(e) { wx.navigateTo({ url: `/pages/record-edit/index?id=${e.currentTarget.dataset.id}` }); },
  submit(e) {
    if (this.data.submitting) return;
    const id = e.currentTarget.dataset.id;
    this.setData({ submitting: id });
    wx.showModal({ title: '提交审核', content: '提交后暂不能修改，确认提交吗？', success: async result => {
      try {
        if (!result.confirm) return;
        await request({ url: `/api/plant-records/${id}/submit`, method: 'POST' });
        wx.showToast({ title: '已提交审核' });
        await this.loadRecords();
      } catch (error) { /* request displays the error */ }
      finally { this.setData({ submitting: '' }); }
    }, fail: () => this.setData({ submitting: '' }) });
  }
});
