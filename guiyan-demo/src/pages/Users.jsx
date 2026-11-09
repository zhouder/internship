import { useState } from "react";
import { useApp } from "../state";
import { money } from "../api";
import { PageTitle, SearchBox, Panel, Badge, Modal } from "../ui";
export function Users() {
  const { data } = useApp();
  const [query, setQuery] = useState(""),
    [segment, setSegment] = useState(""),
    [selected, setSelected] = useState(null);
  const rows = data.profiles.filter(
    (u) =>
      (!query || (u.name + u.city + u.tags.join("")).includes(query)) &&
      (!segment || u.tags.includes(segment)),
  );
  return (
    <>
      <PageTitle
        title="用户画像"
        subtitle="一人一档，以消费与兴趣连接演艺服务"
      />
      <div className="kpi-grid">
        <div className="kpi">
          <div>
            <span>用户档案</span>
            <strong>{data.profiles.length}</strong>
            <small>基础属性与偏好覆盖</small>
          </div>
        </div>
        {["高价值用户", "潜力会员", "新用户"].map((t) => (
          <button
            className={`kpi ${segment === t ? "selected" : ""}`}
            key={t}
            onClick={() => setSegment(segment === t ? "" : t)}
          >
            <div>
              <span>{t}</span>
              <strong>
                {data.profiles.filter((u) => u.tags.includes(t)).length}
              </strong>
              <small>点击筛选分群</small>
            </div>
          </button>
        ))}
      </div>
      <div className="filter-bar">
        <SearchBox
          value={query}
          onChange={setQuery}
          placeholder="搜索用户、城市或标签"
        />
        <select
          aria-label="用户分群"
          value={segment}
          onChange={(e) => setSegment(e.target.value)}
        >
          <option value="">全部分群</option>
          {["高价值用户", "潜力会员", "新用户", "高频观演", "待培育"].map(
            (t) => (
              <option key={t}>{t}</option>
            ),
          )}
        </select>
      </div>
      <Panel title={`用户档案 · ${rows.length}人`}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>用户</th>
                <th>城市 / 年龄</th>
                <th>来源渠道</th>
                <th>交易金额</th>
                <th>订单数</th>
                <th>自动标签</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small className="block muted">{u.username}</small>
                  </td>
                  <td>
                    {u.city} · {u.age}岁
                  </td>
                  <td>{u.channel}</td>
                  <td>{money(u.spent)}</td>
                  <td>{u.order_count}</td>
                  <td>
                    <div className="tags">
                      {u.tags.map((t) => (
                        <span key={t}>{t}</span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <button
                      className="text-button"
                      onClick={() => setSelected(u)}
                    >
                      查看画像
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <p className="note">
        标签按实际模拟订单即时计算：交易额超过10,000元为高价值用户；否则订单超过2笔为潜力会员。画像建议为本地规则结果。
      </p>
      {selected ? (
        <Modal title="用户画像详情" onClose={() => setSelected(null)}>
          <div className="profile-header">
            <div className="avatar">{selected.name[0]}</div>
            <div>
              <h2>{selected.name}</h2>
              <p>
                {selected.city} · {selected.gender} · {selected.age}岁
              </p>
            </div>
          </div>
          <div className="tags">
            {selected.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <dl className="profile-dl">
            <dt>来源</dt>
            <dd>{selected.channel}</dd>
            <dt>消费能力</dt>
            <dd>
              {money(selected.spent)} / {selected.order_count}笔订单
            </dd>
            <dt>观演偏好</dt>
            <dd>
              {data.categories.find((c) => c.id === selected.preference)?.name}
            </dd>
            <dt>运营建议</dt>
            <dd>{selected.suggestion}</dd>
            <dt>票价偏好</dt>
            <dd>
              按累计支付额与订单数估算：
              {money(selected.portrait.pricePreference)}
            </dd>
            <dt>储值与支付</dt>
            <dd>
              演示储值余额 {money(selected.portrait.balance)} ·{" "}
              {selected.portrait.payment}
            </dd>
            <dt>行为偏好</dt>
            <dd>
              最近购票时段 {selected.portrait.purchaseWindow} ·{" "}
              {selected.portrait.repeat}
            </dd>
            <dt>站内互动</dt>
            <dd>
              收藏 {selected.portrait.favorites} 项 · 浏览事件{" "}
              {selected.portrait.views} 次
            </dd>
            <dt>前端联动</dt>
            <dd>登录后首页优先展示所选兴趣分类的资源，可在“我的”修改偏好。</dd>
          </dl>
        </Modal>
      ) : null}
    </>
  );
}
