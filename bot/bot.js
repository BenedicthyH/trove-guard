// TroveGuard Telegram bot. Token is read from env TROVE_GUARD_TG_TOKEN only and never logged.
const tg = require("./tg");
const { ethers } = require("ethers");
const { statusText } = require("./status");
const store = require("./store");

if (!tg.hasToken()) { console.error("TROVE_GUARD_TG_TOKEN missing"); process.exit(1); }
const send = (chat_id, text) => tg.call("sendMessage", { chat_id, text });
const log = (...a) => console.log(new Date().toISOString(), ...a);

const COMMANDS = [
  { command: "start", description: "What TroveGuard does" },
  { command: "help", description: "List commands" },
  { command: "watch", description: "Watch a Mezo testnet trove: /watch 0x..." },
  { command: "status", description: "Live ICR and redemption risk: /status 0x..." },
  { command: "unwatch", description: "Stop watching: /unwatch 0x..." },
  { command: "list", description: "Troves you are watching" },
];
const HELP = [
  "TroveGuard watches MUSD troves on Mezo testnet.",
  "/watch 0x... add a trove",
  "/status 0x... live ICR, liquidation distance, redemption queue",
  "/status shows all watched troves if no address is given",
  "/unwatch 0x... remove a trove",
  "/list your watched troves",
].join("\n");

function addr(s) { try { return ethers.getAddress((s || "").trim()); } catch { return null; } }

async function handle(m) {
  const chat = m.chat.id; const [cmdRaw, ...rest] = m.text.trim().split(/\s+/);
  const cmd = cmdRaw.split("@")[0].toLowerCase(); const arg = rest.join(" ");
  log("cmd", cmd);
  if (cmd === "/start") return send(chat, "TroveGuard warns you before your Mezo MUSD loan is liquidated or redeemed, and will repay it from a reserve you set up.\n\n" + HELP);
  if (cmd === "/help") return send(chat, HELP);
  if (cmd === "/list") { const l = store.list(chat); return send(chat, l.length ? l.join("\n") : "Nothing watched. Use /watch 0x..."); }
  if (cmd === "/watch") { const a = addr(arg); if (!a) return send(chat, "Usage: /watch 0xYourAddress"); store.add(chat, a); return send(chat, `Watching ${a}`); }
  if (cmd === "/unwatch") { const a = addr(arg); if (!a) return send(chat, "Usage: /unwatch 0xYourAddress"); store.remove(chat, a); return send(chat, `Stopped watching ${a}`); }
  if (cmd === "/status") {
    const targets = arg ? [addr(arg)] : store.list(chat);
    if (!targets.length || targets.includes(null)) return send(chat, "Usage: /status 0xYourAddress, or /watch one first");
    for (const a of targets) {
      try { await send(chat, await statusText(a)); }
      catch (e) { log("status error", tg.scrub(e.shortMessage || e.message)); await send(chat, `Could not read ${a} from Mezo testnet right now.`); }
    }
    return;
  }
  return send(chat, HELP);
}

(async () => {
  await tg.call("setMyCommands", { commands: COMMANDS });
  await tg.call("setMyDescription", { description: "TroveGuard warns Mezo MUSD borrowers before liquidation or redemption and can repay from a Stability Pool reserve. Testnet." });
  await tg.call("setMyShortDescription", { short_description: "Liquidation and redemption guard for Mezo MUSD troves." });
  log("bot started, polling");
  await tg.poll(handle, log);
})().catch((e) => log("setup error", tg.scrub(e.message)));
