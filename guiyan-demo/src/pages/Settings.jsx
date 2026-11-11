import { useState } from "react";
import { useApp } from "../state";
import { shortDate } from "../api";
import { PageTitle, Panel, FormField, SubmitButton, Badge } from "../ui";
export function Settings() {
  const { data, action, busy } = useApp();
  const [threshold, setThreshold] = useState(data.settings.alertThreshold);
  return (
    <>
      <PageTitle title="系统设置" subtitle="演示配置、数据溯源与操作日志" />
      <div className="two-col">
        <Panel title="库存预警设置">
          <form
            className="form padded"
            onSubmit={(e) => {
              e.preventDefault();
              action(
                "/settings",
                { alertThreshold: Number(threshold) },
                "预警阈值已保存",
                "PATCH",
              );
            }}
          >
            <FormField label="库存低于或等于此值时提醒">
              <input
                type="number"
                min="0"
                max="1000"
                required
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
              />
            </FormField>
            <SubmitButton busy={busy}>保存设置</SubmitButton>
          </form>
        </Panel>
        <Panel title="接口与安全说明">
          <dl className="profile-dl">
            <dt>运行模式</dt>
            <dd>
              <Badge>业务数据模拟</Badge>
            </dd>
            <dt>权限控制</dt>
            <dd>用户、资源方、管理员角色；接口校验权限</dd>
            <dt>密码保存</dt>
            <dd>随机盐与 scrypt 哈希</dd>
            <dt>业务数据</dt>
            <dd>
              {data.database === "postgres"
                ? "PostgreSQL 远程持久化"
                : "SQLite 本地持久化"}
              ；不采集真实身份证或支付信息
            </dd>
            <dt>外部连接</dt>
            <dd>
              微信登录、支付、短信、渠道同步、版权确权仍为模拟。AI：
              {data.ai?.configured
                ? "DeepSeek已配置，生成回答使用真实API"
                : "本地规则"}
              。
            </dd>
          </dl>
        </Panel>
      </div>
      <Panel title="最近操作日志">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>操作时间</th>
                <th>操作者</th>
                <th>操作类型</th>
                <th>详情</th>
              </tr>
            </thead>
            <tbody>
              {data.logs.map((l) => (
                <tr key={l.id}>
                  <td>{shortDate(l.created_at)}</td>
                  <td>{l.user_name || "系统"}</td>
                  <td>{l.action}</td>
                  <td>{l.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}
