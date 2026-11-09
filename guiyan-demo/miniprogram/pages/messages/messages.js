const api = require("../../utils/api");
Page({
  data: {
    messages: [],
    members: [],
    names: [],
    target: 0,
    content: "",
    composing: false,
  },
  onLoad(o) {
    this.to = Number(o.to || 0);
  },
  onShow() {
    this.load();
  },
  async load() {
    if (!api.requireLogin()) return;
    try {
      const d = await api.bootstrap(),
        members = d.members.filter((u) => u.id !== d.user.id);
      this.setData({
        messages: d.messages,
        members,
        names: members.map((u) => u.name),
        target: Math.max(
          0,
          members.findIndex((u) => u.id === this.to),
        ),
        composing: !!this.to,
      });
    } catch (e) {
      api.error(e);
    }
  },
  compose() {
    this.setData({ composing: !this.data.composing });
  },
  target(e) {
    this.setData({ target: Number(e.detail.value) });
  },
  content(e) {
    this.setData({ content: e.detail.value });
  },
  async send() {
    try {
      await api.request("/messages", "POST", {
        to: this.data.members[this.data.target].id,
        content: this.data.content,
        title: "合作沟通",
      });
      this.to = 0;
      this.setData({ content: "", composing: false });
      wx.showToast({ title: "私信已发送" });
      this.load();
    } catch (e) {
      api.error(e);
    }
  },
  async read() {
    try {
      await api.request("/messages/read", "POST");
      this.load();
    } catch (e) {
      api.error(e);
    }
  },
});
