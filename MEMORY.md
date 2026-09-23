# BRDc Project Memory — Session Context

## Project Overview
**BRDc** — Token de Índice Lastreado em Ativos Reais Brasileiros  
Hybrid EVM/Solana architecture: Oracle NAV on Base Sepolia, Token/Reserve/Governance on Solana devnet

---

## Architecture

### EVM Side (Base Sepolia)
- **BRDcBasketOracle.sol** — Computes NAV (Chainlink XAU/USD + manual prices for commodities)
- Deployed on Base Sepolia (chainId 84532)
- NAV posted via off-chain relayer to Solana

### Solana Side (Rust/Anchor - 4 programs)
| Program | Purpose | Key Features |
|---------|---------|--------------|
| `brdc-oracle-bridge` | NAV bridge state | Admin-only NAV updates, timestamp tracking |
| `brdc-token` | SPL token + gold custody | Mint/burn, gold-backed supply, KYC/blacklist, physical gold redemption |
| `brdc-reserve` | USDC settlement | Register/settle redemptions using NAV, 30 bps fee, proof-of-reserve snapshots |
| `brdc-governance` | Proposals + voting | Balance-weighted voting, quorum, execute/cancel proposals |

---

## Repository Structure
```
/home/amos/dev/BRDc/
├── contracts/           # Solidity contracts (EVM side)
│   ├── token/BRDcToken.sol
│   ├── oracle/BRDcBasketOracle.sol
│   ├── reserve/BRDcReserve.sol
│   └── governance/BRDcGovernance.sol
├── solana/              # Rust/Anchor programs
│   ├── Anchor.toml      # workspace config, cluster=devnet
│   ├── Cargo.toml       # workspace with pinned deps
│   ├── programs/
│   │   ├── brdc-oracle-bridge/
│   │   ├── brdc-token/
│   │   ├── brdc-reserve/
│   │   └── brdc-governance/
│   └── scripts/
│       ├── deploy.js    # deploy all 4 programs
│       └── nav-poster.ts # EVM→Solana NAV sync
├── solana-tools/        # Bridge documentation
├── LEGAL_DISCLAIMER.md  # Critical legal warnings
└── README.md
```

---

## Key Configuration Files

### solana/Cargo.toml (Pinned Dependencies)
```toml
[workspace.dependencies]
anchor-lang = "=0.29.0"
solana-program = "=2.1.0"
spl-token = { version = "=4.0.3", features = ["no-entrypoint"] }
spl-associated-token-account = { version = "=2.3.0", features = ["no-entrypoint"] }
borsh = "=0.10.3"
proc-macro-crate = "=0.1.5"
blake3 = "=1.5.5"
digest = "=0.10.7"
crypto-common = "=0.1.7"
ring = "=0.16.20"
rand = "=0.8.5"
rand_core = "=0.6.4"
block-buffer = "=0.10.4"
hybrid-array = "=0.4.15"
subtle = "=2.4.1"
constant_time_eq = "=0.4.1"
toml_datetime = "=0.6.5"
toml_edit = "=0.21.0"
toml_parser = "=1.1.3"
indexmap = "=1.9.3"
hashbrown = "=0.12.3"
unicode-segmentation = "=1.10.1"
jobserver = "=0.1.32"
```

### solana/Anchor.toml
```toml
[workspace]
members = ["programs/brdc-oracle-bridge", "programs/brdc-token", "programs/brdc-reserve", "programs/brdc-governance"]

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"
```

---

## Wallet & Network Status
- **Wallet**: `4YCcQywGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD`
- **Network**: Solana devnet (10 SOL funded via faucet)
- **RPC**: https://api.devnet.solana.com

---

## Build System
- **Solana CLI**: 2.2.8 (Agave)
- **Platform tools SDK**: 2.3.0 at `~/.local/share/solana/install/releases/2.3.0/solana-release/bin/platform-tools-sdk/sbf/`
- **SBF Rust**: `~/.local/share/solana/install/releases/2.3.0/solana-release/bin/platform-tools-sdk/sbf/dependencies/platform-tools/rust/bin/rustc` (1.84.1-dev)
- **cargo-build-sbf**: Built-in via platform tools

---

## Dependencies Pinned For
- **rustc 1.84.1-dev** (Solana platform tools)
- Avoids `edition2024` requirement from `crypto-common 0.2.2`, `toml_datetime 1.1.1+spec-1.1.0`, etc.
- All transitive deps locked to versions compatible with 1.84

---

## Deploy Commands (Ready to Run)
```bash
cd /home/amos/dev/BRDc/solana

# Build each program
~/.local/share/solana/install/releases/2.3.0/solana-release/bin/platform-tools-sdk/sbf/dependencies/platform-tools/rust/bin/cargo build-sbf --manifest-path programs/brdc-oracle-bridge/Cargo.toml
# Repeat for brdc-token, brdc-reserve, brdc-governance

# Deploy to devnet
solana program deploy target/deploy/libbrdc_oracle_bridge.so --url https://api.devnet.solana.com --keypair ~/.config/solana/id.json
# Repeat for other 3 .so files

# Initialize programs (via Anchor client or CLI)
# Configure NAV poster:
export BRDc_SOLANA_KEYPAIR=~/.config/solana/id.json
export SOLANA_RPC_URL=https://api.devnet.solana.com
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export BRDC_ORACLE_BRIDGE_PROGRAM_ID=<deployed_bridge_id>
export BRDC_EVM_ORACLE_ADDRESS=<oracle_on_base_sepolia>
node scripts/nav-poster.ts --poll
```

---

## Legal/Compliance (Critical - from LEGAL_DISCLAIMER.md)
⚠️ **BRDc NÃO É:**
- Real Digital / CBDC do Banco Central
- Afiliado ao BCB ou CVM
- Lastreado em reservas de terceiros
- Promessa de valorização do Real

✅ **BRDc É:**
- Criptoativo privado da AIBANK
- Token de índice: ouro físico (resgatável) + commodities (liquidação em USDC)
- Sujeito a Lei 14.478/2022 (PSAV), possível enquadramento CVM (Parecer 40/2022)
- **Requer parecer jurídico antes de qualquer oferta pública**

---

## Git History
- **Remote**: https://github.com/amos-fernandes/BRDc.git
- **Branch**: master
- **Latest commit**: `d40dc65` — "BRDc Solana: Update Cargo.toml with pinned dependencies for SBF compatibility"
- **User**: Amos Fernandes (amossouzafernandes@gmail.com)

---

## Open Items / Next Steps
1. [ ] Build all 4 programs with `cargo build-sbf` (SBF target)
2. [ ] Deploy to devnet (10 SOL available)
3. [ ] Initialize each program (admin, treasury, voting params)
4. [ ] Deploy BRDcBasketOracle.sol to Base Sepolia
5. [ ] Configure & run NAV poster (EVM→Solana bridge)
6. [ ] Integration testing: mint → burn → redeem → settle
7. [ ] Audit before mainnet
8. [ ] Legal review (Brazil: PSAV license, CVM registration)

---

## Key Technical Decisions
1. **Hybrid architecture**: EVM for NAV (Chainlink), Solana for token ops (speed/fees)
2. **Gold fraction**: Physical redemption only (serialized bars, AIBANK custody)
3. **Index fraction**: Cash settlement only (USDC, no physical delivery)
4. **NAV bridge**: Off-chain poster (trusted admin) — future: Pyth/Chainlink Data Streams
5. **Governance**: Balance-weighted voting (flash loan vulnerable, OK for prototype)
6. **Pinned deps**: Required for SBF compilation with Solana's older rustc

---

## Known Issues
- Anchor CLI version mismatch (using raw `cargo build-sbf` instead)
- `test-ledger/` in .gitignore (large RocksDB files >100MB)
- Governance vulnerable to flash loans (documented)
- Manual commodity prices = trusted operator (documented)
- NAV poster = single point of trust (documented)

---

## Quick Reference
| File | Location |
|------|----------|
| Main README | `/home/amos/dev/BRDc/README.md` |
| Legal Disclaimer | `/home/amos/dev/BRDc/LEGAL_DISCLAIMER.md` |
| Solana Programs | `/home/amos/dev/BRDc/solana/programs/*/src/lib.rs` |
| Deploy Script | `/home/amos/dev/BRDc/solana/scripts/deploy.js` |
| NAV Poster | `/home/amos/dev/BRDc/solana/scripts/nav-poster.ts` |
| Wallet Keypair | `~/.config/solana/id.json` |

---

*Last updated: 2026-09-23 — Session: BRDc Solana devnet prep*
