# @brdc/sdk

SDK compartilhado para integração com programas BRDc (Solana) e Oracle (Base Sepolia).

## Instalação

```bash
# No workspace root
npm install -w packages/sdk
```

## Uso no Mobile (Expo)

```tsx
import { 
  getSolanaConnection,
  decodeTokenAccount,
  decodeReserveAccount,
  decodeGovernanceAccount,
  TOKEN_PROGRAM_ID,
  RESERVE_PROGRAM_ID,
  GOVERNANCE_PROGRAM_ID,
} from "@brdc/sdk";
import { Connection, PublicKey } from "@solana/web3.js";

// Buscar dados do token
const connection = getSolanaConnection();
const programId = new PublicKey(TOKEN_PROGRAM_ID);

const accounts = await connection.getProgramAccounts(programId, {
  commitment: "confirmed",
  filters: [{ dataSize: 80 }],
});

if (accounts.length === 1) {
  const tokenData = decodeTokenAccount(accounts[0].account.data);
  console.log("Total Supply:", tokenData.totalSupply.toString());
  console.log("Gold Reserves:", tokenData.goldReserves.toString());
}
```

## Uso no Web (Next.js)

```tsx
import { 
  getSolanaConnection,
  decodeReserveAccount,
  RESERVE_PROGRAM_ID,
} from "@brdc/sdk";

// Em API route ou Server Component
const connection = getSolanaConnection(process.env.NEXT_PUBLIC_SOLANA_RPC);
const programId = new PublicKey(RESERVE_PROGRAM_ID);

const accounts = await connection.getProgramAccounts(new PublicKey(RESERVE_PROGRAM_ID), {
  commitment: "confirmed",
  filters: [{ dataSize: 88 }],
});

if (accounts.length === 1) {
  const reserve = decodeReserveAccount(accounts[0].account.data);
  return Response.json({
    balance: reserve.balance.toString(),
    redemptions: reserve.redemptionCount.toString(),
    snapshots: reserve.snapshotCount.toString(),
  });
}
```

## Variáveis de Ambiente

```env
# Solana Devnet
EXPO_PUBLIC_TOKEN_PROGRAM_ID=...
EXPO_PUBLIC_RESERVE_PROGRAM_ID=...
EXPO_PUBLIC_GOVERNANCE_PROGRAM_ID=...
EXPO_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Base Sepolia (Oracle)
EXPO_PUBLIC_ORACLE_ADDRESS=...
EXPO_PUBLIC_BASE_SEPOLIA_RPC=https://sepolia.base.org
```

## Estrutura dos Layouts de Conta

### Token (80 bytes)
| Offset | Campo | Tipo |
|--------|-------|------|
| 0-7 | Discriminator | - |
| 32 | totalSupply | u64 (LE) |
| 40 | goldReserves | u64 (LE) |
| 48 | goldBackedSupply | u64 (LE) |
| **Total** | | **80 bytes** |

### Reserve (88 bytes)
| Offset | Campo | Tipo |
|--------|-------|------|
| 0-7 | Discriminator | - |
| 32 | balance | u64 (LE) |
| 72 | redemptionCount | u64 (LE) |
| 80 | snapshotCount | u64 (LE) |
| **Total** | | **88 bytes** |

### Governance (64 bytes)
| Offset | Campo | Tipo |
|--------|-------|------|
| 0-7 | Discriminator | - |
| 56 | proposalCount | u64 (LE) |
| **Total** | | **64 bytes** |

## Type Safety

Todos os decoders retornam `bigint` para valores numéricos, garantindo precisão total sem perda de precisão em JavaScript.