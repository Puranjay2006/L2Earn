import { NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";
import { getBalanceCents, listCompletedCampaigns, listNftClaims, listTxs, NFT_MILESTONES } from "@/lib/store";

export const runtime = "nodejs";

const EXPLORER_BASE = "https://sepolia.basescan.org/tx/";

// Build a lookup: tokenId → milestone metadata
const MILESTONE_BY_TOKEN_ID = new Map(
  NFT_MILESTONES.map((m, i) => [1000 + i + 1, m])
);

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function parseAddress(address: string | null): string | null {
  const trimmed = address?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const userAddress = parseAddress(url.searchParams.get("userAddress"));

  if (!userAddress) {
    return badRequest("Invalid userAddress.");
  }

  const [balanceCents, rawTxs, completedCampaignIds, rawNftClaims] = await Promise.all([
    getBalanceCents(userAddress),
    listTxs(userAddress),
    listCompletedCampaigns(userAddress),
    listNftClaims(userAddress),
  ]);

  // Normalise tx shape: store uses {amount, timestamp} but dashboard expects {amountCents, ts}
  const txs = rawTxs.map((tx: Record<string, unknown>) => ({
    campaignId: tx.campaignId as string,
    amountCents: (tx.amountCents ?? tx.amount) as number,
    ts: (tx.ts ?? tx.timestamp) as number,
  }));

  const campaignById = new Map(CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
  const completedCampaigns = completedCampaignIds.map((campaignId) => {
    const campaign = campaignById.get(campaignId);
    return {
      id: campaignId,
      title: campaign?.title ?? campaignId,
      brand: campaign?.brand ?? "Unknown",
      tags: campaign?.tags ?? [],
      rewardCents: campaign?.rewardCents ?? 0,
    };
  });

  const tagCounts = completedCampaigns.reduce<Record<string, number>>((acc, campaign) => {
    for (const tag of campaign.tags) {
      acc[tag] = (acc[tag] ?? 0) + 1;
    }
    return acc;
  }, {});

  // Enrich each NftClaim with milestone metadata and fallback fields so the
  // profile dashboard and certificate route always have what they need,
  // even for claims saved before the extended fields were added.
  const nftClaims = rawNftClaims.map((claim) => {
    const milestone = MILESTONE_BY_TOKEN_ID.get(claim.tokenId);
    const txHash = claim.txHash ?? claim.mintTx;
    const explorerUrl = claim.explorerUrl ?? (txHash ? `${EXPLORER_BASE}${txHash}` : "");

    return {
      ...claim,
      txHash,
      explorerUrl,
      ts: claim.ts ?? claim.timestamp,
      name: claim.name ?? milestone?.title ?? claim.milestone,
      description: claim.description ?? milestone?.description ?? "",
      threshold: claim.threshold ?? milestone?.threshold ?? 1,
      credential: claim.credential ?? {
        type: "LearningCredentialNFT",
        issuer: "L2Earn",
        signer: "Lumin",
        wallet: userAddress,
        course: claim.campaignId,
        score: 0,
        total: 3,
        luminSignedCertificateHash: claim.certificateHash ?? "",
        mintTx: txHash,
      },
    };
  });

  return NextResponse.json({
    ok: true,
    address: userAddress,
    balanceCents,
    txs,
    completedCampaigns,
    completedCount: completedCampaigns.length,
    totalCampaigns: CAMPAIGNS.length,
    nftClaims,
    tagCounts,
  });
}
