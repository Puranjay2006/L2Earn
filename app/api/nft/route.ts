import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/campaigns";
import { mintLearningNft } from "@/lib/nft-minter";
import {
  getPendingNftMilestones,
  listCompletedCampaigns,
  listNftClaims,
  type NftClaim,
  NFT_MILESTONES,
  recordCourseCompletionAndNftClaims,
} from "@/lib/store";

export const runtime = "nodejs";

function badRequest(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 400 });
}

function serverError(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 502 });
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

  const [claims, completedCampaigns] = await Promise.all([
    listNftClaims(userAddress),
    listCompletedCampaigns(userAddress),
  ]);

  return NextResponse.json({
    ok: true,
    milestones: NFT_MILESTONES,
    claims,
    completedCampaigns,
    completedCount: completedCampaigns.length,
  });
}

export async function POST(req: Request) {
  let body: { userAddress?: string; campaignId?: string };
  try {
    body = (await req.json()) as { userAddress?: string; campaignId?: string };
  } catch {
    return badRequest("Invalid JSON body.");
  }

  const userAddress = parseAddress(body.userAddress ?? null);
  const campaignId = body.campaignId?.trim();

  if (!userAddress) {
    return badRequest("Invalid userAddress.");
  }
  if (!campaignId || !getCampaign(campaignId)) {
    return badRequest("Invalid campaignId.");
  }

  const plan = await getPendingNftMilestones(userAddress, campaignId);
  if (!plan.ok) {
    return badRequest(plan.reason);
  }

  const mintedClaims: NftClaim[] = [];
  try {
    for (const milestone of plan.pendingMilestones) {
      const mint = await mintLearningNft(userAddress, milestone.tokenId);
      mintedClaims.push({
        campaignId,
        tokenId: milestone.tokenId,
        name: milestone.name,
        description: milestone.description,
        threshold: milestone.threshold,
        completedCount: plan.completedCount,
        txHash: mint.txHash,
        chainId: mint.chainId,
        explorerUrl: mint.explorerUrl,
        ts: Date.now(),
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return serverError(`NFT mint failed: ${message}`);
  }

  const claimResult = await recordCourseCompletionAndNftClaims(
    userAddress,
    campaignId,
    plan.completedCampaigns,
    mintedClaims,
  );

  return NextResponse.json({
    ok: true,
    milestones: NFT_MILESTONES,
    completedCampaigns: plan.completedCampaigns,
    ...claimResult,
  });
}
