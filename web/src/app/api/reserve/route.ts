import { Connection, PublicKey } from "@solana/web3.js";
import { NextResponse } from "next/server";
import {
  EMPTY_SOLANA,
  type GovernanceState,
  type ReserveState,
  type SolanaSnapshot,
  type StateReading,
  type TokenState,
} from "@/lib/types";
import {
  decodeTokenAccount,
  TOKEN_PROGRAM_LAYOUT,
  TOKEN_PROGRAM_ID,
  decodeReserveAccount,
  RESERVE_PROGRAM_LAYOUT,
  RESERVE_PROGRAM_ID,
  decodeGovernanceAccount,
  GOVERNANCE_PROGRAM_LAYOUT,
  GOVERNANCE_PROGRAM_ID,
} from "@brdc/sdk";

export const dynamic = "force-dynamic";

async function readTokenAccount(
  connection: Connection,
  programId: string,
  missingMessage: string,
): Promise<StateReading<TokenState>> {
  const id = programId?.trim();
  if (!id) {
    return { source: "demo", value: null, message: missingMessage };
  }
  try {
    const pubkey = new PublicKey(id);
    const accounts = await connection.getProgramAccounts(pubkey, {
      commitment: "confirmed",
      filters: [{ dataSize: TOKEN_PROGRAM_LAYOUT.accountSize }],
    });
    if (accounts.length === 0) {
      return { source: "unavailable", value: null, message: "Nenhuma conta de estado compatível encontrada neste programa." };
    }
    if (accounts.length !== 1) {
      return { source: "unavailable", value: null, message: `${accounts.length} contas compatíveis encontradas; o app não escolhe nem soma estados automaticamente.` };
    }
    const decoded = decodeTokenAccount(accounts[0].account.data);
    return {
      source: "live",
      value: {
        totalSupplyRaw: decoded.totalSupply.toString(),
        goldReservesRaw: decoded.goldReserves.toString(),
        goldBackedSupplyRaw: decoded.goldBackedSupply.toString(),
      },
      message: "Estado bruto lido de uma conta do programa na Solana devnet.",
    };
  } catch {
    return { source: "demo", value: null, message: "Falha na leitura da Solana devnet; nenhum saldo demonstrativo foi inventado." };
  }
}

async function readReserveAccount(
  connection: Connection,
  programId: string,
  missingMessage: string,
): Promise<StateReading<ReserveState>> {
  const id = programId?.trim();
  if (!id) {
    return { source: "demo", value: null, message: missingMessage };
  }
  try {
    const pubkey = new PublicKey(id);
    const accounts = await connection.getProgramAccounts(pubkey, {
      commitment: "confirmed",
      filters: [{ dataSize: RESERVE_PROGRAM_LAYOUT.accountSize }],
    });
    if (accounts.length === 0) {
      return { source: "unavailable", value: null, message: "Nenhuma conta de estado compatível encontrada neste programa." };
    }
    if (accounts.length !== 1) {
      return { source: "unavailable", value: null, message: `${accounts.length} contas compatíveis encontradas; o app não escolhe nem soma estados automaticamente.` };
    }
    const decoded = decodeReserveAccount(accounts[0].account.data);
    return {
      source: "live",
      value: {
        balanceRaw: decoded.balance.toString(),
        redemptionCountRaw: decoded.redemptionCount.toString(),
        snapshotCountRaw: decoded.snapshotCount.toString(),
      },
      message: "Estado bruto lido de uma conta do programa na Solana devnet.",
    };
  } catch {
    return { source: "demo", value: null, message: "Falha na leitura da Solana devnet; nenhum saldo demonstrativo foi inventado." };
  }
}

async function readGovernanceAccount(
  connection: Connection,
  programId: string,
  missingMessage: string,
): Promise<StateReading<GovernanceState>> {
  const id = programId?.trim();
  if (!id) {
    return { source: "demo", value: null, message: missingMessage };
  }
  try {
    const pubkey = new PublicKey(id);
    const accounts = await connection.getProgramAccounts(pubkey, {
      commitment: "confirmed",
      filters: [{ dataSize: GOVERNANCE_PROGRAM_LAYOUT.accountSize }],
    });
    if (accounts.length === 0) {
      return { source: "unavailable", value: null, message: "Nenhuma conta de estado compatível encontrada neste programa." };
    }
    if (accounts.length !== 1) {
      return { source: "unavailable", value: null, message: `${accounts.length} contas compatíveis encontradas; o app não escolhe nem soma estados automaticamente.` };
    }
    const decoded = decodeGovernanceAccount(accounts[0].account.data);
    return {
      source: "live",
      value: {
        proposalCountRaw: decoded.proposalCount.toString(),
      },
      message: "Estado bruto lido de uma conta do programa na Solana devnet.",
    };
  } catch {
    return { source: "demo", value: null, message: "Falha na leitura da Solana devnet; nenhum saldo demonstrativo foi inventado." };
  }
}

export async function GET() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const [token, reserve, governance] = await Promise.all([
    readTokenAccount(connection, TOKEN_PROGRAM_ID || process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ID || "", EMPTY_SOLANA.token.message),
    readReserveAccount(connection, RESERVE_PROGRAM_ID || process.env.NEXT_PUBLIC_RESERVE_PROGRAM_ID || "", EMPTY_SOLANA.reserve.message),
    readGovernanceAccount(connection, GOVERNANCE_PROGRAM_ID || process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID || "", EMPTY_SOLANA.governance.message),
  ]);

  const snapshot: SolanaSnapshot = {
    token,
    reserve,
    governance,
    updatedAt: new Date().toISOString(),
  };
  return NextResponse.json(snapshot, {
    headers: { "Cache-Control": "no-store" },
  });
}