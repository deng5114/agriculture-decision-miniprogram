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

function uploadFile({ url, filePath, name = 'file', formData = {} }) {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: `${app.globalData.baseUrl}${url}`,
      filePath,
      name,
      formData,
      header: app.globalData.demoHeaders || wx.getStorageSync('demoHeaders') || {},
      success(response) {
        let result;
        try {
          result = JSON.parse(response.data || '{}');
        } catch (error) {
          wx.showToast({ title: '服务返回格式错误', icon: 'none' });
          reject(error);
          return;
        }
        if (response.statusCode >= 200 && response.statusCode < 300 && result.code === 0) {
          resolve(result.data);
          return;
        }
        wx.showToast({ title: result.message || '上传识别失败', icon: 'none' });
        reject(result);
      },
      fail(error) {
        wx.showToast({ title: '无法上传文件到后端', icon: 'none' });
        reject(error);
      }
    });
  });
}

module.exports = { request, uploadFile };
