# BRDc — Token de Índice Lastreado em Ativos Reais Brasileiros

> ⚠️ **Leia primeiro: [`LEGAL_DISCLAIMER.md`](./LEGAL_DISCLAIMER.md)**.
> Não é Real Digital, não é afiliado ao Banco Central, não é lastreado
> em reservas de terceiros, e não promete valorização do Real. Isso não
> é retórica — é o que separa este projeto de um risco jurídico sério.

Projeto open source, emitido pela **AIBANK**, na rede **Base** (L2 da
Coinbase, chain id 8453 mainnet / 84532 Base Sepolia testnet).

## O que é

Um ERC-20 de índice com duas frações de lastro bem separadas:

| Fração | Ativo | Resgate | Mecanismo |
|---|---|---|---|
| Ouro | Ouro físico custodiado pela AIBANK (barra serializada) | **Físico, em espécie** | `BRDcToken.requestGoldRedemption()` |
| Índice | Minérios + commodities brasileiras | **Em caixa (stablecoin)**, nunca em espécie | `burn()` + `BRDcReserve.registerRedemption()` |

O NAV do token é calculado por uma cesta ponderada
(`BRDcBasketOracle`): ouro via feed Chainlink, os demais ativos via
preço administrado e auditável (a maioria das commodities agrícolas/
minerais brasileiras não tem feed Chainlink direto e confiável — isso
está documentado no próprio contrato, não escondido).

## Estrutura

```
contracts/
  token/BRDcToken.sol           # ERC-20 UUPS upgradeable — mint/burn, custódia de ouro, resgate físico
  oracle/BRDcBasketOracle.sol   # NAV da cesta multi-ativo (Chainlink + preço administrado)
  reserve/BRDcReserve.sol       # Liquidação em caixa da fração índice (não-ouro)
  governance/BRDcGovernance.sol # Propostas e votação por saldo de BRDc (corrige bug do design original)
  interfaces/IBRDcBasketOracle.sol
scripts/deploy/deploy.ts        # Deploy sequencial: Oracle -> Token (proxy) -> Reserve
LEGAL_DISCLAIMER.md             # Leia antes de divulgar ou contribuir
```

## Por que só o ouro tem resgate físico

Não existe custódia física fracionável e serializável de minério de
ferro, soja ou café da mesma forma que existe para barras de ouro. A
arquitetura reflete isso deliberadamente: prometer resgate físico de
commodity bulk seria um passivo operacional que o projeto não consegue
honrar. A fração índice funciona como a cota de um fundo — você entra e
sai pelo valor (NAV), não pelo ativo físico.

## Compilando

O ambiente de desenvolvimento pode não ter acesso a
`binaries.soliditylang.org` (usado pelo Hardhat para baixar o
compilador). Se for o seu caso, use o `solc` via npm diretamente:

```bash
npm install
node compile_check.js   # compila via solc local, sem downloader do Hardhat
```

Em um ambiente com acesso normal à internet, `npx hardhat compile` e
`npx hardhat test` funcionam normalmente.

## Deploy (Base Sepolia primeiro, sempre)

```bash
cp .env.example .env   # preencha DEPLOYER_PRIVATE_KEY e RPC URLs
npx hardhat run scripts/deploy/deploy.ts --network baseSepolia
```

Depois do deploy, antes de qualquer `mint()`:
1. `oracle.addAsset(...)` para cada ativo da cesta (pesos somando 10000 bps).
2. `token.depositGold(...)` com pelo menos uma barra real registrada —
   **os primeiros BRDc só podem ser mintados com `goldBacked=true` até
   o limite do que estiver realmente em `totalGoldReservesGrams`**
   (isso é reforçado por `require` no contrato, não só por convenção).
3. `reserve.depositTreasury(...)` com o caixa que sustenta a fração índice.

## Status do projeto

Protótipo funcional, compilado e validado sintaticamente. **Não
auditado. Não implantado em mainnet. Sem oferta pública.** Ver
`LEGAL_DISCLAIMER.md` para o que precisa acontecer (parecer jurídico,
eventual registro CVM/BCB) antes disso mudar.

## Licença

MIT — ver `LICENSE`.
