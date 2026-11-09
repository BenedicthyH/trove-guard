// Compute SortedTroves insert hints via HintHelpers (Mezo matsnet).
const { ethers } = require("ethers");
const A = require("./addresses");

async function insertHints(provider, coll, debt, trials = 50, seed = 42) {
  const hh = new ethers.Contract(A.HintHelpers, [
    "function getApproxHint(uint256,uint256,uint256) view returns (address,uint256,uint256)",
  ], provider);
  const st = new ethers.Contract(A.SortedTroves, [
    "function findInsertPosition(uint256,address,address) view returns (address,address)",
  ], provider);
  const nicr = coll * 10n ** 20n / debt;
  const [approx] = await hh.getApproxHint(nicr, trials, seed);
  const [upper, lower] = await st.findInsertPosition(nicr, approx, approx);
  return { upper, lower, nicr };
}

module.exports = { insertHints };
