import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "./tasks";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.28",
    settings: {
      optimizer: { enabled: true, runs: 200 },
    },
  },
  networks: {
    mantraTestnet: {
      url: process.env.MANTRA_TESTNET_RPC_URL || "https://evm.dukong.mantrachain.io",
      chainId: 5887,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    mantraMainnet: {
      url: process.env.MANTRA_MAINNET_RPC_URL || "https://evm.mantrachain.io",
      chainId: 5888,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
};

export default config;
