require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();
module.exports = {
  solidity: { version: "0.8.24", settings: { optimizer: { enabled: true, runs: 200 } } },
  networks: {
    // Mezo testnet (matsnet). Chain ID and RPC from mezo-org/musd hardhat.config.ts.
    matsnet: { url: "https://rpc.test.mezo.org", chainId: 31611,
      accounts: process.env.TESTNET_PRIVATE_KEY ? [process.env.TESTNET_PRIVATE_KEY] : [] },
  },
};
