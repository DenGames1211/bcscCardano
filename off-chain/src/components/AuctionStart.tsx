'use client';

import React, { FormEvent, useState } from 'react';
import {
  Asset,
  BlockfrostProvider,
  deserializeAddress,
  MeshTxBuilder,
} from '@meshsdk/core';
import {
  getBrowserWallet,
  getScript,
  getAssetUtxo,
} from '@/utils/common';
import {
  makeAuctionDatum,
  AuctionStatus,
  makeStartRedeemer,
} from '@/utils/auction';

const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_KEY!);

interface AuctionStartProps {
  object: string;
  deadline: bigint;
}

export default function AuctionStart({ object, deadline }: AuctionStartProps) {
  const [startingBid, setStartingBid] = useState<string>('100000000'); // default: 100 ADA
  const [txHash, setTxHash] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    try {
      const sellerWallet = await getBrowserWallet();
      const sellerUtxos = await sellerWallet.getUtxos();
      const [addr] = await sellerWallet.getUsedAddresses();

      const { scriptCbor, scriptAddr } = getScript();
      const sellerPubKeyHash = deserializeAddress(addr).pubKeyHash;

      const startingBidBigInt = BigInt(startingBid);

      const datum = makeAuctionDatum(
        sellerPubKeyHash,
        object,
        deadline,
        AuctionStatus.STARTED,
        sellerPubKeyHash,
        startingBidBigInt
      );

      const deployDatum = makeAuctionDatum(
        sellerPubKeyHash,
        object,
        deadline,
        AuctionStatus.NOT_STARTED,
        '',
        0n
      );

      const redeemer = makeStartRedeemer();

      const assets: Asset[] = [
        { unit: 'lovelace', quantity: startingBidBigInt.toString() },
      ];

      const sellerAssets: Asset[] = [
        { unit: 'lovelace', quantity: '2000000' },
      ];

      const deployUtxos = await getAssetUtxo({
        scriptAddress: scriptAddr,
        asset: 'lovelace',
        datum: deployDatum,
      });

      if (!deployUtxos) {
        throw new Error('No matching UTxO found with the given datum.');
      }

      const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

      const unsignedTx = await txBuilder
        .spendingPlutusScriptV3()
        .txIn(deployUtxos.input.txHash, deployUtxos.input.outputIndex)
        //.txInDatumValue(deployDatum)
        .txInInlineDatumPresent()
        .txInRedeemerValue(redeemer)
         .txInCollateral(sellerUtxos[0].input.txHash, sellerUtxos[0].input.outputIndex)
        .txInScript(scriptCbor)
        .txOut(scriptAddr, assets)
        .txOutInlineDatumValue(datum)
        .txOut(addr, sellerAssets)
        .changeAddress(addr)
        .selectUtxosFrom(sellerUtxos)
        .requiredSignerHash(sellerPubKeyHash)
        .complete();

      const signedTx = await sellerWallet.signTx(unsignedTx, true);
      const txHash = await sellerWallet.submitTx(signedTx);
      setTxHash(txHash || 'Transaction sent!');
    } catch (err: any) {
      console.error(err);
      alert(`Start failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {/* Read-only Display of Object & Deadline */}
      <div className="text-sm text-gray-700">
        <p><strong>Object:</strong> {object}</p>
        <p><strong>Deadline:</strong> {deadline.toString()}</p>
      </div>

      {/* Input for Starting Bid */}
      <input
        type="number"
        placeholder="Initial Bid (lovelace)"
        value={startingBid}
        onChange={(e) => setStartingBid(e.target.value)}
        required
        className="border rounded-lg px-3 py-2"
      />

      <button
        type="submit"
        disabled={loading}
        className="bg-green-600 text-white rounded-xl py-2 font-semibold hover:bg-green-700 transition duration-200 disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Start Auction'}
      </button>

      {/* Tx Hash Output */}
      {txHash && (
        <div className="mt-2 text-sm text-green-700 break-words">
          <strong>Transaction submitted:</strong> {txHash}
        </div>
      )}
    </form>
  );
}
