const { put, get } = require("@vercel/blob");
const KEY = "trove-guard/alert-state.json";
const COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6h per (chat, addr, kind)

async function load() {
  try {
    const r = await get(KEY, { access: "private", useCache: false });
    if (!r) return {};
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (/not.?found/i.test(e.message || e.name || "")) return {};
    throw e;
  }
}
async function save(d) {
  await put(KEY, JSON.stringify(d), {
    access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json",
  });
}

function band(icrPct) {
  if (icrPct <= 0) return null;
  if (icrPct < 115) return "critical";
  if (icrPct < 130) return "high";
  if (icrPct < 150) return "warn";
  return null;
}

function bandMsg(kind, a, s) {
  const q = s.ahead === null ? "not in first 400" : `${s.ahead} ahead in redemption queue`;
  if (kind === "critical") return `CRITICAL ${a}\nICR ${s.icrPct.toFixed(1)}% (liq below 110%). ${q}\nRe-arm or top up soon.`;
  if (kind === "high") return `HIGH RISK ${a}\nICR ${s.icrPct.toFixed(1)}%. ${q}`;
  if (kind === "warn") return `Watch ${a}\nICR ${s.icrPct.toFixed(1)}% under 150% recovery line. ${q}`;
  if (kind === "queue") return `Redemption risk ${a}\nOnly ${s.ahead} troves ahead of you in the queue.`;
  if (kind === "rearm") return `Your TroveGuard vault is disarmed (signature used or expired).\nRe-sign here:\n${a}`;
  return null;
}

function alertKey(chat, addr, kind) {
  return `${chat}|${String(addr).toLowerCase()}|${kind}`;
}
/** True if cooldown allows a send. Does not stamp; call markSent after success. */
async function shouldSend(state, chat, addr, kind) {
  const k = alertKey(chat, addr, kind);
  const last = state[k] || 0;
  return Date.now() - last >= COOLDOWN_MS;
}
function markSent(state, chat, addr, kind) {
  state[alertKey(chat, addr, kind)] = Date.now();
}

module.exports = { load, save, band, bandMsg, shouldSend, markSent, COOLDOWN_MS };
