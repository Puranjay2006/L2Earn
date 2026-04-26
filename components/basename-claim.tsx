"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { AlertCircle, Check, Loader2, ExternalLink } from "lucide-react";

const ENS_USE_TESTNET = true;
const ENS_SUFFIX = ".basetest.eth";

export function BasenameClaim() {
  const { address } = useAccount();
  const [label, setLabel] = useState("");
  const [price, setPrice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

  if (!address) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-700">
            <p className="font-semibold">Connect your wallet to claim a Basename</p>
            <p className="mt-1">Your .basetest.eth name is your on-chain identity.</p>
          </div>
        </div>
      </div>
    );
  }

  const checkPrice = async () => {
    if (!label || label.length < 3) {
      setError("Label must be at least 3 characters");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch(
        `/api/ens/register-price?label=${encodeURIComponent(label)}&years=1&testnet=${ENS_USE_TESTNET}`
      );
      const data = await res.json();

      if (data.ok) {
        setPrice(data.priceEth);
        setResolvedName(data.fullName);
      } else {
        setError(data.error);
        setPrice(null);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to check price");
      setPrice(null);
    } finally {
      setLoading(false);
    }
  };

  const registerBasename = async () => {
    if (!address || !label) return;

    setLoading(true);
    setError(null);
    setTxHash(null);

    try {
      const res = await fetch("/api/ens/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label,
          owner: address,
          years: 1,
          testnet: ENS_USE_TESTNET,
          reverseRecord: true,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        setTxHash(data.txHash);
        setExplorerUrl(data.explorerUrl);
        setLabel("");
        setPrice(null);
        setResolvedName(null);
      } else {
        setError(data.error);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to register basename");
    } finally {
      setLoading(false);
    }
  };

  if (txHash) {
    return (
      <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-6">
        <div className="flex items-start gap-3">
          <Check className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-green-700">Basename Registered!</h3>
            <p className="text-sm text-green-600 mt-2">
              Your new basename {resolvedName} has been registered on Base Sepolia.
            </p>
            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 mt-3 text-sm text-green-600 hover:text-green-700 font-medium"
              >
                View on Basescan
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-primary/20 bg-linear-to-br from-primary/5 to-transparent p-6">
      <div className="mb-4">
        <h3 className="font-semibold text-foreground mb-1">Claim Your Basename</h3>
        <p className="text-sm text-muted-foreground">
          Get your {ENS_SUFFIX} name as your on-chain identity for L2Earn
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor="basename-label" className="block text-sm font-medium text-foreground mb-2">
            Desired name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              id="basename-label"
              value={label}
              onChange={(e) => {
                setLabel(e.target.value.toLowerCase());
                setPrice(null);
              }}
              placeholder="e.g., myname"
              className="flex-1 rounded-lg border border-primary/20 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              disabled={loading}
            />
            <span className="flex items-center text-sm text-muted-foreground px-3 py-2 rounded-lg border border-primary/20 bg-background/50">
              {ENS_SUFFIX}
            </span>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex gap-2">
            <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {price && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
            <p className="text-sm font-medium text-foreground">
              Price: <span className="text-primary">{price} ETH</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              For 1 year registration on Base Sepolia
            </p>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={checkPrice}
            disabled={!label || loading}
            variant="outline"
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Check Price
          </Button>

          <Button
            onClick={registerBasename}
            disabled={!price || loading}
            className="flex-1"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Register
          </Button>
        </div>
      </div>
    </div>
  );
}
