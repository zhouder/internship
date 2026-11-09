const api = require("../../utils/api");
Page({
  data: {
    orders: [],
    status: 0,
    statusNames: [
      "全部订单",
      "待确认",
      "待支付",
      "已支付",
      "已完成",
      "退款申请中",
      "纠纷处理中",
    ],
    statusKeys: [
      "",
      "pending",
      "confirmed",
      "paid",
      "completed",
      "refund_requested",
      "disputed",
    ],
    all: [],
  },
  onShow() {
    this.load();
  },
  async load() {
    if (!api.requireLogin()) return;
    try {
      const d = await api.bootstrap();
      this.setData({ all: d.orders });
      this.filter();
    } catch (e) {
      api.error(e);
    }
  },
  filter() {
    const key = this.data.statusKeys[this.data.status];
    this.setData({
      orders: this.data.all.filter((o) => !key || o.status === key),
    });
  },
  status(e) {
    this.setData({ status: Number(e.detail.value) });
    this.filter();
  },
  async action(e) {
    const { id, action } = e.currentTarget.dataset;
    const run = async (reason) => {
      try {
        await api.request("/orders/" + id, "PATCH", { action, reason });
        wx.showToast({
          title: action === "pay" ? "模拟支付成功" : "订单已更新",
          icon: "none",
        });
        this.load();
      } catch (err) {
        api.error(err);
      }
    };
    if (["refund", "dispute"].includes(action)) {
      wx.showModal({
        title: action === "refund" ? "申请退款" : "提交申诉",
        editable: true,
        placeholderText: "填写原因",
        success: (r) => {
          if (r.confirm) run(r.content || "用户申请售后");
        },
      });
    } else
      wx.showModal({
        title: "确认操作",
        content:
          action === "pay"
            ? "仅模拟支付，不会产生真实扣款。"
            : "确认更新订单状态？",
        success: (r) => {
          if (r.confirm) run();
        },
      });
  },
  async contract(e) {
    try {
      const r = await api.request(
        "/orders/" + e.currentTarget.dataset.id + "/contract",
      );
      wx.showModal({
        title: r.title,
        content: r.content,
        showCancel: false,
        confirmText: "我知道了",
      });
    } catch (err) {
      api.error(err);
    }
  },
});
