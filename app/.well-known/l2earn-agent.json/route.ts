import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;

  return NextResponse.json({
    name: "L2Earn",
    type: "AgentReadableLearningCredentialProtocol",
    version: "1.0",
    description:
      "L2Earn exposes learn-to-earn campaigns, wallet learning passports, leaderboard data, and verifiable credential NFT metadata for AI agents.",
    human_entrypoints: {
      home: `${origin}/`,
      campaigns: `${origin}/campaigns`,
      profile: `${origin}/profile`,
      leaderboard: `${origin}/leaderboard`,
    },
    agent_endpoints: {
      campaigns: `${origin}/api/agents/campaigns`,
      passport: `${origin}/api/agents/passport?address={walletAddress}`,
      leaderboard: `${origin}/api/leaderboard`,
      nft_metadata: `${origin}/api/nft/metadata/{tokenId}`,
      generated_certificate_pdf: `${origin}/api/certificates/{tokenId}?userAddress={walletAddress}`,
    },
    actions: [
      "discover_courses",
      "compare_campaign_rewards",
      "verify_wallet_learning_passport",
      "inspect_learning_credential_nft_metadata",
      "rank_learners",
      "open_generated_completion_certificate",
    ],
    credential_model: {
      standard: "ERC1155",
      issuer: "L2Earn",
      signer: "Lumin",
      credential_type: "LearningCredentialNFT",
      binds: ["wallet", "course", "score", "luminSignedCertificateHash", "mintTx"],
      verification_goal: "Secure verification of learning credentials across platforms.",
    },
    agent_instructions: [
      "Use /api/agents/campaigns to discover available learning campaigns and rewards.",
      "Use /api/agents/passport?address=0x... to verify a learner's completed courses and credential NFTs.",
      "Use /api/leaderboard to compare learners by completed courses, credentials, and dNZD earned.",
      "Use /api/nft/metadata/{tokenId} to inspect ERC1155 credential metadata.",
      "Send humans to the human entrypoints for quiz completion and wallet interactions.",
    ],
  });
}
