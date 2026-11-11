import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, Bot } from "lucide-react";
import { useApp } from "../state";
import { api } from "../api";
import { PageTitle, Badge, Panel } from "../ui";
export function AI({ mobile = false }) {
  const { data, setToast } = useApp();
  const operator = data.user?.role === "admin";
  const [kind, setKind] = useState(operator ? "operator" : "support"),
    [input, setInput] = useState(""),
    [loading, setLoading] = useState(false),
    [histories, setHistories] = useState({
      operator: [],
      support: [],
      copy: [],
    });
  const messages = histories[kind],
    chatRef = useRef(null),
    external = data.ai?.configured;
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, loading]);
  const append = (message) =>
    setHistories((h) => ({ ...h, [kind]: [...h[kind], message].slice(-20) }));
  async function send(prompt) {
    if (!prompt.trim() || loading) return;
    const history = messages
      .slice(-6)
      .map((m) => ({ role: m.role, content: m.text.slice(0, 1500) }));
    append({ role: "user", text: prompt });
    setInput("");
    setLoading(true);
    try {
      const r = await api("/ai", {
        method: "POST",
        body: { prompt, kind, history },
      });
      append({
        role: "assistant",
        text: r.answer,
        sections: r.sections,
        provider: r.provider,
        fallbackReason: r.fallbackReason,
      });
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <>
      <PageTitle
        title={operator ? "AI工作台" : "智能客服"}
        subtitle={
          operator ? "运营问数、咨询解答与宣传文案" : "咨询解答与宣传文案"
        }
      />
      <div className="category-tabs">
        {(!operator
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
            disabled={loading}
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
            <Badge>{external ? "DeepSeek" : "本地规则"}</Badge>
          </div>
          <div ref={chatRef} className="chat-messages" aria-live="polite">
            {!messages.length ? (
              <div className="chat-message assistant">
                <span className="chat-avatar">
                  <Sparkles size={17} />
                </span>
                <div>
                  你好，我是桂演助手，可以解答订单、分析运营数据或生成宣传文案。
                  {external
                    ? "当前由DeepSeek生成回答。"
                    : "当前使用本地规则与模板。"}
                  业务数据为模拟，重要信息请核实。
                </div>
              </div>
            ) : null}
            {messages.map((m, i) => (
              <div key={i} className={`chat-message ${m.role}`}>
                <span className="chat-avatar">
                  {m.role === "user" ? "我" : <Sparkles size={17} />}
                </span>
                <div>
                  {m.role === "assistant" ? (
                    <small className="ai-response-source">
                      {m.provider === "deepseek"
                        ? "DeepSeek · 模拟业务数据"
                        : "本地规则"}
                      {m.fallbackReason
                        ? " · " + m.fallbackReason + "，本次已回退本地规则"
                        : ""}
                    </small>
                  ) : null}
                  {m.sections ? (
                    <div className="copy-sections">
                      <small>
                        {m.provider === "deepseek"
                          ? "AI多渠道文案草稿"
                          : "本地多渠道模板草稿"}
                      </small>
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
            {loading ? (
              <p className="muted">
                {external ? "DeepSeek正在生成回答…" : "正在整理回答…"}
              </p>
            ) : null}
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
            {external
              ? `已接入DeepSeek。本站每日最多${data.ai.limits.daily}次外部请求，每人每日${data.ai.limits.user}次、每分钟${data.ai.limits.minute}次。服务异常或达到限额时使用本地规则。`
              : "当前使用本地规则与模板。"}
            支付、短信和外部业务渠道仍为模拟；AI不能直接操作订单或资金。
          </p>
        </Panel>
      </div>
    </>
  );
}
