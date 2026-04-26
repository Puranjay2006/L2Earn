import Link from "next/link";
import { Award, BookOpenCheck, Coins, ExternalLink, Medal, Trophy, Wallet } from "lucide-react";
import { Footer } from "@/components/footer";
import { Navbar } from "@/components/navbar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CAMPAIGNS } from "@/lib/campaigns";
import { formatDnzd } from "@/lib/dnzd";
import { listLeaderboardWallets } from "@/lib/store";

export const metadata = {
  title: "Leaderboard | L2Earn",
  description: "Ranked L2Earn wallets by completed courses, credential NFTs, and dNZD earned.",
};

export const dynamic = "force-dynamic";

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function tagCountsFor(campaignIds: string[]) {
  const campaignById = new Map(CAMPAIGNS.map((campaign) => [campaign.id, campaign]));
  const counts: Record<string, number> = {};
  for (const campaignId of campaignIds) {
    for (const tag of campaignById.get(campaignId)?.tags ?? []) {
      counts[tag] = (counts[tag] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 4)
    .map(([tag, count]) => ({ tag, count }));
}

export default async function LeaderboardPage() {
  const wallets = await listLeaderboardWallets();

  return (
    <>
      <Navbar />
      <main className="min-h-[calc(100vh-72px)]">
        <div className="container mx-auto max-w-6xl space-y-8 px-4 py-10 md:px-6 md:py-14">
          <section className="rounded-xl border border-border/60 bg-card/60 p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-primary">
                  Learning reputation
                </p>
                <h1 className="text-4xl font-black tracking-tight text-foreground md:text-5xl">
                  Leaderboard
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                  Wallets ranked by completed courses, verifiable credential NFTs, and dNZD earned.
                </p>
              </div>
              <Link
                href="/api/leaderboard"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
              >
                Machine-readable feed
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </section>

          {wallets.length === 0 ? (
            <Card className="border-dashed border-border/60 bg-card/60">
              <CardContent className="p-8 text-center">
                <Trophy className="mx-auto h-8 w-8 text-muted-foreground" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No learners yet. Complete a campaign to appear on the leaderboard.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/60 bg-card/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="h-5 w-5 text-primary" />
                  All Learners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="border-b border-border/60 text-left text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-3 pr-4">Rank</th>
                        <th className="py-3 pr-4">Wallet</th>
                        <th className="py-3 pr-4">Courses</th>
                        <th className="py-3 pr-4">dNZD</th>
                        <th className="py-3 pr-4">Credentials</th>
                        <th className="py-3 pr-4">Top Skills</th>
                        <th className="py-3">Verify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {wallets.map((wallet, index) => {
                        const tags = tagCountsFor(wallet.completedCampaigns);
                        return (
                          <tr key={wallet.address} className="border-b border-border/40 last:border-0">
                            <td className="py-4 pr-4 font-black">
                              <span className="inline-flex items-center gap-1">
                                {index === 0 ? <Medal className="h-4 w-4 text-primary" /> : null}
                                #{index + 1}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex items-center gap-2">
                                <Wallet className="h-4 w-4 text-primary" />
                                <span className="font-semibold">{shortAddress(wallet.address)}</span>
                              </div>
                              <p className="mt-1 break-all text-xs text-muted-foreground">{wallet.address}</p>
                            </td>
                            <td className="py-4 pr-4">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <BookOpenCheck className="h-4 w-4 text-primary" />
                                {wallet.completedCampaigns.length}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <Coins className="h-4 w-4 text-primary" />
                                {formatDnzd(wallet.balanceCents)}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <span className="inline-flex items-center gap-1 font-semibold">
                                <Award className="h-4 w-4 text-primary" />
                                {wallet.nftClaims.length}
                              </span>
                            </td>
                            <td className="py-4 pr-4">
                              <div className="flex flex-wrap gap-1">
                                {tags.length ? (
                                  tags.map((tag) => (
                                    <Badge key={tag.tag} variant="outline" className="text-[11px]">
                                      {tag.tag}
                                    </Badge>
                                  ))
                                ) : (
                                  <span className="text-xs text-muted-foreground">None</span>
                                )}
                              </div>
                            </td>
                            <td className="py-4">
                              <Link
                                href={`/api/agents/passport?address=${wallet.address}`}
                                className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                              >
                                Passport
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
