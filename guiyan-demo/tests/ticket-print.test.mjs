import test from "node:test";
import assert from "node:assert/strict";
import { ticketPrintDocument, ticketLabel } from "../src/ticket-print.js";
const ticket = {
  code: "GYT123",
  resource_name: "演出 <img src=x onerror=alert(1)>",
  booking_date: "2099-01-01",
  session_time: "19:30",
  seat_label: "1排1座",
  status: "active",
};
const qr = "data:image/png;base64,aGVsbG8=";
test("电子票显示区分过期、售后和已核销，不能把历史票显示成有效待核销", () => {
  const current = { ...ticket, status: "active", order_status: "paid" };
  assert.equal(ticketLabel(current, "2026-11-11"), "待核销");
  assert.equal(
    ticketLabel({ ...current, booking_date: "2026-11-10" }, "2026-11-11"),
    "已过期",
  );
  assert.equal(
    ticketLabel({ ...current, order_status: "refund_requested" }, "2026-11-11"),
    "售后处理中，暂不可核销",
  );
  assert.equal(
    ticketLabel({ ...current, order_status: "refunded" }, "2026-11-11"),
    "已作废",
  );
  assert.equal(
    ticketLabel(
      { ...current, status: "used", booking_date: "2026-11-10" },
      "2026-11-11",
    ),
    "已核销",
  );
});
test("打印文档仅包含所选票据，转义业务文字并限制二维码来源", () => {
  const html = ticketPrintDocument(
    [ticket, { ...ticket, code: "GYT456", seat_label: "1排2座" }],
    { GYT123: qr, GYT456: qr },
  );
  assert.equal((html.match(/class="ticket"/g) || []).length, 2);
  assert.equal((html.match(/alt="演示票码二维码"/g) || []).length, 2);
  assert.ok(html.includes("演出 &lt;img src=x onerror=alert(1)&gt;"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("body > *"));
  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("img-src data:"));
  assert.ok(html.includes("1排2座"));
  assert.throws(
    () =>
      ticketPrintDocument([ticket], { GYT123: "https://example.com/qr.png" }),
    /二维码/,
  );
  assert.throws(() => ticketPrintDocument([ticket], {}), /二维码/);
  assert.throws(() => ticketPrintDocument([], {}), /没有可打印/);
});
