import type { HardhatUserConfig } from "hardhat/config";

import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import { configVariable } from "hardhat/config";

const config: HardhatUserConfig = {
  plugins: [hardhatToolboxMochaEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.30",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhat: {
      // Hardhat 3.x 版本强制要求 type，传统网络已被移除
      // 只能在 EDR 模拟器和 HTTP 网络之间选择
      type: "edr-simulated",
      chainType: "l1",
      hardfork: "prague", // Enable Prague fork for BLS12381 precompiles
    },      
    // opSepolia: {
    //   type: "http",
    //   chainType: "op",
    //   url: "https://sepolia.optimism.io",
    //   accounts: [], // 需要时设置 PRIVATE_KEY 环境变量
    // },
  },
};

export default config;
