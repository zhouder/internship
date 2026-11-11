import { useState } from "react";
import { useApp } from "./state";
import { money, shortDate } from "./api";
export function Benefits() {
  const { data, action, busy } = useApp(),
    [amount, setAmount] = useState(500);
  const b = data.benefits || {
    balance: 0,
    coupons: [],
    claims: [],
    ledger: [],
  };
  const names = {
    available: "可使用",
    reserved: "订单占用中",
    used: "已使用",
    expired: "已过期",
  };
  return (
    <div className="benefits extension-stack">
      <div className="extension-card">
        <h3>
          模拟余额 <strong>{money(b.balance)}</strong>
        </h3>
        <p className="note">仅供演示，没有真实资金充值或扣款。</p>
        <form
          className="extension-inline"
          onSubmit={(e) => {
            e.preventDefault();
            action("/demo/wallet/recharge", {
              amount: Math.round(Number(amount) * 100),
            });
          }}
        >
          <label>
            模拟充值金额（元）
            <input
              aria-label="模拟充值金额"
              type="number"
              min="1"
              max="100000"
              step="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button disabled={busy} className="button primary">
            增加模拟余额
          </button>
        </form>
      </div>
      <h3>领券中心</h3>
      <div className="extension-grid">
        {b.coupons.map((c) => {
          const owned = b.claims.some((x) => x.coupon_code === c.code);
          return (
            <article className="extension-card" key={c.code}>
              <h4>{c.name}</h4>
              <p>
                满{money(c.min_spend)}减{money(c.amount)} · 领取后{c.valid_days}
                天有效
              </p>
              <button
                className="button"
                disabled={owned || busy}
                onClick={() => action("/demo/coupons/claim", { code: c.code })}
              >
                {owned ? "已领取" : "领取演示券"}
              </button>
            </article>
          );
        })}
      </div>
      <h3>我的优惠券</h3>
      {!b.claims.length ? (
        <p className="muted">暂无优惠券，领取后可在预约时选择。</p>
      ) : (
        b.claims.map((c) => (
          <div className="extension-card" key={c.code}>
            <strong>{c.name}</strong>
            <p>
              {names[c.status] || c.status} · 到期 {shortDate(c.expires_at)}
            </p>
          </div>
        ))
      )}
      <h3>模拟余额流水</h3>
      {!b.ledger.length ? (
        <p className="muted">暂无流水</p>
      ) : (
        b.ledger.map((x) => (
          <div className="extension-line" key={x.code}>
            <span>
              {
                {
                  recharge: "模拟充值",
                  payment: "订单支付",
                  refund: "订单退款",
                }[x.kind]
              }{" "}
              · {shortDate(x.created_at)}
            </span>
            <strong>
              {x.amount > 0 ? "+" : ""}
              {money(x.amount)}
            </strong>
          </div>
        ))
      )}
    </div>
  );
}
