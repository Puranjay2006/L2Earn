import { NextResponse } from "next/server";
import { NFT_MILESTONES } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ tokenId: string }> },
) {
  const { tokenId } = await params;
  const id = /^[0-9]+$/.test(tokenId)
    ? Number.parseInt(tokenId, 10)
    : Number.parseInt(tokenId.replace(/^0x/, ""), 16);
  // NFT_MILESTONES uses tokenId = 1001, 1002, … (index + 1001)
  const milestone = NFT_MILESTONES.find((_m, i) => 1000 + i + 1 === id);

  if (!milestone) {
    return NextResponse.json({ error: "Unknown tokenId." }, { status: 404 });
  }

  const origin = new URL(req.url).origin;
  // imageUrl is not in the milestone definition — fall back to a placeholder
  const image = `${origin}/nft-placeholder.png`;

  return NextResponse.json({
    name: milestone.title,
    description: milestone.description,
    image,
    external_url: `${origin}/profile`,
    credential_type: "LearningCredentialNFT",
    verification_model: {
      standard: "ERC1155",
      issuer: "L2Earn",
      signer: "Lumin",
      binds: ["wallet", "course", "score", "luminSignedCertificateHash", "mintTx"],
      passport_url_template: `${origin}/api/agents/passport?address={walletAddress}`,
    },
    attributes: [
      { trait_type: "Credential Type", value: "Verifiable Learning Credential" },
      {
        trait_type: "Milestone",
        value: `${milestone.threshold} course${milestone.threshold === 1 ? "" : "s"}`,
      },
      { trait_type: "Issuer", value: "L2Earn + Lumin" },
    ],
  });
}
