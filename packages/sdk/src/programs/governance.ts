import { PublicKey } from "@solana/web3.js";
import { readU64LE } from "../connection";
import type { GovernanceState } from "../types";

// Layout esperado do Governance State (64 bytes após discriminator)
// offset 56: proposalCount (u64)

export const GOVERNANCE_PROGRAM_LAYOUT = {
  discriminatorSize: 8,
  proposalCountOffset: 56,
  accountSize: 64,
} as const;

export interface GovernanceAccountData {
  proposalCount: bigint;
}

export function decodeGovernanceAccount(data: Uint8Array): GovernanceAccountData {
  if (data.length < GOVERNANCE_PROGRAM_LAYOUT.accountSize) {
    throw new Error(`Governance account data muito pequeno: ${data.length} bytes, esperado ${GOVERNANCE_PROGRAM_LAYOUT.accountSize}`);
  }
  
  return {
    proposalCount: BigInt(readU64LE(data, GOVERNANCE_PROGRAM_LAYOUT.proposalCountOffset)),
  };
}

export function formatGovernanceState(raw: { proposalCountRaw: string }) {
  return {
    proposalCount: BigInt(raw.proposalCountRaw),
  };
}

export const GOVERNANCE_PROGRAM_ID = process.env.EXPO_PUBLIC_GOVERNANCE_PROGRAM_ID || process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID || "";