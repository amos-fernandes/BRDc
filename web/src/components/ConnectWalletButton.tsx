"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ArrowRight, X, Loader2 } from "lucide-react";
import styles from "./WalletProvider.module.css";

export function ConnectWalletButton() {
  const { connected, connecting, disconnect, select, publicKey, wallet } = useWallet();

  if (connected && publicKey) {
    return (
      <div className={styles.walletConnected}>
        <span className={styles.address}>
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </span>
        <button className={styles.disconnectBtn} onClick={disconnect} type="button">
          <X size={14} />
          <span>Desconectar</span>
        </button>
      </div>
    );
  }

  return (
    <button
      className={`${styles.connectBtn} ${connecting ? styles.connecting : ""}`}
      onClick={select}
      disabled={connecting}
      type="button"
    >
      {connecting ? <Loader2 size={16} className={styles.spinner} /> : <ArrowRight size={16} />}
      <span>{connecting ? "Conectando..." : wallet ? wallet.name : "Conectar Carteira"}</span>
    </button>
  );
}