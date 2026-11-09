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
  "Tip: tap a command, then send the address as the next message.",
].join("\n");

const NEEDS_ADDR = new Set(["/watch", "/unwatch", "/status", "/arm"]);
const PROMPT = {
  "/watch": "Send the wallet address to watch.",
  "/unwatch": "Send the wallet address to unwatch.",
  "/status": "Send the wallet address for status (or /status with no address after watching one).",
  "/arm": "Send the borrower wallet address to open the re-arm page.",
};

/** Accept whitespace, any case, backticks, optional surrounding punctuation. */
function addr(s) {
  if (s == null) return null;
  let t = String(s).trim();
  t = t.replace(/^`+|`+$/g, "").trim();
  t = t.replace(/^[<(["']+|[>)\]"',.]+$/g, "").trim();
  // bare 0x…40 hex even if extra text around it
  const m = t.match(/0x[a-fA-F0-9]{40}/);
  if (m) t = m[0];
  try { return ethers.getAddress(t); } catch { return null; }
}

function parseCommand(text) {
  const raw = String(text || "").trim();
  if (!raw) return { cmd: null, arg: "", raw };
  const parts = raw.split(/\s+/);
  let c0 = parts[0];
  // Normalize /watch@TroveGuardMezoBot
  if (c0.startsWith("/")) c0 = c0.split("@")[0].toLowerCase();
  else c0 = c0.toLowerCase();
  const arg = parts.slice(1).join(" ");
  return { cmd: c0.startsWith("/") ? c0 : null, arg, raw };
}

async function doWatch(chat, send, a) {
  await store.add(chat, a);
  await send(`Watching ${a}`);
}
async function doUnwatch(chat, send, a) {
  await store.remove(chat, a);
  await send(`Stopped watching ${a}`);
}
async function doArm(chat, send, a) {
  const link = `${BASE}/arm.html?owner=${a}&factory=${FACTORY}`;
  await send(`Re-arm your TroveGuard vault (Mezo testnet).\nOpen this on a wallet browser, sign RepayMUSD, then confirm arm():\n${link}`);
}
async function doStatus(chat, send, aOrNull) {
  const targets = aOrNull ? [aOrNull] : await store.list(chat);
  if (!targets.length || targets.includes(null)) {
    await send("Usage: /status 0xYourAddress, or /watch one first");
    return;
  }
  for (const a of targets) {
    try { await send(await statusText(a)); }
    catch (e) {
      console.log("status error", scrub(e.shortMessage || e.message));
      await send(`Could not read ${a} from Mezo testnet right now.`);
    }
  }
}

async function runWithAddr(cmd, chat, send, a) {
  if (cmd === "/watch") return doWatch(chat, send, a);
  if (cmd === "/unwatch") return doUnwatch(chat, send, a);
  if (cmd === "/arm") return doArm(chat, send, a);
  if (cmd === "/status") return doStatus(chat, send, a);
}

async function handle(m) {
  const chat = m.chat.id;
  const send = (text) => tg("sendMessage", { chat_id: chat, text });
  const { cmd, arg, raw } = parseCommand(m.text);
  console.log("cmd", cmd || raw.slice(0, 66), "chat", chat);

  // Plain address: complete pending command, else default to /watch
  const asAddr = addr(raw);
  if (!cmd && asAddr) {
    const pending = await store.takePending(chat);
    const use = pending && NEEDS_ADDR.has(pending) ? pending : "/watch";
    return runWithAddr(use, chat, send, asAddr);
  }

  if (cmd === "/start") return send("TroveGuard warns you before your Mezo MUSD loan is liquidated or redeemed, and will repay it from a reserve you set up.\n\n" + HELP);
  if (cmd === "/help") return send(HELP);
  if (cmd === "/list") {
    const l = await store.list(chat);
    return send(l.length ? l.join("\n") : "Nothing watched. Use /watch 0x...");
  }

  if (NEEDS_ADDR.has(cmd)) {
    const a = addr(arg);
    if (a) {
      await store.clearPending(chat);
      // /status with no list still works when address given
      return runWithAddr(cmd, chat, send, a);
    }
    // Bare /status with no arg: show watched list if any
    if (cmd === "/status") {
      const list = await store.list(chat);
      if (list.length) return doStatus(chat, send, null);
    }
    // Bare /arm with a watched address
    if (cmd === "/arm") {
      const list = await store.list(chat);
      if (list[0]) return doArm(chat, send, list[0]);
    }
    await store.setPending(chat, cmd);
    return send(PROMPT[cmd] || "Send the wallet address.");
  }

  return send(HELP);
}
module.exports = { handle, tg, scrub, store, addr };
