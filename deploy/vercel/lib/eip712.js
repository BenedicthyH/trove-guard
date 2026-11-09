// EIP-712 RepayMUSD typed data for Mezo BorrowerOperationsSignatures (matsnet).
// Must match solidity/contracts/BorrowerOperationsSignatures.sol
const BOS = "0xD757e3646AF370b15f32EB557F0F8380Df7D639e";
const CHAIN_ID = 31611;
const DOMAIN = {
  name: "BorrowerOperationsSignatures",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: BOS,
};
const TYPES = {
  RepayMUSD: [
    { name: "amount", type: "uint256" },
    { name: "borrower", type: "address" },
    { name: "nonce", type: "uint256" },
    { name: "deadline", type: "uint256" },
  ],
};
function repayTypedData({ amount, borrower, nonce, deadline }) {
  return {
    domain: { ...DOMAIN },
    types: TYPES,
    primaryType: "RepayMUSD",
    message: {
      amount: String(amount),
      borrower,
      nonce: String(nonce),
      deadline: String(deadline),
    },
  };
}
module.exports = { BOS, CHAIN_ID, DOMAIN, TYPES, repayTypedData };
