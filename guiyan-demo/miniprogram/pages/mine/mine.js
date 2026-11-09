const api = require("../../utils/api");
Page({
  data: {
    user: null,
    orders: 0,
    favorites: [],
    messages: 0,
    editing: false,
    name: "",
    city: "南宁",
    preferenceIndex: 0,
    categoryNames: [],
    categories: [],
    showFavorites: false,
  },
  onShow() {
    this.load();
  },
  async load() {
    try {
      const d = await api.bootstrap();
      this.setData({
        user: d.user,
        orders: d.orders.length,
        favorites: d.resources.filter((r) => d.favorites.includes(r.id)),
        messages: d.messages.filter((m) => !m.is_read).length,
        name: d.user ? d.user.name : "",
        city: d.user ? d.user.city : "南宁",
        categories: d.categories,
        categoryNames: d.categories.map((c) => c.name),
        preferenceIndex: Math.max(
          0,
          d.categories.findIndex((c) => d.user && c.id === d.user.preference),
        ),
      });
    } catch (e) {
      api.error(e);
    }
  },
  login() {
    wx.navigateTo({ url: "/pages/login/login" });
  },
  navigate(e) {
    if (!api.requireLogin()) return;
    wx.navigateTo({
      url:
        "/pages/" +
        e.currentTarget.dataset.page +
        "/" +
        e.currentTarget.dataset.page,
    });
  },
  edit() {
    this.setData({ editing: !this.data.editing });
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  preference(e) {
    this.setData({ preferenceIndex: Number(e.detail.value) });
  },
  async save() {
    try {
      await api.request("/profile", "PATCH", {
        name: this.data.name,
        city: this.data.city,
        preference: this.data.categories[this.data.preferenceIndex].id,
      });
      this.setData({ editing: false });
      this.load();
      wx.showToast({ title: "资料已保存" });
    } catch (e) {
      api.error(e);
    }
  },
  async verify() {
    try {
      await api.request("/profile", "PATCH", { verify: true });
      this.load();
      wx.showToast({ title: "演示认证完成" });
    } catch (e) {
      api.error(e);
    }
  },
  async logout() {
    try {
      await api.request("/logout", "POST");
    } catch (e) {}
    wx.removeStorageSync("guiyan.token");
    this.load();
  },
  favorites() {
    this.setData({ showFavorites: !this.data.showFavorites });
  },
  open(e) {
    wx.navigateTo({
      url: "/pages/detail/detail?id=" + e.currentTarget.dataset.id,
    });
  },
});
