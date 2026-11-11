import { Select } from "../Select";
import { useState } from "react";
import { useApp } from "../state";
import { PageTitle, Badge, Empty } from "../ui";
export function Moderation() {
  const { data, action, busy } = useApp();
  const [tab, setTab] = useState("comment"),
    [filter, setFilter] = useState("pending"),
    [replies, setReplies] = useState({});
  const rows = (
    tab === "comment"
      ? data.comments
      : tab === "message"
        ? data.moderatedMessages
        : data.demands
  ).filter((r) => !filter || r.status === filter);
  return (
    <>
      <PageTitle title="内容审核" subtitle="审核评论、合作需求与待核实私信" />
      <div className="filter-bar">
        <div className="category-tabs">
          <button
            className={tab === "comment" ? "active" : ""}
            onClick={() => setTab("comment")}
          >
            评分与评论
          </button>
          <button
            className={tab === "demand" ? "active" : ""}
            onClick={() => setTab("demand")}
          >
            合作需求
          </button>
        </div>
        <button
          className={`button ${tab === "message" ? "selected" : ""}`}
          onClick={() => setTab("message")}
        >
          合作私信
        </button>
        <Select
          aria-label="审核状态"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="pending">待审核</option>
          <option value="approved">已通过</option>
          <option value="rejected">已驳回</option>
          <option value="">全部状态</option>
        </Select>
      </div>
      <div className="moderation-list">
        {rows.map((r) => (
          <article className="panel moderation-item" key={r.id}>
            <div className="panel-head">
              <h3>{tab === "comment" ? r.resource_name : r.title}</h3>
              <Badge status={r.status} />
            </div>
            <p className="muted">
              {r.user_name}
              {tab === "comment" ? ` · ${r.rating}分` : ""}
            </p>
            {tab === "message" ? (
              <p className="muted">
                {r.sender_name} → {r.user_name}
              </p>
            ) : null}
            <p>{r.content || r.description}</p>
            {tab === "comment" ? (
              <input
                aria-label={"平台回复" + r.id}
                placeholder="平台回复（可选）"
                value={replies[r.id] ?? r.reply ?? ""}
                onChange={(e) =>
                  setReplies((s) => ({ ...s, [r.id]: e.target.value }))
                }
              />
            ) : null}
            <footer>
              <button
                className="button small primary"
                disabled={busy}
                onClick={() =>
                  action(
                    "/moderate",
                    {
                      type: tab,
                      id: r.id,
                      status: "approved",
                      reply: replies[r.id],
                    },
                    "内容已通过审核",
                  )
                }
              >
                {r.status === "approved" ? "保存回复" : "审核通过"}
              </button>
              <button
                className="button small"
                disabled={busy}
                onClick={() =>
                  action(
                    "/moderate",
                    { type: tab, id: r.id, status: "rejected" },
                    "内容已驳回",
                  )
                }
              >
                驳回
              </button>
            </footer>
          </article>
        ))}
      </div>
      {!rows.length ? <Empty text="当前没有需要处理的内容" /> : null}
    </>
  );
}
