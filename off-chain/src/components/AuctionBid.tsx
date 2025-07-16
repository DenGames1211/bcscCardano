'use client';

import React, { FormEvent, useEffect, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  MeshTxBuilder,
  UTxO,
  deserializeAddress,
} from '@meshsdk/core';
import { deserializePlutusData } from '@meshsdk/core-csl';
import { getBrowserWallet, getScript } from '@/utils/common';
import { makeAuctionDatum, AuctionStatus, makeBidRedeemer } from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionInfo {
  object: string;
  deadline: bigint;
  currentBid: bigint;
  utxo: UTxO;
}

function parseAuctionDatum(datumHex: string) {
  const datum = deserializePlutusData(datumHex);
  const constr = datum.as_constr_plutus_data();
  if (!constr) throw new Error('Not a constructor datum');

  const fields = constr.data();

  const sellerBytes = fields.get(0)?.as_bytes();
  const objectBytes = fields.get(1)?.as_bytes();
  const deadlineInt = fields.get(2)?.as_integer()?.as_int();
  const statusTag = fields.get(3)?.as_constr_plutus_data()?.alternative().to_str();
  const highestBidderBytes = fields.get(4)?.as_bytes();
  const highestBidInt = fields.get(5)?.as_integer()?.as_int();

  if (!sellerBytes || !objectBytes || !highestBidderBytes || !statusTag || !deadlineInt || !highestBidInt) {
    throw new Error('Invalid datum structure');
  }

  return {
    seller: Buffer.from(sellerBytes).toString('hex'),
    object: Buffer.from(objectBytes).toString('utf8'),
    deadline: BigInt(deadlineInt.to_str()),
    status: Number(statusTag),
    highestBidder: Buffer.from(highestBidderBytes).toString('hex'),
    highestBid: BigInt(highestBidInt.to_str()),
  };
}

export default function AuctionBid() {
  const [bid, setBid] = useState('100000000');
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [auctions, setAuctions] = useState<AuctionInfo[]>([]);
  const [selectedAuction, setSelectedAuction] = useState<AuctionInfo | null>(null);

  const fetchAuctions = async () => {
    const { scriptAddr } = getScript();
    const utxos = await provider.fetchAddressUTxOs(scriptAddr);
    const startedAuctions: AuctionInfo[] = [];

    for (const utxo of utxos) {
      try {
        const datumHex = utxo.output.plutusData;
        if (!datumHex) continue;
        const parsed = parseAuctionDatum(datumHex);
        if (parsed.status !== AuctionStatus.STARTED) continue;

        startedAuctions.push({
          object: parsed.object,
          deadline: parsed.deadline!,
          currentBid: parsed.highestBid!,
          utxo,
        });
      } catch {
        continue;
      }
    }

    setAuctions(startedAuctions);
  };

  useEffect(() => {
    fetchAuctions();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAuction) return;
    setLoading(true);

    try {
      const bidderWallet = await getBrowserWallet();
      const bidderUtxos = await bidderWallet.getUtxos();
      const [addr] = await bidderWallet.getUsedAddresses();
      const bidderPubKeyHash = deserializeAddress(addr).pubKeyHash;
      const bidBigInt = BigInt(bid);

      const { scriptAddr, scriptCbor } = getScript();
      const auctionUtxo = selectedAuction.utxo;
      const parsed = parseAuctionDatum(auctionUtxo.output.plutusData!);

      if (bidBigInt <= parsed.highestBid!) {
        throw new Error('Your bid must be higher than the current highest.');
      }

      const redeemer = makeBidRedeemer();

      const newDatum = makeAuctionDatum(
        parsed.seller,
        parsed.object,
        parsed.deadline!,
        AuctionStatus.STARTED,
        bidderPubKeyHash,
        bidBigInt
      );

      const assets: Asset[] = [
        { unit: 'lovelace', quantity: bidBigInt.toString() },
      ];

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

      txBuilder
        .spendingPlutusScriptV3()
        .txIn(auctionUtxo.input.txHash, auctionUtxo.input.outputIndex)
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
        .txInScript(scriptCbor)
        .txInCollateral(bidderUtxos[0].input.txHash, bidderUtxos[0].input.outputIndex)
        .txOut(scriptAddr, assets)
        .txOutInlineDatumValue(newDatum);

      if (parsed.highestBid! > 100000000n) {
        const outbidDatum = makeAuctionDatum(
          parsed.seller,
          parsed.object,
          parsed.deadline!,
          AuctionStatus.OUTBID,
          parsed.highestBidder,
          parsed.highestBid!
        );

        const outbidAssets: Asset[] = [
          { unit: 'lovelace', quantity: parsed.highestBid!.toString() },
        ];

        txBuilder
          .txOut(scriptAddr, outbidAssets)
          .txOutInlineDatumValue(outbidDatum);
      }

      const unsignedTx = await txBuilder
        .changeAddress(addr)
        .selectUtxosFrom(bidderUtxos)
        .requiredSignerHash(bidderPubKeyHash)
        .complete();

      const signedTx = await bidderWallet.signTx(unsignedTx, true);
      const submittedHash = await bidderWallet.submitTx(signedTx);
      setTxHash(submittedHash);
      fetchAuctions();
    } catch (err: any) {
      console.error(err);
      alert(`Bid failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <ul className="border rounded p-4">
        {auctions.map((auction, idx) => (
          <li
            key={idx}
            className={`p-2 border-b cursor-pointer hover:bg-gray-100 ${selectedAuction?.object === auction.object ? 'bg-blue-100' : ''}`}
            onClick={() => setSelectedAuction(auction)}
          >
            <strong>{auction.object}</strong> — Current bid: {auction.currentBid.toString()} — Ends: {new Date(Number(auction.deadline) * 1000).toLocaleString()}
          </li>
        ))}
      </ul>

      <form onSubmit={handleSubmit} className="space-y-4">
        <label className="block">
          Bid Amount (lovelace):
          <input
            type="number"
            value={bid}
            onChange={(e) => setBid(e.target.value)}
            className="border p-2 w-full rounded"
          />
        </label>
        <button
          type="submit"
          disabled={loading || !selectedAuction}
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Place Bid'}
        </button>
        {txHash && <p className="text-green-600 mt-2">Tx Hash: {txHash}</p>}
      </form>
    </div>
  );
}