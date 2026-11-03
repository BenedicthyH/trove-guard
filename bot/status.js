const { snapshot } = require("../keeper/risk");
async function statusText(a) {
  const s = await snapshot(a);
  if (s.status !== undefined || s.icr > 10n ** 30n) return `${a}\nNo active trove found on Mezo testnet.`;
  const price = Number(s.price) / 1e18;
  const liqPrice = price * 110 / s.icrPct;
  const dist = (1 - liqPrice / price) * 100;
  const q = s.ahead === null ? "not in first 400 scanned" : `${s.ahead} troves ahead of you`;
  return [
    a,
    `ICR: ${s.icrPct.toFixed(2)}% (liquidation below 110%)`,
    `BTC price: $${price.toFixed(0)}`,
    `Liquidation price: $${liqPrice.toFixed(0)} (BTC can fall ${dist.toFixed(1)}%)`,
    `Redemption queue: ${q}`,
  ].join("\n");
}

module.exports = { statusText };
