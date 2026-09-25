export type DataSource = "live" | "demo" | "unavailable";

export type NavSnapshot = {
  source: DataSource;
  navUsd: number;
  goldPercent: number;
  indexPercent: number;
  compositionSource: DataSource;
  updatedAt: string | null;
  network: string;
  message: string;
};

export type StateReading<T> = {
  source: DataSource;
  value: T | null;
  message: string;
};

export type TokenState = {
  totalSupplyRaw: string;
  goldReservesRaw: string;
  goldBackedSupplyRaw: string;
};

export type ReserveState = {
  balanceRaw: string;
  redemptionCountRaw: string;
  snapshotCountRaw: string;
};

export type GovernanceState = {
  proposalCountRaw: string;
};

export type SolanaSnapshot = {
  token: StateReading<TokenState>;
  reserve: StateReading<ReserveState>;
  governance: StateReading<GovernanceState>;
  updatedAt: string;
};

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