const { request } = require('../../utils/request');

Page({
  data: { records: [] },
  onShow() {
    this.loadRecords();
  },
  async loadRecords() {
    try {
      const records = await request({ url: '/api/reviews/pending' });
      this.setData({ records });
    } catch (error) {
      console.error(error);
    }
  },
  approve(event) {
    this.review(event.currentTarget.dataset.id, 'approve', '审核通过');
  },
  reject(event) {
    wx.showModal({
      title: '填写驳回原因',
      editable: true,
      placeholderText: '请输入审核意见',
      success: (result) => {
        if (result.confirm && result.content.trim()) {
          this.review(event.currentTarget.dataset.id, 'reject', result.content.trim());
        } else if (result.confirm) {
          wx.showToast({ title: '驳回原因不能为空', icon: 'none' });
        }
      }
    });
  },
  async review(id, action, comment) {
    try {
      await request({
        url: `/api/reviews/${id}/${action}`,
        method: 'POST',
        data: { comment }
      });
      wx.showToast({ title: action === 'approve' ? '已通过' : '已驳回' });
      this.loadRecords();
    } catch (error) {
      console.error(error);
    }
  }
});
