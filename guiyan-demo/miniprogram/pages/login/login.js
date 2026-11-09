const api = require("../../utils/api");
Page({
  data: {
    username: "demo",
    password: "demo123",
    name: "",
    register: false,
    busy: false,
  },
  field(e) {
    this.setData({ [e.currentTarget.dataset.field]: e.detail.value });
  },
  toggle() {
    this.setData({ register: !this.data.register });
  },
  async submit() {
    if (this.data.busy) return;
    this.setData({ busy: true });
    try {
      const { username, password, name, register } = this.data;
      if (register)
        await api.request("/register", "POST", {
          username,
          password,
          name,
          channel: "微信小程序",
        });
      const r = await api.request("/login", "POST", { username, password });
      wx.setStorageSync("guiyan.token", r.token);
      wx.showToast({ title: "登录成功" });
      setTimeout(() => {
        const pages = getCurrentPages();
        if (pages.length > 1) wx.navigateBack();
        else wx.switchTab({ url: "/pages/mine/mine" });
      }, 400);
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
});
