import { useState } from "react";
import { FileText, Download, Package, ShieldCheck } from "lucide-react";
import { useApp } from "../state";
import {
  api,
  money,
  shortDate,
  statusNames,
  downloadText,
  exportOrders,
} from "../api";
import {
  PageTitle,
  SearchBox,
  Badge,
  Empty,
  Modal,
  FormField,
  SubmitButton,
} from "../ui";
export function OrderActions({ order: o, onContract }) {
  const { data, action, busy } = useApp(),
    admin = data.user?.role === "admin";
  const [reason, setReason] = useState("");
  const mutate = (act) =>
    action(
      "/orders/" + o.id,
      { action: act, reason: reason || "用户提交售后申请" },
      act === "pay" ? "模拟支付成功，未扣款" : "订单已更新",
      "PATCH",
    );
  return (
    <>
      <div className="order-actions">
        {admin && o.status === "pending" ? (
          <>
            <button
              className="button small primary"
              disabled={busy}
              onClick={() => mutate("confirm")}
            >
              确认预约
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => mutate("reject")}
            >
              驳回
            </button>
          </>
        ) : null}
        {o.status === "confirmed" ? (
          <button
            className="button small primary"
            disabled={busy}
            onClick={() => mutate("pay")}
          >
            模拟支付
          </button>
        ) : null}
        {["pending", "confirmed"].includes(o.status) ? (
          <button
            className="button small"
            disabled={busy}
            onClick={() => mutate("cancel")}
          >
            取消预约
          </button>
        ) : null}
        {o.status === "paid" ? (
          <>
            <button
              className="button small primary"
              disabled={busy}
              onClick={() => mutate("complete")}
            >
              确认完成
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => mutate("refund")}
            >
              申请退款
            </button>
            <button
              className="button small"
              disabled={busy}
              onClick={() => mutate("dispute")}
            >
              提交申诉
            </button>
          </>
        ) : null}
        {admin && ["refund_requested", "disputed"].includes(o.status) ? (
          <button
            className="button small"
            disabled={busy}
            onClick={() => mutate("approveRefund")}
          >
            同意退款
          </button>
        ) : null}
        {admin && o.status === "disputed" ? (
          <button
            className="button small"
            disabled={busy}
            onClick={() => mutate("resolve")}
          >
            调解完成并结算
          </button>
        ) : null}
        <button className="button small" onClick={() => onContract(o)}>
          <FileText size={14} />
          协议 / 权益
        </button>
      </div>
      {o.status === "paid" ? (
        <input
          className="reason-input"
          aria-label="退款或申诉原因"
          placeholder="退款或申诉原因（可选）"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      ) : null}
    </>
  );
}
export function Transactions({ mobile = false }) {
  const { data, setToast } = useApp();
  const [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [contract, setContract] = useState(null);
  const rows = data.orders.filter(
    (o) =>
      (!status || o.status === status) &&
      (!query || (o.code + o.resource_name + o.user_name).includes(query)),
  );
  async function showContract(o) {
    try {
      const c = await api("/orders/" + o.id + "/contract");
      setContract({ ...c, order: o });
    } catch (e) {
      setToast(e.message);
    }
  }
  return (
    <>
      <PageTitle
        title={mobile ? "我的订单" : "交易管理"}
        subtitle="预约、模拟支付、托管与售后处理"
      >
        {!mobile ? (
          <button
            className="button primary"
            onClick={() => exportOrders().catch((e) => setToast(e.message))}
          >
            <Download size={15} />
            导出订单
          </button>
        ) : null}
      </PageTitle>
      <div className="filter-bar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="搜索订单编号或资源名称"
        />
        <select
          aria-label="订单状态筛选"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">全部状态</option>
          {Object.entries(statusNames)
            .filter(
              ([k]) =>
                !["approved", "rejected", "published", "draft"].includes(k),
            )
            .map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
        </select>
      </div>
      <div className="order-list">
        {rows.map((o) => (
          <article className="order-card" key={o.id}>
            <header>
              <span>{o.code}</span>
              <Badge status={o.status} />
            </header>
            <div className="order-info">
              <img src={o.image} alt={o.resource_name + "示意图"} />
              <div>
                <h3>{o.resource_name}</h3>
                <p>
                  {o.booking_date} · {o.quantity}
                  {o.unit} · {o.channel}
                </p>
                {!mobile ? <p>预约人：{o.user_name}</p> : null}
                <p className="muted">{shortDate(o.created_at)}</p>
              </div>
              <strong>{money(o.amount)}</strong>
            </div>
            <div className="order-extras">
              <span>
                <ShieldCheck size={14} />
                {o.escrow}
              </span>
              {o.category === "creative" ? (
                <span>
                  <Package size={14} />
                  {["paid", "completed"].includes(o.status)
                    ? "模拟物流：运输中，DEMO" + o.id
                    : "付款后生成模拟物流"}
                </span>
              ) : null}
              {o.category === "digital" &&
              ["paid", "completed"].includes(o.status) ? (
                <span>点播权益已激活（模拟）</span>
              ) : null}
            </div>
            {o.refund_reason ? (
              <p className="note">售后原因：{o.refund_reason}</p>
            ) : null}
            <OrderActions order={o} onContract={showContract} />
          </article>
        ))}
      </div>
      {!rows.length ? <Empty text="暂无符合条件的订单" /> : null}
      {contract ? (
        <Modal title={contract.title} onClose={() => setContract(null)}>
          <pre className="contract-text">{contract.content}</pre>
          <button
            className="button primary"
            onClick={() =>
              downloadText(
                contract.content,
                contract.order.code + "-模拟协议.txt",
              )
            }
          >
            <Download size={15} />
            下载模拟协议
          </button>
        </Modal>
      ) : null}
    </>
  );
}
