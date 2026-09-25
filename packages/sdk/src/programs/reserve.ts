import { PublicKey } from "@solana/web3.js";
import { readU64LE } from "../connection";
import type { ReserveState } from "../types";

// Layout esperado do Reserve State (88 bytes após discriminator)
// offset 32: balance (u64)
// offset 72: redemptionCount (u64)
// offset 80: snapshotCount (u64)

export const RESERVE_PROGRAM_LAYOUT = {
  discriminatorSize: 8,
  balanceOffset: 32,
  redemptionCountOffset: 72,
  snapshotCountOffset: 80,
  accountSize: 88,
} as const;

export interface ReserveAccountData {
  balance: bigint;
  redemptionCount: bigint;
  snapshotCount: bigint;
}

export function decodeReserveAccount(data: Uint8Array): ReserveAccountData {
  if (data.length < RESERVE_PROGRAM_LAYOUT.accountSize) {
    throw new Error(`Reserve account data muito pequeno: ${data.length} bytes, esperado ${RESERVE_PROGRAM_LAYOUT.accountSize}`);
  }
  
  return {
    balance: BigInt(readU64LE(data, RESERVE_PROGRAM_LAYOUT.balanceOffset)),
    redemptionCount: BigInt(readU64LE(data, RESERVE_PROGRAM_LAYOUT.redemptionCountOffset)),
    snapshotCount: BigInt(readU64LE(data, RESERVE_PROGRAM_LAYOUT.snapshotCountOffset)),
  };
}

export function formatReserveState(raw: { balanceRaw: string; redemptionCountRaw: string; snapshotCountRaw: string }) {
  return {
    balance: BigInt(raw.balanceRaw),
    redemptionCount: BigInt(raw.redemptionCountRaw),
    snapshotCount: BigInt(raw.snapshotCountRaw),
  };
}

export const RESERVE_PROGRAM_ID = process.env.EXPO_PUBLIC_RESERVE_PROGRAM_ID || process.env.NEXT_PUBLIC_RESERVE_PROGRAM_ID || "";