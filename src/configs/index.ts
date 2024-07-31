import { eth } from "../assets";
import { StarknetChainId, Token, Percent, JSBI } from "l0k_swap-sdk";
import { sample } from "lodash";
import { RpcProvider } from "starknet";

export const APP_CHAIN_ID = StarknetChainId.TESTNET;
// process.env.NODE_ENV === "production"
// 	? StarknetChainId.MAINNET
// 	: StarknetChainId.TESTNET;

export const NETWORKS_SUPPORTED = {
  [StarknetChainId.MAINNET]: {
    name: "Starknet Mainnet",
    rpc: ["https://starknet-mainnet.public.blastapi.io"],
  },
  [StarknetChainId.TESTNET]: {
    name: "Starknet Sepolia",
    rpc: ["https://starknet-sepolia.public.blastapi.io/rpc/v0_7"],
  },
};

export const WETH = {
  [StarknetChainId.MAINNET]: new Token(
    StarknetChainId.MAINNET,
    "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    18,
    "ETH",
    "Ether"
  ),
  [StarknetChainId.TESTNET]: new Token(
    "SN_SEPOLIA" as any,
    "0x49d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7",
    18,
    "ETH",
    "Ether"
  ),
};

// used to construct intermediary pairs for trading
export const BASES_TO_CHECK_TRADES_AGAINST = {
  [StarknetChainId.MAINNET]: [WETH[StarknetChainId.MAINNET]],
  [StarknetChainId.TESTNET]: [WETH[StarknetChainId.TESTNET]],
};

export const CUSTOM_BASES: {
  [key in StarknetChainId]: {
    [key: string]: Token[];
  };
} = {
  [StarknetChainId.MAINNET]: {},
  [StarknetChainId.TESTNET]: {},
};

export const TOKEN_LIST = {
  [StarknetChainId.MAINNET]: [WETH[StarknetChainId.MAINNET]],
  [StarknetChainId.TESTNET]: [
    WETH[StarknetChainId.TESTNET],
    new Token(
      "SN_SEPOLIA" as any,
      "0x07e0a8b80a3d17ee281f2844acc03647398bb5464a7a34a97693e82bf3635196",
      18,
      "BrownFi",
      "BRFI"
    ),
  ],
};

export const TOKEN_ICON_LIST = {
  [StarknetChainId.MAINNET]: {
    [WETH[StarknetChainId.MAINNET].address]: eth,
  },
  [StarknetChainId.TESTNET]: {
    [WETH[StarknetChainId.TESTNET].address]: eth,
  },
};

export const UNKNOWN_TOKEN_ICON =
  "https://icones.pro/wp-content/uploads/2021/05/icone-point-d-interrogation-question-noir.png";

export const FACTORY_ADDRESS = {
  [StarknetChainId.MAINNET]: "",
  [StarknetChainId.TESTNET]:
    "0x05d789e22a62125d58773cd899e1b609b476b5daa0c86dccb32c72836dcec906",
};

export const ROUTER_ADDRESS = {
  [StarknetChainId.MAINNET]: "",
  [StarknetChainId.TESTNET]:
    "0x07365f5f8f2f7748d31653133ba5a8be7501d5d90e9893e91372e44b4fe9c967",
};

export enum Field {
  INPUT = "INPUT",
  OUTPUT = "OUTPUT",
}

export const MAX_TRADE_HOPS = 3;

export const BETTER_TRADE_LESS_HOPS_THRESHOLD = new Percent(
  JSBI.BigInt(50),
  JSBI.BigInt(10000)
);

export const ZERO_PERCENT = new Percent("0");
export const ONE_HUNDRED_PERCENT = new Percent("1");
export const FIVE_PERCENT = new Percent(JSBI.BigInt(5), JSBI.BigInt(100));
export const SWAP_FEE_PERCENT = new Percent(JSBI.BigInt(97), JSBI.BigInt(100));

export const BIPS_BASE = JSBI.BigInt(10000);

export const SN_RPC_PROVIDER = () =>
  new RpcProvider({
    nodeUrl: sample(NETWORKS_SUPPORTED[APP_CHAIN_ID].rpc)!,
  });

export const getTokenIcon = (address: string | undefined) => {
  return address
    ? TOKEN_ICON_LIST[APP_CHAIN_ID][address] ?? UNKNOWN_TOKEN_ICON
    : UNKNOWN_TOKEN_ICON;
};
