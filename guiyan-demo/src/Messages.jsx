import { Select } from "./Select";
import { useState } from "react";
import { useApp } from "./state";
import { PageTitle, Empty, Badge, FormField, SubmitButton } from "./ui";
import { shortDate, money } from "./api";
export function Messages() {
  const { data, action, busy } = useApp();
  const [tab, setTab] = useState("system"),
    [selected, setSelected] = useState(null),
    [peer, setPeer] = useState(""),
    [content, setContent] = useState("");
  const incoming = data.messages.filter((m) => m.user_id === data.user.id);
  const systems = incoming.filter((m) => m.kind !== "private");
  const thread = data.messages
    .filter(
      (m) =>
        m.kind === "private" &&
        ((m.sender_id === data.user.id && m.user_id === Number(peer)) ||
          (m.user_id === data.user.id && m.sender_id === Number(peer))),
    )
    .sort((a, b) => a.id - b.id);
  async function open(m) {
    setSelected(m);
    if (!m.is_read) await action("/messages/read", { id: m.id });
  }
  async function choosePeer(id) {
    setPeer(id);
    for (const m of incoming.filter(
      (m) => m.kind === "private" && m.sender_id === Number(id) && !m.is_read,
    ))
      await action("/messages/read", { id: m.id });
  }
  const detail = selected
    ? data.messages.find((m) => m.id === selected.id) || selected
    : null;
  const order = detail?.related_order_id
    ? data.orders.find((o) => o.id === detail.related_order_id)
    : null;
  return (
    <>
      <PageTitle title="消息与私信">
        <button
          className="text-button"
          disabled={busy}
          onClick={() => action("/messages/read", {}, "消息已全部标为已读")}
        >
          全部已读
        </button>
      </PageTitle>
      <div className="category-tabs">
        <button
          className={tab === "system" ? "active" : ""}
          onClick={() => setTab("system")}
        >
          平台通知
        </button>
        <button
          className={tab === "private" ? "active" : ""}
          onClick={() => setTab("private")}
        >
          合作私信{" "}
          {incoming.filter((m) => m.kind === "private" && !m.is_read).length ||
            ""}
        </button>
      </div>
      {tab === "system" ? (
        detail ? (
          <article className="message-detail">
            <button className="text-button" onClick={() => setSelected(null)}>
              返回通知列表
            </button>
            <h3>{detail.title}</h3>
            <p>{detail.content}</p>
            <small>{shortDate(detail.created_at)} · 已读</small>
            {order ? (
              <div className="info-box">
                关联订单：{order.code} · {order.resource_name} ·{" "}
                {money(order.amount)}
                <Badge status={order.status} />
              </div>
            ) : null}
          </article>
        ) : (
          <div className="message-list">
            {systems.map((m) => (
              <article key={m.id} className={m.is_read ? "" : "unread"}>
                <button className="message-open" onClick={() => open(m)}>
                  <h3>
                    {m.title}
                    {!m.is_read ? " · 未读" : ""}
                  </h3>
                  <p>{m.content}</p>
                  <small>{shortDate(m.created_at)} · 查看详情</small>
                </button>
              </article>
            ))}
            {!systems.length ? <Empty text="暂无平台通知" /> : null}
          </div>
        )
      ) : (
        <section className="conversation">
          <FormField label="选择联系人">
            <Select
              aria-label="私信联系人"
              value={peer}
              onChange={(e) => choosePeer(e.target.value)}
            >
              <option value="">请选择联系人</option>
              {data.members
                .filter((u) => u.id !== data.user.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                    {incoming.some(
                      (m) =>
                        m.kind === "private" &&
                        m.sender_id === u.id &&
                        !m.is_read,
                    )
                      ? " · 有未读"
                      : ""}
                  </option>
                ))}
            </Select>
          </FormField>
          {peer ? (
            <>
              <div className="conversation-thread" aria-live="polite">
                {thread.map((m) => (
                  <article
                    key={m.id}
                    className={
                      m.sender_id === data.user.id ? "sent" : "received"
                    }
                  >
                    <small>
                      {m.sender_id === data.user.id ? "我" : m.sender_name} ·{" "}
                      {shortDate(m.created_at)}
                    </small>
                    <p>{m.content}</p>
                    {m.status !== "approved" ? (
                      <Badge status={m.status} />
                    ) : null}
                  </article>
                ))}
                {!thread.length ? (
                  <Empty text="暂无对话，可以发送第一条合作私信" />
                ) : null}
              </div>
              <form
                className="form"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const r = await action("/messages", {
                    to: Number(peer),
                    content,
                    title: "合作私信",
                  });
                  if (r) setContent("");
                }}
              >
                <FormField label="回复内容">
                  <textarea
                    aria-label="回复内容"
                    required
                    rows={3}
                    maxLength={1000}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </FormField>
                <SubmitButton busy={busy}>发送私信</SubmitButton>
              </form>
              <p className="note">
                命中敏感词的私信暂不送达，进入后台人工审核。仅限本演示站内沟通。
              </p>
            </>
          ) : (
            <Empty text="选择联系人查看或继续对话" />
          )}
        </section>
      )}
    </>
  );
}
