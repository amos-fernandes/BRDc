# Política de Segurança

## Status atual

Os contratos deste repositório **não passaram por auditoria externa**
e **não devem ser usados em mainnet com valor financeiro real** até que
isso mude. Uso atual recomendado: Base Sepolia (testnet) e revisão por
pares.

## Reportando uma vulnerabilidade

**Não abra uma issue pública no GitHub nem poste no Discord público**
para vulnerabilidades de segurança — isso dá tempo de qualquer pessoa
mal-intencionada explorar antes da correção.

Em vez disso:
1. Envie um relatório pelo canal privado da equipe no Discord (peça
   acesso a um administrador se não tiver o canal), ou
2. Abra uma *GitHub Security Advisory* privada no repositório
   (Security → Advisories → Report a vulnerability).

Inclua: contrato afetado, condição que dispara o problema, e (se
possível) uma prova de conceito mínima.

## Escopo

Contratos em `contracts/`:
- `token/BRDcToken.sol`
- `oracle/BRDcBasketOracle.sol`
- `reserve/BRDcReserve.sol`
- `governance/BRDcGovernance.sol`

## Limitações conhecidas (já documentadas, não é necessário reportar)

- `BRDcBasketOracle`: preços de ativos sem feed Chainlink dependem de
  atualização manual (`PRICE_UPDATER_ROLE`) — é um ponto de confiança
  no operador, documentado no próprio contrato.
- `BRDcGovernance`: peso de voto por `balanceOf` no momento do voto é
  vulnerável a flash loan (sem checkpoint/snapshot). Migração para
  `ERC20Votes` + `Governor` da OpenZeppelin é o caminho recomendado
  antes de qualquer votação com valor financeiro relevante em disputa.
