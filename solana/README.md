# BRDc — Token de Índice Lastreado em Ativos Reais Brasileiros

## Arquitetura Híbrida — Solana + EVM

**BRDc** é um token de índice que acompanha o NAV de uma cesta de ativos reais brasileiros (ouro + minérios + commodities). Esta implementação é para a **Solana testnet** e usa uma arquitetura híbrida: a Oracle de cesta (NAV) continua no ecossistema EVM (Base Sepolia), enquanto os contratos de token, reserva e governança são implementados em Rust/Anchor na Solana.

---

## Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────┐
│                        SOLANA (Rust/Anchor)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ BRDcToken    │  │ BRDcReserve  │  │ BRDcGovernance   │  │
│  │ (token state)│  │ (USDC ATA)   │  │ (propostas)      │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
│         │                 │                     │            │
│         │   ═════════════╪═════════════════════╪═══════     │
│         │   BRIDGE:      │                     │            │
│         │   NAV State    │                     │            │
│         │   (via CPI/    │                     │            │
│         │    cross-prog) │                     │            │
└─────────┼───────────────┘                     │            │
          │                                     │            │
          │     ═══════════════════════════════ │            │
          │     EVM ↔ SOLANA COMMUNICATION     │            │
          │     (off-chain relayer/poster)     │            │
          │                                     │            │
┌─────────┼───────────────┐                     │            │
│         ▼               │                     │            │
│  ┌──────────────┐      │                     │            │
│  │ EVM Side     │      │                     │            │
│  │ BRDcBasket   │◄─────┤                     │            │
│  │ Oracle.sol   │      │                     │            │
│  │ (Base Sepolia)│      │                     │            │
│  └──────────────┘      │                     │            │
└────────────────────────┘                     │            │
                          │                     │            │
                          │ NAV Poster         │            │
┌────────────────────────┐ │ (off-chain bot)   │            │
│  NAV Poster (off-chain)│◄────────────────────┘            │
│  - Lê computeNAV() na  │                                  │
│    Oracle EVM           │                                  │
│  - Atualiza NAV State   │                                  │
│    na Solana via CPI    │                                  │
└─────────────────────────┘                                  │
```

## Componentes

### 1. EVM Side — BRDcBasketOracle.sol (Base Sepolia)

**Já existe!** Mantido como está. Responsável por:
- Agregação de preços (Chainlink XAU/USD + preços MANUAL para commodities)
- Cálculo do NAV (soma ponderada, 8 decimais)
- Rodando em: Base Sepolia (chainId 84532)

### 2. Solana Side — Rust/Anchor (4 programas)

#### Programa A: BRDcToken (`brdc-token`)
- Gerencia o estado do token BRDc (supply, gold-backed supply, KYC, blacklist)
- Permite mint (com flag `goldBacked`), burn, requestGoldRedemption, processGoldRedemption
- Resgate físico de ouro: depositGold, withdrawGold, registerCustodyRecord
- Compliance: KYC, blacklist, pause/unpause, limites diários
- Lê NAV do bridge para validação

#### Programa B: BRDcReserve (`brdc-reserve`)
- Deposita e retira USDC da reserva (via ATA)
- Registra resgates de fração índice (registerRedemption) e liquida (settleRedemption)
- Usa NAV do bridge para calcular settlement em USDC
- Fee de resgate: 30 bps

#### Programa C: BRDcGovernance (`brdc-governance`)
- Criação de propostas e votação por saldo de BRDc
- Correção: usa balance real no momento do voto (como no Solidity)
- Quorum checado na execução
- Votante tracking para evitar double-vote

#### Programa D: BRDcOracleBridge (`brdc-oracle-bridge`)
- Guarda o NAV atualizado e timestamp
- Atualizado pelo poster off-chain (admin autorizado)
- Leitura do NAV por outros programas via CPI
- Tamanchenko simples de confiança: apenas o admin pode atualizar

### 3. Bridge / NAV Poster (off-chain daemon)

- Monitora a Oracle BRDcBasketOracle na Base Sepolia
- A cada N minutos (configurável, default 5 min):
  1. Chama `computeNAV()` na Oracle EVM via RPC
  2. Pega o resultado (NAV em 8 decimais, USD)
  3. Chama `updateNav(newNav)` no BRDcOracleBridge program na Solana via CPI
- Requer: keypair Solana com 권한 de admin do bridge, RPC URLs configurados

### 4. Pyth Integration (futuro)

- Feed de preços escolhido na Solana para commodities
- Atualmente: o NAV vem do EVM via poster
- Futuro: integrar Pyth para atualizar preços das commodities diretamente na Solana
- Disponível em testnet e mainnet

## Endossos Legais e Advertências

1. **Ouro físico**: resgate físico de ouro contra ouro que a AIBANK custodia efetivamente. Nunca referenciar reservas de terceiros (fraude, CP art. 171).
2. **Preços MANUAL**: minérios/commodities brasileiras sem feed Chainlink confiável → confiança no operador (PRICE_UPDATER_ROLE), não trustlessness total. Para produção: avaliar Chainlink Data Streams, Pyth, ou multi-sig de preço.
3. **Governança vulnerável a flash loan**: usa balance real no momento do voto (balanceOf), não checkpoint histórico. Adequado para protótipo/testnet. Para produção com valor real: migrar para ERC20Votes + Governor com checkpoint.
4. **NAV Bridge**: o NAV na Solana depende do poster off-chain. O poster é confiável (admin do bridge). Para maior descentralização, avaliar Pyth ou comitê de preços.
5. **Não é Real Digital, não é BCB, não é CVM**. Token de índice privado da AIBANK, nos termos da Lei 14.478/2022.

## Pré-requisitos

- Rust e Cargo instalados
- Solana CLI 2.2+ instalado e configurado para testnet
- Anchor CLI 0.30+ instalado via avm
- Node.js 18+ e npm para scripts de deploy
- SOL na testnet para deploy e teste
- Acesso à Base Sepolia RPC
- Keypair Solana configurado em ~/.config/solana/id.json

## Instalação e Deploy

### 1. Build dos programas

```bash
cd solana
cargo build --release
anchor build
```

### 2. Deploy na testnet

```bash
# Configurar Anchor para testnet
anchor config set --provider.cluster testnet
anchor config set --provider.wallet ~/.config/solana/id.json

# Deployar os programas
anchor deploy
```

Ou use o script de deploy:

```bash
cd solana/scripts
node deploy.js
```

### 3. Configurar o NAV Poster

```bash
# Definir variáveis de ambiente
export BRDc_SOLANA_KEYPAIR=~/.config/solana/id.json
export SOLANA_RPC_URL=https://api.testnet.solana.com
export BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
export BRDC_ORACLE_BRIDGE_PROGRAM_ID=<program-id-do-bridge>
export BRDC_EVM_ORACLE_ADDRESS=<endereço-da-oracle-na-base>

# Executar uma vez
node nav-poster.ts

# Ou em modo polling (a cada 5 minutos por padrão)
node nav-poster.ts --poll
```

### 4. Usar o token

Depois do deploy, use o cliente TypeScript gerado para interagir:

```typescript
import { Program, BN } from '@coral-xyz/anchor';
import { BRDcToken } from './target/types/brdc_token';

const program = new Program(BRDcToken, provider);

// Mint de tokens
await program.methods
  .mint(recipientPubkey, new BN(1000000000), true)  // 10 tokens, gold-backed
  .rpc();

// Burn de tokens
await program.methods
  .burn(new BN(500000000))  // 5 tokens
  .rpc();

// Request gold redemption
await program.methods
  .requestGoldRedemption(new BN(10000000000), 'Endereco de entrega')
  .rpc();
```

## Estrutura do Projeto

```
solana/
├── Anchor.toml              # Configuração do workspace Anchor
├── Cargo.toml               # Workspace Rust com todos os programas
├── programs/
│   ├── brdc-oracle-bridge/ # Programa: NAV bridge (estado do NAV)
│   │   └── src/lib.rs
│   ├── brdc-token/         # Programa: Token BRDc (supply, KYC, gold)
│   │   └── src/lib.rs
│   ├── brdc-reserve/       # Programa: Reserva USDC (liquidacao)
│   │   └── src/lib.rs
│   └── brdc-governance/    # Programa: Governanca (propostas, votacao)
│       └── src/lib.rs
├── scripts/
│   ├── deploy.js           # Script de deploy na testnet
│   └── nav-poster.ts       # Daemon off-chain para atualizar NAV
└── target/                 # Build artifacts (gerado por cargo/anchor)
```

## Endross dos Programas (IAMF — Identifiers After Mainnet Foundation)

Os IDs dos programas são gerados aleatoriamente pelo Anchor. Após o deploy, use `anchor id` para verificar os endereços.

## Testes

```bash
# Testes unitários dos programas (Rust)
cargo test -p brdc-oracle-bridge
cargo test -p brdc-token
cargo test -p brdc-reserve
cargo test -p brdc-governance

# Testes de integração via Anchor (quando houver SOL na testnet)
anchor test
```

## Contribuição

1. Fork o repositório
2. Crie uma branch para sua feature (`git checkout -b feature/nova-feature`)
3. Commit suas mudanças (`git commit -am 'Add nova feature'`)
4. Push para a branch (`git push origin feature/nova-feature`)
5. Abra um Pull Request

## Licença

MIT — veja o arquivo [LICENSE](../../LICENSE) na raiz do repositório.

---

**AIBANK — dezembro/2024**
