const fs = require("fs"); const path = require("path");
const FILE = path.join(__dirname, "..", "data", "watch.json");
function load() { try { return JSON.parse(fs.readFileSync(FILE, "utf8")); } catch { return {}; } }
function save(d) { fs.mkdirSync(path.dirname(FILE), { recursive: true }); fs.writeFileSync(FILE + ".tmp", JSON.stringify(d, null, 2)); fs.renameSync(FILE + ".tmp", FILE); }
module.exports = {
  list(chat) { return load()[chat] || []; },
  add(chat, a) { const d = load(); const s = new Set(d[chat] || []); s.add(a); d[chat] = [...s]; save(d); },
  remove(chat, a) { const d = load(); d[chat] = (d[chat] || []).filter((x) => x !== a); save(d); },
};
