import { useEffect, useState } from "react";
import { useApp } from "../state";
import { money, api, downloadText, shortDate } from "../api";
import {
  PageTitle,
  SearchBox,
  Panel,
  Badge,
  Modal,
  FormField,
  SubmitButton,
} from "../ui";
import { TagRules } from "./TagRules";
export function Users() {
  const { data, action, busy, setToast } = useApp();
  const [query, setQuery] = useState(""),
    [tag, setTag] = useState(""),
    [city, setCity] = useState(""),
    [channel, setChannel] = useState(""),
    [selected, setSelected] = useState(null),
    [rules, setRules] = useState(false),
    [groupName, setGroupName] = useState(""),
    [savedId, setSavedId] = useState(""),
    [push, setPush] = useState(false),
    [content, setContent] = useState(""),
    [history, setHistory] = useState([]),
    [preview, setPreview] = useState([]);
  const groups = data.settings.segments || [],
    allTags = [...new Set(data.profiles.flatMap((u) => u.tags))];
  const rows = data.profiles.filter(
    (u) =>
      (!query || (u.name + u.city + u.tags.join("")).includes(query)) &&
      (!tag || u.tags.includes(tag)) &&
      (!city || u.city === city) &&
      (!channel || u.channel === channel),
  );
  const profile = data.profiles.find((u) => u.id === selected);
  useEffect(() => {
    let active = true;
    setHistory([]);
    setPreview([]);
    if (selected)
      api("/profiles/" + selected + "/history")
        .then((r) => {
          if (active) setHistory(r.snapshots);
        })
        .catch((e) => setToast(e.message));
    return () => {
      active = false;
    };
  }, [selected, setToast]);
  const csv = (value) =>
    '"' +
    String(value ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  function exportRows() {
    downloadText(
      "\uFEFF" +
        [
          [
            "用户编号",
            "姓名",
            "城市",
            "渠道",
            "有效付费金额(元)",
            "有效付费笔数",
            "标签",
          ],
          ...rows.map((u) => [
            u.id,
            u.name,
            u.city,
            u.channel,
            (u.spent / 100).toFixed(2),
            u.paid_count,
            u.tags.join("、"),
          ]),
        ]
          .map((r) => r.map(csv).join(","))
          .join("\r\n"),
      "桂演分群名单.csv",
    );
  }
  return (
    <>
      <PageTitle title="用户画像" subtitle="消费、兴趣与行为共同支撑用户运营">
        <button className="button" onClick={() => setRules(true)}>
          配置标签规则
        </button>
        <button
          className="button"
          disabled={busy}
          onClick={() => action("/profiles/snapshot", {})}
        >
          保存今日快照
        </button>
      </PageTitle>
      <div className="kpi-grid">
        {[
          ["用户档案", data.profiles.length],
          ...["高价值用户", "潜力会员", "沉默用户"].map((t) => [
            t,
            data.profiles.filter((u) => u.tags.includes(t)).length,
          ]),
        ].map(([label, n]) => (
          <button
            key={label}
            className="kpi"
            onClick={() =>
              setTag(label === "用户档案" ? "" : tag === label ? "" : label)
            }
          >
            <div>
              <span>{label}</span>
              <strong>{n}</strong>
              <small>点击筛选</small>
            </div>
          </button>
        ))}
      </div>
      <Panel title="分群条件与名单">
        <div className="segment-controls">
          <SearchBox
            value={query}
            onChange={setQuery}
            placeholder="搜索用户、城市或标签"
          />
          <select
            aria-label="用户分群"
            value={tag}
            onChange={(e) => {
              setTag(e.target.value);
              setSavedId("");
            }}
          >
            <option value="">全部标签</option>
            {allTags.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select
            aria-label="分群城市"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setSavedId("");
            }}
          >
            <option value="">全部城市</option>
            {[...new Set(data.profiles.map((u) => u.city))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="分群来源渠道"
            value={channel}
            onChange={(e) => {
              setChannel(e.target.value);
              setSavedId("");
            }}
          >
            <option value="">全部渠道</option>
            {[...new Set(data.profiles.map((u) => u.channel))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="segment-controls">
          <input
            aria-label="新分群名称"
            placeholder="为标签、城市和渠道条件命名"
            maxLength={40}
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
          />
          <button
            className="button"
            disabled={busy || !groupName.trim() || groups.length >= 30}
            onClick={async () => {
              const id = "segment-" + Date.now();
              const r = await action(
                "/settings",
                {
                  segments: [
                    ...groups,
                    { id, name: groupName.trim(), tag, city, channel },
                  ],
                },
                "分群已保存",
                "PATCH",
              );
              if (r) {
                setSavedId(id);
                setGroupName("");
                setQuery("");
              }
            }}
          >
            保存当前分群
          </button>
          <select
            aria-label="已保存分群"
            value={savedId}
            onChange={(e) => {
              setSavedId(e.target.value);
              const g = groups.find((g) => g.id === e.target.value);
              if (g) {
                setTag(g.tag);
                setCity(g.city);
                setChannel(g.channel);
                setQuery("");
              }
            }}
          >
            <option value="">选择已保存分群</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <button className="button" onClick={exportRows}>
            导出当前名单
          </button>
          <button
            className="button"
            disabled={!savedId || busy}
            onClick={() => setPush(true)}
          >
            分群站内通知
          </button>
          <button
            className="text-button"
            disabled={!savedId || busy}
            onClick={async () => {
              if (
                await action(
                  "/settings",
                  { segments: groups.filter((g) => g.id !== savedId) },
                  "分群已删除",
                  "PATCH",
                )
              )
                setSavedId("");
            }}
          >
            删除分群
          </button>
        </div>
        <p className="note">
          当前 {rows.length} 人，占全部用户{" "}
          {data.profiles.length
            ? ((rows.length / data.profiles.length) * 100).toFixed(1)
            : 0}
          %。保存条件不包含自由搜索词；人数按当前数据实时计算。
        </p>
      </Panel>
      <Panel title={`用户档案 · ${rows.length}人`}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {[
                  "用户",
                  "城市 / 年龄",
                  "来源渠道",
                  "有效支付金额",
                  "付费 / 历史订单",
                  "自动标签",
                  "操作",
                ].map((t) => (
                  <th key={t}>{t}</th>
                ))}
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
                  <td>
                    {u.paid_count} / {u.order_count}
                  </td>
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
                      onClick={() => setSelected(u.id)}
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
        标签由已启用规则即时计算；默认潜力会员需要累计支付、复购与近期消费同时满足。退款成功订单不计消费金额。规则可由运营调整。
      </p>
      {rules ? <TagRules onClose={() => setRules(false)} /> : null}
      {push ? (
        <Modal title="向分群发送模拟站内通知" onClose={() => setPush(false)}>
          <form
            className="form"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await action("/segments/notify", {
                  segmentId: savedId,
                  content,
                })
              ) {
                setPush(false);
                setContent("");
              }
            }}
          >
            <p>
              接收分群：{groups.find((g) => g.id === savedId)?.name}
              ；按已保存条件实时圈选，不发送外部短信。
            </p>
            <FormField label="通知内容">
              <textarea
                required
                maxLength={500}
                value={content}
                onChange={(e) => setContent(e.target.value)}
              />
            </FormField>
            <SubmitButton busy={busy}>发送模拟站内通知</SubmitButton>
          </form>
        </Modal>
      ) : null}
      {profile ? (
        <Modal title="用户画像详情" onClose={() => setSelected(null)} wide>
          <div className="profile-header">
            <div className="avatar">{profile.name[0]}</div>
            <div>
              <h2>{profile.name}</h2>
              <p>
                {profile.city} · {profile.gender} · {profile.age}岁
              </p>
            </div>
          </div>
          <div className="tags">
            {profile.tags.map((t) => (
              <Badge key={t}>{t}</Badge>
            ))}
          </div>
          <dl className="profile-dl">
            <dt>来源渠道</dt>
            <dd>{profile.channel}</dd>
            <dt>有效消费</dt>
            <dd>
              {money(profile.spent)} / {profile.paid_count}笔有效付费订单
            </dd>
            <dt>平均客单价</dt>
            <dd>{money(profile.portrait.pricePreference)}</dd>
            <dt>票价偏好区间</dt>
            <dd>
              {profile.portrait.priceBand}；
              {profile.portrait.priceDistribution
                .map((b) => b.name + " " + b.count + "份")
                .join("、")}
            </dd>
            <dt>最近消费</dt>
            <dd>
              {profile.last_order ? shortDate(profile.last_order) : "暂无"}；
              {profile.days_since_payment === 99999
                ? "尚未付费"
                : "距今" + profile.days_since_payment + "天"}
            </dd>
            <dt>运营建议</dt>
            <dd>{profile.suggestion}</dd>
            <dt>储值与支付</dt>
            <dd>未接入真实储值；仅模拟支付</dd>
            <dt>互动记录</dt>
            <dd>
              收藏 {profile.favorite_count} 项 · 浏览 {profile.view_count} 次
            </dd>
          </dl>
          <button
            className="button"
            onClick={async () => {
              try {
                setPreview(
                  (
                    await api("/recommendations?userId=" + profile.id)
                  ).recommendations.slice(0, 5),
                );
              } catch (e) {
                setToast(e.message);
              }
            }}
          >
            试算此用户推荐
          </button>
          {preview.length ? (
            <ol className="recommendation-preview">
              {preview.map((r) => (
                <li key={r.resourceId}>
                  {data.resources.find((x) => x.id === r.resourceId)?.name}：
                  {r.reason}（{r.score}分）
                </li>
              ))}
            </ol>
          ) : null}
          <h3>画像按日快照</h3>
          <p className="note">
            从点击“保存今日快照”开始留存；不伪造历史。同日保存会更新该日结果。
          </p>
          {history.length ? (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>保存日期</th>
                    <th>累计支付</th>
                    <th>付费笔数</th>
                    <th>当时标签</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h.date}>
                      <td>{h.date}</td>
                      <td>{money(h.profile.spent)}</td>
                      <td>{h.profile.paid_count}</td>
                      <td>{h.profile.tags.join("、")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">尚无快照，请关闭详情后保存今日快照。</p>
          )}
        </Modal>
      ) : null}
    </>
  );
}
