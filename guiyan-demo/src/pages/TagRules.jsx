import { useState } from "react";
import { useApp } from "../state";
import { Modal, FormField, SubmitButton } from "../ui";
const fields = {
  spent: "累计支付（元）",
  paid_count: "有效付费订单数",
  days_since_payment: "距上次消费（天）",
  view_count: "浏览次数",
  favorite_count: "收藏数量",
  preference: "兴趣分类",
  view_category: "浏览分类",
  city: "城市",
  channel: "来源渠道",
};
const numeric = (field) =>
  [
    "spent",
    "paid_count",
    "days_since_payment",
    "view_count",
    "favorite_count",
  ].includes(field);
export function TagRules({ onClose }) {
  const { data, action, busy } = useApp();
  const [rules, setRules] = useState(() =>
    structuredClone(data.settings.tagRules),
  );
  const edit = (i, key, value) =>
    setRules((rows) =>
      rows.map((r, n) => (n === i ? { ...r, [key]: value } : r)),
    );
  const condition = (i, j, key, value) =>
    setRules((rows) =>
      rows.map((r, n) =>
        n === i
          ? {
              ...r,
              conditions: r.conditions.map((c, k) =>
                k === j
                  ? {
                      ...c,
                      [key]: value,
                      ...(key === "field"
                        ? {
                            op: numeric(value) ? "gte" : "eq",
                            value: numeric(value)
                              ? 0
                              : value.includes("category") ||
                                  value === "preference"
                                ? "heritage"
                                : "南宁",
                          }
                        : {}),
                    }
                  : c,
              ),
            }
          : r,
      ),
    );
  return (
    <Modal title="配置自动标签规则" onClose={onClose} wide>
      <form
        className="form"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await action(
            "/settings",
            { tagRules: rules },
            "标签规则已保存，用户画像已重新计算",
            "PATCH",
          );
          if (r) onClose();
        }}
      >
        <p className="note">
          条件可组合，保存后立即重算。金额单位为元；未付费用户不会被默认划为潜力会员。
        </p>
        {rules.map((r, i) => (
          <fieldset className="tag-rule" key={r.id}>
            <div className="form-row">
              <FormField label="标签名称">
                <input
                  required
                  maxLength={20}
                  value={r.name}
                  onChange={(e) => edit(i, "name", e.target.value)}
                />
              </FormField>
              <FormField label="条件关系">
                <select
                  value={r.match}
                  onChange={(e) => edit(i, "match", e.target.value)}
                >
                  <option value="all">全部满足</option>
                  <option value="any">任一满足</option>
                </select>
              </FormField>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={r.enabled}
                  onChange={(e) => edit(i, "enabled", e.target.checked)}
                />
                启用
              </label>
              <button
                className="text-button"
                type="button"
                onClick={() =>
                  setRules((rows) => rows.filter((_, n) => i !== n))
                }
              >
                删除规则
              </button>
            </div>
            {r.conditions.map((c, j) => (
              <div className="rule-condition" key={j}>
                <select
                  aria-label={`规则${i + 1}条件${j + 1}维度`}
                  value={c.field}
                  onChange={(e) => condition(i, j, "field", e.target.value)}
                >
                  {Object.entries(fields).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`规则${i + 1}条件${j + 1}比较`}
                  value={c.op}
                  onChange={(e) => condition(i, j, "op", e.target.value)}
                >
                  {(numeric(c.field)
                    ? [
                        ["gte", "大于等于"],
                        ["lte", "小于等于"],
                        ["gt", "大于"],
                        ["lt", "小于"],
                        ["eq", "等于"],
                      ]
                    : [["eq", "等于"]]
                  ).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                {["preference", "view_category"].includes(c.field) ? (
                  <select
                    aria-label={`规则${i + 1}条件${j + 1}值`}
                    value={c.value}
                    onChange={(e) => condition(i, j, "value", e.target.value)}
                  >
                    {data.categories.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    aria-label={`规则${i + 1}条件${j + 1}值`}
                    required
                    type={numeric(c.field) ? "number" : "text"}
                    min="0"
                    step={c.field === "spent" ? ".01" : "1"}
                    value={c.field === "spent" ? c.value / 100 : c.value}
                    onChange={(e) =>
                      condition(
                        i,
                        j,
                        "value",
                        numeric(c.field)
                          ? Math.round(
                              Number(e.target.value) *
                                (c.field === "spent" ? 100 : 1),
                            )
                          : e.target.value,
                      )
                    }
                  />
                )}
                <button
                  className="text-button"
                  type="button"
                  disabled={r.conditions.length === 1}
                  onClick={() =>
                    edit(
                      i,
                      "conditions",
                      r.conditions.filter((_, n) => n !== j),
                    )
                  }
                >
                  移除条件
                </button>
              </div>
            ))}
            <button
              type="button"
              className="text-button"
              disabled={r.conditions.length >= 6}
              onClick={() =>
                edit(i, "conditions", [
                  ...r.conditions,
                  { field: "paid_count", op: "gte", value: 1 },
                ])
              }
            >
              添加条件
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button"
          disabled={rules.length >= 20}
          onClick={() =>
            setRules((rows) => [
              ...rows,
              {
                id: "rule-" + Date.now(),
                name: "",
                enabled: true,
                match: "all",
                conditions: [{ field: "paid_count", op: "gte", value: 1 }],
              },
            ])
          }
        >
          新增标签规则
        </button>
        <SubmitButton busy={busy}>保存规则并重算</SubmitButton>
      </form>
    </Modal>
  );
}
