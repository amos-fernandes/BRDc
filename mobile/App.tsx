import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Buffer } from "buffer";
import { SolanaWalletProvider } from "./src/WalletProvider";
import { ConnectWalletButton } from "./src/ConnectWalletButton";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  type StyleProp,
  Text,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import {
  DEMO_NAV,
  EMPTY_SOLANA,
  type DataSource,
  type NavSnapshot,
  type SolanaSnapshot,
} from "@brdc/sdk";

type Tab = "overview" | "nav" | "simulator" | "data";

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
const SOLANA_RPC_URL = (process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com").trim();
const LEGAL_URL = "https://github.com/amos-fernandes/BRDc/blob/master/LEGAL_DISCLAIMER.md";

const ORACLE_PROGRAM_ID = (process.env.EXPO_PUBLIC_ORACLE_PROGRAM_ID ?? "").trim();
const TOKEN_PROGRAM_ID = (process.env.EXPO_PUBLIC_TOKEN_PROGRAM_ID ?? "").trim();
const RESERVE_PROGRAM_ID = (process.env.EXPO_PUBLIC_RESERVE_PROGRAM_ID ?? "").trim();
const GOVERNANCE_PROGRAM_ID = (process.env.EXPO_PUBLIC_GOVERNANCE_PROGRAM_ID ?? "").trim();

const hasProgramIds = false;
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Visão" },
  { id: "nav", label: "NAV" },
  { id: "simulator", label: "Simular" },
  { id: "data", label: "Dados" },
];
const COLORS = {
  ink: "#12151C",
  paper: "#F7F5F0",
  bronze: "#B08D46",
  slate: "#2E4A66",
  muted: "#777A7C",
  line: "#E7E3DA",
  card: "#FBFAF7",
  cream: "#F0E5C8",
  green: "#456451",
};

function formatUsd(value: number, digits = 2): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number, digits = 4): string {
  return new Intl.NumberFormat("pt-BR", { maximumFractionDigits: digits }).format(
    Number.isFinite(value) ? value : 0,
  );
}

function formatInteger(value: string | undefined): string {
  try {
    return value === undefined ? "—" : new Intl.NumberFormat("pt-BR").format(BigInt(value));
  } catch {
    return "—";
  }
}

function sourceLabel(source: DataSource): string {
  if (source === "live") return "DADO ON-CHAIN";
  if (source === "demo") return "DADOS DE DEMONSTRAÇÃO";
  return "DADO INDISPONÍVEL";
}

function SourceBadge({ source }: { source: DataSource }) {
  return (
    <View style={[styles.sourceBadge, source === "live" ? styles.sourceLive : source === "demo" ? styles.sourceDemo : styles.sourceUnavailable]}>
      <View style={[styles.sourceDot, source === "live" ? styles.dotLive : source === "demo" ? styles.dotDemo : styles.dotUnavailable]} />
      <Text style={[styles.sourceText, source === "live" ? styles.sourceTextLive : source === "demo" ? styles.sourceTextDemo : styles.sourceTextUnavailable]}>
        {sourceLabel(source)}
      </Text>
    </View>
  );
}

function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Eyebrow({ children }: { children: string }) {
  return (
    <View style={styles.eyebrowRow}>
      <View style={styles.eyebrowRule} />
      <Text style={styles.eyebrow}>{children}</Text>
    </View>
  );
}

function SectionTitle({ kicker, title, italic }: { kicker: string; title: string; italic?: string }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <Eyebrow>{kicker}</Eyebrow>
      <Text style={styles.sectionTitle}>
        {title}
        {italic ? <Text style={styles.sectionTitleItalic}> {italic}</Text> : null}
      </Text>
    </View>
  );
}

function InfoBox({ children, warning = false }: { children: string; warning?: boolean }) {
  return (
    <View style={[styles.infoBox, warning && styles.warningBox]}>
      <View style={[styles.infoMark, warning && styles.warningMark]}>
        <Text style={[styles.infoMarkText, warning && styles.warningMarkText]}>{warning ? "!" : "i"}</Text>
      </View>
      <Text style={[styles.infoText, warning && styles.warningText]}>{children}</Text>
    </View>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("overview");
  const [nav, setNav] = useState<NavSnapshot>(DEMO_NAV);
  const [solana, setSolana] = useState<SolanaSnapshot>(EMPTY_SOLANA);
  const [amount, setAmount] = useState("1000");
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);

    // Fetch NAV from API (Base Sepolia)
    if (API_BASE_URL) {
      const load = async <T,>(path: string): Promise<T> => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12_000);
        try {
          const response = await fetch(`${API_BASE_URL}${path}`, {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          });
          if (!response.ok) throw new Error("Leitura indisponível");
          return (await response.json()) as T;
        } finally {
          clearTimeout(timeout);
        }
      };

      const navResult = await load<NavSnapshot>("/api/nav").catch(() => null);
      if (navResult) setNav(navResult);
    } else {
      setNav(DEMO_NAV);
    }

    // Solana data - program IDs not configured yet, use demo
    setSolana(EMPTY_SOLANA);

    setRefreshing(false);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const simulation = useMemo(() => {
    const parsedAmount = Number(amount.replace(",", "."));
    const usd = Number.isFinite(parsedAmount) && parsedAmount > 0 ? parsedAmount : 0;
    const tokens = nav.navUsd > 0 ? usd / nav.navUsd : 0;
    return {
      tokens,
      feeTokens: tokens * 0.005,
      feeUsd: usd * 0.005,
      afterFeeUsd: usd * 0.995,
    };
  }, [amount, nav.navUsd]);

  const openLegal = useCallback(() => {
    void Linking.openURL(LEGAL_URL).catch(() => undefined);
  }, []);

  const renderOverview = () => (
    <>
      <View style={styles.hero}>
        <Eyebrow>VISÃO DO MODELO</Eyebrow>
        <Text style={styles.heroTitle}>
          Uma cesta.{"\n"}
          <Text style={styles.heroItalic}>Duas formas</Text> de resgate.
        </Text>
        <Text style={styles.bodyCopy}>
          BRDc é um protótipo de token de índice da AIBANK. O modelo prevê uma fração ligada a ouro custodiado, com possibilidade de resgate físico, e outra ligada a uma cesta de ativos, liquidada somente em caixa.
        </Text>
        <Text style={styles.bodyCopy}>
          Este painel explica a arquitetura. Não comprova custódia, não oferece tokens e não executa operações.
        </Text>
      </View>

      <View style={styles.metaGrid}>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>ESTRUTURA</Text>
          <Text style={styles.metaValue}>Ouro físico + índice</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>RESGATE DO ÍNDICE</Text>
          <Text style={styles.metaValue}>Somente em caixa</Text>
        </View>
        <View style={styles.metaCell}>
          <Text style={styles.metaLabel}>ACESSO</Text>
          <Text style={styles.metaValue}>Leitura pública</Text>
        </View>
      </View>

      <SectionTitle kicker="FLUXO DO MODELO" title="Como" italic="funciona" />
      {[
        ["01", "Custódia de ouro", "O modelo prevê custódia e registro de barras. Esta interface não comprova a existência nem a custódia física."],
        ["02", "Oráculo calcula NAV", "O contrato agrega preços e pesos da cesta na Base Sepolia. Preços administrados dependem de atualização por operador."],
        ["03", "Emissão ou queima", "O modelo prevê emissão e queima do token. O aplicativo não chama instruções nem envia transações."],
        ["04", "Resgate conforme a fração", "A fração de ouro prevê resgate físico; a fração de índice é liquidada em caixa, nunca em commodity."],
      ].map(([number, title, description]) => (
        <Card key={number} style={styles.stepCard}>
          <Text style={styles.stepNumber}>{number}</Text>
          <View style={styles.stepCopy}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={styles.smallCopy}>{description}</Text>
          </View>
        </Card>
      ))}

      <Card style={styles.feeCard}>
        <Text style={styles.cardLabel}>TAXAS DESCRITAS NO PROTÓTIPO</Text>
        <View style={styles.feeRow}>
          <View style={styles.feeMetric}>
            <Text style={styles.feeRate}>0,50%</Text>
            <Text style={styles.smallCopy}>taxa do token</Text>
          </View>
          <View style={styles.feeDivider} />
          <View style={styles.feeMetric}>
            <Text style={styles.feeRate}>0,30%</Text>
            <Text style={styles.smallCopy}>taxa da reserva</Text>
          </View>
        </View>
        <Text style={styles.smallCopy}>O app não executa resgates nem liquidações.</Text>
      </Card>
    </>
  );

  const renderNav = () => (
    <>
      <SectionTitle kicker="DADOS DA CESTA" title="NAV" italic="por unidade" />
      <View style={styles.chainLabel}>
        <View style={styles.chainDot} />
        <Text style={styles.chainLabelText}>BASE SEPOLIA</Text>
      </View>
      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>VALOR LIDO DO ORÁCULO</Text>
          <SourceBadge source={nav.source} />
        </View>
        <Text style={styles.navValue}>{formatUsd(nav.navUsd, 4)}</Text>
        <Text style={styles.smallCopy}>NAV retornado por computeNAV()</Text>
        <View style={styles.cardRule} />
        <Text style={styles.smallCopy}>{nav.message}</Text>
        {nav.updatedAt ? (
          <Text style={styles.timestamp}>
            Atualizado às {new Date(nav.updatedAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          </Text>
        ) : null}
      </Card>

      <Card style={styles.compositionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>PESOS ATIVOS DA CESTA</Text>
          <SourceBadge source={nav.compositionSource} />
        </View>
        <View style={styles.compositionNumberRow}>
          <Text style={styles.compositionNumber}>{formatNumber(nav.goldPercent, 1)}%</Text>
          <Text style={[styles.compositionNumber, styles.compositionIndex]}>{formatNumber(nav.indexPercent, 1)}%</Text>
        </View>
        <View style={styles.compositionBar}>
          <View style={[styles.goldBar, { width: `${Math.max(0, Math.min(100, nav.goldPercent))}%` }]} />
          <View style={[styles.indexBar, { width: `${Math.max(0, Math.min(100, nav.indexPercent))}%` }]} />
        </View>
        <View style={styles.legendRow}>
          <Text style={styles.legendText}><Text style={styles.goldBullet}>●</Text> Ouro</Text>
          <Text style={styles.legendText}><Text style={styles.indexBullet}>●</Text> Índice</Text>
        </View>
        <View style={styles.cardRule} />
        <Text style={styles.smallCopy}>
          {nav.compositionSource === "live"
            ? "Pesos ativos informados pelo oráculo."
            : "Proporção ilustrativa; não representa a composição atual de uma cesta implantada."}
        </Text>
      </Card>

      <InfoBox>
        O NAV usa precisão de 8 casas decimais no contrato. A composição só é dado on-chain quando os pesos ativos puderem ser lidos na Base Sepolia.
      </InfoBox>
    </>
  );

  const renderSimulator = () => (
    <>
      <SectionTitle kicker="FERRAMENTA EDUCATIVA" title="Simulador" italic="de cálculo" />
      <Card>
        <View style={styles.simulationPill}><Text style={styles.simulationPillText}>SIMULAÇÃO</Text></View>
        <Text style={styles.inputLabel}>Valor de referência em USD</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.amountPrefix}>US$</Text>
          <TextInput
            accessibilityLabel="Valor de referência em dólares"
            keyboardType="decimal-pad"
            value={amount}
            onChangeText={setAmount}
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor="#96948E"
          />
        </View>
        <Text style={styles.inputHint}>Cálculo baseado no NAV exibido: {formatUsd(nav.navUsd, 4)}</Text>

        <View style={styles.results}>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>TOKENS NO NAV ATUAL</Text>
            <Text style={styles.resultValue}>{formatNumber(simulation.tokens)}</Text>
            <Text style={styles.resultUnit}>unidades estimadas</Text>
          </View>
          <View style={styles.resultRow}>
            <Text style={styles.resultLabel}>TAXA DE RESGATE · 0,50%</Text>
            <Text style={[styles.resultValue, styles.feeResult]}>{formatUsd(simulation.feeUsd)}</Text>
            <Text style={styles.resultUnit}>{formatNumber(simulation.feeTokens)} tokens equivalentes</Text>
          </View>
          <View style={[styles.resultRow, styles.resultLast]}>
            <Text style={styles.resultLabel}>REFERÊNCIA APÓS A TAXA</Text>
            <Text style={styles.resultValue}>{formatUsd(simulation.afterFeeUsd)}</Text>
            <Text style={styles.resultUnit}>somente aritmética ilustrativa</Text>
          </View>
        </View>
      </Card>
      <InfoBox warning>
        Exercício educacional — não é ordem de compra, emissão, queima ou resgate. Nenhuma carteira é conectada e nenhum fundo é movimentado. O resultado usa o NAV visível e não prevê preço futuro.
      </InfoBox>
    </>
  );

  const renderData = () => (
    <>
      <SectionTitle kicker="SOLANA DEVNET" title="Transparência" italic="da reserva" />
      <View style={styles.chainLabel}>
        <View style={[styles.chainDot, styles.solanaDot]} />
        <Text style={[styles.chainLabelText, styles.solanaText]}>SOLANA DEVNET</Text>
      </View>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>BARRAS REGISTRADAS</Text>
          <SourceBadge source={solana.token.source} />
        </View>
        <Text style={styles.metricLarge}>—</Text>
        <Text style={styles.smallCopy}>O programa atual não armazena uma lista de barras ou quantidade em gramas.</Text>
        {solana.token.value ? (
          <View style={styles.rawState}>
            <Text style={styles.smallCopy}>Campo bruto gold_reserves</Text>
            <Text style={styles.rawValue}>{formatInteger(solana.token.value.goldReservesRaw)}</Text>
            <Text style={styles.tinyCopy}>unidade não documentada pelo programa</Text>
          </View>
        ) : null}
        <View style={styles.cardRule} />
        <Text style={styles.tinyCopy}>{solana.token.message}</Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>SALDO REGISTRADO NO ESTADO</Text>
          <SourceBadge source={solana.reserve.source} />
        </View>
        <Text style={styles.metricLarge}>
          {solana.reserve.value ? formatInteger(solana.reserve.value.balanceRaw) : "—"}
        </Text>
        <Text style={styles.smallCopy}>
          Unidades brutas do campo balance; o programa não associa esse número a um mint ou às casas decimais de USDC.
        </Text>
        {solana.reserve.value ? (
          <View style={styles.rawMetrics}>
            <View style={styles.rawMetric}><Text style={styles.tinyCopy}>RESGATES</Text><Text style={styles.rawMetricValue}>{formatInteger(solana.reserve.value.redemptionCountRaw)}</Text></View>
            <View style={styles.rawMetric}><Text style={styles.tinyCopy}>SNAPSHOTS</Text><Text style={styles.rawMetricValue}>{formatInteger(solana.reserve.value.snapshotCountRaw)}</Text></View>
          </View>
        ) : null}
        <View style={styles.cardRule} />
        <Text style={styles.tinyCopy}>{solana.reserve.message}</Text>
      </Card>

      <Card>
        <View style={styles.cardHeader}>
          <Text style={styles.cardLabel}>GOVERNANÇA</Text>
          <SourceBadge source={solana.governance.source} />
        </View>
        <Text style={styles.metricLarge}>
          {solana.governance.value ? formatInteger(solana.governance.value.proposalCountRaw) : "—"}
        </Text>
        <Text style={styles.smallCopy}>Contador de propostas no programa; registros ativos não estão disponíveis para listar.</Text>
        <View style={styles.cardRule} />
        <Text style={styles.tinyCopy}>{solana.governance.message}</Text>
        <View style={styles.riskBox}>
          <Text style={styles.riskTitle}>PESO DE VOTO: SALDO SIMPLES DO TOKEN</Text>
          <Text style={styles.smallCopy}>
            O desenho usa saldo atual como peso, sem checkpoints históricos. Isso é vulnerável a empréstimo relâmpago e não deve ser interpretado como proteção contra manipulação.
          </Text>
        </View>
      </Card>

      <InfoBox warning>
        Leitura da conta do programa não confirma custódia física, existência de barras ou saldo em USDC. O programa precisaria registrar identificadores, unidades e vínculos verificáveis.
      </InfoBox>
    </>
  );

  return (
    <SolanaWalletProvider>
      <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.networkRibbon}>
        <Text style={styles.networkRibbonTitle}>TESTNET / DEVNET — sem valor financeiro real</Text>
        <Text style={styles.networkRibbonBody}>
          Protótipo em testnet/devnet — não é oferta pública de investimento.
        </Text>
        <Pressable onPress={openLegal} accessibilityRole="link" accessibilityLabel="Abrir aviso legal do projeto">
          <Text style={styles.legalLink}>Consulte o LEGAL_DISCLAIMER.md do projeto.</Text>
        </Pressable>
      </View>

      <View style={styles.appHeader}>
        <View style={styles.brandMark}><Text style={styles.brandLetter}>B</Text></View>
        <View style={styles.brandCopy}>
          <Text style={styles.brandName}>BRDc <Text style={styles.brandExplorer}>Explorer</Text></Text>
          <Text style={styles.brandCaption}>AIBANK · PAINEL DO PROTÓTIPO</Text>
        </View>
        <ConnectWalletButton />
        <Pressable
          onPress={() => void refresh()}
          disabled={refreshing}
          accessibilityRole="button"
          accessibilityLabel="Atualizar dados"
          style={styles.refreshAction}
        >
          {refreshing ? <ActivityIndicator size="small" color={COLORS.slate} /> : <Text style={styles.refreshGlyph}>↻</Text>}
        </Pressable>
      </View>

      <ScrollView
        key={tab}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {tab === "overview" ? renderOverview() : null}
        {tab === "nav" ? renderNav() : null}
        {tab === "simulator" ? renderSimulator() : null}
        {tab === "data" ? renderData() : null}
        <View style={styles.footer}>
          <Text style={styles.footerTitle}>BRDc Explorer</Text>
          <Text style={styles.tinyCopy}>Painel informativo · AIBANK · leitura somente</Text>
          <Text style={styles.footerMeta}>CARTEIRA OPCIONAL · SEM TRANSAÇÕES AUTOMÁTICAS</Text>
        </View>
      </ScrollView>

      <View style={styles.tabBar}>
        {TABS.map(({ id, label }) => (
          <Pressable
            key={id}
            onPress={() => setTab(id)}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === id }}
            style={[styles.tabButton, tab === id && styles.tabButtonActive]}
          >
            <Text style={[styles.tabLabel, tab === id && styles.tabLabelActive]}>{label}</Text>
            {tab === id ? <View style={styles.tabIndicator} /> : null}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
    </SolanaWalletProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.paper },
  networkRibbon: {
    paddingHorizontal: 15,
    paddingTop: 7,
    paddingBottom: 8,
    alignItems: "center",
    backgroundColor: COLORS.cream,
  },
  networkRibbonTitle: { color: "#5E4B22", fontSize: 10, fontWeight: "800", letterSpacing: 0.7, textAlign: "center" },
  networkRibbonBody: { marginTop: 3, color: "#6C5D3A", fontSize: 8, textAlign: "center" },
  legalLink: { marginTop: 2, color: "#59471F", fontSize: 8, fontWeight: "700", textDecorationLine: "underline" },
  appHeader: {
    minHeight: 61,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  brandMark: { width: 34, height: 34, borderWidth: 1, borderColor: COLORS.bronze, alignItems: "center", justifyContent: "center" },
  brandLetter: { color: COLORS.bronze, fontFamily: "Georgia", fontSize: 20 },
  brandCopy: { marginLeft: 10, flex: 1 },
  brandName: { color: COLORS.ink, fontSize: 14, fontWeight: "700" },
  brandExplorer: { color: COLORS.muted, fontWeight: "400" },
  brandCaption: { marginTop: 3, color: "#888A8B", fontSize: 7, letterSpacing: 1 },
  refreshAction: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  refreshGlyph: { color: COLORS.slate, fontSize: 24, lineHeight: 28 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 18, paddingTop: 25, paddingBottom: 30 },
  hero: { paddingBottom: 19, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  eyebrowRule: { width: 17, height: 1, backgroundColor: COLORS.bronze },
  eyebrow: { color: "#7E7664", fontSize: 8, fontWeight: "700", letterSpacing: 1.4 },
  heroTitle: { marginTop: 18, color: COLORS.ink, fontFamily: "Georgia", fontSize: 39, lineHeight: 43, letterSpacing: -1.6 },
  heroItalic: { color: "#8E7441", fontStyle: "italic" },
  bodyCopy: { marginTop: 13, color: "#62645F", fontSize: 12, lineHeight: 19 },
  metaGrid: { marginTop: 13, marginBottom: 30, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  metaCell: { minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: COLORS.line },
  metaLabel: { color: "#92918C", fontSize: 7, fontWeight: "700", letterSpacing: 0.9 },
  metaValue: { color: "#353832", fontSize: 10, fontWeight: "600" },
  sectionTitleWrap: { marginTop: 2, marginBottom: 14 },
  sectionTitle: { marginTop: 7, color: COLORS.ink, fontFamily: "Georgia", fontSize: 27, letterSpacing: -0.8 },
  sectionTitleItalic: { color: "#8B8B84", fontStyle: "italic" },
  card: { marginBottom: 11, padding: 15, borderWidth: 1, borderColor: COLORS.line, backgroundColor: COLORS.card },
  stepCard: { flexDirection: "row", gap: 12, paddingVertical: 14 },
  stepNumber: { width: 32, color: "#A7A297", fontSize: 9, fontWeight: "700", letterSpacing: 1 },
  stepCopy: { flex: 1 },
  stepTitle: { marginBottom: 5, color: "#2D302E", fontFamily: "Georgia", fontSize: 17 },
  smallCopy: { color: "#74756F", fontSize: 9, lineHeight: 14 },
  feeCard: { marginTop: 8, backgroundColor: "#EAE7DF" },
  cardLabel: { color: "#85857F", fontSize: 7, fontWeight: "700", letterSpacing: 0.9 },
  feeRow: { flexDirection: "row", alignItems: "center", marginVertical: 14 },
  feeMetric: { flex: 1 },
  feeRate: { color: "#353832", fontFamily: "Georgia", fontSize: 23 },
  feeDivider: { width: 1, height: 35, marginHorizontal: 14, backgroundColor: "#D2CEC3" },
  chainLabel: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12, paddingHorizontal: 8, paddingVertical: 6, borderWidth: 1, borderColor: "#E2D6B9" },
  chainDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: COLORS.bronze },
  chainLabelText: { color: "#746039", fontSize: 7, fontWeight: "700", letterSpacing: 0.8 },
  solanaDot: { backgroundColor: "#6485A0" },
  solanaText: { color: "#526C80" },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
  sourceBadge: { maxWidth: "60%", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 6, paddingVertical: 4, backgroundColor: "#F1EFE8" },
  sourceLive: { backgroundColor: "#EAF0E9" },
  sourceDemo: { backgroundColor: "#F4EDDC" },
  sourceUnavailable: { backgroundColor: "#EEECE8" },
  sourceDot: { width: 4, height: 4, borderRadius: 2 },
  dotLive: { backgroundColor: COLORS.green },
  dotDemo: { backgroundColor: "#856B34" },
  dotUnavailable: { backgroundColor: COLORS.muted },
  sourceText: { flexShrink: 1, fontSize: 6, fontWeight: "700", letterSpacing: 0.3 },
  sourceTextLive: { color: COLORS.green },
  sourceTextDemo: { color: "#856B34" },
  sourceTextUnavailable: { color: COLORS.muted },
  navValue: { marginTop: 19, marginBottom: 7, color: COLORS.ink, fontFamily: "Georgia", fontSize: 36 },
  cardRule: { height: 1, marginVertical: 10, backgroundColor: COLORS.line },
  timestamp: { marginTop: 7, color: "#92918B", fontSize: 8 },
  compositionCard: { paddingBottom: 17 },
  compositionNumberRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 20, marginBottom: 7 },
  compositionNumber: { color: "#8A713F", fontFamily: "Georgia", fontSize: 23 },
  compositionIndex: { color: COLORS.slate },
  compositionBar: { height: 12, flexDirection: "row", overflow: "hidden", backgroundColor: "#E7E3DA" },
  goldBar: { height: "100%", backgroundColor: COLORS.bronze },
  indexBar: { height: "100%", backgroundColor: COLORS.slate },
  legendRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 9 },
  legendText: { color: "#62645F", fontSize: 9 },
  goldBullet: { color: COLORS.bronze, fontSize: 9 },
  indexBullet: { color: COLORS.slate, fontSize: 9 },
  infoBox: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 2, marginBottom: 12, padding: 12, borderLeftWidth: 2, borderLeftColor: COLORS.bronze, backgroundColor: "#F1EFE9" },
  warningBox: { borderLeftColor: "#8A7143", backgroundColor: "#F3EDDF" },
  infoMark: { width: 15, height: 15, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "#8B7341" },
  warningMark: { backgroundColor: "#8A7143" },
  infoMarkText: { color: "#FFFFFF", fontSize: 9, fontWeight: "700" },
  warningMarkText: { color: "#FFFFFF" },
  infoText: { flex: 1, color: "#716D62", fontSize: 9, lineHeight: 14 },
  warningText: { color: "#73684E" },
  simulationPill: { alignSelf: "flex-start", marginBottom: 16, borderWidth: 1, borderColor: "#D6C69E", paddingHorizontal: 8, paddingVertical: 5 },
  simulationPillText: { color: "#796236", fontSize: 7, fontWeight: "700", letterSpacing: 1 },
  inputLabel: { marginBottom: 7, color: "#666861", fontSize: 10, fontWeight: "700" },
  amountInputWrap: { height: 45, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D9D5CB", backgroundColor: "#FFFFFF" },
  amountPrefix: { paddingLeft: 11, color: "#7B7B74", fontSize: 12 },
  amountInput: { flex: 1, paddingHorizontal: 8, color: COLORS.ink, fontFamily: "Georgia", fontSize: 19 },
  inputHint: { marginTop: 6, color: "#86847C", fontSize: 8 },
  results: { marginTop: 17, borderTopWidth: 1, borderTopColor: COLORS.line },
  resultRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.line },
  resultLast: { borderBottomWidth: 0 },
  resultLabel: { color: "#89877F", fontSize: 7, fontWeight: "700", letterSpacing: 0.8 },
  resultValue: { marginTop: 5, color: "#252923", fontFamily: "Georgia", fontSize: 21 },
  feeResult: { color: "#7A6537" },
  resultUnit: { marginTop: 4, color: "#85857F", fontSize: 8 },
  metricLarge: { marginTop: 9, color: "#282B28", fontFamily: "Georgia", fontSize: 29 },
  rawState: { marginTop: 12, padding: 10, backgroundColor: "#F1EFE9" },
  rawValue: { marginTop: 3, color: "#363933", fontFamily: "Georgia", fontSize: 18 },
  tinyCopy: { color: "#85847D", fontSize: 8, lineHeight: 13 },
  rawMetrics: { flexDirection: "row", gap: 12, marginTop: 12 },
  rawMetric: { flex: 1, gap: 4 },
  rawMetricValue: { color: "#484A45", fontFamily: "Georgia", fontSize: 14 },
  riskBox: { marginTop: 12, padding: 10, borderWidth: 1, borderColor: "#E4D9C1", backgroundColor: "#F4F0E7" },
  riskTitle: { marginBottom: 6, color: "#5B4C2D", fontSize: 8, fontWeight: "700", letterSpacing: 0.5 },
  footer: { alignItems: "center", marginTop: 20, paddingTop: 15, borderTopWidth: 1, borderTopColor: COLORS.line },
  footerTitle: { color: COLORS.ink, fontSize: 10, fontWeight: "700" },
  footerMeta: { marginTop: 7, color: "#95938B", fontSize: 7, fontWeight: "700", letterSpacing: 0.7 },
  tabBar: { minHeight: 57, flexDirection: "row", borderTopWidth: 1, borderTopColor: COLORS.line, backgroundColor: COLORS.card },
  tabButton: { position: "relative", flex: 1, alignItems: "center", justifyContent: "center" },
  tabButtonActive: { backgroundColor: "#F4F1E9" },
  tabLabel: { color: "#797A75", fontSize: 9, fontWeight: "600" },
  tabLabelActive: { color: "#5D4A27" },
  tabIndicator: { position: "absolute", right: 17, bottom: 0, left: 17, height: 2, backgroundColor: COLORS.bronze },
});