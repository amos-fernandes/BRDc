import { ethers, upgrades } from "hardhat";

/**
 * Ordem de deploy:
 * 1. BRDcBasketOracle (não é upgradeable — troque o contrato inteiro se precisar mudar a lógica de NAV)
 * 2. BRDcToken (upgradeable via UUPS — proxy + implementação)
 * 3. BRDcReserve (liquidação em caixa da fração NAV não-ouro)
 *
 * Antes de rodar em `base` (mainnet), rode em `baseSepolia` e valide:
 * - addAsset() da cesta com pesos somando 10000 bps
 * - depositGold() com pelo menos 1 barra real registrada
 * - mint() de teste com goldBacked=true dentro do limite de custódia
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deployer:", deployer.address);
  console.log("Rede:", (await ethers.provider.getNetwork()).name);

  // 1. Oráculo de cesta
  const Oracle = await ethers.getContractFactory("BRDcBasketOracle");
  const oracle = await Oracle.deploy(deployer.address);
  await oracle.waitForDeployment();
  console.log("BRDcBasketOracle:", await oracle.getAddress());

  // Exemplo de composição inicial da cesta — AJUSTE conforme a estratégia real de negócio.
  // Ouro com feed Chainlink (endereço de exemplo — confirme o feed XAU/USD ativo na Base antes de usar).
  // Minérios/commodities sem feed direto confiável entram como MANUAL, com PRICE_UPDATER_ROLE
  // atualizando via processo administrado e auditável (ver docstring do contrato).
  //
  // await oracle.addAsset("XAU", 5000, 0 /* CHAINLINK */, "0xENDERECO_DO_FEED_XAU_USD_NA_BASE");
  // await oracle.addAsset("IRON_ORE", 2500, 1 /* MANUAL */, ethers.ZeroAddress);
  // await oracle.addAsset("SOYBEAN", 1500, 1 /* MANUAL */, ethers.ZeroAddress);
  // await oracle.addAsset("COFFEE", 1000, 1 /* MANUAL */, ethers.ZeroAddress);

  // 2. Token (UUPS upgradeable)
  const Token = await ethers.getContractFactory("BRDcToken");
  const token = await upgrades.deployProxy(
    Token,
    [deployer.address, await oracle.getAddress()],
    { kind: "uups" }
  );
  await token.waitForDeployment();
  console.log("BRDcToken (proxy):", await token.getAddress());

  // 3. Reserva de liquidação (fração NAV não-ouro)
  // Substitua pelo endereço real do USDC (ou outra stablecoin de liquidação) na Base:
  // Mainnet Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
  const SETTLEMENT_ASSET = process.env.SETTLEMENT_ASSET_ADDRESS || "0x0000000000000000000000000000000000dEaD";

  const Reserve = await ethers.getContractFactory("BRDcReserve");
  const reserve = await Reserve.deploy(
    deployer.address,
    SETTLEMENT_ASSET,
    await oracle.getAddress(),
    await token.getAddress()
  );
  await reserve.waitForDeployment();
  console.log("BRDcReserve:", await reserve.getAddress());

  // 4. Governança
  const Governance = await ethers.getContractFactory("BRDcGovernance");
  const governance = await Governance.deploy(deployer.address, await token.getAddress());
  await governance.waitForDeployment();
  console.log("BRDcGovernance:", await governance.getAddress());

  console.log("\n=== Resumo ===");
  console.log("Oracle:", await oracle.getAddress());
  console.log("Token (proxy):", await token.getAddress());
  console.log("Reserve:", await reserve.getAddress());
  console.log("Governance:", await governance.getAddress());
  console.log("\nPróximo passo manual: chamar addAsset() na cesta e depositGold() com barras reais antes de qualquer mint().");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
