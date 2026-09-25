# BRDc Explorer

Aplicação web somente de leitura para o protótipo BRDc. Executa sem carteira e não envia transações.

## Rodar localmente

```bash
cp .env.example .env.local
npm install
npm run dev
```

Abra `http://localhost:3000`. Para validação de produção, use `npm run build`.

## Configuração

Preencha os endereços públicos em `.env.local` conforme a implantação da testnet/devnet. Os RPCs padrão são Base Sepolia e Solana devnet. Não coloque chaves privadas, frases-semente ou credenciais nessas variáveis.

Sem endereço do oráculo, o painel usa NAV e composição de demonstração identificados na tela. Se a consulta falhar, o mesmo fallback é usado. Valores de reserva não recebem números fictícios.

## Limites de leitura observados no código do repositório

- O oráculo EVM fornece `computeNAV()` e `getBasketComposition()`. O NAV usa precisão de 8 casas decimais.
- Os programas Solana do repositório são instruções de baixo nível que gravam estados `repr(C)`; não há IDL Anchor nem discriminadores Anchor. O leitor abaixo decodifica apenas os layouts documentados no código Rust e só aceita exatamente uma conta compatível por programa.
- O estado do token contém `gold_reserves`, mas não registra barras individuais nem documenta unidade em gramas. Por isso o app não estima contagem de barras nem rotula o valor bruto como gramas.
- O estado da reserva contém um contador `balance`, mas não vincula o número a um mint SPL ou a casas decimais. O app não o apresenta como saldo comprovado de USDC.
- O estado de governança contém `prop_count`, mas o programa não persiste registros individuais de propostas ou votos. O app não inventa propostas ativas.
- Peso de voto por saldo simples, sem checkpoints, pode ser afetado por empréstimo relâmpago. A interface não habilita voto.

Leia [`../LEGAL_DISCLAIMER.md`](../LEGAL_DISCLAIMER.md) antes de divulgar o projeto.