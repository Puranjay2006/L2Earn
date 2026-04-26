import { NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";
import {
  getBalanceCents,
  listCompletedCampaigns,
  listNftClaims,
  listTxs,
  NFT_MILESTONES,
} from "@/lib/store";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function parseAddress(address: string | null): string | null {
  const trimmed = address?.trim();
  if (!trimmed || !/^0x[a-fA-F0-9]{40}$/.test(trimmed)) return null;
  return trimmed;
}

function formatDnzd(cents: number): string {
  return (cents / 100).toFixed(2);
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const origin = url.origin;
  const address = parseAddress(url.searchParams.get("address"));

  if (!address) {
    return badRequest("Invalid Ethereum address.");
  }

  const [balanceCents, txs, completedCampaignIds, nftClaims] = await Promise.all([
    getBalanceCents(address),
    listTxs(address),
    listCompletedCampaigns(address),
    listNftClaims(address),
  ]);

  const campaignById = new Map(CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
  const completedCampaigns = completedCampaignIds.map((campaignId) => {
    const campaign = campaignById.get(campaignId);
    return {
      id: campaignId,
      brand: campaign?.brand ?? "Unknown",
      title: campaign?.title ?? campaignId,
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

  const credentials = nftClaims.map((claim) => {
    const campaign = campaignById.get(claim.campaignId);
    const milestone = NFT_MILESTONES.find((m) => m.id === claim.milestone);

    return {
      type: "LearningCredentialNFT",
      issuer: "L2Earn",
      signer: "Lumin",
      holder: address,
      campaign: {
        id: claim.campaignId,
        brand: campaign?.brand ?? "Unknown",
        title: campaign?.title ?? claim.campaignId,
        tags: campaign?.tags ?? [],
      },
      credential: {
        standard: "ERC1155",
        wallet: address,
        course: claim.campaignId,
        score: 3,
        total: 3,
        luminSignedCertificateHash: claim.certificateHash || "0x",
        mintTx: claim.mintTx,
      },
      nft: {
        standard: "ERC1155",
        tokenId: claim.tokenId,
        name: milestone?.title || "Learning Credential",
        description: milestone?.description || "Completed a learning campaign",
        metadataUrl: `${origin}/api/nft/metadata/${claim.tokenId}`,
        chainId: 84532,
      },
      verification: {
        onChainMintPresent: Boolean(claim.mintTx),
        signedCertificatePresent: Boolean(claim.certificateHash),
        machineReadableMetadata: `${origin}/api/nft/metadata/${claim.tokenId}`,
      },
    };
  });

  return NextResponse.json({
    ok: true,
    type: "L2EarnAgentLearningPassport",
    version: "1.0",
    address,
    summary: {
      completedCourses: completedCampaigns.length,
      totalCampaigns: CAMPAIGNS.length,
      earned: {
        asset: "dNZD",
        amount: formatDnzd(balanceCents),
        amountCents: balanceCents,
      },
      credentialCount: credentials.length,
      topTags: Object.entries(tagCounts)
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([tag, count]) => ({ tag, count })),
    },
    credentials,
    completedCampaigns,
    rewardHistory: txs.map((tx) => ({
      campaignId: tx.campaignId,
      amount: formatDnzd(tx.amount),
      amountCents: tx.amount,
      ts: tx.timestamp,
    })),
    agentDecisionHints: {
      canRecommendNewMoney: completedCampaigns.some((campaign) => campaign.brand === "NewMoney"),
      knowsStablecoins: Boolean(tagCounts.Stablecoins),
      knowsDeFi: Boolean(tagCounts.DeFi),
      knowsAi: Boolean(tagCounts["AI Agents"]),
      knowsWeb3: Boolean(tagCounts.Web3),
      verifiedBy: ["Wallet address", "ERC1155 credential metadata", "Lumin certificate hash"],
    },
  });
}
