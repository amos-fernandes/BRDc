"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Check, ExternalLink, ShieldCheck, Vault, WalletCards } from "lucide-react";
import { contractAddresses, encodeTokenCall, isAddressConfigured, toBytes32, toTokenAmount, txLink } from "@/lib/contracts";
import { getEvmAccount, sendEvmTransaction } from "@/lib/evm";

type Mode = "mint" | "custody" | "redeem";
const modes: { id: Mode; label: string; eyebrow: string; title: string; text: string }[] = [
  { id: "mint", label: "Emitir BRDc", eyebrow: "OPERAÇÃO 01", title: "Transforme lastro em unidade digital.", text: "Emita BRDc indexado com uma transação assinada pela sua carteira EVM." },
  { id: "custody", label: "Tokenizar ouro", eyebrow: "OPERAÇÃO 02", title: "Registre o ouro que sustenta o protocolo.", text: "Cadastre uma barra custodida antes de emitir unidades gold-backed." },
  { id: "redeem", label: "Resgatar", eyebrow: "OPERAÇÃO 03", title: "Converta BRDc em direito de resgate.", text: "Queime unidades ou solicite a entrega física do ouro." },
];

export function OperationsPanel({ initialMode = "mint" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState<{ kind: "idle" | "pending" | "success" | "error"; text: string; hash?: string }>({ kind: "idle", text: "" });
  const [amount, setAmount] = useState("1000");
  const [goldBacked, setGoldBacked] = useState(true);
  const [serial, setSerial] = useState("");
  const [grams, setGrams] = useState("");
  const [purity, setPurity] = useState("9999");
  const [vault, setVault] = useState("");
  const [delivery, setDelivery] = useState("");

  const configReady = isAddressConfigured(contractAddresses.token);
  const current = modes.find((item) => item.id === mode) ?? modes[0];
  const fee = useMemo(() => Number(grams || 0) * 0.005, [grams]);

  async function connect() { try { const next = await getEvmAccount(); setAccount(next); setStatus({ kind: "success", text: "Carteira EVM conectada à Base Sepolia." }); } catch (error) { setStatus({ kind: "error", text: error instanceof Error ? error.message : "Não foi possível conectar." }); } }
  async function execute() {
    try {
      setStatus({ kind: "pending", text: "Aguardando assinatura na carteira…" });
      const from = account || await getEvmAccount(); setAccount(from);
      if (!configReady) throw new Error("Contrato BRDc ainda não configurado. Adicione NEXT_PUBLIC_TOKEN_ADDRESS para habilitar a testnet.");
      let functionName: "mint" | "burn" | "depositGold" | "requestGoldRedemption"; let args: readonly unknown[];
      if (mode === "mint") { functionName = "mint"; args = [from, toTokenAmount(amount), goldBacked]; }
      else if (mode === "custody") { if (!serial || Number(grams) <= 0 || Number(purity) < 9900 || Number(purity) > 9999) throw new Error("Informe serial, peso válido e pureza entre 9900 e 9999 bps."); functionName = "depositGold"; args = [toBytes32(serial), BigInt(grams), BigInt(purity), vault]; }
      else if (delivery) { if (Number(grams) < 100) throw new Error("O resgate físico exige no mínimo 100 g."); functionName = "requestGoldRedemption"; args = [BigInt(grams), delivery]; }
      else { functionName = "burn"; args = [toTokenAmount(amount)]; }
      const hash = await sendEvmTransaction(contractAddresses.token, encodeTokenCall(functionName, args), from);
      setStatus({ kind: "success", text: "Transação enviada para a Base Sepolia.", hash });
    } catch (error) { setStatus({ kind: "error", text: error instanceof Error ? error.message : "A transação não foi concluída." }); }
  }

  return <section className="ops-shell" aria-labelledby="operations-title">
    <div className="ops-intro"><span className="eyebrow"><span className="eyebrow-rule" /> CENTRO DE OPERAÇÕES</span><h1 id="operations-title">{current.title}</h1><p>{current.text}</p><div className="ops-proof"><ShieldCheck size={16} /> Todas as ações exigem assinatura. Nenhuma chave privada passa pelo app.</div></div>
    <div className="ops-tabs">{modes.map((item) => <button key={item.id} className={mode === item.id ? "ops-tab is-active" : "ops-tab"} onClick={() => { setMode(item.id); setStatus({ kind: "idle", text: "" }); }}>{item.eyebrow}<strong>{item.label}</strong></button>)}</div>
    <div className="ops-card"><div className="ops-card-head"><div><span className="card-label">BASE SEPOLIA · TESTNET</span><h2>{current.label}</h2></div><span className={`ops-status ${configReady ? "is-ready" : ""}`}><span /> {configReady ? "CONTRATO CONFIGURADO" : "MODO CONFIGURAÇÃO"}</span></div>
      {!configReady && <div className="ops-empty"><Vault size={18} /><div><strong>O contrato ainda não foi implantado nesta interface.</strong><p>Configure <code>NEXT_PUBLIC_TOKEN_ADDRESS</code> nas variáveis do projeto para habilitar transações reais.</p></div></div>}
      {mode === "mint" && <div className="form-grid"><label>Quantidade BRDc<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /><small>18 casas decimais · destinatário: {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "sua carteira"}</small></label><label className="toggle-field"><span>Lastro em ouro</span><button type="button" className={`toggle ${goldBacked ? "is-on" : ""}`} onClick={() => setGoldBacked(!goldBacked)} aria-pressed={goldBacked}><span /></button><small>{goldBacked ? "Emissão gold-backed" : "Emissão indexada"}</small></label></div>}
      {mode === "custody" && <div className="form-grid"><label>Serial da barra<input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="BRDC-2026-0001" /></label><label>Peso em gramas<input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="numeric" placeholder="1000" /></label><label>Pureza (bps)<input value={purity} onChange={(e) => setPurity(e.target.value)} inputMode="numeric" /><small>Permitido: 9900–9999</small></label><label>Localização do cofre<input value={vault} onChange={(e) => setVault(e.target.value)} placeholder="Cofre São Paulo · A1" /></label></div>}
      {mode === "redeem" && <div className="form-grid"><label>Quantidade de BRDc<input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" /><small>Queima a fração correspondente do índice.</small></label><label>Gramas para resgate físico<input value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="numeric" placeholder="mínimo 100" /><small>Taxa estimada: {fee.toFixed(2)} g</small></label><label className="field-wide">Endereço de entrega<input value={delivery} onChange={(e) => setDelivery(e.target.value)} placeholder="Preencha apenas para resgate físico" /></label></div>}
      <div className="ops-actions"><button className="wallet-action" onClick={connect}><WalletCards size={15} /> {account ? `${account.slice(0, 6)}…${account.slice(-4)}` : "Conectar carteira EVM"}</button><button className="primary-action" onClick={execute} disabled={status.kind === "pending"}>{status.kind === "pending" ? "Aguardando assinatura…" : "Revisar e assinar"}<ArrowUpRight size={15} /></button></div>
      {status.text && <div className={`tx-status ${status.kind}`}><span>{status.kind === "success" ? <Check size={15} /> : status.kind === "error" ? "!" : "·"}</span><div>{status.text}{status.hash && <a href={txLink(status.hash)} target="_blank" rel="noreferrer">Ver na BaseScan <ExternalLink size={12} /></a>}</div></div>}
    </div>
  </section>;
}
