# Contribuindo com o BRDc

Obrigado pelo interesse. Antes de tudo, leia o
[`LEGAL_DISCLAIMER.md`](./LEGAL_DISCLAIMER.md) — ele vale tanto para
código quanto para qualquer comunicação pública sobre o projeto
(issues, PRs, Discord, redes sociais).

## Como propor mudanças

1. Abra uma *issue* descrevendo o problema ou a melhoria antes de
   escrever código — evita retrabalho em PRs que não serão aceitos.
2. Fork + branch a partir de `main`, nome de branch descritivo
   (`fix/oracle-staleness-check`, `feat/multisig-price-updater`).
3. Toda mudança em contrato precisa:
   - Compilar sem erros (`node compile_check.js` se o `hardhat compile`
     não tiver acesso à internet no seu ambiente);
   - Vir acompanhada de justificativa da mudança no PR — especialmente
     se mexer em lógica de custódia, mint/burn ou oráculo;
   - Não introduzir nenhuma referência a "Real Digital", afiliação com
     o Banco Central, ou lastro em reservas que a AIBANK não custodia
     de fato (ver disclaimer).
4. Mudanças em `BRDcToken.sol` e `BRDcBasketOracle.sol` são
   consideradas críticas — esperem revisão mais demorada e, quando o
   projeto tiver auditoria contratada, essas mudanças passam por ela
   antes de merge em `main`.

## Reportando vulnerabilidades

**Não abra issue pública para vulnerabilidade de segurança.** Reporte
de forma privada (canal `#security-privado` no Discord ou e-mail
dedicado, conforme anunciado no repositório) antes de divulgar
publicamente — dá tempo do time corrigir antes que alguém explore em
mainnet.

## Estilo de código

- Solidity: siga o padrão já usado nos contratos existentes
  (NatSpec nos contratos públicos, `require` com mensagem descritiva,
  eventos para toda mudança de estado relevante).
- Sem dependências novas sem justificar no PR por quê.

## Código de conduta

Este projeto segue o [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
