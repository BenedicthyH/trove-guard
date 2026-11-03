// Minimal Telegram Bot API client (long polling). Token never leaves this module in logs.
const TOKEN = process.env.TROVE_GUARD_TG_TOKEN;
const BASE = () => `https://api.telegram.org/bot${TOKEN}/`;
const scrub = (s) => String(s).split(TOKEN || "\u0000").join("***");
async function call(method, body = {}) {
  const r = await fetch(BASE() + method, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json();
  if (!j.ok) throw new Error(`${method}: ${j.error_code} ${j.description}`);
  return j.result;
}
async function poll(onMessage, log) {
  let offset = 0;
  for (;;) {
    try {
      const ups = await call("getUpdates", { offset, timeout: 50, allowed_updates: ["message"] });
      for (const u of ups) { offset = u.update_id + 1; if (u.message?.text) await onMessage(u.message).catch((e) => log("handler error", scrub(e.message))); }
    } catch (e) { log("poll error", scrub(e.message)); await new Promise((r) => setTimeout(r, 5000)); }
  }
}
module.exports = { call, poll, scrub, hasToken: () => !!TOKEN };
