"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { CampaignCard } from "@/components/campaign-card";
import type { Campaign, Difficulty } from "@/lib/campaigns";
import { Zap, Shield, Flame, X } from "lucide-react";

const DIFFICULTY_SECTIONS: {
  key: Difficulty;
  label: string;
  description: string;
  icon: React.ReactNode;
  style: string;
}[] = [
  {
    key: "easy",
    label: "Easy",
    description: "No prior crypto knowledge needed — perfect starting point.",
    icon: <Zap className="h-4 w-4" />,
    style: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  {
    key: "medium",
    label: "Medium",
    description: "Requires basic familiarity with crypto and wallets.",
    icon: <Shield className="h-4 w-4" />,
    style: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
  {
    key: "hard",
    label: "Hard",
    description: "Advanced topics — DeFi mechanics, cross-chain, AI agents.",
    icon: <Flame className="h-4 w-4" />,
    style: "text-rose-400 bg-rose-500/10 border-rose-500/30",
  },
];

const ALL_DIFF_FILTERS = ["all", "easy", "medium", "hard"] as const;
type DiffFilter = (typeof ALL_DIFF_FILTERS)[number];

const DIFF_LABELS: Record<DiffFilter, { label: string; icon?: React.ReactNode; style: string }> = {
  all: { label: "All", style: "bg-primary/15 text-primary border-primary/30 hover:bg-primary/25" },
  easy: { label: "Easy", icon: <Zap className="h-3.5 w-3.5" />, style: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25" },
  medium: { label: "Medium", icon: <Shield className="h-3.5 w-3.5" />, style: "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25" },
  hard: { label: "Hard", icon: <Flame className="h-3.5 w-3.5" />, style: "bg-rose-500/15 text-rose-400 border-rose-500/30 hover:bg-rose-500/25" },
};


export function CampaignsGrid({ campaigns }: { campaigns: Campaign[] }) {
  const { address } = useAccount();
  const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
  const [activeDiff, setActiveDiff] = useState<DiffFilter>("all");

  useEffect(() => {
    if (!address) return;
    fetch(`/api/user-stats?address=${address}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.completedCampaigns) {
          setCompletedIds(
            new Set(data.completedCampaigns.map((c: { campaignId: string }) => c.campaignId))
          );
        }
      })
      .catch(() => {});
  }, [address]);

  const filtered = useMemo(
    () => activeDiff === "all" ? campaigns : campaigns.filter((c) => c.difficulty === activeDiff),
    [campaigns, activeDiff],
  );

  // Group filtered campaigns by difficulty for section headers
  const grouped = DIFFICULTY_SECTIONS.map((section) => ({
    ...section,
    campaigns: filtered.filter((c) => c.difficulty === section.key),
  })).filter((s) => s.campaigns.length > 0);

  const hasActiveFilters = activeDiff !== "all";

  return (
    <div className="space-y-6">
      {/* ── Difficulty filter ─────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Difficulty
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_DIFF_FILTERS.map((f) => {
            const { label, icon, style } = DIFF_LABELS[f];
            const isActive = activeDiff === f;
            return (
              <button
                key={f}
                onClick={() => setActiveDiff(f)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-all ${style} ${
                  isActive
                    ? "ring-2 ring-offset-2 ring-offset-background ring-current/50 scale-105"
                    : "opacity-70"
                }`}
              >
                {icon}
                {label}
                <span className="ml-1 opacity-60 text-xs">
                  ({f === "all" ? campaigns.length : campaigns.filter((c) => c.difficulty === f).length})
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Active filter summary + clear ─────────────────────────── */}
      {hasActiveFilters && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filtered.length}</strong> of {campaigns.length} campaigns
          </span>
          <button
            onClick={() => setActiveDiff("all")}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-3 w-3" />
            Clear filters
          </button>
        </div>
      )}

      {/* ── Results ───────────────────────────────────────────────── */}
      {grouped.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 px-6 py-12 text-center">
          <p className="text-sm font-medium text-foreground">No campaigns match these filters</p>
          <p className="mt-2 text-sm text-muted-foreground">Try adjusting your difficulty or skill selection.</p>
        </div>
      ) : (
        <div className="space-y-10">
          {grouped.map((section) => (
            <section key={section.key}>
              <div className="mb-5 flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-bold ${section.style}`}
                >
                  {section.icon}
                  {section.label}
                </span>
                <div className="h-px flex-1 bg-border/40" />
                <span className="text-xs text-muted-foreground">{section.description}</span>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {section.campaigns.map((c) => (
                  <CampaignCard
                    key={c.id}
                    campaign={c}
                    isCompleted={completedIds.has(c.id)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
