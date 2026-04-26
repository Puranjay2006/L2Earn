import { NextResponse } from "next/server";
import { CAMPAIGNS } from "@/lib/campaigns";
import { NFT_MILESTONES } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    ok: true,
    type: "L2EarnAgentCampaignFeed",
    version: "1.0",
    purpose:
      "Machine-readable learn-to-earn campaigns for AI agents. Humans use /campaigns; agents use this feed.",
    agentInstructions: [
      "Use learningObjectives and tags to decide whether this campaign is relevant to a user.",
      "Send humans to humanUrl when a course requires quiz completion.",
      "Verify completed learning via /api/agents/passport?address=0x...",
    ],
    credentialModel: {
      issuer: "L2Earn",
      signer: "Lumin",
      nftStandard: "ERC1155",
      credentialType: "Verifiable Learning Credential",
      binds: ["wallet", "course", "score", "luminSignedCertificateHash", "mintTx"],
      milestones: NFT_MILESTONES.map((milestone) => ({
        threshold: milestone.threshold,
        tokenId: 1000 + NFT_MILESTONES.indexOf(milestone) + 1,
        name: milestone.title,
        description: milestone.description,
        metadataUrl: `${origin}/api/nft/metadata/${1000 + NFT_MILESTONES.indexOf(milestone) + 1}`,
      })),
    },
    campaigns: CAMPAIGNS.map((campaign) => ({
      id: campaign.id,
      brand: campaign.brand,
      title: campaign.title,
      summary: campaign.summary,
      tags: campaign.tags,
      difficulty: campaign.difficulty,
      reward: {
        asset: "dNZD",
        amount: (campaign.rewardCents / 100).toFixed(2),
        amountCents: campaign.rewardCents,
      },
      quiz: {
        questionCount: campaign.quizQuestions.length,
        passRule: "2 correct answers out of 3",
      },
      learningObjectives: campaign.quizQuestions.map((question) => question.explanation),
      credentialIssued: {
        type: "LearningCredentialNFT",
        signedCertificate:
          "The minted credential binds wallet, course, score, Lumin signed certificate hash, and mint tx.",
      },
      actions: {
        humanUrl: `${origin}/campaigns/${campaign.id}`,
        agentPassportVerificationUrlTemplate: `${origin}/api/agents/passport?address={walletAddress}`,
      },
    })),
  });
}
