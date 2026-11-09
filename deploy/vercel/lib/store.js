// Durable watch list + short-lived pending commands in private Vercel Blob.
const { put, get } = require("@vercel/blob");
const WATCH_KEY = "trove-guard/watch.json";
const PENDING_KEY = "trove-guard/pending.json";
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function loadKey(key) {
  try {
    const r = await get(key, { access: "private", useCache: false });
    if (!r) return {};
    return JSON.parse(await new Response(r.stream).text());
  } catch (e) {
    if (/not.?found/i.test(e.message || e.name || "")) return {};
    throw e;
  }
}
async function saveKey(key, d) {
  await put(key, JSON.stringify(d), {
    access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json",
  });
}

function chatKey(c) { return String(c); }

module.exports = {
  async list(c) { return (await loadKey(WATCH_KEY))[chatKey(c)] || []; },
  async add(c, a) {
    const d = await loadKey(WATCH_KEY);
    const k = chatKey(c);
    d[k] = [...new Set([...(d[k] || []), a])];
    await saveKey(WATCH_KEY, d);
  },
  async remove(c, a) {
    const d = await loadKey(WATCH_KEY);
    const k = chatKey(c);
    d[k] = (d[k] || []).filter((x) => x !== a);
    await saveKey(WATCH_KEY, d);
  },
  async count() {
    const d = await loadKey(WATCH_KEY);
    return Object.values(d).reduce((n, l) => n + l.length, 0);
  },
  async all() { return loadKey(WATCH_KEY); },

  async setPending(c, cmd) {
    const d = await loadKey(PENDING_KEY);
    d[chatKey(c)] = { cmd, at: Date.now() };
    await saveKey(PENDING_KEY, d);
  },
  async takePending(c) {
    const d = await loadKey(PENDING_KEY);
    const k = chatKey(c);
    const p = d[k];
    if (!p) return null;
    delete d[k];
    await saveKey(PENDING_KEY, d);
    if (!p.at || Date.now() - p.at > PENDING_TTL_MS) return null;
    return p.cmd || null;
  },
  async clearPending(c) {
    const d = await loadKey(PENDING_KEY);
    delete d[chatKey(c)];
    await saveKey(PENDING_KEY, d);
  },
};
