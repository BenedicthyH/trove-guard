const { handle, scrub } = require("../lib/handler");
module.exports = async (req, res) => {
  if (req.method !== "POST" || req.headers["x-telegram-bot-api-secret-token"] !== process.env.TG_WEBHOOK_SECRET) return res.status(401).end();
  try { const m = req.body && req.body.message; if (m && m.text) await handle(m); } catch (e) { console.log("handler error", scrub(e.message)); }
  res.status(200).json({ ok: true });
};
