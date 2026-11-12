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
export async function api(
  path,
  { method = "GET", body, signal, timeoutMs = 60000 } = {},
) {
  const key = tokenKey(),
    token = localStorage.getItem(key),
    controller = new AbortController();
  const abort = () => controller.abort(signal?.reason);
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch("/api" + path, {
      method,
      headers: {
        "X-Guiyan-Channel": location.pathname.startsWith("/h5") ? "H5" : "web",
        ...(body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw Object.assign(new Error("服务返回异常，请刷新页面核对结果后再试"), {
        status: response.status >= 400 ? response.status : 502,
      });
    }
    if (!response.ok) {
      if (
        response.status === 401 &&
        path !== "/login" &&
        token &&
        localStorage.getItem(key) === token
      ) {
        localStorage.removeItem(key);
        window.dispatchEvent(new Event("guiyan:session-expired"));
      }
      throw Object.assign(
        new Error(
          data.error || `服务暂时不可用（${response.status}），请稍后重试`,
        ),
        { status: response.status },
      );
    }
    return data;
  } catch (e) {
    if (signal?.aborted) throw e;
    if (controller.signal.aborted)
      throw new Error("请求超时，请刷新核对操作结果后再试");
    if (e instanceof TypeError)
      throw new Error("无法连接服务，请检查网络后重试");
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export async function exportOrders(period, range = "all") {
  const response = await fetch("/api/export" + (period ? "?" + new URLSearchParams({period, range}) : ""), {
    headers: {
      Authorization: `Bearer ${localStorage.getItem(tokenKey()) || ""}`,
    },
  });
  if (!response.ok) throw new Error("导出失败，请重新登录");
  downloadBlob(await response.blob(), period ? `桂演${{day:"日",week:"周",month:"月",quarter:"季度"}[period]}统计.csv` : "桂演订单报表.csv");
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
