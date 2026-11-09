const api = require("../../utils/api");
Page({
  data: {
    resources: [],
    categories: [],
    baseUrl: "",
    keyword: "",
    loading: true,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const d = await api.bootstrap();
      this.setData({
        resources: d.resources
          .slice()
          .sort(
            (a, b) =>
              Number(b.category === (d.user || {}).preference) -
              Number(a.category === (d.user || {}).preference),
          )
          .slice(0, 5),
        categories: d.categories,
        baseUrl: getApp().globalData.baseUrl,
        loading: false,
      });
    } catch (e) {
      api.error(e);
      this.setData({ loading: false });
    }
  },
  searchInput(e) {
    this.setData({ keyword: e.detail.value });
  },
  search() {
    getApp().globalData.keyword = this.data.keyword;
    getApp().globalData.category = "";
    wx.switchTab({ url: "/pages/list/list" });
  },
  category(e) {
    getApp().globalData.category = e.currentTarget.dataset.id;
    getApp().globalData.keyword = "";
    wx.switchTab({ url: "/pages/list/list" });
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
