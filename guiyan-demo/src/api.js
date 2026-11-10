export const statusNames = {
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
export const money = (value) =>
  `¥${(Number(value || 0) / 100).toLocaleString("zh-CN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const shortDate = (value) =>
  value
    ? new Date(new Date(value).getTime() + 8 * 3600000)
        .toISOString()
        .slice(0, 16)
        .replace("T", " ")
    : "—";
export function tokenKey() {
  return location.pathname.startsWith("/admin")
    ? "guiyan.admin.v1"
    : "guiyan.user.v1";
}
export async function api(path, { method = "GET", body } = {}) {
  const token = localStorage.getItem(tokenKey());
  const response = await fetch("/api" + path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "请求失败");
  return data;
}
export async function exportOrders() {
  const response = await fetch("/api/export", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem(tokenKey()) || ""}`,
    },
  });
  if (!response.ok) throw new Error("导出失败，请重新登录");
  downloadBlob(await response.blob(), "桂演订单报表.csv");
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadText(text, filename) {
  downloadBlob(
    new Blob([text], { type: "text/plain;charset=utf-8" }),
    filename,
  );
}
