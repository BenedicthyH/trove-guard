// Telegram front end skeleton. Needs TELEGRAM_BOT_TOKEN in .env.
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { snapshot } = require("../keeper/risk");
if (!process.env.TELEGRAM_BOT_TOKEN) { console.error("TELEGRAM_BOT_TOKEN missing"); process.exit(1); }
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
const watch = new Map(); // chatId -> address (move to SQLite/Redis)

bot.onText(/\/start/, (m) => bot.sendMessage(m.chat.id,
  "TroveGuard keeps a MUSD rescue reserve in the Mezo Stability Pool and repays your trove before liquidation or redemption.\n/watch <address>\n/status\n/arm (opens web page to sign)"));
bot.onText(/\/watch (0x[0-9a-fA-F]{40})/, (m, r) => { watch.set(m.chat.id, r[1]); bot.sendMessage(m.chat.id, `Watching ${r[1]}`); });
bot.onText(/\/status/, async (m) => {
  const a = watch.get(m.chat.id); if (!a) return bot.sendMessage(m.chat.id, "Use /watch <address> first");
  const s = await snapshot(a);
  bot.sendMessage(m.chat.id, `ICR ${s.icrPct.toFixed(1)}%\nBTC $${(Number(s.price) / 1e18).toFixed(0)}\nTroves ahead in redemption queue: ${s.ahead ?? "unknown"}`);
});
