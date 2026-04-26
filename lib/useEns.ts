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

const BASENAME_CACHE_KEY = "l2earn.basenameByAddress";

function getCachedBasename(address: string): string | null {
  if (globalThis.window === undefined) return null;
  try {
    const raw = localStorage.getItem(BASENAME_CACHE_KEY);
    if (!raw) return null;
    const map = JSON.parse(raw) as Record<string, string>;
    return map[address.toLowerCase()] ?? null;
  } catch {
    return null;
  }
}

function setCachedBasename(address: string, basename: string) {
  if (globalThis.window === undefined) return;
  try {
    const raw = localStorage.getItem(BASENAME_CACHE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[address.toLowerCase()] = basename;
    localStorage.setItem(BASENAME_CACHE_KEY, JSON.stringify(map));
  } catch {
    // Ignore cache write failures.
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, errorMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutId = setTimeout(reject, ms, new Error(errorMessage));
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function resolveBasenameOnSepolia(address: string): Promise<string | null> {
  try {
    return await withTimeout(
      publicClientBaseSepolia.getEnsName({ address: address as `0x${string}` }),
      6000,
      "Basename resolution timeout",
    );
  } catch {
    return null;
  }
}

async function resolveBasenameViaApi(address: string): Promise<string | null> {
  try {
    const res = await fetch(`/api/ens/resolve?query=${encodeURIComponent(address)}&type=address`);
    if (!res.ok) return null;

    const data = (await res.json()) as { ok?: boolean; result?: string | null };
    return data.ok && data.result ? data.result : null;
  } catch {
    return null;
  }
}

async function resolveEnsOnMainnet(address: string): Promise<string | null> {
  try {
    return await withTimeout(
      publicClientMainnet.getEnsName({ address: address as `0x${string}` }),
      7000,
      "ENS resolution timeout",
    );
  } catch {
    return null;
  }
}

async function resolvePreferredName(address: string): Promise<string | null> {
  const sepoliaBasename = await resolveBasenameOnSepolia(address);
  if (sepoliaBasename) return sepoliaBasename;

  const apiBasename = await resolveBasenameViaApi(address);
  if (apiBasename) return apiBasename;

  return resolveEnsOnMainnet(address);
}

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

    const resolveEns = async () => {
      setLoading(true);
      try {
        const cachedBasename = getCachedBasename(address);
        if (cachedBasename && isMounted) {
          setEnsName(cachedBasename);
        }

        const name = await resolvePreferredName(address);

        if (!isMounted) return;

        setEnsName(name ?? cachedBasename ?? null);

        if (name) {
          setCachedBasename(address, name);
        }

        if (name) {
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
        } else {
          setEnsAvatar(null);
        }
      } catch (error) {
        console.debug("ENS lookup failed", error);
        if (isMounted) {
          setEnsName(null);
          setEnsAvatar(null);
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
    };
  }, [address]);

  return { ensName, ensAvatar, loading };
}

export function formatAddress(address: string, ensName?: string | null) {
  if (ensName) return ensName;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
