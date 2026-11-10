import { useState } from "react";
import { Send, Sparkles, Bot } from "lucide-react";
import { useApp } from "../state";
import { api } from "../api";
import { PageTitle, Badge, Panel } from "../ui";
export function AI({ mobile = false }) {
  const { setToast } = useApp();
  const [kind, setKind] = useState(mobile ? "support" : "operator"),
    [input, setInput] = useState(""),
    [loading, setLoading] = useState(false),
    [messages, setMessages] = useState([
      {
        role: "assistant",
        text: "你好，我是桂演演示助手。可以查询运营数据、解答订单问题，或组合宣传文案。当前使用本地规则与模板。",
      },
    ]);
  async function send(prompt) {
    if (!prompt.trim() || loading) return;
    setMessages((m) => [...m, { role: "user", text: prompt }]);
    setInput("");
    setLoading(true);
    try {
      const r = await api("/ai", { method: "POST", body: { prompt, kind } });
      setMessages((m) => [
        ...m,
        { role: "assistant", text: r.answer, sections: r.sections },
      ]);
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageTitle
        title={mobile ? "智能客服" : "AI工作台"}
        subtitle="运营问数、咨询解答与宣传文案"
      />
      <div className="category-tabs">
        {(mobile
          ? [
              ["support", "智能客服"],
              ["copy", "文案生成"],
            ]
          : [
              ["operator", "运营助手"],
              ["support", "智能客服"],
              ["copy", "AIGC文案"],
            ]
        ).map(([k, v]) => (
          <button
            key={k}
            className={kind === k ? "active" : ""}
            onClick={() => setKind(k)}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="ai-layout">
        <section className="chat-panel">
          <div className="chat-heading">
            <Bot size={20} />
            <strong>
              {kind === "operator"
                ? "运营分析助手"
                : kind === "copy"
                  ? "宣传文案助手"
                  : "用户服务助手"}
            </strong>
            <Badge>本地模拟</Badge>
          </div>
          <div className="chat-messages" aria-live="polite">
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                <span className="chat-avatar">
                  {m.role === "user" ? "我" : <Sparkles size={17} />}
                </span>
                <div>
                  {m.sections ? (
                    <div className="copy-sections">
                      <small>本地多渠道模板草稿</small>
                      <h3>{m.sections.title}</h3>
                      <p>{m.sections.body}</p>
                      {m.sections.channels.map((c) => (
                        <section key={c.name}>
                          <h4>{c.name}</h4>
                          <p>{c.content}</p>
                        </section>
                      ))}
                      <small>{m.sections.notes.join("；")}</small>
                    </div>
                  ) : (
                    m.text
                  )}
                </div>
              </div>
            ))}
            {loading ? <p className="muted">正在整理回答…</p> : null}
          </div>
          <form
            className="chat-input"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <input
              aria-label="向助手提问"
              value={input}
              maxLength={1000}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                kind === "copy"
                  ? "例如：为周末民族歌舞演出写推送文案"
                  : "输入你的问题…"
              }
            />
            <button
              className="button primary"
              aria-label="发送问题"
              disabled={loading || !input.trim()}
            >
              <Send size={18} />
            </button>
          </form>
        </section>
        <Panel title="试试这些问题">
          <div className="prompt-list">
            {(kind === "operator"
              ? [
                  "当前交易数据怎么样？",
                  "最近用户增长和活跃怎么样？",
                  "各渠道卖得怎么样？",
                  "场馆档期和上座率如何？",
                  "哪些资源热销？",
                  "检查库存和异常预警",
                  "生成经营报告",
                ]
              : kind === "copy"
                ? [
                    "给民族歌舞剧写一段小红书文案",
                    "为非遗亲子体验设计活动标题",
                    "写一段周末剧场推送",
                  ]
                : [
                    "如何申请退款或改签？",
                    "帮我查询订单",
                    "文惠卡和会员如何使用？",
                  ]
            ).map((p) => (
              <button key={p} onClick={() => send(p)} disabled={loading}>
                {p}
                <Send size={14} />
              </button>
            ))}
          </div>
          <p className="note">
            本Demo没有调用大模型、短信或支付接口。这里的回答由可解释的本地规则和模板生成。
          </p>
        </Panel>
      </div>
    </>
  );
}
