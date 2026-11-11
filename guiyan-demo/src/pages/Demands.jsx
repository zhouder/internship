import { Select } from "../Select";
import { useState } from "react";
import { Plus, MapPin, MessageCircle, Sparkles } from "lucide-react";
import { useApp } from "../state";
import { money } from "../api";
import {
  PageTitle,
  Badge,
  Modal,
  FormField,
  SubmitButton,
  Empty,
  ResourceCard,
} from "../ui";
export function MessageForm({ to, onClose }) {
  const { data, action, busy } = useApp();
  const [target, setTarget] = useState(
      to || data.members.find((u) => u.id !== data.user?.id)?.id || 1,
    ),
    [content, setContent] = useState("");
  async function submit(e) {
    e.preventDefault();
    const r = await action(
      "/messages",
      { to: Number(target), content, title: "合作沟通" },
      "站内私信已发送",
    );
    if (r) onClose();
  }
  return (
    <Modal title="发送站内私信" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        <FormField label="接收人">
          <Select value={target} onChange={(e) => setTarget(e.target.value)}>
            {data.members
              .filter((u) => u.id !== data.user?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
          </Select>
        </FormField>
        <FormField label="沟通内容">
          <textarea
            required
            rows={5}
            maxLength={1000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
          />
        </FormField>
        <SubmitButton busy={busy}>发送私信</SubmitButton>
      </form>
    </Modal>
  );
}
export function DemandForm({ onClose }) {
  const { data, action, busy } = useApp();
  const [f, setF] = useState({
    title: "",
    category: "show",
    budget: 10000,
    city: "南宁",
    description: "",
  });
  const set = (k, v) => setF((x) => ({ ...x, [k]: v }));
  async function submit(e) {
    e.preventDefault();
    const r = await action(
      "/demands",
      { ...f, budget: Math.round(Number(f.budget) * 100) },
      "需求已提交，等待审核",
    );
    if (r) onClose();
  }
  return (
    <Modal title="发布合作需求" onClose={onClose}>
      <form className="form" onSubmit={submit}>
        {!data.user?.verified ? (
          <div className="info-box">
            发布前需完成演示身份认证。
            <button
              type="button"
              className="text-button"
              onClick={() =>
                action(
                  "/profile",
                  { verify: true },
                  "演示身份认证完成",
                  "PATCH",
                )
              }
            >
              完成演示认证
            </button>
          </div>
        ) : null}
        <FormField label="需求标题">
          <input
            required
            maxLength={80}
            value={f.title}
            onChange={(e) => set("title", e.target.value)}
          />
        </FormField>
        <div className="form-row">
          <FormField label="需求分类">
            <Select
              value={f.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {data.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="预算（元）">
            <input
              type="number"
              required
              min="0"
              value={f.budget}
              onChange={(e) => set("budget", e.target.value)}
            />
          </FormField>
        </div>
        <FormField label="合作城市">
          <input
            required
            value={f.city}
            onChange={(e) => set("city", e.target.value)}
          />
        </FormField>
        <FormField label="需求说明">
          <textarea
            required
            rows={4}
            maxLength={2000}
            value={f.description}
            onChange={(e) => set("description", e.target.value)}
          />
        </FormField>
        <SubmitButton busy={busy}>提交审核</SubmitButton>
      </form>
    </Modal>
  );
}
export function Demands({ onNeedLogin, onOpen }) {
  const { data, setToast } = useApp();
  const [create, setCreate] = useState(false),
    [recipient, setRecipient] = useState(null),
    [matched, setMatched] = useState(null);
  function requireLogin(fn) {
    if (data.user) fn();
    else {
      setToast("请先登录");
      onNeedLogin?.();
    }
  }
  return (
    <>
      <PageTitle title="需求大厅" subtitle="发布合作意向，让合适的资源找到你">
        <button
          className="button primary"
          onClick={() => requireLogin(() => setCreate(true))}
        >
          <Plus size={16} />
          发布需求
        </button>
      </PageTitle>
      <div className="demand-list">
        {data.demands.map((d) => (
          <article className="demand-card" key={d.id}>
            <div className="demand-head">
              <Badge>
                {data.categories.find((c) => c.id === d.category)?.name}
              </Badge>
              <Badge status={d.status} />
            </div>
            <h3>{d.title}</h3>
            <p>{d.description}</p>
            <div className="demand-meta">
              <span>
                <MapPin size={14} />
                {d.city}
              </span>
              <span>{d.user_name}</span>
              <strong>预算 {money(d.budget)}</strong>
            </div>
            <footer>
              <button className="button small" onClick={() => setMatched(d)}>
                <Sparkles size={14} />
                资源匹配
              </button>
              {d.user_id !== data.user?.id ? (
                <button
                  className="button small primary"
                  onClick={() => requireLogin(() => setRecipient(d.user_id))}
                >
                  <MessageCircle size={14} />
                  联系发布方
                </button>
              ) : null}
            </footer>
          </article>
        ))}
      </div>
      {!data.demands.length ? <Empty text="暂无合作需求" /> : null}
      {create ? <DemandForm onClose={() => setCreate(false)} /> : null}
      {recipient ? (
        <MessageForm to={recipient} onClose={() => setRecipient(null)} />
      ) : null}
      {matched ? (
        <Modal title="供需资源匹配" onClose={() => setMatched(null)}>
          <p className="note">按需求分类、城市和预算进行本地规则匹配。</p>
          {data.resources
            .filter(
              (r) =>
                r.status === "published" &&
                r.category === matched.category &&
                r.price <= matched.budget,
            )
            .sort(
              (a, b) =>
                Number(b.city === matched.city) -
                Number(a.city === matched.city),
            )
            .slice(0, 4)
            .map((r) => (
              <ResourceCard
                key={r.id}
                resource={r}
                onOpen={(v) => {
                  setMatched(null);
                  onOpen(v);
                }}
              />
            ))}
          {!data.resources.some(
            (r) => r.category === matched.category && r.price <= matched.budget,
          ) ? (
            <Empty text="暂无同类且预算内的资源，可调整需求或联系平台" />
          ) : null}
        </Modal>
      ) : null}
    </>
  );
}
