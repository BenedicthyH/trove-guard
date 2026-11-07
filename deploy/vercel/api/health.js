const { tg, store, scrub } = require("../lib/handler");
module.exports = async (_req, res) => {
  const out = { service: "trove-guard-bot", time: new Date().toISOString() };
  try { const me = await tg("getMe", {}); out.bot = me.username; } catch (e) { out.botError = scrub(e.message); }
  try { const w = await tg("getWebhookInfo", {}); out.webhookSet = !!w.url; out.pending = w.pending_update_count; out.lastError = w.last_error_message || null; } catch {}
  try { out.watchedTroves = await store.count(); out.store = "ok"; } catch (e) { out.store = "error: " + (e.message || "").slice(0, 120); }
  res.status(200).json(out);
};
