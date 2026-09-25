# BRDc Explorer Mobile

Aplicativo nativo para iOS e Android, feito com Expo e React Native. É uma
experiência complementar ao painel web: somente leitura, sem conexão de carteira
e sem envio de transações.

## Executar

```bash
npm install
npm start
```

Use o QR code do Expo Go para abrir no aparelho ou execute `npm run android` /
`npm run ios` com o ambiente nativo correspondente.

## Fonte de dados

Configure `EXPO_PUBLIC_API_BASE_URL` com a URL pública da instância web que
oferece `/api/nav` e `/api/reserve`. O app chama essas rotas de leitura para
reutilizar a consulta à Base Sepolia e à Solana devnet. Não configure uma chave
privada ou outro segredo em uma variável `EXPO_PUBLIC_`: valores desse prefixo
ficam embutidos no aplicativo.

Sem URL ou quando a leitura falha, o NAV de demonstração aparece claramente
marcado; dados da reserva e propostas não são preenchidos com números fictícios.
O simulador é apenas aritmética educacional.

## Build

```bash
npm run typecheck
npx expo-doctor
```

O projeto não contém credenciais EAS nem executa publicação para lojas.