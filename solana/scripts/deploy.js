#!/usr/bin/env node

/**
 * BRDc Solana Deploy Script
 *
 * Deploya os 4 programas Anchor na Solana devnet:
 * 1. brdc-oracle-bridge (NAV state)
 * 2. brdc-token (token BRDc)
 * 3. brdc-reserve (reserva de liquidação em USDC)
 * 4. brdc-governance (governança)
 *
 * Usa keypair em ~/.config/solana/id.json
 * Requer: anchor, solana-cli configurados para devnet
 *
 * Uso: node deploy.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SOLANA_CONFIG = {
  keypair: path.join(process.env.HOME || os.homedir(), '.config', 'solana', 'id.json'),
  rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
  commitment: 'confirmed',
};

function run(cmd, opts = {}) {
  console.log(`\n$ ${cmd}`);
  try {
    const result = execSync(cmd, {
      stdio: 'inherit',
      env: { ...process.env, ...opts.env },
    });
    return result;
  } catch (err) {
    console.error(`Command failed: ${cmd}`);
    process.exit(1);
  }
}

async function main() {
  console.log('=== BRDc Solana Deploy ===\n');

  // Configurar Solana para devnet
  console.log('1. Configurando Solana para devnet...');
  try {
    run(`solana config set --url ${SOLANA_CONFIG.rpcUrl}`);
    console.log('Configuração OK!\n');
  } catch (err) {
    console.error('Erro ao configurar Solana.');
    process.exit(1);
  }

  // 1. Check environment
  console.log('2. Verificando ambiente...');
  try {
    run('anchor --version');
    run('solana --version');
    console.log('Ambiente OK!\n');
  } catch (err) {
    console.error('Erro no ambiente. Instale anchor e solana-cli.');
    process.exit(1);
  }

  // 2. Check SOL balance
  console.log('3. Verificando saldo SOL...');
  try {
    const balanceOutput = execSync(
      `solana balance --keypair ${SOLANA_CONFIG.keypair} --url ${SOLANA_CONFIG.rpcUrl}`,
      { encoding: 'utf8' }
    ).trim();
    console.log(`Saldo: ${balanceOutput}`);
    if (!balanceOutput.includes('SOL')) {
      console.log('AVISO: Saldo insuficiente ou não encontrado. O deploy pode falhar.');
    }
  } catch (err) {
    console.warn('Não foi possível verificar saldo. Continuando mesmo assim.');
  }

  // 3. Build programs
  console.log('4. Compilando programas...');
  try {
    run('anchor build');
    console.log('Compilação concluída!\n');
  } catch (err) {
    console.error('Falha na compilação. Verifique os programas.');
    process.exit(1);
  }

  // 4. Sync program IDs
  console.log('5. Sincronizando IDs dos programas...');
  try {
    run('anchor id');
    console.log('IDs sincronizados!\n');
  } catch (err) {
    console.warn('Não foi possível sincronizar IDs. Pode ser necessário rodar manualmente.');
  }

  // 5. Deploy programs
  console.log('6. Deployando programas na devnet...');
  try {
    run('anchor deploy');
    console.log('Deploy concluído!\n');
  } catch (err) {
    console.error('Falha no deploy. Verifique o saldo de SOL e a configuração.');
    process.exit(1);
  }

  // 6. Print program IDs
  console.log('7. Endereços dos programas deployados:');
  try {
    const idOutput = execSync('anchor id', { encoding: 'utf8' });
    console.log(idOutput);
  } catch (err) {
    console.warn('Não foi possível obter os IDs dos programas.');
  }

  // 7. Generate TypeScript client
  console.log('\n8. Gerando cliente TypeScript...');
  try {
    run('anchor generate');
    console.log('Cliente gerado!\n');
  } catch (err) {
    console.warn('Não foi possível gerar o cliente TypeScript.');
  }

  console.log('=== Deploy concluído com sucesso! ===');
  console.log('\nPróximos passos:');
  console.log('1. Atualize o NAV bridge via script off-chain (ver scripts/nav-poster.ts)');
  console.log('2. Crie os accounts de holder e configure KYC/blacklist');
  console.log('3. Faça mint de tokens de teste');
  console.log('4. Teste o fluxo completo de resgate');
}

main().catch(console.error);
