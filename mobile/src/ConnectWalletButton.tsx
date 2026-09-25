import { useWallet } from "@solana/wallet-adapter-react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";

export function ConnectWalletButton() {
  const { connected, connecting, disconnect, select, publicKey, wallet } = useWallet();

  if (connected && publicKey) {
    return (
      <View style={styles.walletConnected}>
        <Text style={styles.address}>
          {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
        </Text>
        <TouchableOpacity style={styles.disconnectBtn} onPress={disconnect}>
          <Text style={styles.disconnectText}>Desconectar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.connectBtn, connecting && styles.connecting]}
      onPress={select}
      disabled={connecting}
    >
      <Text style={[styles.connectText, connecting && styles.connectingText]}>
        {connecting ? "Conectando..." : wallet ? wallet.name : "Conectar Carteira"}
      </Text>
      {connecting && <ActivityIndicator size="small" color="#F7F5F0" />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  walletConnected: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F4F0E7",
    borderWidth: 1,
    borderColor: "#E4D9C1",
    borderRadius: 8,
    minWidth: 200,
  },
  address: {
    fontFamily: "monospace",
    fontWeight: "600",
    fontSize: 13,
    color: "#5B4C2D",
  },
  disconnectBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#D6C69E",
    borderRadius: 6,
  },
  disconnectText: {
    color: "#796236",
    fontSize: 12,
    fontWeight: "600",
  },
  connectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#12151C",
    borderRadius: 8,
    minWidth: 180,
  },
  connectBtnDisabled: {
    opacity: 0.6,
  },
  connectText: {
    color: "#F7F5F0",
    fontSize: 13,
    fontWeight: "600",
  },
  connectingText: {
    color: "#12151C",
  },
  connecting: {
    backgroundColor: "#B08D46",
  },
});