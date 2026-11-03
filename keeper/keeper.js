// Keeper loop: for each registered vault, call rescue() when needsRescue() is true.
// Testnet only. Needs KEEPER_PRIVATE_KEY and VAULTS (comma separated) in .env.
require("dotenv").config();
const { ethers } = require("ethers");
const A = require("./addresses");
const p = new ethers.JsonRpcProvider(A.rpc);
const abi = ["function needsRescue() view returns (bool)", "function rescue(address,address)"];
async function tick(wallet) {
  for (const v of (process.env.VAULTS || "").split(",").filter(Boolean)) {
    const c = new ethers.Contract(v, abi, wallet);
    if (await c.needsRescue()) {
      // TODO: compute hints with HintHelpers.getApproxHint + SortedTroves.findInsertPosition
      const tx = await c.rescue(ethers.ZeroAddress, ethers.ZeroAddress);
      console.log("rescue", v, tx.hash);
    }
  }
}
async function main() {
  if (!process.env.KEEPER_PRIVATE_KEY) throw new Error("KEEPER_PRIVATE_KEY missing");
  const w = new ethers.Wallet(process.env.KEEPER_PRIVATE_KEY, p);
  const n = await p.getNetwork(); if (n.chainId !== 31611n) throw new Error("not Mezo testnet");
  for (;;) { try { await tick(w); } catch (e) { console.error(e.shortMessage || e.message); } await new Promise((r) => setTimeout(r, 30000)); }
}
main();
