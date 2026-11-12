import { Select } from "./Select";
import { useState } from "react";
import { ArrowLeft, MessageSquarePlus } from "lucide-react";
import { useApp } from "./state";
import { PageTitle, Empty, Badge, FormField, SubmitButton, Modal } from "./ui";
import { shortDate, money } from "./api";

export function Messages() {
  const { data, action, busy } = useApp();
  const [tab, setTab] = useState("system"), [selected, setSelected] = useState(null),
    [peer, setPeer] = useState(null), [content, setContent] = useState(""),
    [composing, setComposing] = useState(false), [contact, setContact] = useState("");
  const incoming = data.messages.filter(m => m.user_id === data.user.id);
  const systems = incoming.filter(m => m.kind !== "private");
  const conversations = new Map();
  for (const m of data.messages.filter(m => m.kind === "private")) {
    const id = m.sender_id === data.user.id ? m.user_id : m.sender_id;
    if (!id || id === data.user.id) continue;
    if (!conversations.has(id)) conversations.set(id, {id, unread:0, latest:m});
    const item = conversations.get(id);
    if (m.id > item.latest.id) item.latest = m;
    if (m.user_id === data.user.id && !m.is_read) item.unread++;
  }
  const peers = [...conversations.values()].sort((a,b) => b.latest.id - a.latest.id);
  const memberName = id => data.members.find(u => u.id === Number(id))?.name || "平台用户";
  const thread = data.messages.filter(m => m.kind === "private" && (
    (m.sender_id === data.user.id && m.user_id === peer) ||
    (m.user_id === data.user.id && m.sender_id === peer)
  )).sort((a,b) => a.id - b.id);
  async function choosePeer(id) {
    setPeer(Number(id)); setContent(""); setComposing(false); setContact("");
    await action("/messages/read", {peerId:Number(id)});
  }
  async function open(m) {
    setSelected(m);
    if (!m.is_read) await action("/messages/read", {id:m.id});
  }
  const detail = selected ? data.messages.find(m => m.id === selected.id) || selected : null;
  const order = detail?.related_order_id ? data.orders.find(o => o.id === detail.related_order_id) : null;
  return <>
    <PageTitle title="消息与私信">
      {tab === "private" ? <button className="button primary" onClick={() => setComposing(true)}><MessageSquarePlus size={16}/>发起私信</button> : null}
      <button className="text-button" disabled={busy} onClick={() => action("/messages/read", {}, "消息已全部标为已读")}>全部已读</button>
    </PageTitle>
    <div className="category-tabs">
      <button className={tab === "system" ? "active" : ""} onClick={() => setTab("system")}>平台通知</button>
      <button className={tab === "private" ? "active" : ""} onClick={() => {setTab("private");setPeer(null);setContent("");}}>合作私信{incoming.filter(m => m.kind === "private" && !m.is_read).length || ""}</button>
    </div>
    {tab === "system" ? detail ? <article className="message-detail">
      <button className="text-button" onClick={() => setSelected(null)}>返回通知列表</button>
      <h3>{detail.title}</h3><p>{detail.content}</p><small>{shortDate(detail.created_at)} · {detail.is_read ? "已读" : "未读"}</small>
      {order ? <div className="info-box">关联订单：{order.code} · {order.resource_name} · {money(order.amount)}<Badge status={order.status}/></div> : null}
    </article> : <div className="message-list">
      {systems.map(m => <article key={m.id} className={m.is_read ? "" : "unread"}><button className="message-open" onClick={() => open(m)}><h3>{m.title}{!m.is_read ? " · 未读" : ""}</h3><p>{m.content}</p><small>{shortDate(m.created_at)} · 查看详情</small></button></article>)}
      {!systems.length ? <Empty text="暂无平台通知"/> : null}
    </div> : peer ? <section className="conversation">
      <div className="conversation-heading"><button className="text-button" onClick={() => {setPeer(null);setContent("");}}><ArrowLeft size={16}/>返回会话列表</button><h3>{memberName(peer)}</h3></div>
      <div className="conversation-thread" aria-live="polite">
        {thread.map(m => <article key={m.id} className={m.sender_id === data.user.id ? "sent" : "received"}><small>{m.sender_id === data.user.id ? "我" : m.sender_name} · {shortDate(m.created_at)}</small><p>{m.content}</p>{m.status !== "approved" ? <Badge status={m.status}/> : null}</article>)}
        {!thread.length ? <Empty text="暂无对话，发送第一条合作私信吧"/> : null}
      </div>
      <form className="form" onSubmit={async e => {e.preventDefault();if(await action("/messages", {to:peer,content,title:"合作私信"}))setContent("");}}>
        <FormField label="回复内容"><textarea aria-label="回复内容" required rows={3} maxLength={1000} value={content} onChange={e => setContent(e.target.value)}/></FormField>
        <SubmitButton busy={busy}>发送私信</SubmitButton>
      </form><p className="note">含待核实内容的私信进入人工审核，通过后送达。仅限站内演示沟通。</p>
    </section> : <div className="conversation-list">
      {peers.map(item => <button className="conversation-card" key={item.id} onClick={() => choosePeer(item.id)} aria-label={`与${memberName(item.id)}的会话${item.unread ? `，${item.unread}条未读` : ""}`}>
        <span className="avatar">{memberName(item.id).slice(0,1)}</span>
        <span className="conversation-summary"><span className="conversation-title"><strong>{memberName(item.id)}</strong><time>{shortDate(item.latest.created_at)}</time></span><span className="conversation-preview">{item.latest.status !== "approved" ? "【" + (item.latest.status === "pending" ? "待审核" : "已驳回") + "】" : ""}{item.latest.sender_id === data.user.id ? "我：" : ""}{item.latest.content}</span></span>
        {item.unread ? <span className="unread-count">{item.unread > 99 ? "99+" : item.unread}</span> : null}
      </button>)}
      {!peers.length ? <Empty text="暂无合作私信，点击“发起私信”开始沟通"/> : null}
    </div>}
    {composing ? <Modal title="发起私信" onClose={() => {setComposing(false);setContact("");}}>
      <form className="form" onSubmit={e => {e.preventDefault();if(contact)choosePeer(contact);}}><FormField label="选择联系人"><Select required aria-label="私信联系人" value={contact} onChange={e => setContact(e.target.value)}><option value="">请选择联系人</option>{data.members.filter(u => u.id !== data.user.id).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</Select></FormField><SubmitButton busy={busy}>进入对话</SubmitButton></form>
    </Modal> : null}
  </>;
}
