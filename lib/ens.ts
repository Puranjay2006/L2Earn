import { createPublicClient, http } from "viem";
import { baseSepolia, base } from "viem/chains";

// ─── ENS Resolution Client ────────────────────────────────────────────

const publicClientSepolia = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

const publicClientMainnet = createPublicClient({
  chain: base,
  transport: http("https://mainnet.base.org"),
});

// ─── Basename Constants ────────────────────────────────────────────────

export const BASENAME_REGISTRAR = {
  testnet: {
    controller: "0x49aE3cC2e3AA768B1e5654f5D3C6002144A59581",
    resolver: "0x6533C94469D7D6e8bfF3d5f24c2f27e64b01c8d8",
    suffix: ".basetest.eth",
    chainId: 84532,
  },
  mainnet: {
    controller: "0x4cCb0BB02FCABA27e82a56646E81d8c5bC4119a5",
    resolver: "0x03c4738ee98ae44591e1a4a4f3cab6641d95dd9a",
    suffix: ".base.eth",
    chainId: 8453,
  },
};

export const REGISTRAR_ABI = [
  {
    name: "registerPrice",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "name", type: "string" },
      { name: "duration", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "register",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "request",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "owner", type: "address" },
          { name: "duration", type: "uint256" },
          { name: "resolver", type: "address" },
          { name: "data", type: "bytes[]" },
          { name: "reverseRecord", type: "bool" },
        ],
      },
    ],
    outputs: [],
  },
] as const;

// ─── Resolve ENS Name ─────────────────────────────────────────────────

export async function resolveBasename(
  address: string,
  isTestnet: boolean = true
): Promise<string | null> {
  try {
    const client = isTestnet ? publicClientSepolia : publicClientMainnet;
    const name = await client.getEnsName({ address: address as `0x${string}` });
    return name;
  } catch (error) {
    console.error("ENS resolution error:", error);
    return null;
  }
}

export async function resolveAddress(
  name: string,
  isTestnet: boolean = true
): Promise<string | null> {
  try {
    const client = isTestnet ? publicClientSepolia : publicClientMainnet;
    const address = await client.getEnsAddress({ name });
    return address ?? null;
  } catch (error) {
    console.error("Address resolution error:", error);
    return null;
  }
}

// ─── Get Basename Registration Price ──────────────────────────────────

export async function getBasenamePrice(
  label: string,
  durationYears: number = 1,
  isTestnet: boolean = true
): Promise<bigint | null> {
  try {
    const client = isTestnet ? publicClientSepolia : publicClientMainnet;
    const registrar = isTestnet ? BASENAME_REGISTRAR.testnet : BASENAME_REGISTRAR.mainnet;

    const durationSeconds = BigInt(durationYears * 31_557_600); // seconds per year

    const price = await client.readContract({
      address: registrar.controller as `0x${string}`,
      abi: REGISTRAR_ABI,
      functionName: "registerPrice",
      args: [label, durationSeconds],
    });

    return price as bigint;
  } catch (error) {
    console.error("Price lookup error:", error);
    return null;
  }
}

// ─── Format Basename Display ──────────────────────────────────────────

export function formatBasename(label: string, isTestnet: boolean = true): string {
  const suffix = isTestnet ? BASENAME_REGISTRAR.testnet.suffix : BASENAME_REGISTRAR.mainnet.suffix;
  return `${label}${suffix}`;
}

// ─── Validate Basename Label ─────────────────────────────────────────

export function isValidBasenameLabel(label: string): {
  valid: boolean;
  error?: string;
} {
  if (!label) {
    return { valid: false, error: "Label cannot be empty" };
  }

  if (label.length < 3) {
    return { valid: false, error: "Label must be at least 3 characters" };
  }

  if (label.length > 63) {
    return { valid: false, error: "Label must be at most 63 characters" };
  }

  if (!/^[a-z0-9-]+$/.test(label)) {
    return { valid: false, error: "Label can only contain lowercase letters, numbers, and hyphens" };
  }

  if (label.startsWith("-") || label.endsWith("-")) {
    return { valid: false, error: "Label cannot start or end with a hyphen" };
  }

  return { valid: true };
}

// ─── Types ────────────────────────────────────────────────────────────

export interface BasenameRegistrationRequest {
  label: string;
  owner: string; // wallet address
  duration?: number; // in years, default 1
  reverseRecord?: boolean; // set as primary name
}

export interface BasenameRegistrationResult {
  ok: boolean;
  label?: string;
  fullName?: string;
  txHash?: string;
  price?: string;
  error?: string;
}
