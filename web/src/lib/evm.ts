import { BASE_SEPOLIA_CHAIN_ID } from "./contracts";

export type EthereumProvider = { isMetaMask?: boolean; isMercadoBitcoin?: boolean; isMBWallet?: boolean; providers?: EthereumProvider[]; request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };

declare global { interface Window { ethereum?: EthereumProvider } }

export async function getEvmAccount() {
  if (!window.ethereum) throw new Error("Instale uma carteira EVM como MetaMask para continuar.");
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" }) as string[];
  if (!accounts[0]) throw new Error("Nenhuma conta EVM foi selecionada.");
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (Number.parseInt(String(chainId), 16) !== BASE_SEPOLIA_CHAIN_ID) {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x14a34" }] });
  }
  return accounts[0] as `0x${string}`;
}

export async function sendEvmTransaction(to: string, data: `0x${string}`, from: string) {
  if (!window.ethereum) throw new Error("Carteira EVM não encontrada.");
  return await window.ethereum.request({ method: "eth_sendTransaction", params: [{ from, to, data }] }) as string;
}
