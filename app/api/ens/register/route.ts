import { NextResponse } from "next/server";
import { createWalletClient, createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia, base } from "viem/chains";
import { isValidBasenameLabel, BASENAME_REGISTRAR, REGISTRAR_ABI, formatBasename } from "@/lib/ens";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    let body: {
      label?: string;
      owner?: string;
      years?: number;
      testnet?: boolean;
      reverseRecord?: boolean;
    };

    try {
      body = (await req.json()) as typeof body;
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { label, owner, years = 1, testnet = true, reverseRecord = true } = body;

    // Validate inputs
    if (!label || !owner) {
      return NextResponse.json(
        { ok: false, error: "Missing label or owner" },
        { status: 400 }
      );
    }

    const validation = isValidBasenameLabel(label.toLowerCase());
    if (!validation.valid) {
      return NextResponse.json(
        { ok: false, error: validation.error },
        { status: 400 }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(owner)) {
      return NextResponse.json(
        { ok: false, error: "Invalid owner address" },
        { status: 400 }
      );
    }

    // Get environment configuration
    const minterKey = process.env.NFT_MINTER_PRIVATE_KEY || process.env.MASTER_WALLET_PRIVATE_KEY;
    if (!minterKey) {
      return NextResponse.json(
        { ok: false, error: "ENS registration not configured (missing private key)" },
        { status: 502 }
      );
    }

    const rpcUrl = testnet ? "https://sepolia.base.org" : "https://mainnet.base.org";
    const config = testnet ? BASENAME_REGISTRAR.testnet : BASENAME_REGISTRAR.mainnet;
    const chain = testnet ? baseSepolia : base;

    // Setup wallet
    const account = privateKeyToAccount(minterKey as `0x${string}`);
    const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
    const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

    // Get registration price
    const durationSeconds = BigInt(years * 31_557_600);
    const priceWei = await publicClient.readContract({
      address: config.controller as `0x${string}`,
      abi: REGISTRAR_ABI,
      functionName: "registerPrice",
      args: [label.toLowerCase(), durationSeconds],
    });

    // Submit registration
    const txHash = await walletClient.writeContract({
      address: config.controller as `0x${string}`,
      abi: REGISTRAR_ABI,
      functionName: "register",
      args: [
        {
          name: label.toLowerCase(),
          owner: owner as `0x${string}`,
          duration: durationSeconds,
          resolver: config.resolver as `0x${string}`,
          data: [],
          reverseRecord,
        },
      ],
      value: (priceWei as bigint) + ((priceWei as bigint) / 10n), // Add 10% buffer
    });

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status !== "success") {
      return NextResponse.json(
        { ok: false, error: "Transaction failed" },
        { status: 502 }
      );
    }

    const fullName = formatBasename(label.toLowerCase(), testnet);

    return NextResponse.json({
      ok: true,
      label: label.toLowerCase(),
      fullName,
      owner,
      txHash,
      chainId: testnet ? 84532 : 8453,
      explorerUrl: testnet
        ? `https://sepolia.basescan.org/tx/${txHash}`
        : `https://basescan.org/tx/${txHash}`,
    });
  } catch (error) {
    console.error("ENS registration error:", error);
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 }
    );
  }
}
