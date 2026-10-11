"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, X } from "lucide-react";
import styles from "./WalletProvider.module.css";
import type { EthereumProvider } from "@/lib/evm";

function findProvider(kind: "metamask" | "mercado") {
  const providers = window.ethereum?.providers ?? (window.ethereum ? [window.ethereum] : []);
  return providers.find((provider) =>
    kind === "metamask"
      ? provider.isMetaMask && !provider.isMercadoBitcoin && !provider.isMBWallet
      : provider.isMercadoBitcoin || provider.isMBWallet
  );
}

export function EvmWalletButton() {
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<"metamask" | "mercado" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [available, setAvailable] = useState({ metamask: false, mercado: false });

  const refreshAvailability = useCallback(() => {
    setAvailable({
      metamask: Boolean(findProvider("metamask")),
      mercado: Boolean(findProvider("mercado")),
    });
  }, []);

  useEffect(() => {
    refreshAvailability();
    const ethereum = window.ethereum;
    if (!ethereum) return;
    const handleAccountsChanged = (accounts: unknown) => {
      setAddress(Array.isArray(accounts) && typeof accounts[0] === "string" ? accounts[0] : null);
    };
    void ethereum.request({ method: "eth_accounts" }).then(handleAccountsChanged).catch(() => undefined);
    return () => undefined;
  }, [refreshAvailability]);

  const connect = async (kind: "metamask" | "mercado") => {
    setError(null);
    const provider = findProvider(kind);
    if (!provider) {
      setError(kind === "metamask" ? "Instale a MetaMask para conectar." : "Abra ou instale a carteira Mercado Bitcoin.");
      return;
    }
    setConnecting(kind);
    try {
      const accounts = await provider.request({ method: "eth_requestAccounts" });
      const account = Array.isArray(accounts) ? accounts[0] : null;
      setAddress(typeof account === "string" ? account : null);
    } catch (cause) {
      if (!(cause && typeof cause === "object" && "code" in cause && cause.code === 4001)) {
        setError("Não foi possível conectar essa carteira.");
      }
    } finally {
      setConnecting(null);
    }
  };

  const shortAddress = useMemo(() => address ? `${address.slice(0, 6)}...${address.slice(-4)}` : null, [address]);

  if (address) {
    return (
      <div className={styles.walletConnected}>
        <span className={styles.address}>{shortAddress}</span>
        <span className={styles.chainLabel}>EVM</span>
        <button className={styles.disconnectBtn} onClick={() => setAddress(null)} type="button">
          <X size={14} />
          <span>Desconectar</span>
        </button>
      </div>
    );
  }

  return (
    <div className={styles.evmWalletGroup}>
      <span className={styles.walletNetworkLabel}>EVM</span>
      <div className={styles.evmButtons}>
        <button className={styles.connectBtn} onClick={() => void connect("metamask")} disabled={connecting !== null} type="button">
          {connecting === "metamask" ? <Loader2 size={15} className={styles.spinner} /> : null}
          <span>MetaMask</span>
        </button>
        <button className={styles.connectBtn} onClick={() => void connect("mercado")} disabled={connecting !== null} type="button">
          {connecting === "mercado" ? <Loader2 size={15} className={styles.spinner} /> : null}
          <span>Mercado Bitcoin</span>
        </button>
      </div>
      {!available.metamask && !available.mercado ? <span className={styles.walletHint}>Instale MetaMask ou Mercado Bitcoin</span> : null}
      {error ? <span className={styles.walletError} role="status">{error}</span> : null}
    </div>
  );
}
