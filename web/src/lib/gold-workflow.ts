export const CUSTODY_PROVIDERS = ["Prosegur", "Brink's", "Loomis"] as const;
export type CustodyProvider = (typeof CUSTODY_PROVIDERS)[number];

export type GoldStage = "intake" | "custody" | "compliance" | "register" | "mint" | "monitor" | "redeem";
export type GoldCaseStatus = "draft" | "awaiting_compliance" | "awaiting_signature" | "confirmed" | "rejected" | "paused" | "error";

export type CustodyEvidence = {
  provider: CustodyProvider;
  barSerial: string;
  vaultLocation: string;
  evidenceReference: string;
  evidenceHash: string;
  operator: string;
  verifiedAt: string | null;
};

export type GoldCase = {
  id: string;
  stage: GoldStage;
  status: GoldCaseStatus;
  evidence: CustodyEvidence;
  weightGrams: number;
  purityBps: number;
  eligibleFineGrams: number;
  tokenAmount: string;
};

export const GOLD_STAGES: { id: GoldStage; label: string; description: string }[] = [
  { id: "intake", label: "Intake", description: "Dados da barra" },
  { id: "custody", label: "Custódia", description: "Provider e evidência" },
  { id: "compliance", label: "Compliance", description: "Aprovação operacional" },
  { id: "register", label: "Registro", description: "Barra on-chain" },
  { id: "mint", label: "Mint", description: "Emissão gold-backed" },
  { id: "monitor", label: "Monitoramento", description: "Reconciliação" },
];

export function calculateGoldBacking(weightGrams: string, purityBps: string) {
  const weight = Number(weightGrams);
  const purity = Number(purityBps);
  if (!Number.isFinite(weight) || !Number.isFinite(purity)) return 0;
  return Math.floor((weight * purity) / 10000 * 1000) / 1000;
}

export function providerEvidence(provider: CustodyProvider, serial: string, vault: string): CustodyEvidence {
  return { provider, barSerial: serial.trim(), vaultLocation: vault.trim(), evidenceReference: "manual-review", evidenceHash: "", operator: "", verifiedAt: null };
}
