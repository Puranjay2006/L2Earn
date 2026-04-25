"use client";

import { useState } from "react";
import { useAccount, useChainId, useEnsName } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getCampaign } from "@/lib/campaigns";
import { Award, CheckCircle2, XCircle, Sparkles, Wallet, Loader2, Coins } from "lucide-react";
import Link from "next/link";

const NZD_SEND_AMOUNT = "5";

const EXPLORER_TX_BASE: Record<number, string> = {
  1: "https://etherscan.io/tx/",
  10: "https://optimistic.etherscan.io/tx/",
  137: "https://polygonscan.com/tx/",
  42161: "https://arbiscan.io/tx/",
  8453: "https://basescan.org/tx/",
  84532: "https://sepolia.basescan.org/tx/",
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correct?: number;
};

export type QuizState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; quizId: string; questions: QuizQuestion[] }
  | { status: "grading"; quizId: string; questions: QuizQuestion[] }
  | {
      status: "graded";
      passed: boolean;
      score: number;
      total: number;
      feedback: { questionId: string; correct: boolean; explanation: string }[];
    }
  | { status: "error"; message: string };

type Props = {
  campaignId: string;
  rewardCents: number;
};

type NftClaim = {
  tokenId: number;
  name: string;
  description: string;
  threshold: number;
  completedCount: number;
  txHash: string;
  explorerUrl?: string;
};

export function QuizPlayer({ campaignId, rewardCents }: Props) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { data: ensName } = useEnsName({
    address,
    chainId: 1,
    query: {
      enabled: Boolean(address),
    },
  });
  const [state, setState] = useState<QuizState>({ status: "idle" });
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [onChainMessage, setOnChainMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSendingOnChain, setIsSendingOnChain] = useState(false);
  const [nftMessage, setNftMessage] = useState<string | null>(null);
  const [nftClaims, setNftClaims] = useState<NftClaim[]>([]);
  const [isClaimingNfts, setIsClaimingNfts] = useState(false);

  const reward = (rewardCents / 100).toFixed(2);
  const displayWallet = ensName ?? address;

  async function startQuiz() {
    setState({ status: "loading" });
    setAnswers({});
    try {
      const campaign = getCampaign(campaignId);
      if (!campaign) throw new Error("Campaign not found");
      const quizId = `${campaignId}-${Date.now()}`;
      const questions = campaign.quizQuestions.map((question) => ({
        id: question.id,
        question: question.question,
        options: question.options,
      }));
      setState({ status: "ready", quizId, questions });
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }

  async function submitQuiz() {
    if (state.status !== "ready") return;
    const { quizId, questions } = state;
    setState({ status: "grading", quizId, questions });
    try {
      const campaign = getCampaign(campaignId);
      if (!campaign) throw new Error("Campaign not found");

      const feedback = campaign.quizQuestions.map((question) => {
        const picked = answers[question.id];
        const correct = picked === question.correctIndex;
        return {
          questionId: question.id,
          correct,
          explanation: correct
            ? `Correct. ${question.explanation}`
            : `The right answer was: "${question.options[question.correctIndex]}". ${question.explanation}`,
        };
      });
      const score = feedback.filter((item) => item.correct).length;
      const passed = score >= 2;
      setState({
        status: "graded",
        passed,
        score,
        total: campaign.quizQuestions.length,
        feedback,
      });
      if (passed) {
        void claimNftRewards();
      }
    } catch (e) {
      setState({ status: "error", message: (e as Error).message });
    }
  }

  async function claimNftRewards() {
    if (!isConnected || !address || isClaimingNfts) {
      setNftMessage("Connect MetaMask first.");
      return;
    }

    setIsClaimingNfts(true);
    setNftMessage(null);
    try {
      const res = await fetch("/api/nft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          campaignId,
        }),
      });

      const payload = (await res.json()) as {
        ok?: boolean;
        completedCount?: number;
        newlyClaimed?: NftClaim[];
        claims?: NftClaim[];
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        setNftMessage(payload.error ?? "NFT reward claim failed.");
        return;
      }

      setNftClaims(payload.newlyClaimed ?? []);
      const completedCount = payload.completedCount ?? 0;
      if (payload.newlyClaimed?.length) {
        setNftMessage(
          `Unlocked ${payload.newlyClaimed.length} NFT reward${payload.newlyClaimed.length > 1 ? "s" : ""}. ${completedCount} course${completedCount === 1 ? "" : "s"} completed.`,
        );
      } else {
        setNftMessage(
          `Course completion recorded. ${completedCount} course${completedCount === 1 ? "" : "s"} completed. No new milestone NFT this time.`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setNftMessage(`NFT reward claim failed: ${message}`);
    } finally {
      setIsClaimingNfts(false);
    }
  }

  async function sendRealNzdOnChain() {
    setOnChainMessage(null);
    setTxHash(null);

    if (!isConnected || !address || isSendingOnChain) {
      setOnChainMessage("Connect MetaMask first.");
      return;
    }

    setIsSendingOnChain(true);
    try {
      const res = await fetch("/api/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: address,
          campaignId,
        }),
      });

      const payload = (await res.json()) as {
        ok?: boolean;
        txHash?: string;
        message?: string;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        setOnChainMessage(payload.error ?? payload.message ?? "On-chain transfer failed.");
        return;
      }

      if (payload.txHash) {
        setTxHash(payload.txHash);
      }
      setOnChainMessage(
        payload.message ??
          `${NZD_SEND_AMOUNT} dNZD has been sent to your connected wallet. Open MetaMask to view the transfer.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setOnChainMessage(`On-chain transfer failed: ${message}`);
    } finally {
      setIsSendingOnChain(false);
    }
  }

  if (!isConnected) {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Wallet className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Connect a wallet first</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use Reown to connect a wallet first, then claim your reward when you pass.
            </p>
          </div>
          <Link href={`/wallet?returnTo=${encodeURIComponent(`/campaigns/${campaignId}`)}`}>
            <Button size="lg" className="gap-2 font-semibold">
              <Wallet className="h-4 w-4" />
              Connect Wallet
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "idle") {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Sparkles className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-xl font-bold">Ready when you are.</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Read the campaign brief, then take the quiz. Pass 2 of 3 to earn {reward} dNZD.
            </p>
          </div>
          <Button size="lg" onClick={startQuiz} className="gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            Start AI Quiz
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "loading") {
    return (
      <Card className="border-border/60 bg-card/60">
        <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Preparing your campaign quiz...</p>
        </CardContent>
      </Card>
    );
  }

  if (state.status === "ready" || state.status === "grading") {
    const allAnswered =
      state.status === "ready" && state.questions.every((q) => answers[q.id] !== undefined);

    return (
      <div className="space-y-4">
        {state.status === "ready" &&
          state.questions.map((q, i) => (
            <Card key={q.id} className="border-border/60 bg-card/60">
              <CardContent className="p-6">
                <p className="mb-4 text-base font-semibold">
                  {i + 1}. {q.question}
                </p>
                <RadioGroup
                  value={answers[q.id]?.toString() ?? ""}
                  onValueChange={(v) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: parseInt(v, 10) }))
                  }
                >
                  {q.options.map((opt, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/30"
                    >
                      <RadioGroupItem value={idx.toString()} id={`${q.id}-${idx}`} className="mt-0.5" />
                      <Label htmlFor={`${q.id}-${idx}`} className="cursor-pointer text-sm leading-relaxed">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </CardContent>
            </Card>
          ))}
        <Button
          size="lg"
          className="w-full gap-2 font-semibold"
          disabled={state.status === "grading" || !allAnswered}
          onClick={submitQuiz}
        >
          {state.status === "grading" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Checking your answers...
            </>
          ) : (
            <>Submit answers</>
          )}
        </Button>
      </div>
    );
  }

  if (state.status === "graded") {
    return (
      <div className="space-y-4">
        <Alert
          className={
            state.passed ? "border-primary/40 bg-primary/10" : "border-destructive/40 bg-destructive/10"
          }
        >
          {state.passed ? (
            <CheckCircle2 className="h-5 w-5 text-primary" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <AlertDescription className="ml-2 text-base font-semibold">
            {state.passed
              ? `Passed - ${state.score}/${state.total}.`
              : `Not quite - ${state.score}/${state.total}. Try again to earn ${reward} dNZD.`}
          </AlertDescription>
        </Alert>
        {state.feedback.map((f) => (
          <Card key={f.questionId} className="border-border/60 bg-card/60">
            <CardContent className="p-4 text-sm">
              <p className="flex items-center gap-2 font-semibold">
                {f.correct ? (
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive" />
                )}
                {f.correct ? "Correct" : "Incorrect"}
              </p>
              <p className="mt-1 text-muted-foreground">{f.explanation}</p>
            </CardContent>
          </Card>
        ))}
        {state.passed ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="w-full rounded-lg border border-border/50 bg-muted/30 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Coins className="h-4 w-4 text-primary" />
                Claim your dNZD
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                We will send {reward} dNZD to your connected wallet through the Reown flow. You can track it in your wallet app or on the explorer.
              </p>
              <p className="mt-1 break-all text-xs font-mono">{displayWallet ?? "Connect wallet first"}</p>
              <Button size="sm" className="mt-3 w-full font-semibold" onClick={sendRealNzdOnChain} disabled={isSendingOnChain}>
                {isSendingOnChain ? "Sending reward..." : "Send reward to my wallet"}
              </Button>
              {onChainMessage ? <p className="mt-2 text-xs text-muted-foreground">{onChainMessage}</p> : null}
              {txHash ? (
                <p className="mt-1 break-all text-[11px] text-muted-foreground">
                  Tx:{" "}
                  {EXPLORER_TX_BASE[chainId] ? (
                    <a
                      href={`${EXPLORER_TX_BASE[chainId]}${txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:no-underline"
                    >
                      {txHash}
                    </a>
                  ) : (
                    txHash
                  )}
                </p>
              ) : null}
            </div>

            <div className="w-full rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Award className="h-4 w-4 text-primary" />
                Learning NFT rewards
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Complete 1, 3, and 5 courses to unlock milestone NFTs for your wallet.
              </p>
              {isClaimingNfts ? (
                <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Claiming NFT rewards...
                </p>
              ) : null}
              {nftMessage ? <p className="mt-3 text-xs text-muted-foreground">{nftMessage}</p> : null}
              {nftClaims.length > 0 ? (
                <ul className="mt-3 space-y-2">
                  {nftClaims.map((claim) => (
                    <li key={claim.tokenId} className="rounded-md border border-primary/20 bg-background/50 p-3">
                      <p className="text-sm font-semibold">{claim.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{claim.description}</p>
                      <p className="mt-1 break-all text-[11px] text-muted-foreground">
                        Token #{claim.tokenId} · mint tx{" "}
                        {claim.explorerUrl?.startsWith("http") ? (
                          <a
                            href={claim.explorerUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline hover:no-underline"
                          >
                            {claim.txHash}
                          </a>
                        ) : (
                          claim.txHash
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {!isClaimingNfts && !nftMessage ? (
                <Button size="sm" variant="outline" className="mt-3 w-full font-semibold" onClick={claimNftRewards}>
                  Claim NFT rewards
                </Button>
              ) : null}
            </div>
          </div>
        ) : (
          <Button size="lg" onClick={startQuiz} className="w-full gap-2 font-semibold">
            <Sparkles className="h-4 w-4" />
            Try a fresh quiz
          </Button>
        )}
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <Alert variant="destructive">
        <XCircle className="h-5 w-5" />
        <AlertDescription className="ml-2">
          Something went wrong: {state.message}. Try again.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
