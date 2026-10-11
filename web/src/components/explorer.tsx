"use client";

import { ConnectWalletButton } from "./ConnectWalletButton";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  BarChart3,
  Boxes,
  CircleDollarSign,
  ClipboardList,
  Database,
  Info,
  Landmark,
  LockKeyhole,
  Menu,
  RefreshCw,
  Scale,
  ShieldAlert,
  Vault,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DEMO_NAV, EMPTY_SOLANA, type DataSource, type NavSnapshot, type SolanaSnapshot } from "@/lib/types";

const sections = [
  { id: "overview", label: "Visão geral", icon: Landmark },
  { id: "nav", label: "NAV da cesta", icon: BarChart3 },
  { id: "process", label: "Como funciona", icon: Boxes },
  { id: "simulator", label: "Simulador", icon: Activity },
  { id: "reserve", label: "Transparência", icon: Vault },
  { id: "governance", label: "Governança", icon: Scale },
];

function SourceBadge({ source, compact = false }: { source: DataSource; compact?: boolean }) {
  const label =
    source === "live"
      ? "DADO ON-CHAIN"
      : source === "demo"
        ? "DADOS DE DEMONSTRAÇÃO"
        : "DADO INDISPONÍVEL";
  return (
    <span className={`source-badge source-${source}${compact ? " source-compact" : ""}`}>
      <span className="source-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function CompositionRing({ gold, index }: { gold: number; index: number }) {
  const radius = 41;
  const circumference = 2 * Math.PI * radius;
  const goldArc = (Math.max(0, Math.min(100, gold)) / 100) * circumference;
  const indexArc = (Math.max(0, Math.min(100, index)) / 100) * circumference;

  return (
    <svg className="composition-ring" viewBox="0 0 100 100" role="img" aria-label={`Composição: ${gold}% ouro e ${index}% índice`}>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="#e7e3da" strokeWidth="11" />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#b08d46"
        strokeWidth="11"
        strokeDasharray={`${goldArc} ${circumference - goldArc}`}
        strokeLinecap="butt"
        transform="rotate(-90 50 50)"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="#2e4a66"
        strokeWidth="11"
        strokeDasharray={`${indexArc} ${circumference - indexArc}`}
        strokeDashoffset={-goldArc}
        strokeLinecap="butt"
        transform="rotate(-90 50 50)"
      />
      <text x="50" y="47" textAnchor="middle" className="ring-value">
        {Math.round(gold)}%
      </text>
      <text x="50" y="61" textAnchor="middle" className="ring-caption">
        ouro
      </text>
    </svg>
  );
}

function readNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function formatUsd(value: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

function formatInteger(value: string): string {
  try {
    return new Intl.NumberFormat("pt-BR").format(BigInt(value));
  } catch {
    return "—";
  }
}

export function Explorer() {
  const [nav, setNav] = useState<NavSnapshot>(DEMO_NAV);
  const [solana, setSolana] = useState<SolanaSnapshot>(EMPTY_SOLANA);
  const [amount, setAmount] = useState("1000");
  const [refreshing, setRefreshing] = useState(true);
  const [activeSection, setActiveSection] = useState("overview");

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const [navResult, reserveResult] = await Promise.allSettled([
      fetch("/api/nav", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("nav");
        return response.json() as Promise<NavSnapshot>;
      }),
      fetch("/api/reserve", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("reserve");
        return response.json() as Promise<SolanaSnapshot>;
      }),
    ]);
    if (navResult.status === "fulfilled") setNav(navResult.value);
    if (reserveResult.status === "fulfilled") setSolana(reserveResult.value);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id);
      },
      { rootMargin: "-25% 0px -60% 0px", threshold: [0, 0.2, 0.5] },
    );
    sections.forEach(({ id }) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    return () => observer.disconnect();
  }, []);

  const simulation = useMemo(() => {
    const usd = readNumber(amount);
    const tokens = nav.navUsd > 0 ? usd / nav.navUsd : 0;
    return {
      tokens,
      feeTokens: tokens * 0.005,
      feeUsd: usd * 0.005,
      afterFeeUsd: usd * 0.995,
    };
  }, [amount, nav.navUsd]);

  return (
    <div className="app-shell min-h-screen bg-paper text-ink">
      <a className="skip-link" href="#main">Pular para o conteúdo</a>
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-lockup">
          <div className="brand-mark">B</div>
          <div>
            <div className="brand-name">BRDc <span>Explorer</span></div>
            <div className="brand-caption">VERTICALAGENT</div>
          </div>
        </div>

        <div className="network-card">
          <div className="network-card-top">
            <span className="network-pulse" />
            <span>AMBIENTE DE TESTE</span>
          </div>
          <strong>Base Sepolia</strong>
          <span className="network-subline">+ Solana devnet</span>
        </div>

        <nav className="side-nav">
          <span className="nav-overline">NAVEGAÇÃO</span>
          {sections.map(({ id, label, icon: Icon }) => (
            <a
              key={id}
              className={`side-nav-link${activeSection === id ? " is-active" : ""}`}
              href={`#${id}`}
            >
              <Icon size={17} strokeWidth={1.7} />
              <span>{label}</span>
              {activeSection === id && <span className="nav-active-mark" />}
            </a>
          ))}
        </nav>

  <div className="sidebar-bottom">
  <a className="operations-link" href="/operations"><Vault size={16} /> Centro de operações <ArrowRight size={13} /></a>
  <ConnectWalletButton />
          <div className="sidebar-note">
            <LockKeyhole size={16} />
            <span>Somente leitura<br />Nenhuma carteira conectada</span>
          </div>
          <a className="legal-mini-link" href="https://github.com/amos-fernandes/BRDc/blob/master/LEGAL_DISCLAIMER.md" target="_blank" rel="noreferrer">
            Aviso legal do projeto <ArrowRight size={13} />
          </a>
        </div>
      </aside>

      <div className="main-column">
        <div className="testnet-ribbon">
          <div className="ribbon-primary">
            <ShieldAlert size={14} />
            <span>TESTNET / DEVNET — sem valor financeiro real</span>
            <span className="ribbon-divider" />
            <span className="ribbon-detail">Painel somente leitura</span>
          </div>
          <div className="ribbon-compliance">
            Protótipo em testnet/devnet — não é oferta pública de investimento. Consulte o{" "}
            <a href="https://github.com/amos-fernandes/BRDc/blob/master/LEGAL_DISCLAIMER.md" target="_blank" rel="noreferrer">LEGAL_DISCLAIMER.md do projeto.</a>
          </div>
        </div>

        <header className="mobile-header">
          <a className="mobile-brand" href="#overview">
            <span className="brand-mark">B</span>
            <span>BRDc <em>Explorer</em></span>
          </a>
          <a href="#nav" aria-label="Ir para dados da cesta"><Menu size={20} /></a>
        </header>

        <main id="main" className="content">
          <section className="hero-section" id="overview">
            <div className="hero-topline">
              <span className="eyebrow"><span className="eyebrow-rule" /> VISÃO DO MODELO</span>
              <button className="refresh-button" type="button" onClick={() => void refresh()} disabled={refreshing}>
                <RefreshCw size={14} className={refreshing ? "spin" : ""} />
                <span>{refreshing ? "Atualizando" : "Atualizar dados"}</span>
              </button>
            </div>
            <div className="hero-grid">
              <div className="hero-copy">
                <h1>Uma cesta.<br /><i>Duas formas</i> de resgate.</h1>
                <p className="hero-description">
                  BRDc é um protótipo de token de índice da AIBANK. Uma parte do modelo prevê ouro custodiado com possibilidade de resgate físico; a outra acompanha uma cesta de ativos e prevê liquidação somente em caixa. Este painel descreve a arquitetura — não comprova custódia, não oferece tokens nem executa operações.
                </p>
                <a className="text-link" href="#process">
                  Entenda o fluxo <ArrowRight size={15} />
                </a>
              </div>
              <div className="hero-stamp" aria-label="Protótipo em redes de teste">
                <span className="stamp-small">BRDc</span>
                <span className="stamp-line" />
                <span className="stamp-main">EXPLORER</span>
                <span className="stamp-small">AIBANK · TESTNET</span>
                <span className="stamp-number">01 / 04</span>
              </div>
            </div>
            <div className="hero-meta-row">
              <div className="hero-meta"><span className="meta-label">ESTRUTURA</span><strong>Ouro físico + índice</strong></div>
              <div className="hero-meta"><span className="meta-label">LIQUIDAÇÃO DO ÍNDICE</span><strong>Somente em caixa</strong></div>
              <div className="hero-meta"><span className="meta-label">ACESSO AOS DADOS</span><strong>Leitura pública, sem carteira</strong></div>
            </div>
          </section>

          <section className="section-block nav-section" id="nav">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-rule" /> DADOS DA CESTA</span>
                <h2>NAV <span>por unidade</span></h2>
              </div>
              <div className="section-heading-right">
                <span className="chain-pill"><span /> SOLANA</span>
              </div>
            </div>

            <div className="nav-dashboard">
              <article className="nav-value-card">
                <div className="card-topline">
                  <span className="card-label">VALOR LIDO DO ORÁCULO</span>
                  <SourceBadge source={nav.source} compact />
                </div>
                <div className="nav-number-row">
                  <span className="currency-prefix">USD</span>
                  <strong>{nav.navUsd.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 8 })}</strong>
                </div>
                <p className="nav-subtitle">NAV retornado por <code>computeNAV()</code></p>
                <div className="nav-card-footer">
                  <span className="status-led" />
                  <span>{nav.source === "live" ? "Leitura da Base Sepolia" : "Sem leitura confirmada do contrato"}</span>
                  {nav.updatedAt && <time dateTime={nav.updatedAt}>{new Date(nav.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</time>}
                </div>
                <p className={`data-message${nav.source === "demo" ? " message-demo" : ""}`}>{nav.message}</p>
              </article>

              <article className="composition-card">
                <div className="card-topline">
                  <span className="card-label">PESOS ATIVOS DA CESTA</span>
                  <SourceBadge source={nav.compositionSource} compact />
                </div>
                <div className="composition-content">
                  <CompositionRing gold={nav.goldPercent} index={nav.indexPercent} />
                  <div className="composition-legend">
                    <div className="legend-item">
                      <span className="legend-swatch swatch-gold" />
                      <span className="legend-label">Ouro</span>
                      <strong>{nav.goldPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
                    </div>
                    <div className="legend-item">
                      <span className="legend-swatch swatch-index" />
                      <span className="legend-label">Índice</span>
                      <strong>{nav.indexPercent.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</strong>
                    </div>
                  </div>
                </div>
                <div className="composition-footnote">
                  {nav.compositionSource === "live"
                    ? "Distribuição calculada dos pesos ativos informados pelo oráculo."
                    : "Proporção ilustrativa; não representa a composição atual de uma cesta implantada."}
                </div>
              </article>
            </div>
            <div className="info-strip">
              <Info size={15} />
              <p>O NAV no contrato usa precisão de 8 casas decimais. A cesta só é exibida como dado on-chain se o contrato e os pesos ativos puderem ser lidos na Base Sepolia.</p>
            </div>
          </section>

          <section className="section-block process-section" id="process">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-rule" /> FLUXO DO MODELO</span>
                <h2>Como <span>funciona</span></h2>
              </div>
              <span className="section-index">01 — 04</span>
            </div>
            <div className="process-grid">
              {[
                {
                  num: "01",
                  title: "Custódia de ouro",
                  text: "O fluxo prevê custódia e registro de barras de ouro. Esta interface não comprova a existência nem a custódia física.",
                  icon: Vault,
                  accent: "gold",
                },
                {
                  num: "02",
                  title: "Oráculo calcula NAV",
                  text: "O contrato agrega preços e pesos da cesta na Base Sepolia. Preços administrados dependem de atualização por operador.",
                  icon: BarChart3,
                  accent: "blue",
                },
                {
                  num: "03",
                  title: "Emissão ou queima",
                  text: "O modelo prevê emissão e queima do token. O painel não chama instruções nem envia transações.",
                  icon: Boxes,
                  accent: "ink",
                },
                {
                  num: "04",
                  title: "Resgate conforme a fração",
                  text: "A fração de ouro prevê resgate físico; a fração de índice é liquidada em caixa, nunca em commodity.",
                  icon: ArrowDownRight,
                  accent: "slate",
                },
              ].map(({ num, title, text, icon: Icon, accent }) => (
                <article className="process-card" key={num}>
                  <div className={`process-icon icon-${accent}`}><Icon size={19} strokeWidth={1.7} /></div>
                  <span className="process-number">{num}</span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                  {num !== "04" && <span className="process-connector" aria-hidden="true" />}
                </article>
              ))}
            </div>
          </section>

          <section className="section-block simulator-section" id="simulator">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-rule" /> FERRAMENTA EDUCATIVA</span>
                <h2>Simulador <span>de cálculo</span></h2>
              </div>
              <span className="simulation-seal"><Activity size={13} /> SIMULAÇÃO</span>
            </div>
            <div className="simulator-card">
              <div className="simulator-input-area">
                <label htmlFor="simulation-value">Valor de referência em USD</label>
                <div className="amount-input-wrap">
                  <span>US$</span>
                  <input
                    id="simulation-value"
                    type="number"
                    min="0"
                    step="100"
                    inputMode="decimal"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-describedby="simulator-disclaimer"
                  />
                </div>
                <div className="input-hint">Cálculo baseado no NAV exibido acima: {formatUsd(nav.navUsd, 4)}</div>
              </div>
              <div className="simulation-results">
                <div className="result-cell">
                  <span className="result-label">TOKENS NO NAV ATUAL</span>
                  <strong>{simulation.tokens.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}</strong>
                  <span className="result-unit">unidades estimadas</span>
                </div>
                <div className="result-cell fee-cell">
                  <span className="result-label">TAXA DE RESGATE · 0,50%</span>
                  <strong>{formatUsd(simulation.feeUsd, 2)}</strong>
                  <span className="result-unit">{simulation.feeTokens.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} tokens equivalentes</span>
                </div>
                <div className="result-cell">
                  <span className="result-label">REFERÊNCIA APÓS A TAXA</span>
                  <strong>{formatUsd(simulation.afterFeeUsd, 2)}</strong>
                  <span className="result-unit">somente aritmética ilustrativa</span>
                </div>
              </div>
              <div className="simulator-warning" id="simulator-disclaimer">
                <div className="simulation-stamp">SIMULAÇÃO</div>
                <p>Exercício educacional: não é ordem de compra, emissão, queima ou resgate. Nenhuma carteira é conectada e nenhum fundo é movimentado. O resultado usa o NAV visível e não prevê preço futuro.</p>
              </div>
            </div>
          </section>

          <section className="section-block reserve-section" id="reserve">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-rule" /> LEITURA DA SOLANA DEVNET</span>
                <h2>Transparência <span>da reserva</span></h2>
              </div>
              <span className="chain-pill chain-pill-sol"><span /> SOLANA DEVNET</span>
            </div>
            <div className="reserve-grid">
              <article className="reserve-card">
                <div className="reserve-card-head">
                  <div className="metric-icon metric-gold"><Vault size={18} /></div>
                  <SourceBadge source={solana.token.source} compact />
                </div>
                <span className="metric-label">BARRAS REGISTRADAS</span>
                <strong className="metric-value">—</strong>
                <p className="metric-note">O programa atual não armazena uma lista de barras ou quantidade em gramas.</p>
                {solana.token.value && (
                  <div className="raw-state">
                    <span>Campo bruto <code>gold_reserves</code></span>
                    <strong>{formatInteger(solana.token.value.goldReservesRaw)}</strong>
                    <small>unidade não documentada pelo programa</small>
                  </div>
                )}
                <div className="reading-message">{solana.token.message}</div>
              </article>

              <article className="reserve-card">
                <div className="reserve-card-head">
                  <div className="metric-icon metric-blue"><CircleDollarSign size={18} /></div>
                  <SourceBadge source={solana.reserve.source} compact />
                </div>
                <span className="metric-label">SALDO REGISTRADO NO ESTADO</span>
                <strong className="metric-value">
                  {solana.reserve.value ? formatInteger(solana.reserve.value.balanceRaw) : "—"}
                </strong>
                <p className="metric-note">Unidades brutas do campo <code>balance</code>; o programa não associa este número a um mint ou às casas decimais de USDC.</p>
                {solana.reserve.value && (
                  <div className="raw-submetrics">
                    <span>Resgates contabilizados<strong>{formatInteger(solana.reserve.value.redemptionCountRaw)}</strong></span>
                    <span>Snapshots<strong>{formatInteger(solana.reserve.value.snapshotCountRaw)}</strong></span>
                  </div>
                )}
                <div className="reading-message">{solana.reserve.message}</div>
              </article>
            </div>
            <div className="integrity-note">
              <ShieldAlert size={16} />
              <p>Leitura da conta do programa não confirma custódia física, existência de barras ou saldo em um token USDC. Para provar esses dados, o programa precisa registrar identificadores, unidades e vínculos verificáveis.</p>
            </div>
          </section>

          <section className="section-block governance-section" id="governance">
            <div className="section-heading">
              <div>
                <span className="eyebrow"><span className="eyebrow-rule" /> PROTOCOLO E PARTICIPAÇÃO</span>
                <h2>Governança <span>do protótipo</span></h2>
              </div>
              <span className="section-index">SEM AÇÕES DE VOTO</span>
            </div>
            <div className="governance-grid">
              <article className="governance-summary">
                <div className="governance-icon"><Scale size={20} /></div>
                <div className="governance-number">
                  <span className="metric-label">CONTADOR NO PROGRAMA</span>
                  <strong>{solana.governance.value ? formatInteger(solana.governance.value.proposalCountRaw) : "—"}</strong>
                  <span className="metric-note">propostas criadas, se a conta estiver disponível</span>
                </div>
                <SourceBadge source={solana.governance.source} compact />
              </article>
              <article className="governance-list">
                <div className="governance-list-head">
                  <ClipboardList size={17} />
                  <strong>Propostas ativas</strong>
                  <span className="list-count">0 listadas</span>
                </div>
                <div className="empty-proposals">
                  <Database size={19} />
                  <p>O programa atual guarda um contador, mas não serializa os registros de propostas nem seu estado de votação. Por isso, não é possível listar propostas ativas a partir dos dados disponíveis.</p>
                </div>
                <div className="reading-message">{solana.governance.message}</div>
              </article>
            </div>
            <div className="governance-risk">
              <div className="risk-mark"><ShieldAlert size={17} /></div>
              <div>
                <strong>Peso de voto: saldo simples do token</strong>
                <p>O desenho descrito usa saldo atual como peso, sem checkpoints históricos. Isso é vulnerável a empréstimo relâmpago e não deve ser interpretado como proteção contra manipulação.</p>
              </div>
            </div>
          </section>

          <section className="fee-strip" aria-label="Taxas descritas no modelo">
            <div><span className="fee-overline">MODELO DE RESGATE</span><strong>0,50% <small>taxa do token</small></strong></div>
            <span className="fee-separator" />
            <div><span className="fee-overline">MODELO DE LIQUIDAÇÃO</span><strong>0,30% <small>taxa da reserva</small></strong></div>
            <p>Taxas descritas no protótipo; o painel não executa resgates nem liquidações.</p>
          </section>

          <footer className="page-footer">
            <div className="footer-brand">
              <span className="brand-mark">B</span>
              <div><strong>BRDc Explorer</strong><span>Painel informativo · AIBANK</span></div>
            </div>
            <p className="footer-disclaimer">Protótipo em testnet/devnet — não é oferta pública de investimento. Consulte o <a href="https://github.com/amos-fernandes/BRDc/blob/master/LEGAL_DISCLAIMER.md" target="_blank" rel="noreferrer">LEGAL_DISCLAIMER.md do projeto</a>.</p>
            <div className="footer-meta"><span>SEM CARTEIRA</span><span>SEM TRANSAÇÕES</span><span>LEITURA SOMENTE</span></div>
          </footer>
        </main>
      </div>
    </div>
  );
}
