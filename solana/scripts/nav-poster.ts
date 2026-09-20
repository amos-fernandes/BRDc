#!/usr/bin/env node

/**
 * BRDc NAV Poster — Off-chain daemon que lê o NAV do oracle EVM (Base Sepolia)
 * e atualiza o NAV bridge na Solana devnet.
 *
 * Fluxo:
 * 1. O script lê o endereço da Oracle EVM via argumento ou variável de ambiente
 * 2. Chama computeNAV() na Oracle (via RPC da Base Sepolia)
 * 3. Pega o resultado (NAV em 8 decimais, USD)
 * 4. Chama updateNav() no BRDcOracleBridge program na Solana devnet
 *
 * Uso:
 *   BRDc_SOLANA_KEYPAIR=~/.config/solana/id.json \
 *   BASE_SEPOLIA_RPC_URL=https://sepolia.base.org \
 *   BRDC_ORACLE_BRIDGE_PROGRAM_ID=<program-id> \
 *   BRDC_EVM_ORACLE_ADDRESS=<oracle-address> \
 *   node nav-poster.ts
 *
 * Ou com polling:
 *   node nav-poster.ts --poll-interval 300000  # 5 minutos
 */

const { Connection, Keypair, Transaction, SystemProgram, TransactionInstruction } = require('@solana/web3.js');
const { AnchorProvider, Program } = require('@coral-xyz/anchor');
const { BRDcOracleBridge } = require('./target/types/brdc_oracle_bridge');
const { BN } = require('@coral-xyz/anchor');
const * as ethers from 'ethers';

// Configurações via ambiente
const CONFIG = {
  solanaKeypair: process.env.BRDc_SOLANA_KEYPAIR || path.join(os.homedir(), '.config', 'solana', 'id.json'),
  solanaRpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  baseSepoliaRpcUrl: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org',
  brdcOracleBridgeProgramId: process.env.BRDC_ORACLE_BRIDGE_PROGRAM_ID || '',
  brdcEvmOracleAddress: process.env.BRDC_EVM_ORACLE_ADDRESS || '',
  pollInterval: parseInt(process.env.POLL_INTERVAL || '300000', 10), // 5 minutos padrão
  commitment: 'confirmed',
};

// ABI simplificado da Oracle EVM (só o método computeNAV)
const ORACLE_ABI = [
  'function computeNAV() external view returns (uint256 navUsd8Decimals)'
];

async function readEvmNav(rpcUrl, oracleAddress) {
  console.log(`[NAV Poster] Lendo NAV da Oracle EVM em ${rpcUrl}...`);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const oracle = new ethers.Contract(oracleAddress, ORACLE_ABI, provider);

  try {
    const nav = await oracle.computeNAV();
    console.log(`[NAV Poster] NAV da Oracle EVM: ${nav.toString()} (8 decimais, USD)`);
    return nav;
  } catch (err) {
    console.error(`[NAV Poster] Erro ao ler NAV da Oracle EVM:`, err.message);
    throw err;
  }
}

async function updateSolanaNav(provider, program, navBN) {
  console.log(`[NAV Poster] Atualizando NAV na Solana (program: ${program.programId})...`);

  const navU64 = navBN.toNumber(); // converte de BN para u64 (assumindo valor pequeno o suficiente)

  // O signer é o keypair que vai atualizar o NAV (admin do bridge)
  const signer = provider.wallet;

  try {
    const tx = await program.methods
      .updateNav(navU64)
      .send({ skipPreflight: false, commitment: CONFIG.commitment });

    console.log(`[NAV Poster] Transação enviada: ${tx}`);
    await tx.confirmation();
    console.log(`[NAV Poster] NAV atualizado na Solana com sucesso!`);
    return tx;
  } catch (err) {
    console.error(`[NAV Poster] Erro ao atualizar NAV na Solana:`, err.message);
    throw err;
  }
}

async function runOnce() {
  console.log('=== BRDc NAV Poster (single run) ===\n');

  // Validar configuração
  if (!CONFIG.brdcOracleBridgeProgramId) {
    console.error('ERRO: BRDC_ORACLE_BRIDGE_PROGRAM_ID não definido');
    process.exit(1);
  }
  if (!CONFIG.brdcEvmOracleAddress) {
    console.error('ERRO: BRDC_EVM_ORACLE_ADDRESS não definido');
    process.exit(1);
  }

  // Configurar Solana
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(CONFIG.solanaKeypair, 'utf8')))
  );
  const solanaConnection = new Connection(CONFIG.solanaRpcUrl, CONFIG.commitment);
  const provider = new AnchorProvider(solanaConnection, new Wallet(keypair), {});
  const program = new Program(BRDcOracleBridge, provider);

  console.log(`[NAV Poster] Program ID: ${program.programId}`);
  console.log(`[NAV Poster] Admin: ${keypair.publicKey.toString()}`);

  // Ler NAV da Oracle EVM
  const navBN = await readEvmNav(CONFIG.baseSepoliaRpcUrl, CONFIG.brdcEvmOracleAddress);

  // Atualizar na Solana
  await updateSolanaNav(provider, program, navBN);

  console.log('\n=== NAV Poster executado com sucesso! ===');
}

async function runPolling() {
  console.log('=== BRDc NAV Poster (polling mode) ===\n');
  console.log(`[NAV Poster] Polling a cada ${CONFIG.pollInterval}ms (${CONFIG.pollInterval / 60000} minutos)`);

  // Configurar Solana
  const keypair = Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(CONFIG.solanaKeypair, 'utf8')))
  );
  const solanaConnection = new Connection(CONFIG.solanaRpcUrl, CONFIG.commitment);
  const provider = new AnchorProvider(solanaConnection, new Wallet(keypair), {});
  const program = new Program(BRDcOracleBridge, provider);

  console.log(`[NAV Poster] Program ID: ${program.programId}`);
  console.log(`[NAV Poster] Admin: ${keypair.publicKey.toString()}`);

  let consecutiveErrors = 0;

  while (true) {
    try {
      consecutiveErrors = 0;
      const navBN = await readEvmNav(CONFIG.baseSepoliaRpcUrl, CONFIG.brdcEvmOracleAddress);
      await updateSolanaNav(provider, program, navBN);
      console.log(`[NAV Poster] Próxima atualização em ${CONFIG.pollInterval / 1000} segundos...`);
    } catch (err) {
      consecutiveErrors++;
      console.error(`[NAV Poster] Erro na iteração ${consecutiveErrors}:`, err.message);
      if (consecutiveErrors >= 3) {
        console.error('[NAV Poster] Muitos erros consecutivos. Encerrando.');
        process.exit(1);
      }
    }

    await new Promise(resolve => setTimeout(resolve, CONFIG.pollInterval));
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const isPolling = args.includes('--poll') || args.includes('-p');
const pollIntervalArg = args.find(arg => arg.startsWith('--poll-interval=') || arg.startsWith('--poll-interval '));
if (pollIntervalArg) {
  const val = pollIntervalArg.split('=')[1] || pollIntervalArg.split(' ')[1];
  CONFIG.pollInterval = parseInt(val, 10);
}

async function main() {
  if (isPolling) {
    await runPolling();
  } else {
    await runOnce();
  }
}

main().catch(console.error);
