import { CoinbaseWallet } from "@web3-react/coinbase-wallet";
import { Web3ReactHooks } from "@web3-react/core";
import { MetaMask } from "@web3-react/metamask";
import { Network } from "@web3-react/network";
import { WalletConnect } from "@web3-react/walletconnect-v2";
import { coinbaseWallet, hooks as coinbaseWalletHooks } from "./coinbaseWallet";
import { metaMask, hooks as metaMaskHooks } from "./metaMask";
import { network, hooks as networkHooks } from "./network";
import { walletConnect, hooks as walletConnectHooks } from "./walletConnect";

const connectors: [
  MetaMask | WalletConnect | CoinbaseWallet | Network,
  Web3ReactHooks,
][] = [
  [metaMask, metaMaskHooks],
  [walletConnect, walletConnectHooks],
  [coinbaseWallet, coinbaseWalletHooks],
  [network, networkHooks],
];

export default connectors;
