import { PublicKey } from "@solana/web3.js";

// O Oracle está na Base Sepolia (EVM), não no Solana
// Este arquivo serve apenas para centralizar o endereço

export interface OracleNavResult {
  navUsd8Decimals: bigint;
}

export interface OracleCompositionResult {
  symbols: string[];
  weights: bigint[];
  activeFlags: boolean[];
}

export function calculateComposition(
  symbols: string[],
  weights: bigint[],
  activeFlags: boolean[]
): { goldPercent: number; indexPercent: number } {
  let total = 0n;
  let gold = 0n;
  
  for (let i = 0; i < symbols.length; i++) {
    if (!activeFlags[i]) continue;
    const weight = weights[i] ?? 0n;
    total += weight;
    const normalized = symbols[i]?.trim().toLowerCase();
    if (["xau", "gold", "ouro", "oro"].includes(normalized)) gold += weight;
  }
  
  if (total === 0n) return { goldPercent: 50, indexPercent: 50 };
  
  const goldPercent = Number((gold * 10000n) / total) / 100;
  const indexPercent = Math.max(0, 100 - goldPercent);
  
  return { goldPercent, indexPercent };
}

export const ORACLE_ADDRESS = process.env.EXPO_PUBLIC_ORACLE_ADDRESS || process.env.NEXT_PUBLIC_ORACLE_ADDRESS || "";
export const BASE_SEPOLIA_RPC = process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";