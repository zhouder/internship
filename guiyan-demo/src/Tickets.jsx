import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { api, shortDate } from "./api";
import { useApp } from "./state";
import { Modal } from "./ui";
const names = { active: "待核销", used: "已核销", void: "已作废" };
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
          {names[t.status]}
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
  const { setToast } = useApp(),
    [tickets, setTickets] = useState([]),
    [qrs, setQrs] = useState({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [printing, setPrinting] = useState([]);
  async function load(issue = false) {
    setLoading(true);
    setError("");
    try {
      const r = await api("/orders/" + order.id + "/tickets", {
        method: issue ? "POST" : "GET",
      });
      setTickets(r.tickets);
      setQrs(
        Object.fromEntries(
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
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, [order.id]);
  useEffect(() => {
    if (!printing.length) return;
    const done = () => setPrinting([]);
    window.addEventListener("afterprint", done);
    const timer = setTimeout(() => {
      window.print();
      setPrinting([]);
    }, 200);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", done);
    };
  }, [printing]);
  async function print(rows) {
    try {
      await api("/demo/tickets/print", {
        method: "POST",
        body: { codes: rows.map((t) => t.code) },
      });
      setPrinting(rows);
    } catch (e) {
      setToast(e.message);
    }
  }
  return (
    <>
      <Modal title="电子票与自助打印（模拟）" onClose={onClose} wide>
        <div className="extension-stack">
          <p className="note">
            二维码只包含随机票码。打印日志记录的是请求；可在浏览器选择打印或保存PDF。
          </p>
          {loading ? <p>正在读取电子票…</p> : null}
          {error ? <p role="alert">{error}</p> : null}
          {!loading && !tickets.length && order.status === "paid" ? (
            <button className="button primary" onClick={() => load(true)}>
              生成演示电子票
            </button>
          ) : null}
          {tickets.length ? (
            <button className="button primary" onClick={() => print(tickets)}>
              批量打印 / 保存PDF
            </button>
          ) : null}
          {tickets.map((t) => (
            <div key={t.code}>
              <Ticket ticket={t} qr={qrs[t.code]} />
              <button className="text-button" onClick={() => print([t])}>
                打印此票
              </button>
            </div>
          ))}
        </div>
      </Modal>
      {printing.length
        ? createPortal(
            <div className="ticket-print-sheet">
              {printing.map((t) => (
                <Ticket key={t.code} ticket={t} qr={qrs[t.code]} />
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
