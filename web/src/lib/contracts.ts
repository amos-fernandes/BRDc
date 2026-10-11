import { encodeFunctionData, parseUnits } from "viem";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const BASE_SEPOLIA_EXPLORER = "https://sepolia.basescan.org";

export const contractAddresses = {
  token: process.env.NEXT_PUBLIC_TOKEN_ADDRESS ?? "",
  oracle: process.env.NEXT_PUBLIC_ORACLE_ADDRESS ?? "",
  reserve: process.env.NEXT_PUBLIC_RESERVE_ADDRESS ?? "",
  governance: process.env.NEXT_PUBLIC_GOVERNANCE_ADDRESS ?? "",
} as const;

export const tokenAbi = [
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }, { name: "goldBacked", type: "bool" }], outputs: [] },
  { type: "function", name: "burn", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "depositGold", stateMutability: "nonpayable", inputs: [{ name: "barSerialNumber", type: "bytes32" }, { name: "weightGrams", type: "uint256" }, { name: "purity", type: "uint256" }, { name: "vaultLocation", type: "string" }], outputs: [] },
  { type: "function", name: "requestGoldRedemption", stateMutability: "nonpayable", inputs: [{ name: "amountGrams", type: "uint256" }, { name: "deliveryAddress", type: "string" }], outputs: [{ type: "uint256" }] },
] as const;

export function isAddressConfigured(address: string) { return /^0x[a-fA-F0-9]{40}$/.test(address); }
export function toTokenAmount(value: string) { return parseUnits(value || "0", 18); }
export function toBytes32(value: string) { return `0x${Array.from(new TextEncoder().encode(value)).map((b) => b.toString(16).padStart(2, "0")).join("").padEnd(64, "0").slice(0, 64)}` as `0x${string}`; }
export function encodeTokenCall(functionName: "mint" | "burn" | "depositGold" | "requestGoldRedemption", args: readonly unknown[]) {
  return encodeFunctionData({ abi: tokenAbi, functionName, args: args as never });
}
export function txLink(hash: string) { return `${BASE_SEPOLIA_EXPLORER}/tx/${hash}`; }
