# BRDc Project Roadmap - Pendências Atuais

> Última atualização: 2026-09-25

---

## 🚫 Bloqueador Crítico: Fundos Base Sepolia

**Problema:** Carteira deployer `0xf42138298fa1Fc8514BC17D59eBB451AceF3cDBa` sem ETH na Base Sepolia.
**Impacto:** Deploy do Oracle (`BRDcBasketOracle`) e contratos EVM não podem ser feitos.

### Ações necessárias:
- [ ] Obter Base Sepolia ETH via faucet que **não** exija Mainnet ETH:
  - https://www.alchemy.com/faucets/base-sepolia
  - https://faucet.quicknode.com/base/sepolia
  - https://bridge.base.org/deposit (bridge Sepolia → Base Sepolia)
- [ ] Endereço para financiar: `0xf42138298fa1Fc8514BC17D59eBB451AceF3cDBa`
- [ ] Após fundos chegarem (~1-2 min), rodar:
  ```bash
  cd /home/amos/dev/BRDc
  npx hardhat run scripts/deploy/deploy.ts --network baseSepolia
  ```

---

## 📋 Após Deploy do Oracle - Configurar Secrets Faltantes

### GitHub Secrets (Settings → Secrets → Actions):

| Secret | Status | Valor |
|--------|--------|-------|
| `NEXT_PUBLIC_ORACLE_ADDRESS` | ❌ FALTA | Endereço do `BRDcBasketOracle` deployado |
| `EXPO_PUBLIC_ORACLE_ADDRESS` | ❌ FALTA | Mesmo do acima |
| `DEPLOYER_PRIVATE_KEY` | ❌ FALTA | Para CI/CD deploys futuros |
| `BASESCAN_API_KEY` | ⚠️ OPCIONAL | Verificação no BaseScan |

---

## ✅ Já Concluído

### Solana Programs (Deploy funcionando)
- [x] 4 programas: Oracle Bridge, Token, Reserve, Governance
- [x] Program IDs persistentes via GitHub Secrets
- [x] Balance parsing corrigido (5 SOL mínimo)
- [x] CI/CD GitHub Actions funcional
- [x] `cargo-build-sbf` flags corretas

### Mobile (Expo) + Web (Next.js)
- [x] Wallet Adapter (Phantom, Solflare, Backpack)
- [x] Conexão direta Solana RPC
- [x] Variáveis de ambiente padronizadas
- [x] CI/CD configurado

### SDK Compartilhado (`packages/sdk`)
- [x] Tipos TypeScript compartilhados
- [x] Decoders para layouts de conta (80/88/64 bytes)
- [x] Helpers de conexão RPC
- [x] Oracle (Base Sepolia) helpers

---

## 🎯 Próximos Passos (pós-deploy Oracle)

### 1. Configurar Oracle na Base Sepolia
```bash
# Após deploy, chamar addAsset() para configurar cesta
# Exemplo (ajustar endereços dos feeds Chainlink):
await oracle.addAsset("XAU", 5000, 0, "0xFEED_XAU_USD_BASE_SEPOLIA");
await oracle.addAsset("IRON_ORE", 2500, 1, ethers.ZeroAddress); // MANUAL
await oracle.addAsset("SOYBEAN", 1500, 1, ethers.ZeroAddress);
await oracle.addAsset("COFFEE", 1000, 1, ethers.ZeroAddress);
```

### 2. Depositar Gold Real (Custódia)
```bash
# Chamar depositGold() com barras reais registradas
await oracle.depositGold(barSerial, weightGrams, purityBps, custodian);
```

### 3. Testes de Integração
- [ ] Mint test tokens (goldBacked=true)
- [ ] Verificar NAV via `computeNAV()`
- [ ] Testar reserve/redemption flow
- [ ] Validar governance voting

### 4. Mobile/Web Polish
- [ ] Conectar SDK `@brdc/sdk` nos apps
- [ ] Substituir chamadas RPC diretas por SDK
- [ ] Adicionar loading states/erros amigáveis
- [ ] Testes E2E (Cypress/Playwright)

### 5. Mainnet Preparation
- [ ] Auditoria contratos (Solana + EVM)
- [ ] Deploy Base Mainnet + Solana Mainnet
- [ ] Monitoring/Alerting (Sentry, Datadog)
- [ ] Documentação técnica completa

---

## 📦 Arquitetura Atual

```
BRDc/
├── .github/workflows/
│   ├── solana-build.yml    # ✅ Build + Deploy Solana
│   ├── mobile-ci.yml       # ✅ Expo CI
│   └── web-ci.yml          # ✅ Next.js CI
├── solana/                 # ✅ 4 programas Rust
├── contracts/              # ⏳ Oracle + Token + Reserve + Governance
├── mobile/                 # ✅ Expo App
├── web/                    # ✅ Next.js App
└── packages/sdk/           # ✅ Tipos + Decoders
```

---

## 🔗 Links Úteis

- **Base Sepolia Faucets:** Alchemy, QuickNode, Bridge
- **Deployer:** `0xf42138298fa1Fc8514BC17D59eBB451AceF3cDBa`
- **Solana Deployer:** `4YCcQywGVtG73itS4h1oo9gXqyzityCb7hzyrWeGL9tD`
- **Base Sepolia Explorer:** https://sepolia.basescan.org
- **Solana Explorer:** https://explorer.solana.com/?cluster=devnet