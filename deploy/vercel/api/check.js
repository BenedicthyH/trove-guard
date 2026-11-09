// Protected proactive scan. Call with header x-cron-secret: $CRON_SECRET (or TG_WEBHOOK_SECRET).
const { ethers } = require("ethers");
const { tg, scrub, store } = require("../lib/handler");
const { snapshot } = require("../lib/risk");
const alerts = require("../lib/alerts");
const A = require("../lib/addresses");

const FACTORY = process.env.TROVE_GUARD_FACTORY || "0x505895594A647eC13686dAf3Eb5964616c7192fA";
const BASE = process.env.PUBLIC_BASE || "https://trove-guard-bot.vercel.app";
const MAX_WATCHES = 40; // stay under 60s

function authorized(req) {
  const secret = process.env.CRON_SECRET || process.env.TG_WEBHOOK_SECRET;
  const h = req.headers["x-cron-secret"] || req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  return !!secret && h === secret;
}

module.exports = async (req, res) => {
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).end();
  if (!authorized(req)) return res.status(401).json({ ok: false, error: "unauthorized" });

  const started = Date.now();
  const out = { ok: true, checked: 0, alerted: 0, skipped: 0, errors: [] };
  const state = await alerts.load();
  const all = await store.all(); // { chatId: [addrs] }
  const entries = [];
  for (const [chat, addrs] of Object.entries(all)) {
    for (const a of addrs) entries.push({ chat, a });
  }
  const batch = entries.slice(0, MAX_WATCHES);
  out.skipped = Math.max(0, entries.length - batch.length);

  const provider = new ethers.JsonRpcProvider(A.rpc);
  const factory = new ethers.Contract(FACTORY, [
    "function vaultOf(address) view returns (address)",
  ], provider);
  const vaultAbi = [
    "function armed() view returns (bool)",
    "function reserve() view returns (uint256)",
    "function owner() view returns (address)",
  ];

  for (const { chat, a } of batch) {
    out.checked++;
    try {
      const s = await snapshot(a);
      if (s.status !== undefined && s.status !== 1n) continue;
      const kind = alerts.band(s.icrPct);
      if (kind && await alerts.shouldSend(state, chat, a, kind)) {
        await tg("sendMessage", { chat_id: chat, text: alerts.bandMsg(kind, a, s) });
        out.alerted++;
      }
      if (s.ahead !== null && s.ahead <= 5 && await alerts.shouldSend(state, chat, a, "queue")) {
        await tg("sendMessage", { chat_id: chat, text: alerts.bandMsg("queue", a, s) });
        out.alerted++;
      }
      // Re-arm nudge if vault exists, has reserve, not armed
      try {
        const vAddr = await factory.vaultOf(a);
        if (vAddr && vAddr !== ethers.ZeroAddress) {
          const v = new ethers.Contract(vAddr, vaultAbi, provider);
          const [armed, reserve] = await Promise.all([v.armed(), v.reserve()]);
          if (!armed && reserve > 0n && await alerts.shouldSend(state, chat, a, "rearm")) {
            const link = `${BASE}/arm.html?owner=${a}&vault=${vAddr}`;
            await tg("sendMessage", { chat_id: chat, text: alerts.bandMsg("rearm", link, s) });
            out.alerted++;
          }
        }
      } catch (e) {
        // vault lookup optional
      }
    } catch (e) {
      out.errors.push(scrub(e.shortMessage || e.message).slice(0, 120));
    }
    if (Date.now() - started > 50_000) { out.stoppedEarly = true; break; }
  }

  await alerts.save(state);
  out.ms = Date.now() - started;
  res.status(200).json(out);
};
