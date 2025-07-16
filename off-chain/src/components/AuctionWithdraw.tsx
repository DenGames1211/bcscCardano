'use client';

import React, { useEffect, useState, FormEvent } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  MeshTxBuilder,
  UTxO,
} from '@meshsdk/core';
import { deserializePlutusData } from '@meshsdk/core-csl';
import { getBrowserWallet, getScript } from '@/utils/common';
import { parseAuctionDatum, AuctionStatus, makeWithdrawRedeemer } from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionInfo {
  object: string;
  deadline: bigint;
  currentBid: bigint;
  utxo: UTxO;
  status: number;
  isHighestBid: boolean;
}

export default function AuctionWithdraw() {
  const [auctions, setAuctions] = useState<AuctionInfo[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);

  // Fetch wallet address
  useEffect(() => {
    (async () => {
      try {
        const wallet = await getBrowserWallet();
        const [addr] = await wallet.getUsedAddresses();
        setWalletAddress(addr);
      } catch {
        setWalletAddress(null);
      }
    })();
  }, []);

  // Fetch auctions for which the connected wallet has an OUTBID bid
  async function fetchAuctions() {
    if (!walletAddress) return;

    const bidderPubKeyHash = deserializeAddress(walletAddress).pubKeyHash;
    const { scriptAddr } = getScript();

    const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddr);
    const filteredAuctions: AuctionInfo[] = [];

    for (const utxo of scriptUtxos) {
      if (!utxo.output.plutusData) continue;

      try {
        const datum = parseAuctionDatum(utxo.output.plutusData);
        if (datum.status !== AuctionStatus.OUTBID) continue;
        if (datum.highestBidder !== bidderPubKeyHash) continue; // Not bidder's outbid UTxO

        // Only keep auctions where this wallet has an OUTBID bid
        filteredAuctions.push({
          object: datum.object,
          deadline: datum.deadline,
          currentBid: datum.highestBid,
          utxo,
          status: datum.status,
          isHighestBid: false,
        });
      } catch {
        continue;
      }
    }

    // To identify which one is the highest bid for this user, fetch all STARTED auctions too
    const startedUtxos = await provider.fetchAddressUTxOs(scriptAddr);
    const highestBidsByObject: Record<string, bigint> = {};

    for (const utxo of startedUtxos) {
      if (!utxo.output.plutusData) continue;
      try {
        const datum = parseAuctionDatum(utxo.output.plutusData);
        if (datum.status !== AuctionStatus.STARTED) continue;
        const obj = datum.object;
        const bid = datum.highestBid;
        if (!highestBidsByObject[obj] || bid > highestBidsByObject[obj]) {
          highestBidsByObject[obj] = bid;
        }
      } catch {
        continue;
      }
    }

    // Mark auctions where user's outbid is actually the highest bid (rare case)
    const finalList = filteredAuctions.map((auc) => ({
      ...auc,
      isHighestBid: highestBidsByObject[auc.object] === auc.currentBid,
    }));

    setAuctions(finalList);
  }

  useEffect(() => {
    if (walletAddress) {
      fetchAuctions();
    }
  }, [walletAddress]);

  // Calculate time remaining in seconds
  function getTimeRemaining(deadline: bigint): string {
    const now = BigInt(Math.floor(Date.now() / 1000));
    const diff = deadline > now ? deadline - now : 0n;
    const seconds = Number(diff % 60n);
    const minutes = Number((diff / 60n) % 60n);
    const hours = Number(diff / 3600n);
    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async function handleWithdraw() {
    if (!selectedAuction) return;

    setLoading(true);
    try {
      const wallet = await getBrowserWallet();
      const [addr] = await wallet.getUsedAddresses();
      const bidderPubKeyHash = deserializeAddress(addr).pubKeyHash;

      const { scriptAddr, scriptCbor } = getScript();

      const utxo = selectedAuction.utxo;
      const datum = parseAuctionDatum(utxo.output.plutusData!);

      // Build transaction to withdraw outbid amount

      // Redeemer for withdraw action
      const redeemer = makeWithdrawRedeemer();

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

      txBuilder
        .spendingPlutusScriptV3()
        .txIn(utxo.input.txHash, utxo.input.outputIndex)
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        .txInCollateral(utxo.input.txHash, utxo.input.outputIndex) // You probably want to add a real collateral from wallet utxos here instead
        .txOut(addr, [{ unit: 'lovelace', quantity: datum.highestBid.toString() }]);

      const unsignedTx = await txBuilder
        .changeAddress(addr)
        .requiredSignerHash(bidderPubKeyHash)
        .complete();

      const signedTx = await wallet.signTx(unsignedTx, true);
      const txHash = await wallet.submitTx(signedTx);
      alert(`Withdraw successful: ${txHash}`);

      setSelectedAuction(null);
      fetchAuctions();
    } catch (e: any) {
      alert(`Withdraw failed: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-4">

  {!walletAddress && <p>Connect your wallet to see your outbid auctions.</p>}

  {walletAddress && auctions.length === 0 && (
    <p className="text-center text-gray-500 mt-6">No active outbid auctions found.</p>
  )}

  <ul>
    {auctions.map((auc, idx) => (
      <li
        key={idx}
        onClick={() => setSelectedAuction(auc)}
        className={`cursor-pointer p-2 mb-2 border rounded
          ${selectedAuction === auc ? 'border-blue-500' : 'border-gray-300'}
          ${auc.isHighestBid ? 'bg-green-200' : 'bg-red-200'}
        `}
      >
        <div><strong>Object:</strong> {auc.object}</div>
        <div><strong>Remaining time:</strong> {getTimeRemaining(auc.deadline)}</div>
        <div><strong>Bid:</strong> {auc.currentBid.toString()} lovelace</div>
      </li>
    ))}
  </ul>

  <button
    className="mt-4 w-full bg-blue-600 text-white p-2 rounded disabled:opacity-50"
    disabled={!selectedAuction || loading}
    onClick={handleWithdraw}
  >
    {loading ? 'Withdrawing...' : 'Withdraw'}
  </button>
</div>
  );
}
