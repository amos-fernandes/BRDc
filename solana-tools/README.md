# BRDC Solana Tools — Bridge EVM↔Solana

## Arquitetura Híbrida

```
┌─────────────────────────────────────────────────────────────┐
│                        SOLANA (Rust/Anchor)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ BRDcToken.rs │  │ BRDcReserve  │  │ PythPriceFeed    │  │
│  │ (SPL token)  │  │ (liquidação) │  │ (XAU/USD etc.)   │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                     │            │
│         │      ═══════════╪═════════════════════╪═══════     │
│         │      BRIDGE:    │  Pyth Net / Poster  │            │
│         │      "NAV do    │  (atualiza preços  │            │
│         │       Oracle"   │   na Solana)       │            │
└─────────┼────────┘        └────────────────────┘            │
          │                                                   │
          │          ════════════════════════════════════════ │
          │          EVM ↔ SOLANA COMMUNICATION              │
          │          (off-chain relayer / oracle poster)     │
          │                                                   │
┌─────────┼────────┐        ┌────────────────────┐            │
│         ▼         │        │                    │            │
│  ┌──────────────┐ │        │  NAV Posting       │            │
│  │ EVM Side     │ │        │  (off-chain bot   │            │
│  │ BRDcBasket   │ │◄───────│   ou keeper)      │            │
│  │ Oracle.sol   │ │        │                   │            │
│  │ (Base)       │ │        │ Pega NAV de       │            │
│  └──────────────┘ │        │ Solidity e posta  │            │
└───────────────────┘        │ na Solana via     │            │
                             │ CPI ou syscall      │            │
                             └────────────────────┘            │
```

## Componentes

### 1. EVM Side — BRDcBasketOracle.sol (Base Sepolia)
**Já existe!** Mantido como está. Responsável por:
- Agregação de preços (Chainlink XAU/USD + preços MANUAL para commodities)
- Cálculo do NAV (soma ponderada, 8 decimais)
- Onde vai ser rodado: Base Sepolia (chainId 84532) — já configured no hardhat.config.ts

### 2. Solana Side — Rust/Anchor (nova implementação)
Three programs:

#### Programa A: `BRDcToken` (SPL Token + Account Data)
- Token BRDc como SPL Token (ou token ativo via sysvar)
- Contas: 
  - `TokenState`: supply, admin, pauser, 업바이더
  - `Holder`: balance, KYC tier, daily volume tracking
  - `GoldBackedRecord`: quanto do supply é gold-backed
- Cumpre função: emissão, transferência, KYC/check, pause, mint/burn administrativo

#### Programa B: `BRDcReserve` (Liquidação em USDC)
- Recebe USDC (Solana USDC — geralmente via associated token account)
- `registerRedemption(burned_amount)` → calcula settlement em USDC baseado no NAV atual
- `settleRedemption(requestId)` → transfere USDC para o holder
- Usa preço atual (NAV) que vem do bridge/poster

#### Programa C: `BRDcGovernance` (Propostas)
- Criação/Execução de propostas com votação por saldo BRDc
- Correção: usa balance real no momento do voto (como no Solidity)
- Known limitation: flash loan vulnerability (documentado no Solidity também)

### 3. Bridge / NAV Poster (off-chain keeper)
- Monitora o contrato BRDcBasketOracle na Base Sepolia
- A cada ~X minutos (ex.: 5 min) chama `computeNAV()` no Solidity via RPC
- Pega o resultado e publica na Solana via:
  - Método 1: CPI (Solana program calling another program) — se o EVM for Neon EVM
  - Método 2: off-chain relayer que escreve o NAV em uma conta account data na Solana (simples, mas requer confiança)
  - Método 3: usar Pyth para publicar o NAV como um "price feed customizado" (mais descentralizado)
  - Método 4: CPI inbound do EVM para Solana via Neon EVM cross-program invocation
- A escolha do método de bridge é o ponto crítico de arquitetura!

### 4. Pyth Integration (Solana)
- Pyth é o feed de preço escolhido na Solana
- Contratos Pyth Solana disponíveis via `pyth-solana-installer` ou `pythnet`
- Usado para: atualizar preços das commodities que não têm Chainlink
  - No Solidity atual: minérios/commodidades com preço MANUAL
  - Na Solana: substituir MANUAL por Pyth quando disponível, ou manter o poster off-chain
- Pyth disponível em devnet e mainnet

## Fluxo de Resgate (fração índice = não-ouro)

```
Holder tem BRDc tokens → chama burn() no token BRDc (Solana side)
                                   ↓
                      BRDcReserve registra quem burned quanto
                                   ↓
             Off-chain NAV poster pega último NAV da Oracle EVM
                                   ↓
                   BRDcReserve calcula: burned * NAV / 1e20 = USDC due
                                   ↓
       Holder chama settleRedemption(requestId) → recebe USDC na conta ATA
```

## Fluxo de Resgate Físico (ouro — apenas se mantido)

**Nota**: O resgate físico de ouro envolve entrega física de barras de ouro — isso é um processo off-chain com a AIBANK. Na Solana, esse processo seria:
- `requestGoldRedemption(amountGrams, deliveryAddress)` no token program
- Registro on-chain da requisição
- Processamento off-chain pela AIBANK (entrega física)
- `processGoldRedemption(requestId)` marca como processado on-chain

O invariante permanece: só pode resgatar ouro se houver goldBackedSupply >= amountGrams e totalGoldReservesGrams >= amountGrams.

## Próximos Passos

1. **Criar projeto Anchor** (Anchor.toml, estrutura de programas)
2. **Implementar BRDcToken program** (SPL token wrapper + account data)
3. **Implementar BRDcReserve program** (USDC settlement)
4. **Implementar BRDcGovernance program** (propostas)
5. **Escrever NAV poster** (off-chain bot em Rust ou TS)
6. **Testes no devnet** com SOL de devnet
7. **Deploy no devnet** via CLI

## Endpoints de Referência

- Base Sepolia RPC: https://sepolia.base.org
- Devnet Solana RPC: https://api.devnet.solana.com
- Pyth docs: https://docs.pyth.network
- SPL Token Program: https://spl.solana.com/token
- Anchor framework: https://www.anchor-lang.com

