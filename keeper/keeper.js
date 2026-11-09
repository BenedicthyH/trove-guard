// Keeper loop: for each registered vault, call rescue() when needsRescue() is true.
// Testnet only. Needs KEEPER_PRIVATE_KEY and VAULTS (comma separated) in .env.
require("dotenv").config();
const { ethers } = require("ethers");
const A = require("./addresses");
const { insertHints } = require("./hints");
const p = new ethers.JsonRpcProvider(A.rpc);
const vaultAbi = [
  "function needsRescue() view returns (bool)",
  "function rescue(address,address)",
  "function owner() view returns (address)",
  "function rescueAmount() view returns (uint256)",
];
// Mezo: getEntireDebtAndColl returns coll FIRST, then principal, interest, ...
const tm = new ethers.Contract(A.TroveManager, [
  "function getEntireDebtAndColl(address) view returns (uint256 coll,uint256 principal,uint256 interest,uint256 pendingCollateral,uint256 pendingPrincipal,uint256 pendingInterest)",
], p);

async function tick(wallet) {
  for (const v of (process.env.VAULTS || "").split(",").filter(Boolean)) {
    const c = new ethers.Contract(v, vaultAbi, wallet);
    if (!(await c.needsRescue())) continue;
    const owner = await c.owner();
    const amount = await c.rescueAmount();
    const d = await tm.getEntireDebtAndColl(owner);
    const debt = d.principal + d.interest;
    const newDebt = debt > amount ? debt - amount : debt;
    const { upper, lower } = await insertHints(p, d.coll, newDebt);
    const tx = await c.rescue(upper, lower);
    console.log("rescue", v, tx.hash);
  }
}
async function main() {
  if (!process.env.KEEPER_PRIVATE_KEY) throw new Error("KEEPER_PRIVATE_KEY missing");
  const w = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, p);
  const n = await p.getNetwork(); if (n.chainId !== 31611n) throw new Error("not Mezo testnet");
  for (;;) { try { await tick(w); } catch (e) { console.error(e.shortMessage || e.message); } await new Promise((r) => setTimeout(r, 30000)); }
}
main();
