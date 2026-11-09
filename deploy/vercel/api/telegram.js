const { handle, scrub } = require("../lib/handler");
module.exports = async (req, res) => {
  if (req.method !== "POST" || req.headers["x-telegram-bot-api-secret-token"] !== process.env.TG_WEBHOOK_SECRET) {
    return res.status(401).json({ ok: false });
  }
  const out = { ok: true };
  try {
    const m = req.body && req.body.message;
    if (m && m.text) {
      await handle(m);
      out.replied = true;
      out.chat = m.chat && m.chat.id;
      out.cmd = String(m.text).split(/\s+/)[0];
    } else {
      out.replied = false;
      out.reason = "no text message";
    }
  } catch (e) {
    out.replied = false;
    out.error = scrub(e.message);
    console.log("handler error", out.error);
  }
  res.status(200).json(out);
};
