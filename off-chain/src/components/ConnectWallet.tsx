// src/components/ConnectWallet.tsx
import React, { useEffect, useState } from 'react';
import { initLucid } from '@/utils/lucid';

export default function ConnectWallet() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const lucid = await initLucid();
        if (typeof window !== 'undefined' && window.cardano) {
          // Trova il wallet Lace o Nami compatibile
          const wallet = window.cardano.lace || window.cardano.nami || Object.values(window.cardano).find((w: any) => w.name === 'Nami' || w.name === 'Lace');
          
          if (!wallet) throw new Error('Wallet compatibile non trovato');

          const api = await wallet.enable();
          lucid.selectWallet(api);
          
          const addr = await lucid.wallet.address();
          setAddress(addr);
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    })();
  }, []);

  const handleConnect = async () => {
    try {
      const lucid = await initLucid();
      const api = await window.cardano.nami.enable();
      lucid.selectWallet(api);
      const addr = await lucid.wallet.address();
      setAddress(addr);
      setConnected(true);
    } catch (error) {
      console.error('Connessione wallet fallita', error);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {connected && address ? (
        <span className="text-sm font-medium">Wallet: {address.slice(0, 6)}...{address.slice(-6)}</span>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Connetti Wallet
        </button>
      )}
    </div>
  );
}
