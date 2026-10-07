"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { ArrowRight, X, Loader2 } from "lucide-react";
import { EvmWalletButton } from "./EvmWalletButton";
import styles from "./WalletProvider.module.css";

export function ConnectWalletButton() {
  const { connected, connecting, disconnect, publicKey, wallet } = useWallet();
  const { setVisible } = useWalletModal();
  const connect = () => setVisible(true);

  if (connected && publicKey) {
    return (
      <div className={styles.walletOptions}>
        <div className={styles.walletConnected}>
          <span className={styles.address}>
            {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </span>
          <span className={styles.chainLabel}>Solana</span>
          <button className={styles.disconnectBtn} onClick={disconnect} type="button">
            <X size={14} />
            <span>Desconectar</span>
          </button>
        </div>
        <EvmWalletButton />
      </div>
    );
  }

  return (
    <div className={styles.walletOptions}>
      <div>
        <span className={styles.walletNetworkLabel}>Solana</span>
        <button
      className={`${styles.connectBtn} ${connecting ? styles.connecting : ""}`}
      onClick={connect}
      disabled={connecting}
      type="button"
    >
      {connecting ? <Loader2 size={16} className={styles.spinner} /> : <ArrowRight size={16} />}
      <span>{connecting ? "Conectando..." : wallet ? wallet.adapter.name : "Phantom / Solflare"}</span>
        </button>
      </div>
      <EvmWalletButton />
    </div>
  );
}
