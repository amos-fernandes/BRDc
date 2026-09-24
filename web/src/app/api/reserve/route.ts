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

export const dynamic = "force-dynamic";

type Decoder<T> = (data: Buffer) => T;

function readU64(data: Buffer, offset: number): string {
  if (data.length < offset + 8) throw new Error("Conta menor que o layout esperado.");
  return data.readBigUInt64LE(offset).toString();
}

async function readUniqueProgramAccount<T>(
  connection: Connection,
  configuredId: string | undefined,
  expectedSize: number,
  decode: Decoder<T>,
  missingMessage: string,
): Promise<StateReading<T>> {
  const id = configuredId?.trim();
  if (!id) {
    return { source: "demo", value: null, message: missingMessage };
  }

  try {
    const programId = new PublicKey(id);
    const accounts = await connection.getProgramAccounts(programId, {
      commitment: "confirmed",
      filters: [{ dataSize: expectedSize }],
    });
    if (accounts.length === 0) {
      return {
        source: "unavailable",
        value: null,
        message: "Nenhuma conta de estado compatível encontrada neste programa.",
      };
    }
    if (accounts.length !== 1) {
      return {
        source: "unavailable",
        value: null,
        message: `${accounts.length} contas compatíveis encontradas; o app não escolhe nem soma estados automaticamente.`,
      };
    }
    return {
      source: "live",
      value: decode(accounts[0].account.data),
      message: "Estado bruto lido de uma conta do programa na Solana devnet.",
    };
  } catch {
    return {
      source: "demo",
      value: null,
      message: "Falha na leitura da Solana devnet; nenhum saldo demonstrativo foi inventado.",
    };
  }
}

export async function GET() {
  const rpcUrl =
    process.env.NEXT_PUBLIC_SOLANA_RPC?.trim() || "https://api.devnet.solana.com";
  const connection = new Connection(rpcUrl, "confirmed");

  const tokenDecoder: Decoder<TokenState> = (data) => ({
    totalSupplyRaw: readU64(data, 32),
    goldReservesRaw: readU64(data, 40),
    goldBackedSupplyRaw: readU64(data, 48),
  });
  const reserveDecoder: Decoder<ReserveState> = (data) => ({
    balanceRaw: readU64(data, 32),
    redemptionCountRaw: readU64(data, 72),
    snapshotCountRaw: readU64(data, 80),
  });
  const governanceDecoder: Decoder<GovernanceState> = (data) => ({
    proposalCountRaw: readU64(data, 56),
  });

  const [token, reserve, governance] = await Promise.all([
    readUniqueProgramAccount(
      connection,
      process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ID,
      80,
      tokenDecoder,
      EMPTY_SOLANA.token.message,
    ),
    readUniqueProgramAccount(
      connection,
      process.env.NEXT_PUBLIC_RESERVE_PROGRAM_ID,
      88,
      reserveDecoder,
      EMPTY_SOLANA.reserve.message,
    ),
    readUniqueProgramAccount(
      connection,
      process.env.NEXT_PUBLIC_GOVERNANCE_PROGRAM_ID,
      64,
      governanceDecoder,
      EMPTY_SOLANA.governance.message,
    ),
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