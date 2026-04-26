import { NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";
import { formatDnzd } from "@/lib/dnzd";
import { listLeaderboardWallets } from "@/lib/store";

export const runtime = "nodejs";

function tagCountsFor(campaignIds: string[]) {
  const campaignById = new Map(CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
  const counts: Record<string, number> = {};
  for (const campaignId of campaignIds) {
    const campaign = campaignById.get(campaignId);
    for (const tag of campaign?.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([tag, count]) => ({ tag, count }));
}

export async function GET() {
  const wallets = await listLeaderboardWallets();

  return NextResponse.json({
    ok: true,
    type: "L2EarnLeaderboard",
    version: "1.0",
    entries: wallets.map((wallet, index) => ({
      rank: index + 1,
      address: wallet.address,
      completedCourses: wallet.completedCampaigns.length,
      credentialCount: wallet.nftClaims.length,
      earned: {
        asset: "dNZD",
        amount: formatDnzd(wallet.balanceCents),
        amountCents: wallet.balanceCents,
      },
      topTags: tagCountsFor(wallet.completedCampaigns),
      lastActive: wallet.lastActive,
      passportUrl: `/api/agents/passport?address=${wallet.address}`,
    })),
  });
}
