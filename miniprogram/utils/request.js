const app = getApp();

function request({ url, method = 'GET', data = {} }) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `${app.globalData.baseUrl}${url}`,
      method,
      data,
      header: {
        'content-type': 'application/json',
        ...(app.globalData.demoHeaders || wx.getStorageSync('demoHeaders') || {})
      },
      success(response) {
        const result = response.data || {};
        if (response.statusCode >= 200 && response.statusCode < 300 && result.code === 0) {
          resolve(result.data);
          return;
        }
        wx.showToast({ title: result.message || '请求失败', icon: 'none' });
        reject(result);
      },
      fail(error) {
        wx.showToast({ title: '无法连接后端服务', icon: 'none' });
        reject(error);
      }
    });
  });
}

module.exports = { request };
