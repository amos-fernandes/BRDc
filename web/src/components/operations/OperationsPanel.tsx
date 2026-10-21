"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, ExternalLink, ShieldCheck, Vault, WalletCards } from "lucide-react";
import { contractAddresses, encodeTokenCall, isAddressConfigured, toBytes32, toTokenAmount, txLink } from "@/lib/contracts";
import { getEvmAccount, sendEvmTransaction } from "@/lib/evm";
import { CUSTODY_PROVIDERS, GOLD_STAGES, calculateGoldBacking, type CustodyProvider, type GoldStage } from "@/lib/gold-workflow";

type ViewMode = "mint" | "redeem";

type Status = { kind: "idle" | "pending" | "success" | "error"; text: string; hash?: string };

export function OperationsPanel({ initialMode = "mint" }: { initialMode?: "mint" | "custody" | "redeem" }) {
  const [view, setView] = useState<ViewMode>(initialMode === "redeem" ? "redeem" : "mint");
  const [stage, setStage] = useState<GoldStage>(initialMode === "redeem" ? "monitor" : "intake");
  const [provider, setProvider] = useState<CustodyProvider>("Prosegur");
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle", text: "" });
  const [amount, setAmount] = useState("1000");
  const [serial, setSerial] = useState("");
  const [grams, setGrams] = useState("");
  const [purity, setPurity] = useState("9999");
  const [vault, setVault] = useState("");
  const [evidence, setEvidence] = useState("");
  const [complianceApproved, setComplianceApproved] = useState(false);
  const [goldBacked, setGoldBacked] = useState(true);
  const [delivery, setDelivery] = useState("");

  const configReady = isAddressConfigured(contractAddresses.token);
  const eligibleFineGrams = useMemo(() => calculateGoldBacking(grams, purity), [grams, purity]);
  const estimatedTokens = useMemo(() => eligibleFineGrams.toFixed(3), [eligibleFineGrams]);

  function selectView(next: ViewMode) {
    setView(next); setStage(next === "mint" ? "intake" : "monitor"); setStatus({ kind: "idle", text: "" });
  }

  async function connect() {
    try { const next = await getEvmAccount(); setAccount(next); setStatus({ kind: "success", text: "Carteira EVM conectada à Base Sepolia." }); }
    catch (error) { setStatus({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível conectar." }); }
  }

  async function execute() {
    try {
      setStatus({ kind: "pending", text: "Aguardando assinatura na carteira…" });
      const from = account || await getEvmAccount(); setAccount(from);
      if (!configReady) throw new Error("Contrato BRDc ainda não configurado. Adicione NEXT_PUBLIC_TOKEN_ADDRESS para habilitar a testnet.");
      let functionName: "mint" | "burn" | "depositGold" | "requestGoldRedemption";
      let args: readonly unknown[];
      if (view === "redeem") {
        if (delivery) { if (Number(grams) < 100) throw new Error("O resgate físico exige no mínimo 100 g."); functionName = "requestGoldRedemption"; args = [BigInt(grams), delivery.trim()]; }
        else { functionName = "burn"; args = [toTokenAmount(amount)]; }
      } else if (stage === "register") {
        if (!serial.trim() || Number(grams) <= 0 || Number(purity) < 9900 || Number(purity) > 9999 || !vault.trim()) throw new Error("Informe serial, peso, pureza e localização do cofre.");
        functionName = "depositGold"; args = [toBytes32(serial), BigInt(grams), BigInt(purity), vault.trim()];
      } else if (stage === "mint") {
        if (!complianceApproved) throw new Error("A aprovação de compliance é obrigatória antes do mint.");
        functionName = "mint"; args = [from, toTokenAmount(amount || estimatedTokens), goldBacked];
      } else { throw new Error("Avance o caso até Registro ou Mint para assinar uma transação."); }
      const hash = await sendEvmTransaction(contractAddresses.token, encodeTokenCall(functionName, args), from);
      setStatus({ kind: "success", text: "Transação enviada. Aguarde a confirmação e reconcilie o receipt antes de concluir o caso.", hash });
      setStage(functionName === "depositGold" ? "mint" : "monitor");
    } catch (error) { setStatus({ kind: "error", text: error instanceof Error ? error.message : "A transação não foi concluída." }); }
  }

  const stageIndex = GOLD_STAGES.findIndex((item) => item.id === stage);
  return <section className="ops-shell" aria-labelledby="operations-title">
    <div className="ops-intro"><span className="eyebrow"><span className="eyebrow-rule" /> CENTRO DE OPERAÇÕES · BRDC GOLD</span><h1 id="operations-title">Esteira de custódia até mint.</h1><p>Intake, evidência, compliance, registro on-chain e emissão gold-backed em um fluxo auditável.</p><div className="ops-proof"><ShieldCheck size={16} /> Ações administrativas exigem carteira autorizada. Nenhuma chave privada passa pelo app.</div></div>
    <div className="ops-tabs"><button className={view === "mint" ? "ops-tab is-active" : "ops-tab"} onClick={() => selectView("mint")}>OPERAÇÃO 01<strong>Esteira Gold</strong></button><button className={view === "redeem" ? "ops-tab is-active" : "ops-tab"} onClick={() => selectView("redeem")}>OPERAÇÃO 02<strong>Resgate físico</strong></button></div>
    {view === "mint" && <div className="ops-card"><div className="ops-card-head"><div><span className="card-label">BASE SEPOLIA · TESTNET</span><h2>Case de emissão Gold</h2></div><span className={`ops-status ${configReady ? "is-ready" : ""}`}><span /> {configReady ? "CONTRATO CONFIGURADO" : "MODO CONFIGURAÇÃO"}</span></div>
      <div className="gold-stepper" aria-label="Etapas da esteira Gold">{GOLD_STAGES.map((item, index) => <button type="button" key={item.id} className={index <= stageIndex ? "gold-step is-complete" : "gold-step"} onClick={() => setStage(item.id)}><span>{index + 1}</span><strong>{item.label}</strong><small>{item.description}</small></button>)}</div>
      <div className="gold-metrics"><div><span>Ouro fino elegível</span><strong>{eligibleFineGrams.toFixed(3)} g</strong></div><div><span>Mint estimado</span><strong>{estimatedTokens} BRDc</strong></div><div><span>Provider</span><strong>{provider}</strong></div></div>
      {!configReady && <div className="ops-empty"><Vault size={18} /><div><strong>Contrato não configurado nesta interface.</strong><p>O fluxo está pronto para testnet. Configure <code>NEXT_PUBLIC_TOKEN_ADDRESS</code> antes de assinar.</p></div></div>}
      {(stage === "intake" || stage === "custody" || stage === "compliance" || stage === "register" || stage === "mint") && <div className="form-grid"><label>Provider custodiante<select value={provider} onChange={(event) => setProvider(event.target.value as CustodyProvider)}>{CUSTODY_PROVIDERS.map((item) => <option key={item}>{item}</option>)}</select><small>Opção operacional; não implica integração contratual ativa.</small></label><label>Serial da barra<input value={serial} onChange={(event) => setSerial(event.target.value)} placeholder="BRDC-2026-0001" /></label><label>Peso em gramas<input value={grams} onChange={(event) => setGrams(event.target.value)} inputMode="decimal" placeholder="1000" /></label><label>Pureza (bps)<input value={purity} onChange={(event) => setPurity(event.target.value)} inputMode="numeric" /><small>Permitido: 9900–9999</small></label><label>Localização do cofre<input value={vault} onChange={(event) => setVault(event.target.value)} placeholder="Cofre São Paulo · A1" /></label><label>Referência da evidência<input value={evidence} onChange={(event) => setEvidence(event.target.value)} placeholder="Certificado / protocolo / hash" /></label>{stage === "compliance" && <label className="toggle-field"><span>Compliance aprovado</span><button type="button" className={`toggle ${complianceApproved ? "is-on" : ""}`} onClick={() => setComplianceApproved(!complianceApproved)} aria-pressed={complianceApproved}><span /></button><small>Somente após validação documental e KYC.</small></label>}{stage === "mint" && <><label>Quantidade BRDc<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /><small>Limite operacional: não exceder o ouro fino elegível.</small></label><label className="toggle-field"><span>Lastro em ouro</span><button type="button" className={`toggle ${goldBacked ? "is-on" : ""}`} onClick={() => setGoldBacked(!goldBacked)} aria-pressed={goldBacked}><span /></button><small>{goldBacked ? "Emissão gold-backed" : "Emissão indexada"}</small></label></>}</div>}
      <div className="ops-actions"><button className="wallet-action" onClick={connect}><WalletCards size={15} /> {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Conectar carteira EVM"}</button><button className="primary-action" onClick={execute} disabled={status.kind === "pending"}>{status.kind === "pending" ? "Aguardando assinatura…" : stage === "register" || stage === "mint" ? "Revisar e assinar" : "Validar etapa"}<ArrowUpRight size={15} /></button></div>
      {status.text && <div className={`tx-status ${status.kind}`}><span>{status.kind === "success" ? <Check size={15} /> : status.kind === "error" ? "!" : "·"}</span><div>{status.text}{status.hash && <a href={txLink(status.hash)} target="_blank" rel="noreferrer">Ver receipt na BaseScan <ExternalLink size={12} /></a>}</div></div>}
    </div>}
    {view === "redeem" && <div className="ops-card"><div className="ops-card-head"><div><span className="card-label">BRDC GOLD · SAÍDA OPERACIONAL</span><h2>Resgate e entrega física</h2></div></div><div className="form-grid"><label>Quantidade de BRDc<input value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="decimal" /></label><label>Gramas para resgate físico<input value={grams} onChange={(event) => setGrams(event.target.value)} inputMode="numeric" placeholder="mínimo 100" /><small>Pedido físico exige provider e endereço operacional.</small></label><label className="field-wide">Endereço de entrega<input value={delivery} onChange={(event) => setDelivery(event.target.value)} placeholder="Preencha para solicitar a entrega física" /></label></div><div className="ops-actions"><button className="wallet-action" onClick={connect}><WalletCards size={15} /> {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Conectar carteira EVM"}</button><button className="primary-action" onClick={execute} disabled={status.kind === "pending"}>Solicitar resgate<ArrowUpRight size={15} /></button></div>{status.text && <div className={`tx-status ${status.kind}`}><span>{status.kind === "success" ? <Check size={15} /> : "!"}</span><div>{status.text}{status.hash && <a href={txLink(status.hash)} target="_blank" rel="noreferrer">Ver na BaseScan <ExternalLink size={12} /></a>}</div></div>}</div>}
  </section>;
}
