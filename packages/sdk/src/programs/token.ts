import { PublicKey } from "@solana/web3.js";
import { readU64LE } from "../connection";
import type { TokenState } from "../types";

// Layout esperado do Token State (80 bytes após discriminator)
// offset 0-7: discriminator
// offset 8-15: padding/outros
// offset 32: totalSupply (u64)
// offset 40: goldReserves (u64)
// offset 48: goldBackedSupply (u64)

export const TOKEN_PROGRAM_LAYOUT = {
  discriminatorSize: 8,
  totalSupplyOffset: 32,
  goldReservesOffset: 40,
  goldBackedSupplyOffset: 48,
  accountSize: 80,
} as const;

export interface TokenAccountData {
  totalSupply: bigint;
  goldReserves: bigint;
  goldBackedSupply: bigint;
}

export function decodeTokenAccount(data: Uint8Array): TokenAccountData {
  if (data.length < TOKEN_PROGRAM_LAYOUT.accountSize) {
    throw new Error(`Token account data muito pequeno: ${data.length} bytes, esperado ${TOKEN_PROGRAM_LAYOUT.accountSize}`);
  }
  
  return {
    totalSupply: BigInt(readU64LE(data, TOKEN_PROGRAM_LAYOUT.totalSupplyOffset)),
    goldReserves: BigInt(readU64LE(data, TOKEN_PROGRAM_LAYOUT.goldReservesOffset)),
    goldBackedSupply: BigInt(readU64LE(data, TOKEN_PROGRAM_LAYOUT.goldBackedSupplyOffset)),
  };
}

export function formatTokenState(raw: { totalSupplyRaw: string; goldReservesRaw: string; goldBackedSupplyRaw: string }) {
  return {
    totalSupply: BigInt(raw.totalSupplyRaw),
    goldReserves: BigInt(raw.goldReservesRaw),
    goldBackedSupply: BigInt(raw.goldBackedSupplyRaw),
  };
}

export const TOKEN_PROGRAM_ID = process.env.EXPO_PUBLIC_TOKEN_PROGRAM_ID || process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ID || "";