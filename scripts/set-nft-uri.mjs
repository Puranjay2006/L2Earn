import { existsSync, readFileSync } from "node:fs";
import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { base, baseSepolia } from "viem/chains";

if (existsSync(".env.local")) {
  const envFile = readFileSync(".env.local", "utf8");
  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;
    const key = trimmed.slice(0, separator).trim();
    const value = trimmed.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    process.env[key] ??= value;
  }
}

const abi = [
  {
    type: "function",
    name: "setURI",
    stateMutability: "nonpayable",
    inputs: [{ name: "newuri", type: "string" }],
    outputs: [],
  },
];

const EXPLORER_TX_BASE = {
  8453: "https://basescan.org/tx/",
  84532: "https://sepolia.basescan.org/tx/",
};

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

const contractAddress = required("NFT_CONTRACT_ADDRESS");
const privateKey = process.env.NFT_MINTER_PRIVATE_KEY?.trim() ?? required("MASTER_WALLET_PRIVATE_KEY");
const rpcUrl = process.env.EVM_RPC_URL?.trim() ?? process.env.NEXT_PUBLIC_BASE_RPC_URL?.trim();
if (!rpcUrl) throw new Error("EVM_RPC_URL is required.");

const chainId = Number.parseInt(process.env.EVM_CHAIN_ID?.trim() ?? "84532", 10);
const chain = chainId === base.id ? base : baseSepolia;
const metadataBaseUrl = (process.env.NFT_METADATA_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL)?.trim();
if (!metadataBaseUrl) {
  throw new Error("NFT_METADATA_BASE_URL or NEXT_PUBLIC_APP_URL is required. Use your deployed public app URL.");
}
if (/localhost|127\.0\.0\.1/.test(metadataBaseUrl)) {
  throw new Error("Refusing to set NFT metadata URI to localhost. Use a public deployed URL.");
}

const uri = `${metadataBaseUrl.replace(/\/$/, "")}/api/nft/metadata/{id}`;
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ chain, transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, chain, transport: http(rpcUrl) });

console.log(`Setting ERC1155 metadata URI on ${contractAddress}`);
console.log(uri);

const txHash = await walletClient.writeContract({
  address: contractAddress,
  abi,
  functionName: "setURI",
  args: [uri],
});

const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
if (receipt.status !== "success") {
  throw new Error(`setURI reverted: ${txHash}`);
}

console.log(`setURI tx: ${EXPLORER_TX_BASE[chainId] ?? ""}${txHash}`);
