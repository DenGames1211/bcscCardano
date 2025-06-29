import React, { useEffect, useState } from "react";
import { BrowserWallet } from "@meshsdk/core";

export default function ConnectWallet() {
  const [wallet, setWallet]     = useState<BrowserWallet | null>(null);
  const [address, setAddress]   = useState<string>("");
  const [error, setError]       = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);

  const truncate = (str: string) =>
    str.length > 10
      ? `${str.slice(0, 15)}…${str.slice(-5)}`
      : str;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const injected = (window as any).cardano;
    if (!injected?.lace) {
      setError("Lace wallet extension not found. Please install/enable it.");
      setLoading(false);
      return;
    }

    // Enable the wallet, then grab addresses
    BrowserWallet.enable("lace")
      .then((w) => {
        setWallet(w);
        return w.getUsedAddresses();
      })
      .then((addrs) => {
        if (addrs.length === 0) {
          setError("No used addresses returned by wallet.");
        } else {
          setAddress(addrs[0]);
        }
      })
      .catch((e: any) => {
        setError(e?.message || "User denied connection or unknown error");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  if (loading) {
    return <div>⏳ Connecting to Lace…</div>;
  }

  if (error) {
    return <div style={{ color: "red" }}>❌ {error}</div>;
  }

  return (
    <div>
      ✅ Connected!<br/>
      Address: <code>{truncate(address)}</code>
    </div>
  );
}
