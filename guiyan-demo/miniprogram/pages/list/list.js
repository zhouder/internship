const api = require("../../utils/api");
Page({
  data: {
    all: [],
    resources: [],
    categories: [],
    category: "",
    keyword: "",
    sort: 0,
    sorts: ["推荐排序", "价格最低", "评分最高"],
  },
  onShow() {
    this.setData({
      category: getApp().globalData.category || "",
      keyword: getApp().globalData.keyword || "",
    });
    this.load();
  },
  async load() {
    try {
      const d = await api.bootstrap();
      this.setData({ all: d.resources, categories: d.categories });
      this.filter();
    } catch (e) {
      api.error(e);
    }
  },
  filter() {
    let rows = this.data.all.filter(
      (r) =>
        (!this.data.category || r.category === this.data.category) &&
        (!this.data.keyword ||
          (r.name + r.description).includes(this.data.keyword)),
    );
    if (this.data.sort == 1) rows.sort((a, b) => a.price - b.price);
    if (this.data.sort == 2) rows.sort((a, b) => b.rating - a.rating);
    this.setData({ resources: rows });
  },
  searchInput(e) {
    this.setData({ keyword: e.detail.value });
    this.filter();
  },
  category(e) {
    this.setData({ category: e.currentTarget.dataset.id });
    getApp().globalData.category = this.data.category;
    this.filter();
  },
  sort(e) {
    this.setData({ sort: Number(e.detail.value) });
    this.filter();
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
