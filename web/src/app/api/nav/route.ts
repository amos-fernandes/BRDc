import { NextResponse } from "next/server";
import { createPublicClient, formatUnits, http, isAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { DEMO_NAV, type NavSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

const oracleAbi = [
  {
    type: "function",
    name: "computeNAV",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "navUsd8Decimals", type: "uint256" }],
  },
  {
    type: "function",
    name: "getBasketComposition",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "symbols", type: "string[]" },
      { name: "weights", type: "uint256[]" },
      { name: "activeFlags", type: "bool[]" },
    ],
  },
] as const;

const demo = (message: string): NavSnapshot => ({
  ...DEMO_NAV,
  message,
});

export async function GET() {
  const address = process.env.NEXT_PUBLIC_ORACLE_ADDRESS?.trim();
  const rpcUrl =
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC?.trim() || "https://sepolia.base.org";

  if (!address) {
    return NextResponse.json(demo(DEMO_NAV.message), {
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!isAddress(address)) {
    return NextResponse.json(demo("O endereço do oráculo configurado não é válido; exibindo demonstração."), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    const client = createPublicClient({
      chain: baseSepolia,
      transport: http(rpcUrl, { timeout: 12_000 }),
    });
    const chainId = await client.getChainId();
    if (chainId !== baseSepolia.id) {
      return NextResponse.json(
        demo(`A RPC respondeu à rede ${chainId}, não à Base Sepolia. Exibindo demonstração.`),
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const navResult = await client.readContract({
      address,
      abi: oracleAbi,
      functionName: "computeNAV",
    });
    if (navResult <= 0n) {
      return NextResponse.json(demo("O oráculo retornou NAV vazio; exibindo demonstração."), {
        headers: { "Cache-Control": "no-store" },
      });
    }

    let goldPercent = DEMO_NAV.goldPercent;
    let indexPercent = DEMO_NAV.indexPercent;
    let compositionSource: NavSnapshot["compositionSource"] = "demo";
    let message =
      "NAV lido de computeNAV(). A composição ainda não pôde ser lida; o gráfico usa proporção demonstrativa.";
    try {
      const [symbols, weights, activeFlags] = await client.readContract({
        address,
        abi: oracleAbi,
        functionName: "getBasketComposition",
      });
      let total = 0n;
      let gold = 0n;
      for (let i = 0; i < symbols.length; i += 1) {
        if (!activeFlags[i]) continue;
        const weight = weights[i] ?? 0n;
        total += weight;
        const normalized = symbols[i]?.trim().toLowerCase();
        if (["xau", "gold", "ouro", "oro"].includes(normalized)) gold += weight;
      }
      if (total > 0n) {
        goldPercent = Number((gold * 10_000n) / total) / 100;
        indexPercent = Math.max(0, 100 - goldPercent);
        compositionSource = "live";
        message = "NAV e composição lidos do oráculo na Base Sepolia.";
      }
    } catch {
      // Preserve the live NAV while keeping the fallback composition visibly marked.
    }

    const snapshot: NavSnapshot = {
      source: "live",
      navUsd: Number(formatUnits(navResult, 8)),
      goldPercent,
      indexPercent,
      compositionSource,
      updatedAt: new Date().toISOString(),
      network: "Base Sepolia",
      message,
    };
    return NextResponse.json(snapshot, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      demo("Não foi possível consultar o oráculo na Base Sepolia; exibindo demonstração."),
      { headers: { "Cache-Control": "no-store" } },
    );
  }
}