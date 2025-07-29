'use client';

import React, { useEffect, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  mConStr0,
  MeshTxBuilder,
  UTxO,
} from '@meshsdk/core';
import { getBrowserWallet, getAuctionScript } from '@/utils/common';
import { parseAuctionDatum, AuctionStatus, makeWithdrawRedeemer } from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionInfo {
  object: string;
  deadline: bigint;
  currentBid: bigint;
  utxo: UTxO;
  status: bigint;
  isHighestBid: boolean;
}

export default function AuctionWithdraw() {
  const [auctions, setAuctions] = useState<AuctionInfo[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [bidderUtxos, setBidderUtxos] = useState<UTxO[] | null>(null);
  const [tick, setTick] = useState(0); // for timer refresh
  const [txHash, setTxHash] = useState('');

  // Fetch wallet address once on mount
  useEffect(() => {
    (async () => {
      try {
        const bidderWallet = await getBrowserWallet();
        const [addr] = await bidderWallet.getUsedAddresses();
        const bidderUtxos = await bidderWallet.getUtxos();
        setBidderUtxos(bidderUtxos);
        setWalletAddress(addr);
      } catch {
        setWalletAddress(null);
        setBidderUtxos(null);
      }
    })();
  }, []);

  // Refresh auction list (manual + periodic)
  useEffect(() => {
    if (!walletAddress) return;

    fetchAuctions(); // fetch on load

    const interval = setInterval(() => {
      fetchAuctions(); // periodic fetch every 3s
    }, 3000);

    return () => clearInterval(interval);
  }, [walletAddress]);

  // Force rerender every second for timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  async function fetchAuctions() {
    if (!bidderUtxos) return;
    if (!walletAddress) return;

    const bidderPubKeyHash = deserializeAddress(walletAddress).pubKeyHash;
    const { scriptAddr } = getAuctionScript();

    const scriptUtxos = await provider.fetchAddressUTxOs(scriptAddr);
    const filteredAuctions: AuctionInfo[] = [];

    for (const utxo of scriptUtxos) {
      if (!utxo.output.plutusData) continue;

      try {
        const datum = parseAuctionDatum(utxo.output.plutusData);
        if (datum.status !== 1n) continue;
        if (datum.highestBidder !== bidderPubKeyHash) continue;

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

    // Fetch all STARTED auctions to compare highest bid
    const startedUtxos = await provider.fetchAddressUTxOs(scriptAddr);
    const highestBidsByObject: Record<string, bigint> = {};

    for (const utxo of startedUtxos) {
      if (!utxo.output.plutusData) continue;
      try {
        const datum = parseAuctionDatum(utxo.output.plutusData);
        if (datum.status !== 1n) continue;
        const obj = datum.object;
        const bid = datum.highestBid;
        if (!highestBidsByObject[obj] || bid > highestBidsByObject[obj]) {
          highestBidsByObject[obj] = bid;
        }
      } catch {
        continue;
      }
    }

    const finalList = filteredAuctions.map((auc) => ({
      ...auc,
      isHighestBid: highestBidsByObject[auc.object] === auc.currentBid,
    }));

    setAuctions(finalList);
  }

  function getTimeRemaining(deadline: bigint): string {
    const now = BigInt(Date.now());
    const diff = deadline > now ? deadline - now : 0n;

    const totalSeconds = diff / 1000n;
    const seconds = Number(totalSeconds % 60n);
    const minutes = Number((totalSeconds / 60n) % 60n);
    const hours = Number(totalSeconds / 3600n);

    return `${hours}h ${minutes}m ${seconds}s`;
  }

  async function handleWithdraw() {
    if (!selectedAuction) return;

    setLoading(true);
    try {
      const wallet = await getBrowserWallet();
      const [addr] = await wallet.getUsedAddresses();
      const bidderPubKeyHash = deserializeAddress(addr).pubKeyHash;
      const bidderUtxo = await wallet.getUtxos();

      const { scriptAddr, scriptCbor } = getAuctionScript();

      const utxo = selectedAuction.utxo;
      console.log(utxo);
      const datum = parseAuctionDatum(utxo.output.plutusData!);
      const redeemer = mConStr0([2]);

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });
      if (!bidderUtxos) return;
      txBuilder
        .setNetwork("preview")
        .spendingPlutusScriptV3()
        .txIn(
          utxo.input.txHash,
          utxo.input.outputIndex
        )
        .spendingReferenceTxInInlineDatumPresent()
        .spendingReferenceTxInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        .txInCollateral(
          bidderUtxo[0].input.txHash,
          bidderUtxo[0].input.outputIndex
        )
        .txOut(addr, [{ unit: 'lovelace', quantity: datum.highestBid.toString() }]);

      const unsignedTx = await txBuilder
        .changeAddress(addr)
        .selectUtxosFrom(bidderUtxo)
        .requiredSignerHash(bidderPubKeyHash)
        .complete();

      const signedTx = await wallet.signTx(unsignedTx, true);
      const txHash = await wallet.submitTx(signedTx);
      setTxHash(txHash);
      //alert(`Withdraw successful: ${txHash}`);

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
      {txHash && <p className="text-green-600 mt-2">Withdraw successful! Tx Hash: {txHash}</p>}
    </div>
  );
}
