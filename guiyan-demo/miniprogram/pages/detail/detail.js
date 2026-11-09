const api = require("../../utils/api");
Page({
  data: {
    r: null,
    tab: "detail",
    date: "2026-11-16",
    quantity: 1,
    note: "",
    comment: "",
    rating: 5,
    serviceRating: 5,
    valueRating: 5,
    ratings: ["1分", "2分", "3分", "4分", "5分"],
    comments: [],
    dates: [],
    favorite: false,
    rental: false,
    total: "",
    angle: 0,
    light: false,
    playing: false,
    progress: 0,
  },
  onLoad(options) {
    this.id = Number(options.id);
    this.load();
  },
  onUnload() {
    clearInterval(this.timer);
  },
  onHide() {
    clearInterval(this.timer);
    this.setData({ playing: false });
  },
  async load() {
    try {
      const [d, a] = await Promise.all([
          api.bootstrap(),
          api.request("/availability?resourceId=" + this.id),
        ]),
        r = d.resources.find((v) => v.id === this.id);
      if (!r) throw new Error("资源不存在或已下架");
      this.setData({
        r,
        comments: d.comments.filter(
          (c) => c.resource_id === this.id && c.status === "approved",
        ),
        favorite: d.favorites.includes(this.id),
        rental: ["venue", "equipment"].includes(r.category),
        dates: a.dates,
        total: api.money(r.price * this.data.quantity),
      });
      api.request("/resources/" + this.id + "/view", "POST").catch(() => {});
    } catch (e) {
      api.error(e);
    }
  },
  tab(e) {
    this.setData({ tab: e.currentTarget.dataset.tab });
  },
  date(e) {
    this.setData({ date: e.detail.value });
  },
  quantity(e) {
    const q = Number(e.detail.value) || 1;
    this.setData({ quantity: q, total: api.money(this.data.r.price * q) });
  },
  note(e) {
    this.setData({ note: e.detail.value });
  },
  comment(e) {
    this.setData({ comment: e.detail.value });
  },
  rating(e) {
    this.setData({ rating: Number(e.detail.value) + 1 });
  },
  dimension(e) {
    this.setData({
      [e.currentTarget.dataset.field]: Number(e.detail.value) + 1,
    });
  },
  async favorite() {
    if (!api.requireLogin()) return;
    try {
      await api.request("/favorites", "POST", { resourceId: this.id });
      this.setData({ favorite: !this.data.favorite });
    } catch (e) {
      api.error(e);
    }
  },
  async book() {
    if (!api.requireLogin()) return;
    try {
      await api.request("/orders", "POST", {
        resourceId: this.id,
        date: this.data.date,
        quantity: this.data.rental ? 1 : Number(this.data.quantity),
        note: this.data.note,
        channel: "微信小程序",
      });
      wx.showToast({ title: "预约已提交", icon: "success" });
      setTimeout(() => wx.navigateTo({ url: "/pages/orders/orders" }), 600);
    } catch (e) {
      api.error(e);
    }
  },
  async review() {
    if (!api.requireLogin()) return;
    try {
      await api.request("/comments", "POST", {
        resourceId: this.id,
        rating: this.data.rating,
        dimensions: {
          quality: this.data.rating,
          service: this.data.serviceRating,
          value: this.data.valueRating,
        },
        content: this.data.comment,
      });
      wx.showToast({ title: "已提交，等待审核", icon: "none" });
      this.setData({ comment: "" });
    } catch (e) {
      api.error(e);
    }
  },
  rotate() {
    this.setData({ angle: this.data.angle + 30, light: !this.data.light });
  },
  play() {
    if (this.data.playing) {
      clearInterval(this.timer);
      this.setData({ playing: false });
      return;
    }
    this.setData({ playing: true });
    this.timer = setInterval(
      () => this.setData({ progress: (this.data.progress + 1) % 101 }),
      500,
    );
  },
});
