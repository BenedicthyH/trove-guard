const { ethers } = require("ethers");
const { statusText } = require("./status");
const store = require("./store");
const TOKEN = process.env.TROVE_GUARD_TG_TOKEN;
const BASE = process.env.PUBLIC_BASE || "https://trove-guard-bot.vercel.app";
const FACTORY = process.env.TROVE_GUARD_FACTORY || "0x505895594A647eC13686dAf3Eb5964616c7192fA";
const scrub = (s) => String(s).split(TOKEN || "\u0000").join("***");
async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json(); if (!j.ok) throw new Error(`${method}: ${j.error_code} ${j.description}`); return j.result;
}
const HELP = [
  "TroveGuard watches MUSD troves on Mezo testnet.",
  "/watch 0x... add a trove",
  "/status 0x... live ICR, liquidation distance, redemption queue",
  "/status shows all watched troves if no address is given",
  "/arm 0x... open the re-sign page for your vault (after a rescue)",
  "/unwatch 0x... remove a trove",
  "/list your watched troves",
].join("\n");
const addr = (s) => { try { return ethers.getAddress((s || "").trim()); } catch { return null; } };
async function handle(m) {
  const chat = m.chat.id; const send = (text) => tg("sendMessage", { chat_id: chat, text });
  const [c0, ...rest] = m.text.trim().split(/\s+/); const cmd = c0.split("@")[0].toLowerCase(); const arg = rest.join(" ");
  console.log("cmd", cmd, "chat", chat);
  if (cmd === "/start") return send("TroveGuard warns you before your Mezo MUSD loan is liquidated or redeemed, and will repay it from a reserve you set up.\n\n" + HELP);
  if (cmd === "/help") return send(HELP);
  if (cmd === "/list") { const l = await store.list(chat); return send(l.length ? l.join("\n") : "Nothing watched. Use /watch 0x..."); }
  if (cmd === "/watch") { const a = addr(arg); if (!a) return send("Usage: /watch 0xYourAddress"); await store.add(chat, a); return send(`Watching ${a}`); }
  if (cmd === "/unwatch") { const a = addr(arg); if (!a) return send("Usage: /unwatch 0xYourAddress"); await store.remove(chat, a); return send(`Stopped watching ${a}`); }
  if (cmd === "/arm") {
    const a = addr(arg) || (await store.list(chat))[0];
    if (!a) return send("Usage: /arm 0xBorrowerAddress (or /watch one first)");
    const link = `${BASE}/arm.html?owner=${a}&factory=${FACTORY}`;
    return send(`Re-arm your TroveGuard vault (Mezo testnet).\nOpen this on a wallet browser, sign RepayMUSD, then confirm arm():\n${link}`);
  }
  if (cmd === "/status") {
    const t = arg ? [addr(arg)] : await store.list(chat);
    if (!t.length || t.includes(null)) return send("Usage: /status 0xYourAddress, or /watch one first");
    for (const a of t) { try { await send(await statusText(a)); } catch (e) { console.log("status error", scrub(e.shortMessage || e.message)); await send(`Could not read ${a} from Mezo testnet right now.`); } }
    return;
  }
  return send(HELP);
}
module.exports = { handle, tg, scrub, store };
