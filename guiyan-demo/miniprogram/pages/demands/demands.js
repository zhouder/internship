const api = require("../../utils/api");
Page({
  data: {
    demands: [],
    resources: [],
    categories: [],
    categoryNames: [],
    creating: false,
    title: "",
    categoryIndex: 0,
    budget: "10000",
    city: "南宁",
    description: "",
    matched: [],
    matchTitle: "",
    user: null,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const d = await api.bootstrap();
      this.setData({
        demands: d.demands,
        resources: d.resources,
        categories: d.categories,
        categoryNames: d.categories.map((c) => c.name),
        user: d.user,
      });
    } catch (e) {
      api.error(e);
    }
  },
  create() {
    if (api.requireLogin()) this.setData({ creating: !this.data.creating });
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  category(e) {
    this.setData({ categoryIndex: Number(e.detail.value) });
  },
  async verify() {
    try {
      await api.request("/profile", "PATCH", { verify: true });
      await this.load();
      wx.showToast({ title: "演示认证完成" });
    } catch (e) {
      api.error(e);
    }
  },
  async submit() {
    try {
      await api.request("/demands", "POST", {
        title: this.data.title,
        category: this.data.categories[this.data.categoryIndex].id,
        budget: Math.round(Number(this.data.budget) * 100),
        city: this.data.city,
        description: this.data.description,
      });
      this.setData({ creating: false, title: "", description: "" });
      wx.showToast({ title: "已提交，等待审核", icon: "none" });
      this.load();
    } catch (e) {
      api.error(e);
    }
  },
  contact(e) {
    if (!api.requireLogin()) return;
    wx.navigateTo({
      url: "/pages/messages/messages?to=" + e.currentTarget.dataset.id,
    });
  },
  match(e) {
    const d = this.data.demands.find(
      (v) => v.id === Number(e.currentTarget.dataset.id),
    );
    this.setData({
      matchTitle: d.title,
      matched: this.data.resources
        .filter((r) => r.category === d.category && r.price <= d.budget)
        .sort((a, b) => Number(b.city === d.city) - Number(a.city === d.city))
        .slice(0, 4),
    });
  },
  closeMatch() {
    this.setData({ matchTitle: "" });
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
