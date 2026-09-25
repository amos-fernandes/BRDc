// Tipos compartilhados entre mobile e web

export type DataSource = "live" | "demo" | "unavailable";

export interface NavSnapshot {
  source: DataSource;
  navUsd: number;
  goldPercent: number;
  indexPercent: number;
  compositionSource: DataSource;
  updatedAt: string | null;
  network: string;
  message: string;
}

export interface StateReading<T> {
  source: DataSource;
  value: T | null;
  message: string;
}

export interface TokenState {
  totalSupplyRaw: string;
  goldReservesRaw: string;
  goldBackedSupplyRaw: string;
}

export interface ReserveState {
  balanceRaw: string;
  redemptionCountRaw: string;
  snapshotCountRaw: string;
}

export interface GovernanceState {
  proposalCountRaw: string;
}

export interface SolanaSnapshot {
  token: StateReading<TokenState>;
  reserve: StateReading<ReserveState>;
  governance: StateReading<GovernanceState>;
  updatedAt: string;
}

export const DEMO_NAV: NavSnapshot = {
  source: "demo",
  navUsd: 1,
  goldPercent: 50,
  indexPercent: 50,
  compositionSource: "demo",
  updatedAt: null,
  network: "Base Sepolia",
  message: "Contrato não configurado. Valores ilustrativos para demonstrar a interface.",
};

export const EMPTY_SOLANA: SolanaSnapshot = {
  token: {
    source: "demo",
    value: null,
    message: "ID do programa não configurado; nenhum valor de reserva de demonstração foi fornecido.",
  },
  reserve: {
    source: "demo",
    value: null,
    message: "ID do programa não configurado; nenhum saldo de demonstração foi fornecido.",
  },
  governance: {
    source: "demo",
    value: null,
    message: "ID do programa não configurado; nenhuma proposta de demonstração foi fornecida.",
  },
  updatedAt: "",
};