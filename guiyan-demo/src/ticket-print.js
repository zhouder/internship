const escapeHtml = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const status = { active: "待核销", used: "已核销", void: "已作废" };
export function ticketLabel(
  ticket,
  today = new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10),
) {
  if (ticket.status !== "active") return status[ticket.status] || ticket.status;
  if (["refunded", "cancelled", "completed"].includes(ticket.order_status))
    return "已作废";
  if (ticket.booking_date < today) return "已过期";
  if (["refund_requested", "disputed"].includes(ticket.order_status))
    return "售后处理中，暂不可核销";
  return "待核销";
}

export function ticketPrintDocument(tickets, qrs) {
  if (!tickets.length) throw new Error("没有可打印的电子票");
  const cards = tickets
    .map((t) => {
      const qr = qrs[t.code];
      if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(qr || ""))
        throw new Error("二维码尚未加载完成，请稍后再试");
      return `<article class="ticket"><div><small>桂演 · 演示电子票</small><h1>${escapeHtml(t.resource_name)}</h1><p>${escapeHtml(t.booking_date)} · ${escapeHtml(t.session_time)} · ${escapeHtml(t.seat_label)}</p><p>${escapeHtml(ticketLabel(t))}</p><code>${escapeHtml(t.code)}</code><p class="note">模拟凭证，不用于真实入场；服务端核销一次有效。</p></div><img src="${qr}" width="132" height="132" alt="演示票码二维码"></article>`;
    })
    .join("");
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><title>桂演电子票</title><style>@page{size:A4;margin:12mm}*{box-sizing:border-box}body{margin:0;background:white;color:#222;font-family:"Microsoft YaHei","PingFang SC",sans-serif;font-size:14px}.ticket{display:flex;align-items:center;justify-content:space-between;gap:20px;border:1px dashed #ab9b90;border-radius:10px;padding:20px;margin:0 0 18px;break-inside:avoid;page-break-inside:avoid}.ticket>div{min-width:0}h1{font-size:20px;line-height:1.5;margin:12px 0}p{line-height:1.7;margin:8px 0}code{font-size:12px;overflow-wrap:anywhere}.note{font-size:11px;color:#666}img{flex:none;object-fit:contain;image-rendering:pixelated}</style></head><body>${cards}</body></html>`;
}

// Print only an isolated, same-origin document. The application never switches
// print styles or hides its root, and the frame survives asynchronous previews.
export function printTickets(tickets, qrs) {
  const html = ticketPrintDocument(tickets, qrs);
  return new Promise((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "电子票打印文档";
    frame.setAttribute("aria-hidden", "true");
    frame.tabIndex = -1;
    frame.setAttribute("sandbox", "allow-same-origin allow-modals");
    Object.assign(frame.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "794px",
      height: "1123px",
      border: "0",
      pointerEvents: "none",
    });
    let cleanupTimer,
      loadTimer,
      done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      clearTimeout(cleanupTimer);
      clearTimeout(loadTimer);
      frame.remove();
      resolve();
    };
    const fail = (e) => {
      if (done) return;
      done = true;
      clearTimeout(cleanupTimer);
      clearTimeout(loadTimer);
      frame.remove();
      reject(e);
    };
    loadTimer = setTimeout(
      () => fail(new Error("打印文档加载超时，请重试")),
      15000,
    );
    frame.onload = async () => {
      try {
        const win = frame.contentWindow,
          doc = frame.contentDocument;
        if (!win || !doc) throw new Error("无法打开打印文档");
        await Promise.all([...doc.images].map((img) => img.decode()));
        if (doc.fonts) await doc.fonts.ready;
        await new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );
        if (done) return;
        clearTimeout(loadTimer);
        win.addEventListener("afterprint", cleanup, { once: true });
        // Some mobile browsers omit afterprint; keep the document alive long
        // enough for preview/save instead of deleting it when print() returns.
        cleanupTimer = setTimeout(cleanup, 180000);
        win.print();
      } catch (e) {
        fail(e);
      }
    };
    frame.srcdoc = html;
    document.body.append(frame);
  });
}
