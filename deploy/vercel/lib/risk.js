// Read-only risk engine: ICR, liquidation price, redemption queue position.
const { ethers } = require("ethers");
const A = require("./addresses");
const p = new ethers.JsonRpcProvider(A.rpc);
const tm = new ethers.Contract(A.TroveManager, [
  "function getCurrentICR(address,uint256) view returns (uint256)",
  "function getTroveStatus(address) view returns (uint256)",
], p);
const st = new ethers.Contract(A.SortedTroves, [
  "function getLast() view returns (address)", "function getPrev(address) view returns (address)",
  "function getSize() view returns (uint256)",
], p);
const pf = new ethers.Contract(A.PriceFeed, ["function fetchPrice() view returns (uint256)"], p);
const MCR = 11n * 10n ** 17n;

// Redemptions start at SortedTroves.getLast() (lowest NICR) and skip troves below MCR.
// Returns how many troves sit ahead of `borrower` in that order (capped scan).
async function queuePosition(borrower, price, max = 400) {
  let cur = await st.getLast(); let ahead = 0;
  for (let i = 0; i < max && cur !== ethers.ZeroAddress; i++) {
    if (cur.toLowerCase() === borrower.toLowerCase()) return ahead;
    if ((await tm.getCurrentICR(cur, price)) >= MCR) ahead++;
    cur = await st.getPrev(cur);
  }
  return null;
}

async function snapshot(borrower) {
  const price = await pf.fetchPrice();
  const status = await tm.getTroveStatus(borrower); // 1 = active
  if (status !== 1n) return { price, icr: 0n, icrPct: 0, ahead: null, status };
  const icr = await tm.getCurrentICR(borrower, price);
  return { price, icr, icrPct: Number(icr) / 1e16, ahead: await queuePosition(borrower, price) };
}
module.exports = { snapshot, queuePosition, provider: p };

