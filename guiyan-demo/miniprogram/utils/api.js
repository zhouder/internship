const labels = {
  pending: "待确认",
  confirmed: "待支付",
  paid: "已支付",
  completed: "已完成",
  cancelled: "已取消",
  refund_requested: "退款申请中",
  refunded: "已退款",
  disputed: "纠纷处理中",
  approved: "已通过",
  rejected: "已驳回",
  published: "已上架",
  draft: "已下架",
};
function request(path, method = "GET", data) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: getApp().globalData.baseUrl + "/api" + path,
      method,
      data,
      header: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + (wx.getStorageSync("guiyan.token") || ""),
      },
      success: (r) => {
        if (r.statusCode >= 200 && r.statusCode < 300) resolve(r.data);
        else reject(new Error(r.data.error || "请求失败"));
      },
      fail: () =>
        reject(
          new Error("无法连接本地服务，请检查API地址和开发工具域名校验设置"),
        ),
    });
  });
}
function error(e) {
  wx.showToast({
    title: e.message || "操作失败",
    icon: "none",
    duration: 3000,
  });
}
function money(cents) {
  return "¥" + (Number(cents || 0) / 100).toFixed(2);
}
async function bootstrap() {
  const d = await request("/bootstrap"),
    base = getApp().globalData.baseUrl;
  d.categories = d.categories.map((c) =>
    Object.assign({}, c, { initial: c.name.slice(0, 1) }),
  );
  d.resources = d.resources.map((r) =>
    Object.assign({}, r, {
      image: base + r.image,
      priceText: money(r.price),
      ratingText: Number(r.rating || 0).toFixed(1),
      metaRows: Object.keys(r.meta)
        .filter(
          (k) => !["schedule", "seatRows", "seatCols", "preview"].includes(k),
        )
        .map((k) => ({
          key: k,
          value: Array.isArray(r.meta[k])
            ? r.meta[k].join("、")
            : String(r.meta[k]),
        })),
    }),
  );
  d.orders = d.orders.map((o) =>
    Object.assign({}, o, {
      image: base + o.image,
      amountText: money(o.amount),
      statusText: labels[o.status],
    }),
  );
  d.demands = d.demands.map((v) =>
    Object.assign({}, v, {
      budgetText: money(v.budget),
      statusText: labels[v.status],
    }),
  );
  return d;
}
function requireLogin() {
  if (wx.getStorageSync("guiyan.token")) return true;
  wx.navigateTo({ url: "/pages/login/login" });
  return false;
}
module.exports = { request, error, money, bootstrap, requireLogin, labels };
