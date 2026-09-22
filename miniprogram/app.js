App({
  globalData: {
    baseUrl: 'http://127.0.0.1:3000'
  },
  onLaunch() {
    const headers = wx.getStorageSync('demoHeaders');
    if (headers) {
      this.globalData.demoHeaders = headers;
    }
  }
});
