// Mezo testnet (matsnet, chain 31611). Source: github.com/mezo-org/musd
// solidity/deployments/matsnet/*.json, cross-checked live against rpc.test.mezo.org on 2026-11-03.
module.exports = {
  chainId: 31611,
  rpc: "https://rpc.test.mezo.org",
  BorrowerOperations: "0xCdF7028ceAB81fA0C6971208e83fa7872994beE5",
  BorrowerOperationsSignatures: "0xD757e3646AF370b15f32EB557F0F8380Df7D639e",
  TroveManager: "0xE47c80e8c23f6B4A1aE41c34837a0599D5D16bb0",
  SortedTroves: "0x722E4D24FD6Ff8b0AC679450F3D91294607268fA",
  StabilityPool: "0x1CCA7E410eE41739792eA0A24e00349Dd247680e",
  PriceFeed: "0x86bCF0841622a5dAC14A313a15f96A95421b9366",
  HintHelpers: "0x4e4cBA3779d56386ED43631b4dCD6d8EacEcBCF6",
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
};
