import { useEffect, useState } from "react";
import { createPublicClient, http } from "viem";
import { mainnet, baseSepolia } from "viem/chains";

const publicClientMainnet = createPublicClient({
  chain: mainnet,
  transport: http(
    process.env.NEXT_PUBLIC_RPC_URL || "https://eth-mainnet.public.blastapi.io"
  ),
});

const publicClientBaseSepolia = createPublicClient({
  chain: baseSepolia,
  transport: http("https://sepolia.base.org"),
});

export function useEns(address?: string) {
  const [ensName, setEnsName] = useState<string | null>(null);
  const [ensAvatar, setEnsAvatar] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setEnsName(null);
      setEnsAvatar(null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

    const resolveEns = async () => {
      setLoading(true);
      try {
        // Try Base Sepolia Basename first
        try {
          const basenamePromise = publicClientBaseSepolia.getEnsName({
            address: address as `0x${string}`,
          });

          const basename = await Promise.race([
            basenamePromise,
            new Promise<null>((_, reject) =>
              setTimeout(() => reject(new Error("Basename resolution timeout")), 2500)
            ),
          ]);

          if (basename && isMounted) {
            setEnsName(basename);
            setLoading(false);
            return;
          }
        } catch {
          // Basename lookup failed, try mainnet ENS
        }

        // Try mainnet ENS as fallback
        const ensPromise = publicClientMainnet.getEnsName({
          address: address as `0x${string}`,
        });

        const name = await Promise.race([
          ensPromise,
          new Promise<null>((_, reject) =>
            setTimeout(
              () => reject(new Error("ENS resolution timeout")),
              4500
            )
          ),
        ]);

        if (!isMounted) return;

        if (name) {
          setEnsName(name);

          try {
            const avatar = await publicClientMainnet.getEnsAvatar({
              name,
            });
            if (avatar && isMounted) {
              setEnsAvatar(avatar);
            }
          } catch {
            // Avatar resolution failed, continue without it
          }
        }
      } catch (error) {
        // Silently fail - ENS is optional, just show truncated address
        if (isMounted) {
          setEnsName(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    resolveEns();

    return () => {
      isMounted = false;
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [address]);

  return { ensName, ensAvatar, loading };
}

export function formatAddress(address: string, ensName?: string | null) {
  if (ensName) return ensName;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
