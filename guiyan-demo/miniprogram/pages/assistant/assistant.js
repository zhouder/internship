const api = require("../../utils/api");
Page({
  data: {
    kind: "support",
    prompt: "",
    busy: false,
    messages: [
      {
        role: "assistant",
        content:
          "你好，我是桂演本地演示助手，可解答订单、退款、会员问题，或组合宣传文案。未接入外部AI模型。",
      },
    ],
  },
  onShow() {
    api.requireLogin();
  },
  kind(e) {
    this.setData({ kind: e.currentTarget.dataset.kind });
  },
  input(e) {
    this.setData({ prompt: e.detail.value });
  },
  quick(e) {
    this.send(e.currentTarget.dataset.prompt);
  },
  submit() {
    this.send(this.data.prompt);
  },
  async send(prompt) {
    if (!prompt.trim() || this.data.busy) return;
    this.setData({
      busy: true,
      prompt: "",
      messages: this.data.messages.concat([{ role: "user", content: prompt }]),
    });
    try {
      const r = await api.request("/ai", "POST", {
        prompt,
        kind: this.data.kind,
      });
      this.setData({
        messages: this.data.messages.concat([
          { role: "assistant", content: r.answer },
        ]),
      });
    } catch (e) {
      api.error(e);
    } finally {
      this.setData({ busy: false });
    }
  },
});
