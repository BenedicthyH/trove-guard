// Durable watch list in a private Vercel Blob object.
const { put, get } = require("@vercel/blob");
const KEY = "trove-guard/watch.json";
async function load() {
  try { const r = await get(KEY, { access: "private", useCache: false }); if (!r) return {}; return JSON.parse(await new Response(r.stream).text()); }
  catch (e) { if (/not.?found/i.test(e.message || e.name)) return {}; throw e; }
}
async function save(d) { await put(KEY, JSON.stringify(d), { access: "private", allowOverwrite: true, addRandomSuffix: false, contentType: "application/json" }); }
module.exports = {
  async list(c) { return (await load())[c] || []; },
  async add(c, a) { const d = await load(); d[c] = [...new Set([...(d[c] || []), a])]; await save(d); },
  async remove(c, a) { const d = await load(); d[c] = (d[c] || []).filter((x) => x !== a); await save(d); },
  async count() { const d = await load(); return Object.values(d).reduce((n, l) => n + l.length, 0); },
  async all() { return load(); },
};
