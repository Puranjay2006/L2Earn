import { promises as fs } from "node:fs";
import path from "node:path";
import type { GeneratedQuestion } from "@/lib/anthropic";

/**
 * File-backed dNZD ledger. Mock for the hackathon — no chain involved.
 * Balances are tracked in cents to avoid float drift. 500 = 5.00 dNZD.
 */

export type Tx = {
  campaignId: string;
  amountCents: number;
  ts: number;
};

export type NftClaim = {
  campaignId: string;
  tokenId: number;
  name: string;
  description: string;
  threshold: number;
  completedCount: number;
  txHash: string;
  chainId: number;
  explorerUrl: string;
  ts: number;
};

export type NftMilestone = (typeof NFT_MILESTONES)[number];

type StoreShape = {
  // address (lowercased) -> balance in cents
  balances: Record<string, number>;
  // address (lowercased) -> tx history
  txs: Record<string, Tx[]>;
  // address (lowercased) -> completed campaign ids
  completedCampaigns: Record<string, string[]>;
  // address (lowercased) -> NFT claim history
  nftClaims: Record<string, NftClaim[]>;
  // quizId -> generated quiz payload with expiry timestamp
  quizSessions: Record<string, { questions: GeneratedQuestion[]; ts: number }>;
};

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

let cache: StoreShape | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function load(): Promise<StoreShape> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreShape>;
    const txs = parsed.txs ?? {};
    const completedCampaigns =
      parsed.completedCampaigns ??
      Object.fromEntries(
        Object.entries(txs).map(([address, history]) => [
          address,
          Array.from(new Set(history.map((tx) => tx.campaignId))).sort(),
        ]),
      );
    cache = {
      balances: parsed.balances ?? {},
      txs,
      completedCampaigns,
      nftClaims: parsed.nftClaims ?? {},
      quizSessions: parsed.quizSessions ?? {},
    };
  } catch {
    cache = { balances: {}, txs: {}, completedCampaigns: {}, nftClaims: {}, quizSessions: {} };
  }
  return cache;
}

async function persist(): Promise<void> {
  if (!cache) return;
  const snapshot = JSON.stringify(cache, null, 2);
  // Serialise writes so concurrent route handlers don't race.
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, snapshot, "utf8");
  });
  await writeChain;
}

const norm = (addr: string) => addr.trim().toLowerCase();

export async function getBalanceCents(address: string): Promise<number> {
  const s = await load();
  return s.balances[norm(address)] ?? 0;
}

export async function listTxs(address: string): Promise<Tx[]> {
  const s = await load();
  return [...(s.txs[norm(address)] ?? [])].sort((a, b) => b.ts - a.ts);
}

export async function hasClaimed(address: string, campaignId: string): Promise<boolean> {
  const txs = await listTxs(address);
  return txs.some((t) => t.campaignId === campaignId);
}

export async function credit(
  address: string,
  campaignId: string,
  amountCents: number,
): Promise<{ ok: true; balanceCents: number } | { ok: false; reason: string }> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
    return { ok: false, reason: "invalid_address" };
  }
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return { ok: false, reason: "invalid_amount" };
  }

  const s = await load();
  const key = norm(address);

  const already = (s.txs[key] ?? []).some((t) => t.campaignId === campaignId);
  if (already) return { ok: false, reason: "already_claimed" };

  s.balances[key] = (s.balances[key] ?? 0) + amountCents;
  s.txs[key] = [...(s.txs[key] ?? []), { campaignId, amountCents, ts: Date.now() }];
  await persist();

  return { ok: true, balanceCents: s.balances[key] };
}

export const formatDnzd = (cents: number): string => (cents / 100).toFixed(2);

export const NFT_MILESTONES = [
  {
    threshold: 1,
    tokenId: 1001,
    name: "L2Earn First Lesson",
    description: "Awarded for completing your first L2Earn course.",
  },
  {
    threshold: 3,
    tokenId: 1003,
    name: "L2Earn Three Course Streak",
    description: "Awarded for completing three L2Earn courses.",
  },
  {
    threshold: 5,
    tokenId: 1005,
    name: "L2Earn Five Course Master",
    description: "Awarded for completing five L2Earn courses.",
  },
] as const;

export async function listCompletedCampaigns(address: string): Promise<string[]> {
  const s = await load();
  return [...(s.completedCampaigns[norm(address)] ?? [])];
}

export async function listNftClaims(address: string): Promise<NftClaim[]> {
  const s = await load();
  return (s.nftClaims[norm(address)] ?? [])
    .map((claim) => {
      const milestone = NFT_MILESTONES.find(
        (item) => item.tokenId === claim.tokenId || item.threshold === claim.threshold,
      );
      return {
        ...claim,
        name: claim.name ?? milestone?.name ?? "L2Earn Learning NFT",
        description: claim.description ?? milestone?.description ?? "Awarded for completing L2Earn courses.",
        threshold: claim.threshold ?? milestone?.threshold ?? 1,
        completedCount: claim.completedCount ?? milestone?.threshold ?? 1,
      };
    })
    .sort((a, b) => b.ts - a.ts);
}

export async function getPendingNftMilestones(
  address: string,
  campaignId: string,
): Promise<
  | {
      ok: true;
      completedCount: number;
      completedCampaigns: string[];
      pendingMilestones: NftMilestone[];
    }
  | { ok: false; reason: string }
> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address.trim())) {
    return { ok: false, reason: "invalid_address" };
  }
  if (!campaignId.trim()) {
    return { ok: false, reason: "invalid_campaign" };
  }

  const s = await load();
  const key = norm(address);
  const completed = new Set(s.completedCampaigns[key] ?? []);
  completed.add(campaignId);

  const completedCampaigns = [...completed].sort();
  const completedCount = completedCampaigns.length;
  const existingClaims = s.nftClaims[key] ?? [];
  const existingTokenIds = new Set(existingClaims.map((claim) => claim.tokenId));

  const pendingMilestones = NFT_MILESTONES.filter(
    (milestone) => completedCount >= milestone.threshold && !existingTokenIds.has(milestone.tokenId),
  );

  return {
    ok: true,
    completedCount,
    completedCampaigns,
    pendingMilestones,
  };
}

export async function recordCourseCompletionAndNftClaims(
  address: string,
  campaignId: string,
  completedCampaigns: string[],
  claims: NftClaim[],
): Promise<{ completedCount: number; newlyClaimed: NftClaim[]; claims: NftClaim[] }> {
  const s = await load();
  const key = norm(address);
  const existingClaims = s.nftClaims[key] ?? [];
  const existingTokenIds = new Set(existingClaims.map((claim) => claim.tokenId));
  const newlyClaimed = claims.filter((claim) => !existingTokenIds.has(claim.tokenId));

  s.completedCampaigns[key] = [...new Set(completedCampaigns)].sort();
  s.nftClaims[key] = [...existingClaims, ...newlyClaimed];
  await persist();

  return {
    completedCount: s.completedCampaigns[key].length,
    newlyClaimed,
    claims: [...s.nftClaims[key]].sort((a, b) => b.ts - a.ts),
  };
}

const QUIZ_TTL_MS = 30 * 60 * 1000;

export async function rememberQuizSession(
  quizId: string,
  questions: GeneratedQuestion[],
): Promise<void> {
  const s = await load();
  const cutoff = Date.now() - QUIZ_TTL_MS;

  for (const [key, value] of Object.entries(s.quizSessions)) {
    if (value.ts < cutoff) delete s.quizSessions[key];
  }

  s.quizSessions[quizId] = { questions, ts: Date.now() };
  await persist();
}

export async function recallQuizSession(quizId: string): Promise<GeneratedQuestion[] | null> {
  const s = await load();
  const hit = s.quizSessions[quizId];
  if (!hit) return null;
  if (Date.now() - hit.ts > QUIZ_TTL_MS) {
    delete s.quizSessions[quizId];
    await persist();
    return null;
  }
  return hit.questions;
}
