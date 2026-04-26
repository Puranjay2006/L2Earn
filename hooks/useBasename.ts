import { useEffect, useState } from "react";

export function useBasename(address: string | undefined, testnet: boolean = true) {
  const [basename, setBasename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!address) {
      setBasename(null);
      return;
    }

    setLoading(true);

    fetch(
      `/api/ens/resolve?query=${encodeURIComponent(address)}&type=address&testnet=${testnet}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.ok && data.result) {
          setBasename(data.result);
        } else {
          setBasename(null);
        }
      })
      .catch(() => setBasename(null))
      .finally(() => setLoading(false));
  }, [address, testnet]);

  return { basename, loading };
}
