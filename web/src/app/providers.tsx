"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const SolanaWalletProvider = dynamic(
  () => import("@/components/WalletProvider").then((module) => module.SolanaWalletProvider),
  { ssr: false },
);

export function Providers({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
