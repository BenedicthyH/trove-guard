const { tg, store, scrub } = require("../lib/handler");
module.exports = async (_req, res) => {
  const out = { service: "trove-guard-bot", time: new Date().toISOString() };
  try { const me = await tg("getMe", {}); out.bot = me.username; } catch (e) { out.botError = scrub(e.message); }
  try {
    const w = await tg("getWebhookInfo", {});
    out.webhookSet = !!w.url;
    out.webhookUrl = w.url || null;
    out.pending = w.pending_update_count;
    out.lastError = w.last_error_message || null;
  } catch {}
  try { out.watchedTroves = await store.count(); out.store = "ok"; } catch (e) { out.store = "error: " + (e.message || "").slice(0, 120); }
  out.factory = process.env.TROVE_GUARD_FACTORY || "0x505895594A647eC13686dAf3Eb5964616c7192fA";
  out.armPage = (process.env.PUBLIC_BASE || "https://trove-guard-bot.vercel.app") + "/arm.html";
  out.check = "/api/check";
  res.status(200).json(out);
};
