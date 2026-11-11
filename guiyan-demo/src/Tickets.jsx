import { useCallback, useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api, shortDate } from "./api";
import { useApp } from "./state";
import { Modal } from "./ui";
import { printTickets, ticketLabel } from "./ticket-print";
function Ticket({ ticket: t, qr }) {
  return (
    <article className="demo-ticket">
      <div>
        <span className="eyebrow">桂演 · 演示电子票</span>
        <h3>{t.resource_name}</h3>
        <p>
          {t.booking_date} · {t.session_time} · {t.seat_label}
        </p>
        <p>
          {ticketLabel(t)}
          {t.verified_at ? " · " + shortDate(t.verified_at) : ""}
        </p>
        <code>{t.code}</code>
        <p className="note">模拟凭证，不用于真实入场；服务端核销一次有效。</p>
      </div>
      {qr ? (
        <img src={qr} width="132" height="132" alt="演示票码二维码" />
      ) : null}
    </article>
  );
}
export function Tickets({ order, onClose }) {
  const { data, setToast } = useApp(),
    [tickets, setTickets] = useState([]),
    [qrs, setQrs] = useState({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [printing, setPrinting] = useState(false);
  const printLock = useRef(false);
  const loadSequence = useRef(0);
  const canIssue = order.status === "paid" && order.booking_date >= data.today;
  const load = useCallback(
    async (issue = false) => {
      const sequence = ++loadSequence.current;
      setLoading(true);
      setError("");
      try {
        const r = await api("/orders/" + order.id + "/tickets", {
          method: issue ? "POST" : "GET",
        });
        const nextQrs = Object.fromEntries(
          await Promise.all(
            r.tickets.map(async (t) => [
              t.code,
              await QRCode.toDataURL(t.code, {
                width: 160,
                margin: 1,
                errorCorrectionLevel: "M",
              }),
            ]),
          ),
        );
        if (sequence !== loadSequence.current) return;
        setTickets(r.tickets);
        setQrs(nextQrs);
      } catch (e) {
        if (sequence === loadSequence.current) setError(e.message);
      } finally {
        if (sequence === loadSequence.current) setLoading(false);
      }
    },
    [order.id],
  );
  useEffect(() => {
    load();
    return () => {
      loadSequence.current++;
    };
  }, [load, order.status]);
  async function print(rows) {
    if (printLock.current) return;
    printLock.current = true;
    setPrinting(true);
    try {
      await api("/demo/tickets/print", {
        method: "POST",
        body: { codes: rows.map((t) => t.code) },
      });
      await printTickets(rows, qrs);
    } catch (e) {
      setToast(e.message);
    } finally {
      printLock.current = false;
      setPrinting(false);
    }
  }
  return (
    <>
      <Modal title="电子票与自助打印（模拟）" onClose={onClose} wide>
        <div
          className="extension-stack ticket-dialog-body"
          style={{ "--ticket-count": Math.min(order.quantity || 1, 3) }}
        >
          <p className="note">
            二维码只包含随机票码。打印日志记录的是请求；可在浏览器选择打印或保存PDF。
          </p>
          {loading && !tickets.length ? (
            <div className="ticket-loading" role="status">
              <span>正在读取电子票与二维码…</span>
              <div className="ticket-loading-card" />
              {order.quantity > 1 ? (
                <div className="ticket-loading-card" />
              ) : null}
            </div>
          ) : null}
          {error ? <p role="alert">{error}</p> : null}
          {!loading && !tickets.length && canIssue ? (
            <button className="button primary" onClick={() => load(true)}>
              生成演示电子票
            </button>
          ) : null}
          {!loading && !error && !tickets.length && !canIssue ? (
            <p className="note">
              该订单没有电子票；历史已过期、已退款或已结束的订单不再补发新票。
            </p>
          ) : null}
          <div className="ticket-dialog-tools">
            <button
              className="button small"
              disabled={loading || printing}
              onClick={() => load()}
            >
              刷新票据
            </button>
            {loading && tickets.length ? (
              <span className="muted" role="status">
                正在更新票状态…
              </span>
            ) : null}
          </div>
          {tickets.length ? (
            <button
              className="button primary"
              disabled={
                printing || loading || tickets.some((t) => !qrs[t.code])
              }
              onClick={() => print(tickets)}
            >
              {printing ? "打印处理中…" : "批量打印 / 保存PDF"}
            </button>
          ) : null}
          {tickets.map((t) => (
            <div key={t.code}>
              <Ticket ticket={t} qr={qrs[t.code]} />
              <button
                className="text-button"
                disabled={printing || loading || !qrs[t.code]}
                onClick={() => print([t])}
              >
                打印此票
              </button>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
