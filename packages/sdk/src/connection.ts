import { Connection, clusterApiUrl, PublicKey } from "@solana/web3.js";

// Configuração de conexão RPC
export function getSolanaConnection(rpcUrl?: string): Connection {
  const endpoint = rpcUrl || process.env.EXPO_PUBLIC_SOLANA_RPC_URL || process.env.NEXT_PUBLIC_SOLANA_RPC || clusterApiUrl("devnet");
  return new Connection(endpoint, "confirmed");
}

export function getBaseSepoliaConnection(rpcUrl?: string) {
  const endpoint = rpcUrl || process.env.EXPO_PUBLIC_BASE_SEPOLIA_RPC || process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC || "https://sepolia.base.org";
  return endpoint;
}

// Helpers para parsing de account data
export function readU64LE(data: Uint8Array, offset: number): string {
  if (data.length < offset + 8) throw new Error("Conta menor que o layout esperado.");
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(offset, true).toString();
}

export async function fetchProgramAccount(
  connection: string | import("@solana/web3.js").Connection,
  programId: string,
  expectedSize: number
): Promise<{ data: Uint8Array } | null> {
  const rpcUrl = typeof connection === "string" ? connection : connection.rpcEndpoint;
  
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getProgramAccounts",
      params: [
        programId,
        { commitment: "confirmed", filters: [{ dataSize: expectedSize }] },
      ],
    }),
  });
  
  const result = await response.json();
  
  if (!result.result || result.result.length === 0) return null;
  if (result.result.length !== 1) {
    throw new Error(`${result.result.length} contas compatíveis encontradas; esperado exatamente 1.`);
  }
  
  const accountData = result.result[0].account.data[0];
  return { data: new Uint8Array(Buffer.from(accountData, "base64")) };
}